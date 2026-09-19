import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import {
  addPlannerProblem,
  formatDurationMs,
  LearningPersistError,
  loadActiveSession,
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
import { cn } from "../lib/cn";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import "./companies/companies.css";
import "./planner.css";

interface Props {
  userId?: string;
  problems: Problem[];
  submissions: Submission[];
  refreshKey?: number;
  onSelectProblem: (p: Problem) => void;
  onStartSession?: (topic: string) => void;
  onPlanChange?: () => void;
}

type AddMode = "problem" | "revision" | "custom";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return toDateKey(dt);
}

function formatWeekday(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeekdayShort(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function taskTypeLabel(type: PlannerTask["type"]): string {
  if (type === "problem") return "Problem";
  if (type === "revision") return "Revision";
  if (type === "session") return "Session";
  return "Task";
}

function PlannerTag({ children }: { children: string }) {
  return <Badge variant="primary" className="pl-tag">{children}</Badge>;
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
  const todayKey = toDateKey();
  const [dateKey, setDateKey] = useState(todayKey);
  const [plan, setPlan] = useState<DailyPlan>({
    date: todayKey,
    tasks: [],
    updatedAt: Date.now(),
  });
  const [goals, setGoals] = useState<DailyGoalConfig>({ ...DEFAULT_GOALS });
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [okMessage, setOkMessage] = useState("");
  const [problemQuery, setProblemQuery] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [revisionTitle, setRevisionTitle] = useState("");
  const [addMode, setAddMode] = useState<AddMode>("problem");
  const [goalsOpen, setGoalsOpen] = useState(false);

  const flashOk = (msg: string) => {
    setOkMessage(msg);
    window.setTimeout(() => setOkMessage(""), 2200);
  };

  const reload = useCallback(async () => {
    if (!userId) {
      setPlan({ date: dateKey, tasks: [], updatedAt: Date.now() });
      setGoals({ ...DEFAULT_GOALS });
      setSessions([]);
      setActiveSession(null);
      setLoading(false);
      setError("Sign in to sync your planner across devices.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const accepted = everAcceptedProblemIds(submissions);
      const [synced, nextGoals, nextSessions, active] = await Promise.all([
        syncPlannerWithAccepted(userId, dateKey, accepted),
        loadDailyGoals(userId),
        loadAllSessions(userId),
        loadActiveSession(userId),
      ]);
      setPlan(synced);
      setGoals(nextGoals);
      setSessions(nextSessions);
      setActiveSession(active);
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Unable to load your planner."
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
  const sessionsDone = day?.sessionsCompleted ?? 0;
  const solvedToday = day?.acceptedCount ?? completedProblems;
  const isToday = dateKey === todayKey;

  const syncLabel = !userId
    ? "Sign in to sync"
    : saving || adding
      ? "Syncing…"
      : error
        ? "Sync unavailable"
        : "Synced across devices";

  const syncTone = !userId
    ? "muted"
    : saving || adding
      ? "syncing"
      : error
        ? "error"
        : "ok";

  const suggestions = useMemo(() => {
    const q = problemQuery.trim().toLowerCase();
    if (!q) return [];
    return problems
      .filter((p) => p.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [problems, problemQuery]);

  const persist = async (next: DailyPlan): Promise<boolean> => {
    const prev = plan;
    setPlan(next);
    setSaving(true);
    setError(null);
    try {
      const saved = await saveDailyPlan(userId, next);
      setPlan(saved);
      onPlanChange?.();
      return true;
    } catch (err) {
      setPlan(prev);
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Unable to save plan."
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = (id: string) => {
    const nextCompleted = !plan.tasks.find((t) => t.id === id)?.completed;
    const tasks = plan.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            completed: !t.completed,
            completedSource: "manual" as const,
          }
        : t
    );
    void persist({ ...plan, tasks, updatedAt: Date.now() }).then((ok) => {
      if (ok && nextCompleted) flashOk("Task completed");
    });
  };

  const removeTask = (id: string) => {
    void persist({
      ...plan,
      tasks: plan.tasks.filter((t) => t.id !== id),
      updatedAt: Date.now(),
    });
  };

  const addCustom = async (type: PlannerTask["type"], title: string) => {
    const trimmed = title.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    const task: PlannerTask = {
      id: uid(),
      type,
      title: trimmed,
      completed: false,
      createdAt: Date.now(),
    };
    try {
      const ok = await persist({
        ...plan,
        tasks: [...plan.tasks, task],
        updatedAt: Date.now(),
      });
      if (ok) {
        flashOk("Added to today's plan");
        if (type === "revision") setRevisionTitle("");
        if (type === "custom") setCustomTitle("");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleAddProblem = async (p: Problem) => {
    if (adding) return;
    const id = (p.id || p._id || "").toString();
    setAdding(true);
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
      flashOk("Added to today's plan");
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Unable to add problem."
      );
    } finally {
      setSaving(false);
      setAdding(false);
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
          : "Unable to save goals."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStartFromPlanner = async () => {
    if (activeSession && (activeSession.status === "running" || activeSession.status === "paused")) {
      onStartSession?.(activeSession.topic || "General");
      return;
    }
    const topicTask = plan.tasks.find(
      (t) => t.type === "revision" || t.type === "session"
    );
    const topic = topicTask?.title || "General";
    setError(null);
    try {
      await startStudySession(userId, topic);
      flashOk("Study session started");
      onStartSession?.(topic);
      onPlanChange?.();
      const active = await loadActiveSession(userId);
      setActiveSession(active);
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Unable to start session."
      );
    }
  };

  const hasActiveSession =
    activeSession &&
    (activeSession.status === "running" || activeSession.status === "paused");

  const displayDate = formatWeekday(dateKey);

  return (
    <div className="co-page pl-page">
      <header className="co-header pl-header">
        <div>
          <p className="co-kicker">Planner</p>
          <h1 className="co-title">
            <ListTodo
              size={22}
              strokeWidth={2}
              aria-hidden
              className="pl-icon"
            />
            Daily Planner
          </h1>
          <p className="co-lede">
            Plan your problems, revisions, and study sessions.
          </p>
          <p
            className={cn(
              "pl-sync",
              syncTone === "ok" && "pl-sync-ok",
              syncTone === "syncing" && "pl-sync-syncing",
              syncTone === "error" && "pl-sync-error"
            )}
            role="status"
          >
            {syncTone === "ok" ? (
              <Check size={12} strokeWidth={2.5} aria-hidden className="pl-icon" />
            ) : null}
            {syncLabel}
          </p>
        </div>
      </header>

      <div className="pl-datebar" role="navigation" aria-label="Select day">
        <button
          type="button"
          className="pl-date-nav"
          aria-label="Previous day"
          title="Previous day"
          onClick={() => setDateKey((d) => shiftDateKey(d, -1))}
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
        </button>

        <div className="pl-date-center">
          {isToday ? (
            <span className="pl-today-status">Today</span>
          ) : (
            <span className="pl-today-spacer" aria-hidden="true" />
          )}
          <div className="pl-date-main">
            <strong className="pl-date-label">
              <span className="pl-date-full">{formatWeekday(dateKey)}</span>
              <span className="pl-date-short">{formatWeekdayShort(dateKey)}</span>
            </strong>
            {!isToday ? (
              <button
                type="button"
                className="pl-today-btn"
                onClick={() => setDateKey(todayKey)}
              >
                Today
              </button>
            ) : null}
          </div>
        </div>

        <label className="pl-date-picker" title="Pick date">
          <Calendar size={14} strokeWidth={2} aria-hidden className="pl-icon" />
          <span className="pl-date-picker-label">Pick date</span>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value || todayKey)}
            aria-label="Pick date"
          />
        </label>

        <button
          type="button"
          className="pl-date-nav"
          aria-label="Next day"
          title="Next day"
          onClick={() => setDateKey((d) => shiftDateKey(d, 1))}
        >
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {error ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden className="pl-icon" />
          <div>
            <strong>Unable to load your planner</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {okMessage ? (
        <p className="pl-ok" role="status">
          <Check size={14} strokeWidth={2} aria-hidden className="pl-icon" />
          {okMessage}
        </p>
      ) : null}

      {loading ? (
        <div className="pl-layout" aria-busy="true">
          <div className="pl-main">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="mt-3 h-48 w-full" />
          </div>
          <div className="pl-side">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="mt-3 h-40 w-full" />
          </div>
        </div>
      ) : (
        <div className="pl-layout">
          <div className="pl-main">
            {/* GOAL */}
            <section className="co-panel pl-card">
              <div className="pl-card-head">
                <div>
                  <p className="pl-kicker">Today&apos;s Goal</p>
                  <h2 className="pl-card-title">
                    {isToday
                      ? `Complete ${goalProblems} problem${goalProblems === 1 ? "" : "s"} today`
                      : `Goal for ${displayDate}`}
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!userId}
                  onClick={() => setGoalsOpen((v) => !v)}
                >
                  {goalsOpen ? "Done" : "Edit"}
                </Button>
              </div>

              <div className="pl-progress-block">
                <div className="pl-progress-nums">
                  <strong>
                    {completedProblems}
                    <span> / {goalProblems}</span>
                  </strong>
                  <span className="pl-progress-pct">{pct}%</span>
                </div>
                <div
                  className="pl-progress-bar"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Problem goal progress"
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
                <p className="pl-progress-remain">
                  {remaining > 0
                    ? `${remaining} remaining`
                    : "Goal met — great work"}
                </p>
              </div>

              {goalsOpen ? (
                <div className="pl-goals-edit">
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
                          problemsPerDay: Math.max(
                            1,
                            Number(e.target.value) || 1
                          ),
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
                          studyMinutes: Math.max(
                            15,
                            Number(e.target.value) || 15
                          ),
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
                          revisionTopics: Math.max(
                            0,
                            Number(e.target.value) || 0
                          ),
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
                          sessionsPerDay: Math.max(
                            0,
                            Number(e.target.value) || 0
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className="pl-target-grid">
                  <div className="pl-target">
                    <span className="pl-stat-label">Problems / day</span>
                    <strong>{goals.problemsPerDay}</strong>
                  </div>
                  <div className="pl-target">
                    <span className="pl-stat-label">Study minutes</span>
                    <strong>{goals.studyMinutes}</strong>
                  </div>
                  <div className="pl-target">
                    <span className="pl-stat-label">Revisions</span>
                    <strong>{goals.revisionTopics}</strong>
                  </div>
                  <div className="pl-target">
                    <span className="pl-stat-label">Sessions</span>
                    <strong>{goals.sessionsPerDay}</strong>
                  </div>
                </div>
              )}
            </section>

            {/* PLAN LIST */}
            <section className="co-panel pl-card">
              <div className="pl-card-head">
                <div>
                  <p className="pl-kicker">Today&apos;s Plan</p>
                  <h2 className="pl-card-title">{displayDate}</h2>
                </div>
              </div>

              {plan.tasks.length === 0 ? (
                <EmptyState
                  compact
                  title="Your plan is clear"
                  description={`No tasks scheduled for ${displayDate} yet. Add a problem, revision, or custom task to get started.`}
                  icon={
                    <ListTodo size={20} strokeWidth={1.75} aria-hidden />
                  }
                  action={
                    <Button
                      type="button"
                      size="sm"
                      disabled={!userId}
                      onClick={() =>
                        document
                          .getElementById("pl-add")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      <Plus size={14} strokeWidth={2} aria-hidden className="pl-icon" />
                      Add to Plan
                    </Button>
                  }
                />
              ) : (
                <ul className="pl-task-list">
                  {plan.tasks.map((t) => (
                    <li
                      key={t.id}
                      className={cn(
                        "pl-task",
                        t.completed && "pl-task-done"
                      )}
                    >
                      <button
                        type="button"
                        className="pl-check"
                        disabled={!userId || saving}
                        onClick={() => toggleTask(t.id)}
                        aria-label={
                          t.completed ? "Mark incomplete" : "Mark complete"
                        }
                        aria-pressed={t.completed}
                      >
                        {t.completed ? (
                          <Check size={14} strokeWidth={2.5} aria-hidden />
                        ) : null}
                      </button>
                      <div className="pl-task-body">
                        <div className="pl-task-top">
                          <PlannerTag>{taskTypeLabel(t.type)}</PlannerTag>
                          {t.completed ? (
                            <Badge variant="success" className="pl-tag">
                              Completed
                            </Badge>
                          ) : null}
                        </div>
                        {t.type === "problem" && t.problemId ? (
                          <button
                            type="button"
                            className="pl-task-title-btn"
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
                          <strong className="pl-task-title">{t.title}</strong>
                        )}
                      </div>
                      <button
                        type="button"
                        className="pl-icon-btn"
                        disabled={!userId || saving}
                        onClick={() => removeTask(t.id)}
                        aria-label="Remove task"
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="pl-side">
            {/* ACTIVITY */}
            <section className="co-panel pl-card">
              <p className="pl-kicker">Today&apos;s Activity</p>
              <div className="pl-activity-grid">
                <div className="pl-target">
                  <strong>{solvedToday}</strong>
                  <span className="pl-stat-label">Problems solved</span>
                </div>
                <div className="pl-target">
                  <strong>{formatDurationMs(studyDisplay)}</strong>
                  <span className="pl-stat-label">Study time</span>
                </div>
                <div className="pl-target">
                  <strong>{sessionsDone}</strong>
                  <span className="pl-stat-label">Sessions</span>
                </div>
              </div>
              <Button
                type="button"
                className="pl-session-cta"
                disabled={!userId || saving}
                onClick={() => void handleStartFromPlanner()}
              >
                <Play size={14} strokeWidth={2} aria-hidden className="pl-icon" />
                {hasActiveSession
                  ? "Continue Study Session"
                  : "Start Study Session"}
              </Button>
            </section>

            {/* ADD */}
            <section className="co-panel pl-card" id="pl-add">
              <p className="pl-kicker">Add to Plan</p>
              <h2 className="pl-card-title">Add something for this day</h2>

              <div className="pl-add-tabs" role="tablist" aria-label="Add type">
                {(
                  [
                    { id: "problem", label: "Problem" },
                    { id: "revision", label: "Revision" },
                    { id: "custom", label: "Custom" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={addMode === tab.id}
                    className={
                      addMode === tab.id ? "pl-chip pl-chip-active" : "pl-chip"
                    }
                    onClick={() => setAddMode(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {addMode === "problem" ? (
                <div className="pl-add-body">
                  <label className="pl-field">
                    <span className="sr-only">Search problems</span>
                    <input
                      value={problemQuery}
                      onChange={(e) => setProblemQuery(e.target.value)}
                      placeholder="Search problems…"
                      disabled={!userId}
                      aria-label="Search problems"
                    />
                  </label>
                  {suggestions.length > 0 ? (
                    <ul className="pl-suggest">
                      {suggestions.map((p) => (
                        <li key={String(p.id || p._id)}>
                          <button
                            type="button"
                            disabled={!userId || adding}
                            onClick={() => void handleAddProblem(p)}
                          >
                            <Plus size={14} aria-hidden className="pl-icon" />
                            {p.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : problemQuery.trim() ? (
                    <p className="co-muted pl-hint">No matching problems.</p>
                  ) : (
                    <p className="co-muted pl-hint">
                      Type to search and add a problem to this day.
                    </p>
                  )}
                </div>
              ) : null}

              {addMode === "revision" ? (
                <div className="pl-add-body">
                  <label className="pl-field">
                    <span className="sr-only">Revision topic</span>
                    <input
                      value={revisionTitle}
                      onChange={(e) => setRevisionTitle(e.target.value)}
                      placeholder="Revision topic…"
                      disabled={!userId}
                    />
                  </label>
                  <Button
                    type="button"
                    disabled={!userId || adding || !revisionTitle.trim()}
                    onClick={() => void addCustom("revision", revisionTitle)}
                  >
                    {adding ? "Adding…" : "+ Add Revision"}
                  </Button>
                </div>
              ) : null}

              {addMode === "custom" ? (
                <div className="pl-add-body">
                  <label className="pl-field">
                    <span className="sr-only">Custom task</span>
                    <input
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Custom task…"
                      disabled={!userId}
                    />
                  </label>
                  <Button
                    type="button"
                    disabled={!userId || adding || !customTitle.trim()}
                    onClick={() => void addCustom("custom", customTitle)}
                  >
                    {adding ? "Adding…" : "+ Add Task"}
                  </Button>
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};
