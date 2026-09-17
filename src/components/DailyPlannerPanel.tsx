import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
  Check,
  ListTodo,
  Plus,
  Target,
  Trash,
} from "lucide-react";
import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import {
  addPlannerProblem,
  formatDurationMs,
  LearningPersistError,
  loadAllSessions,
  loadDailyGoals,
  saveDailyGoals,
  saveDailyPlan,
  startStudySession,
  syncPlannerWithAccepted,
  toDateKey,
  type DailyGoalConfig,
  type DailyPlan,
  type PlannerTask,
  type StudySession,
  DEFAULT_GOALS,
} from "../utils/learningPersistence";
import {
  buildDayActivityMap,
  everAcceptedProblemIds,
} from "../utils/learningStats";

interface Props {
  userId?: string;
  problems: Problem[];
  submissions: Submission[];
  refreshKey?: number;
  onSelectProblem: (p: Problem) => void;
  onStartSession?: (topic: string) => void;
  onPlanChange?: () => void;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DailyPlannerPanel: FC<Props> = ({
  userId,
  problems,
  submissions,
  refreshKey = 0,
  onSelectProblem,
  onStartSession,
  onPlanChange,
}) => {
  const [dateKey, setDateKey] = useState(toDateKey());
  const [plan, setPlan] = useState<DailyPlan>({
    date: toDateKey(),
    tasks: [],
    updatedAt: Date.now(),
  });
  const [goals, setGoals] = useState<DailyGoalConfig>({ ...DEFAULT_GOALS });
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problemQuery, setProblemQuery] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [revisionTitle, setRevisionTitle] = useState("");

