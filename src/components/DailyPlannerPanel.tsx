import { useEffect, useMemo, useState, type FC } from "react";
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
  loadAllSessions,
  loadDailyGoals,
  loadDailyPlan,
  saveDailyGoals,
  saveDailyPlan,
  startStudySession,
  syncPlannerWithAccepted,
  toDateKey,
  type DailyGoalConfig,
  type DailyPlan,
  type PlannerTask,
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
  const [plan, setPlan] = useState<DailyPlan>(() =>
    loadDailyPlan(userId, toDateKey())
  );
  const [goals, setGoals] = useState<DailyGoalConfig>(() =>
    loadDailyGoals(userId)
  );
  const [problemQuery, setProblemQuery] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [revisionTitle, setRevisionTitle] = useState("");

  const reload = () => {
    const accepted = everAcceptedProblemIds(submissions);
    const synced = syncPlannerWithAccepted(userId, dateKey, accepted);
    setPlan(synced);
    setGoals(loadDailyGoals(userId));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dateKey, submissions, refreshKey]);

  const sessions = useMemo(() => loadAllSessions(userId), [userId, refreshKey]);
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

  const persist = (next: DailyPlan) => {
    saveDailyPlan(userId, next);
    setPlan(next);
    onPlanChange?.();
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
    persist({ ...plan, tasks, updatedAt: Date.now() });
  };

  const removeTask = (id: string) => {
    persist({
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
    persist({
      ...plan,
      tasks: [...plan.tasks, task],
      updatedAt: Date.now(),
    });
  };

  const handleAddProblem = (p: Problem) => {
    const id = (p.id || p._id || "").toString();
    const next = addPlannerProblem(userId, dateKey, {
      id,
      title: p.title,
      slug: p.slug,
    });
    const accepted = everAcceptedProblemIds(submissions);
    const synced = syncPlannerWithAccepted(userId, dateKey, accepted);
    setPlan(synced.tasks.length ? synced : next);
    setProblemQuery("");
    onPlanChange?.();
  };

  const saveGoals = (next: DailyGoalConfig) => {
    setGoals(next);
    saveDailyGoals(userId, next);
    onPlanChange?.();
  };

  const handleStartFromPlanner = () => {
    const topicTask = plan.tasks.find(
      (t) => t.type === "revision" || t.type === "session"
    );
    const topic = topicTask?.title || "General";
    startStudySession(userId, topic);
    onStartSession?.(topic);
    onPlanChange?.();
  };

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <ListTodo size={22} /> Daily Planner
          </h1>
          <p>Plan problems, revisions, and sessions — auto-synced with Accepted.</p>
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
                onChange={(e) =>
                  saveGoals({
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
                onChange={(e) =>
                  saveGoals({
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
                onChange={(e) =>
                  saveGoals({
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
                onChange={(e) =>
                  saveGoals({
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
              <span>Completed</span>
            </div>
            <div>
              <strong>{day?.sessionsCompleted || 0}</strong>
              <span>Sessions</span>
            </div>
            <div>
              <strong>{formatDurationMs(studyDisplay)}</strong>
              <span>Study time</span>
            </div>
          </div>
        </section>

        <section className="learn-card">
          <div className="learn-card-head">
            <h2>Quick add</h2>
            <button
              type="button"
              className="learn-primary-btn compact"
              onClick={handleStartFromPlanner}
            >
              Start Session
            </button>
          </div>

          <label className="learn-field">
            Add problem
            <input
              value={problemQuery}
              onChange={(e) => setProblemQuery(e.target.value)}
              placeholder="Search problems…"
            />
          </label>
          {suggestions.length > 0 && (
            <ul className="learn-suggest-list">
              {suggestions.map((p) => (
                <li key={p.id || p._id}>
                  <button type="button" onClick={() => handleAddProblem(p)}>
                    <Plus size={14} /> {p.title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="learn-add-row">
            <input
              value={revisionTitle}
              onChange={(e) => setRevisionTitle(e.target.value)}
              placeholder="Revision topic…"
            />
            <button
              type="button"
              onClick={() => {
                addCustom("revision", revisionTitle);
                setRevisionTitle("");
              }}
            >
              Add revision
            </button>
          </div>
          <div className="learn-add-row">
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Custom goal / mock session…"
            />
            <button
              type="button"
              onClick={() => {
                addCustom("custom", customTitle);
                setCustomTitle("");
              }}
            >
              Add task
            </button>
          </div>
        </section>
      </div>

      <section className="learn-card">
        <h2>Planned for {dateKey}</h2>
        {plan.tasks.length === 0 ? (
          <p className="learn-empty">Your day is empty. Add your first task.</p>
        ) : (
          <ul className="learn-planner-list">
            {plan.tasks.map((t, idx) => {
              const problem =
                t.problemId &&
                problems.find(
                  (p) => (p.id || p._id || "").toString() === t.problemId
                );
              return (
                <li key={t.id} className={t.completed ? "done" : ""}>
                  <button
                    type="button"
                    className="learn-check"
                    aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                    onClick={() => toggleTask(t.id)}
                  >
                    {t.completed ? <Check size={14} /> : null}
                  </button>
                  <div className="learn-planner-body">
                    <span className="learn-planner-idx">{idx + 1}.</span>
                    {problem ? (
                      <button
                        type="button"
                        className="learn-link-btn"
                        onClick={() => onSelectProblem(problem)}
                      >
                        {t.title}
                      </button>
                    ) : (
                      <span>{t.title}</span>
                    )}
                    <span className="learn-task-type">{t.type}</span>
                    {t.completedSource === "submission" && (
                      <span className="learn-auto-tag">auto</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="learn-icon-btn"
                    aria-label="Remove task"
                    onClick={() => removeTask(t.id)}
                  >
                    <Trash size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