  const reload = useCallback(async () => {
    if (!userId) {
      setPlan({ date: dateKey, tasks: [], updatedAt: Date.now() });
      setGoals({ ...DEFAULT_GOALS });
      setSessions([]);
      setLoading(false);
      setError("Sign in to sync your planner across devices.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const accepted = everAcceptedProblemIds(submissions);
      const [synced, nextGoals, nextSessions] = await Promise.all([
        syncPlannerWithAccepted(userId, dateKey, accepted),
        loadDailyGoals(userId),
        loadAllSessions(userId),
      ]);
      setPlan(synced);
      setGoals(nextGoals);
      setSessions(nextSessions);
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Failed to load planner"
      );
    } finally {
      setLoading(false);
    }
  }, [userId, dateKey, submissions]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const activity = useMemo(
    () => buildDayActivityMap(submissions, sessions),
    [submissions, sessions]
  );
  const day = activity.get(dateKey);

  const problemTasks = plan.tasks.filter((t) => t.type === "problem");
  const completedProblems = problemTasks.filter((t) => t.completed).length;
  const goalProblems = goals.problemsPerDay;
  const remaining = Math.max(0, goalProblems - completedProblems);
  const pct = goalProblems
    ? Math.min(100, Math.round((completedProblems / goalProblems) * 1000) / 10)
    : 0;

  const studyDisplay = day?.studyMs || 0;

  const suggestions = useMemo(() => {
    const q = problemQuery.trim().toLowerCase();
    if (!q) return [];
    return problems
      .filter((p) => p.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [problems, problemQuery]);

  const persist = async (next: DailyPlan) => {
    const prev = plan;
    setPlan(next);
    setSaving(true);
    setError(null);
    try {
      const saved = await saveDailyPlan(userId, next);
      setPlan(saved);
      onPlanChange?.();
    } catch (err) {
      setPlan(prev);
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Failed to save plan"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = (id: string) => {
    const tasks = plan.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            completed: !t.completed,
            completedSource: "manual" as const,
          }
        : t
    );
    void persist({ ...plan, tasks, updatedAt: Date.now() });
  };

  const removeTask = (id: string) => {
    void persist({
      ...plan,
      tasks: plan.tasks.filter((t) => t.id !== id),
      updatedAt: Date.now(),
    });
  };

  const addCustom = (type: PlannerTask["type"], title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const task: PlannerTask = {
      id: uid(),
      type,
      title: trimmed,
      completed: false,
      createdAt: Date.now(),
    };
    void persist({
      ...plan,
      tasks: [...plan.tasks, task],
      updatedAt: Date.now(),
    });
  };

  const handleAddProblem = async (p: Problem) => {
    const id = (p.id || p._id || "").toString();
    setSaving(true);
    setError(null);
    try {
      const next = await addPlannerProblem(userId, dateKey, {
        id,
        title: p.title,
        slug: p.slug,
      });
      const accepted = everAcceptedProblemIds(submissions);
      const synced = await syncPlannerWithAccepted(userId, dateKey, accepted);
      setPlan(synced.tasks.length ? synced : next);
      setProblemQuery("");
      onPlanChange?.();
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Failed to add problem"
      );
    } finally {
      setSaving(false);
    }
  };

  const saveGoals = async (next: DailyGoalConfig) => {
    const prev = goals;
    setGoals(next);
    setSaving(true);
    setError(null);
    try {
      const saved = await saveDailyGoals(userId, next);
      setGoals(saved);
      onPlanChange?.();
    } catch (err) {
      setGoals(prev);
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Failed to save goals"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStartFromPlanner = async () => {
    const topicTask = plan.tasks.find(
      (t) => t.type === "revision" || t.type === "session"
    );
    const topic = topicTask?.title || "General";
    setError(null);
    try {
      await startStudySession(userId, topic);
      onStartSession?.(topic);
      onPlanChange?.();
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Failed to start session"
      );
    }
  };

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <ListTodo size={22} /> Daily Planner
          </h1>
          <p>
            Plan problems, revisions, and sessions — auto-synced with Accepted.{" "}
            <span style={{ color: "var(--text-muted)" }}>
              Synced to your account (multi-device).
            </span>
          </p>
        </div>
        <label className="learn-field inline">
          Date
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value || toDateKey())}
          />
        </label>
      </header>

      {error ? (
        <div className="learn-card" style={{ marginBottom: 12, color: "var(--danger, #b91c1c)" }}>
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="learn-card">Loading planner…</div>
      ) : null}
      {saving ? (
        <div className="learn-muted" style={{ marginBottom: 8 }}>
          Saving…
        </div>
      ) : null}

      <div className="learn-grid-2">
        <section className="learn-card">
          <div className="learn-card-head">
            <h2>
              <Target size={16} /> Today&apos;s Goal
            </h2>
          </div>
          <div className="learn-goals-grid">
            <label>
              Problems / day
              <input
                type="number"
                min={1}
                max={50}
                value={goals.problemsPerDay}
                disabled={!userId || saving}
                onChange={(e) =>
                  void saveGoals({
                    ...goals,
                    problemsPerDay: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </label>
            <label>
              Study minutes
              <input
                type="number"
                min={15}
                max={600}
                value={goals.studyMinutes}
                disabled={!userId || saving}
                onChange={(e) =>
                  void saveGoals({
                    ...goals,
                    studyMinutes: Math.max(15, Number(e.target.value) || 15),
                  })
                }
              />
            </label>
            <label>
              Revision topics
              <input
                type="number"
                min={0}
                max={10}
                value={goals.revisionTopics}
                disabled={!userId || saving}
                onChange={(e) =>
                  void saveGoals({
                    ...goals,
                    revisionTopics: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
            <label>
              Sessions / day
              <input
                type="number"
                min={0}
                max={10}
                value={goals.sessionsPerDay}
                disabled={!userId || saving}
                onChange={(e) =>
                  void saveGoals({
                    ...goals,
                    sessionsPerDay: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
          </div>

          <div className="learn-progress-meta">
            Problems: {completedProblems} / {goalProblems} · {pct}%
            {remaining > 0 ? ` · ${remaining} remaining` : " · Goal met"}
          </div>
          <div className="learn-progress-bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="learn-day-stats" style={{ marginTop: 12 }}>
            <div>
              <strong>{completedProblems}</strong>
              <span>solved today</span>
            </div>
            <div>
              <strong>{formatDurationMs(studyDisplay)}</strong>
              <span>study time</span>
            </div>
          </div>
          <button
            type="button"
            className="learn-btn primary"
            style={{ marginTop: 12 }}
            disabled={!userId || saving}
            onClick={() => void handleStartFromPlanner()}
          >
            Start study session
          </button>
        </section>

        <section className="learn-card">
          <div className="learn-card-head">
            <h2>Add to plan</h2>
          </div>
          <label className="learn-field">
            Problem
            <input
              value={problemQuery}
              onChange={(e) => setProblemQuery(e.target.value)}
              placeholder="Search problems…"
              disabled={!userId}
            />
          </label>
          {suggestions.length > 0 && (
            <ul className="learn-suggest">
              {suggestions.map((p) => (
                <li key={String(p.id || p._id)}>
                  <button
                    type="button"
                    disabled={!userId || saving}
                    onClick={() => void handleAddProblem(p)}
                  >
                    <Plus size={14} /> {p.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="learn-inline-add">
            <input
              value={revisionTitle}
              onChange={(e) => setRevisionTitle(e.target.value)}
              placeholder="Revision topic"
              disabled={!userId}
            />
            <button
              type="button"
              disabled={!userId || saving}
              onClick={() => {
                addCustom("revision", revisionTitle);
                setRevisionTitle("");
              }}
            >
              Add
            </button>
          </div>
          <div className="learn-inline-add">
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Custom task"
              disabled={!userId}
            />
            <button
              type="button"
              disabled={!userId || saving}
              onClick={() => {
                addCustom("custom", customTitle);
                setCustomTitle("");
              }}
            >
              Add
            </button>
          </div>
        </section>
      </div>

      <section className="learn-card" style={{ marginTop: 16 }}>
        <div className="learn-card-head">
          <h2>Tasks · {dateKey}</h2>
        </div>
        {plan.tasks.length === 0 ? (
          <p className="learn-muted">No tasks for this day yet.</p>
        ) : (
          <ul className="learn-planner-list">
            {plan.tasks.map((t, idx) => (
              <li key={t.id} className={t.completed ? "done" : undefined}>
                <button
                  type="button"
                  className="learn-check"
                  disabled={!userId || saving}
                  onClick={() => toggleTask(t.id)}
                  aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {t.completed ? <Check size={14} /> : null}
                </button>
                <div className="learn-planner-body">
                  <span className="learn-planner-idx">{idx + 1}.</span>
                  {t.type === "problem" && t.problemId ? (
                    <button
                      type="button"
                      className="learn-link"
                      onClick={() => {
                        const p = problems.find(
                          (x) =>
                            String(x.id || x._id) === String(t.problemId)
                        );
                        if (p) onSelectProblem(p);
                      }}
                    >
                      {t.title}
                    </button>
                  ) : (
                    <span>{t.title}</span>
                  )}
                  <span className="learn-muted">{t.type}</span>
                </div>
                <button
                  type="button"
                  className="learn-icon-btn"
                  disabled={!userId || saving}
                  onClick={() => removeTask(t.id)}
                  aria-label="Remove task"
                >
                  <Trash size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
