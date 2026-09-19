import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flame,
  Play,
  RefreshCw,
  Search,
  WifiOff,
} from "lucide-react";
import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import { learningApi } from "../api/learningApi";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/cn";
import {
  formatDurationMs as formatSessionMs,
  getSessionActiveMs,
  loadActiveSession,
  loadAllSessions,
  toDateKey,
  type StudySession,
} from "../utils/learningPersistence";
import {
  buildDayActivityMap,
  buildRoadmap,
  computeStreaks,
  formatDurationMs,
  type DayActivity,
  type RoadmapTopic,
} from "../utils/learningStats";
import { isSolved, normalizeDifficulty } from "../utils/problemUtils";
import "./companies/companies.css";
import "./calendar-roadmap.css";

interface Props {
  problems: Problem[];
  submissions: Submission[];
  userId?: string;
  refreshKey?: number;
  onSelectProblem: (p: Problem) => void;
  onStartSession?: (topic: string) => void;
}

type SyncState = "synced" | "syncing" | "offline" | "error" | "signed_out";
type RoadmapFilter = "all" | "in_progress" | "completed" | "not_started";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FILTER_LABELS: Record<RoadmapFilter, string> = {
  all: "All",
  in_progress: "In Progress",
  completed: "Completed",
  not_started: "Not Started",
};

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDayHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isQualifyingDay(day?: DayActivity | null): boolean {
  if (!day) return false;
  return day.acceptedCount > 0 || day.sessionsCompleted > 0;
}

function levelLabel(level: string): string {
  if (level === "planned") return "Planned";
  if (level === "partial") return "Partial";
  if (level === "completed") return "Completed";
  return "No activity";
}

function statusBadgeVariant(
  status: RoadmapTopic["status"]
): "default" | "primary" | "success" | "warning" {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "warning";
  return "default";
}

function statusDisplay(status: RoadmapTopic["status"]): string {
  return status.replace(/_/g, " ");
}

function CrTag({
  children,
  variant = "primary",
}: {
  children: string;
  variant?: "default" | "primary" | "success" | "warning";
}) {
  return (
    <Badge variant={variant} className="cr-tag">
      {children}
    </Badge>
  );
}

export const LearningCalendarRoadmap: FC<Props> = ({
  problems,
  submissions,
  userId,
  refreshKey = 0,
  onSelectProblem,
  onStartSession,
}) => {
  const todayKey = toDateKey(new Date());
  const today = new Date();

  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()));
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [plannedByDate, setPlannedByDate] = useState<Record<string, number>>(
    {}
  );
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("syncing");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [roadmapFilter, setRoadmapFilter] = useState<RoadmapFilter>("all");
  const [roadmapQuery, setRoadmapQuery] = useState("");
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(
    () => new Set()
  );

  const viewingCurrentMonth =
    cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  const reload = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setPlannedByDate({});
      setActiveSession(null);
      setSyncState("signed_out");
      setLoadError(null);
      setPlansError(null);
      setLoadedOnce(true);
      return;
    }

    setSyncState("syncing");
    const from = toDateKey(new Date(cursor.year, cursor.month, 1));
    const to = toDateKey(new Date(cursor.year, cursor.month + 1, 0));

    const sessionsOutcome = await loadAllSessions(userId)
      .then((list) => ({ ok: true as const, list }))
      .catch(() => ({ ok: false as const }));

    const plansOutcome = await learningApi
      .listPlans(from, to)
      .then((res) => ({ ok: true as const, data: res.data || [] }))
      .catch(() => ({ ok: false as const }));

    const activeOutcome = await loadActiveSession(userId)
      .then((a) => ({ ok: true as const, value: a }))
      .catch(() => ({ ok: false as const }));

    if (sessionsOutcome.ok) {
      setSessions(sessionsOutcome.list);
      setLoadError(null);
    } else {
      setLoadError("Unable to load activity");
    }

    if (plansOutcome.ok) {
      const map: Record<string, number> = {};
      for (const plan of plansOutcome.data) {
        map[plan.date] = (plan.tasks || []).filter(
          (t) => t.type === "problem"
        ).length;
      }
      setPlannedByDate(map);
      setPlansError(null);
    } else {
      setPlansError("Couldn't load month plans.");
    }

    if (activeOutcome.ok) {
      setActiveSession(
        activeOutcome.value && activeOutcome.value.status !== "completed"
          ? activeOutcome.value
          : null
      );
    }

    if (sessionsOutcome.ok && plansOutcome.ok) {
      setSyncState("synced");
    } else if (!navigator.onLine) {
      setSyncState("offline");
    } else {
      setSyncState("error");
    }
    setLoadedOnce(true);
  }, [userId, cursor.year, cursor.month]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    const onOffline = () => setSyncState("offline");
    const onOnline = () => {
      setSyncState("syncing");
      void reload();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [reload]);

  const activity = useMemo(
    () => buildDayActivityMap(submissions, sessions, plannedByDate),
    [submissions, sessions, plannedByDate]
  );

  const streaks = useMemo(() => computeStreaks(activity), [activity]);
  const roadmap = useMemo(
    () => buildRoadmap(problems, submissions, sessions),
    [problems, submissions, sessions]
  );

  const todayActivity = activity.get(todayKey);
  const todayActive = isQualifyingDay(todayActivity);
  const selected = activity.get(selectedKey);
  const selectedActive = isQualifyingDay(selected);
  const selectedIsToday = selectedKey === todayKey;

  const selectedProblems = useMemo(() => {
    const ids = new Set(selected?.solvedProblemIds || []);
    return problems.filter((p) => ids.has((p.id || p._id || "").toString()));
  }, [problems, selected]);

  const roadmapTotals = useMemo(() => {
    const total = roadmap.reduce((n, t) => n + t.total, 0);
    const solved = roadmap.reduce((n, t) => n + t.solved, 0);
    const pct = total ? Math.round((solved / total) * 100) : 0;
    return { total, solved, pct };
  }, [roadmap]);

  const filteredRoadmap = useMemo(() => {
    const q = roadmapQuery.trim().toLowerCase();
    return roadmap.filter((t) => {
      if (roadmapFilter === "in_progress" && t.status !== "IN_PROGRESS")
        return false;
      if (roadmapFilter === "completed" && t.status !== "COMPLETED")
        return false;
      if (roadmapFilter === "not_started" && t.status !== "NOT_STARTED")
        return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roadmap, roadmapFilter, roadmapQuery]);

  const firstDow = (() => {
    const dow = new Date(cursor.year, cursor.month, 1).getDay();
    return dow === 0 ? 6 : dow - 1;
  })();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key?: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      key: toDateKey(new Date(cursor.year, cursor.month, d)),
    });
  }

  const goToday = () => {
    const n = new Date();
    setCursor({ year: n.getFullYear(), month: n.getMonth() });
    setSelectedKey(toDateKey(n));
  };

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 0) return { year: c.year - 1, month: 11 };
      if (m > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: m };
    });
  };

  const toggleTopic = (name: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const syncLabel =
    syncState === "syncing"
      ? "Syncing…"
      : syncState === "offline"
        ? "Offline"
        : syncState === "error"
          ? "Sync unavailable"
          : syncState === "signed_out"
            ? "Sign in to sync"
            : "Synced to your account";

  const activeLive =
    activeSession &&
    (activeSession.status === "running" || activeSession.status === "paused");

  const hasDayData =
    selected &&
    (selected.acceptedCount > 0 ||
      selected.sessionsCompleted > 0 ||
      selected.attemptedCount > 0 ||
      selected.studyMs > 0 ||
      selected.topics.length > 0);

  return (
    <div className="co-page cr-page">
      <header className="co-header cr-header">
        <div>
          <p className="co-kicker">Progress</p>
          <h1 className="co-title">
            <CalendarDays
              size={22}
              strokeWidth={2}
              aria-hidden
              className="cr-icon"
            />
            Calendar + Roadmap
          </h1>
          <p className="co-lede">
            Track your DSA activity, streaks, and roadmap progress.
          </p>
          <p
            className={cn(
              "cr-sync",
              syncState === "synced" && "cr-sync-ok",
              syncState === "syncing" && "cr-sync-syncing",
              (syncState === "error" || syncState === "offline") &&
                "cr-sync-bad"
            )}
            role="status"
          >
            {syncState === "synced" ? (
              <Check size={12} strokeWidth={2.5} aria-hidden className="cr-icon" />
            ) : syncState === "syncing" ? (
              <RefreshCw size={12} aria-hidden className="cr-icon cr-spin" />
            ) : syncState === "offline" ? (
              <WifiOff size={12} aria-hidden className="cr-icon" />
            ) : syncState === "error" ? (
              <AlertCircle size={12} aria-hidden className="cr-icon" />
            ) : null}
            {syncLabel}
          </p>
        </div>
      </header>

      {loadError ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden className="cr-icon" />
          <div>
            <strong>Unable to load activity</strong>
            <p>We couldn&apos;t sync your study sessions right now.</p>
          </div>
          <button type="button" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {!loadedOnce ? (
        <div className="cr-layout" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <div className="cr-grid">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="cr-layout">
          {/* STREAK */}
          <section className="cr-streak co-panel" aria-label="Streak summary">
            <div className="cr-streak-main">
              {streaks.current > 0 || todayActive ? (
                <span
                  className={cn(
                    "cr-fire",
                    todayActive && "cr-fire-active"
                  )}
                  aria-hidden
                >
                  <Flame size={18} strokeWidth={2} fill="currentColor" />
                </span>
              ) : null}
              <div>
                <p className="cr-streak-value">
                  {todayActive
                    ? streaks.current > 0
                      ? `${streaks.current} day${streaks.current === 1 ? "" : "s"}`
                      : "Active today"
                    : streaks.current > 0
                      ? `${streaks.current} day${streaks.current === 1 ? "" : "s"}`
                      : "No active streak"}
                </p>
                <p className="cr-streak-label">
                  {todayActive && streaks.current > 0
                    ? "Current streak · Active today"
                    : todayActive
                      ? "Active today"
                      : "Current streak"}
                </p>
              </div>
            </div>
            <div className="cr-streak-best">
              <span className="cr-stat-label">Best</span>
              <strong>
                {streaks.longest} day{streaks.longest === 1 ? "" : "s"}
              </strong>
            </div>
          </section>

          {activeLive && activeSession ? (
            <section className="cr-active-session co-panel">
              <div className="cr-active-session-text">
                <p className="cr-kicker">
                  <span className="cr-fire cr-fire-active" aria-hidden>
                    <Flame size={12} fill="currentColor" />
                  </span>{" "}
                  Active session
                </p>
                <h2 className="cr-active-topic">
                  {activeSession.topic || "General DSA"}
                </h2>
                <p className="co-muted">
                  {formatSessionMs(getSessionActiveMs(activeSession))} focused
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  onStartSession?.(activeSession.topic || "General DSA")
                }
              >
                <Play size={14} strokeWidth={2} aria-hidden className="cr-icon" />
                Continue Session
              </Button>
            </section>
          ) : null}

          <div className="cr-grid">
            {/* CALENDAR */}
            <section className="co-panel cr-cal-card" aria-label="Activity calendar">
              <div className="cr-section-head">
                <div>
                  <p className="cr-kicker">Activity</p>
                  <h2 className="cr-section-title">Calendar</h2>
                </div>
                <div className="cr-month-nav">
                  <button
                    type="button"
                    className="cr-nav-btn"
                    aria-label="Previous month"
                    title="Previous month"
                    onClick={() => shiftMonth(-1)}
                  >
                    <ChevronLeft size={18} strokeWidth={2} aria-hidden />
                  </button>
                  <strong className="cr-month-label">
                    {monthLabel(cursor.year, cursor.month)}
                  </strong>
                  <button
                    type="button"
                    className="cr-nav-btn"
                    aria-label="Next month"
                    title="Next month"
                    onClick={() => shiftMonth(1)}
                  >
                    <ChevronRight size={18} strokeWidth={2} aria-hidden />
                  </button>
                  {viewingCurrentMonth ? (
                    <span className="cr-today-status">Today</span>
                  ) : (
                    <button
                      type="button"
                      className="cr-today-btn"
                      onClick={goToday}
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>

              {plansError ? (
                <div className="cr-inline-warn" role="status">
                  <span>{plansError}</span>
                  <button type="button" onClick={() => void reload()}>
                    Retry
                  </button>
                </div>
              ) : null}

              <div className="cr-cal-weekdays">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="cr-cal-grid">
                {cells.map((c, i) => {
                  if (c.day == null) {
                    return <div key={`e-${i}`} className="cr-cal-cell empty" />;
                  }
                  const act = activity.get(c.key!);
                  const isTodayCell = c.key === todayKey;
                  const level = act?.level || "none";
                  const qualifying = isQualifyingDay(act);
                  const selectedCell = selectedKey === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      className={cn(
                        "cr-cal-cell",
                        level,
                        selectedCell && "selected",
                        isTodayCell && "today",
                        qualifying && "qualifying"
                      )}
                      onClick={() => setSelectedKey(c.key!)}
                      aria-label={`${formatDayHeading(c.key!)} · ${levelLabel(level)}${
                        qualifying ? " · Active day" : ""
                      }`}
                      aria-pressed={selectedCell}
                    >
                      <span className="cr-cal-num">{c.day}</span>
                      {qualifying && selectedCell ? (
                        <span className="cr-cal-fire" aria-hidden>
                          <Flame size={10} fill="currentColor" />
                        </span>
                      ) : (
                        <span className="cr-cal-dot" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="cr-legend">
                <span>
                  <i className="lg none" /> No activity
                </span>
                <span>
                  <i className="lg planned" /> Planned
                </span>
                <span>
                  <i className="lg partial" /> Partial
                </span>
                <span>
                  <i className="lg completed" /> Completed
                </span>
              </div>
            </section>

            {/* SELECTED DAY */}
            <section
              className="co-panel cr-day-card"
              aria-label="Selected day activity"
            >
              <p className="cr-kicker">
                {selectedIsToday ? "Today's Activity" : "Selected Day"}
              </p>
              <h2 className="cr-section-title">{formatDayHeading(selectedKey)}</h2>

              {selectedActive ? (
                <p className="cr-active-pill" role="status">
                  <span className="cr-fire cr-fire-active" aria-hidden>
                    <Flame size={12} fill="currentColor" />
                  </span>
                  Active {selectedIsToday ? "today" : "day"}
                </p>
              ) : null}

              <p className="cr-info">
                Solved counts include ACCEPTED submissions only.
              </p>

              {!hasDayData ? (
                <EmptyState
                  compact
                  icon={<CalendarDays size={18} strokeWidth={1.75} aria-hidden />}
                  title="No activity yet"
                  description="No submissions or completed study sessions for this day."
                />
              ) : (
                <>
                  <div className="cr-day-stats">
                    <div className="cr-day-stat">
                      <strong>{formatDurationMs(selected!.studyMs)}</strong>
                      <span>Study Time</span>
                    </div>
                    <div className="cr-day-stat">
                      <strong>{selected!.acceptedCount}</strong>
                      <span>Solved</span>
                    </div>
                    <div className="cr-day-stat">
                      <strong>{selected!.attemptedCount}</strong>
                      <span>Attempted</span>
                    </div>
                    <div className="cr-day-stat">
                      <strong>{selected!.sessionsCompleted}</strong>
                      <span>Sessions</span>
                    </div>
                  </div>

                  {selected!.topics.length > 0 ? (
                    <div className="cr-day-block">
                      <p className="cr-stat-label">Topics studied</p>
                      <div className="cr-topic-chips">
                        {selected!.topics.map((t) => (
                          <span key={t} className="cr-topic-chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="cr-day-block">
                    <p className="cr-stat-label">Accepted problems</p>
                    {selectedProblems.length === 0 ? (
                      <p className="co-muted cr-empty-line">
                        No accepted problems on this day.
                      </p>
                    ) : (
                      <ul className="cr-problem-list">
                        {selectedProblems.map((p, idx) => (
                          <li key={p.id || p._id}>
                            <button
                              type="button"
                              className="cr-problem-row done"
                              onClick={() => onSelectProblem(p)}
                            >
                              <Check
                                size={14}
                                strokeWidth={2}
                                aria-hidden
                                className="cr-icon"
                              />
                              <span className="cr-problem-idx">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <span className="cr-problem-title">{p.title}</span>
                              {p.difficulty ? (
                                <span className="cr-problem-diff">
                                  {normalizeDifficulty(p.difficulty)}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* ROADMAP */}
          <section className="co-panel cr-roadmap-card" aria-label="DSA Roadmap">
            <div className="cr-section-head cr-roadmap-head">
              <div>
                <p className="cr-kicker">DSA Roadmap</p>
                <h2 className="cr-section-title">Roadmap</h2>
                <p className="co-muted cr-roadmap-lede">
                  Your roadmap updates automatically from ACCEPTED submissions.
                </p>
              </div>
            </div>

            {roadmapTotals.total > 0 ? (
              <div className="cr-roadmap-summary">
                <div className="cr-roadmap-summary-top">
                  <span className="cr-stat-label">Roadmap progress</span>
                  <strong>
                    {roadmapTotals.solved} / {roadmapTotals.total} solved
                  </strong>
                </div>
                <div className="cr-progress-meta">{roadmapTotals.pct}%</div>
                <div
                  className="cr-progress-bar"
                  role="progressbar"
                  aria-valuenow={roadmapTotals.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${roadmapTotals.pct}%` }} />
                </div>
              </div>
            ) : null}

            <div className="cr-roadmap-tools">
              <label className="cr-search">
                <Search size={14} strokeWidth={2} aria-hidden className="cr-icon" />
                <span className="sr-only">Search roadmap topics</span>
                <input
                  value={roadmapQuery}
                  onChange={(e) => setRoadmapQuery(e.target.value)}
                  placeholder="Search roadmap topics…"
                />
              </label>
              <div className="cr-filters" role="tablist" aria-label="Roadmap filter">
                {(Object.keys(FILTER_LABELS) as RoadmapFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={roadmapFilter === f}
                    className={
                      roadmapFilter === f ? "cr-chip cr-chip-active" : "cr-chip"
                    }
                    onClick={() => setRoadmapFilter(f)}
                  >
                    {FILTER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {roadmap.every((t) => t.total === 0) ? (
              <EmptyState
                compact
                title="Start your DSA journey"
                description="Problems will map onto this roadmap by category as they are published."
              />
            ) : filteredRoadmap.length === 0 ? (
              <div className="cr-inline-empty">
                <p className="cr-inline-empty-title">No matching topics</p>
                <p className="co-muted">
                  Try another filter or clear your search.
                </p>
              </div>
            ) : (
              <div className="cr-roadmap-list">
                {filteredRoadmap.map((t) => {
                  const expanded =
                    expandedTopics.has(t.name) || t.problemIds.length <= 4;
                  const showToggle = t.problemIds.length > 4;
                  const sessionOnTopic =
                    Boolean(activeLive) &&
                    Boolean(activeSession?.topic) &&
                    activeSession!.topic.trim().toLowerCase() ===
                      t.name.trim().toLowerCase();

                  return (
                    <article
                      key={t.name}
                      className={cn("cr-topic", t.status.toLowerCase())}
                    >
                      <div className="cr-topic-top">
                        <h3 className="cr-topic-name">{t.name}</h3>
                        <CrTag variant={statusBadgeVariant(t.status)}>
                          {statusDisplay(t.status)}
                        </CrTag>
                      </div>

                      <div className="cr-topic-progress">
                        <span>
                          {t.solved} / {t.total} solved
                        </span>
                        <span>{t.pct}%</span>
                      </div>
                      <div
                        className="cr-progress-bar"
                        role="progressbar"
                        aria-valuenow={t.pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${t.name} progress`}
                      >
                        <span style={{ width: `${t.pct}%` }} />
                      </div>

                      <div className="cr-diff-row">
                        <span title="Easy problems in topic">
                          <em>Easy</em> {t.easy}
                        </span>
                        <span title="Medium problems in topic">
                          <em>Medium</em> {t.medium}
                        </span>
                        <span title="Hard problems in topic">
                          <em>Hard</em> {t.hard}
                        </span>
                        {t.studyMs > 0 ? (
                          <span className="cr-topic-study">
                            {formatDurationMs(t.studyMs)} studied
                          </span>
                        ) : null}
                      </div>

                      {t.problemIds.length === 0 ? (
                        <p className="co-muted cr-empty-line">
                          No problems linked yet. Problems will appear when this
                          roadmap topic has published problem mappings.
                        </p>
                      ) : (
                        <>
                          {showToggle ? (
                            <button
                              type="button"
                              className="cr-expand-btn"
                              onClick={() => toggleTopic(t.name)}
                              aria-expanded={expanded}
                            >
                              {expanded ? (
                                <ChevronUp size={14} aria-hidden />
                              ) : (
                                <ChevronDown size={14} aria-hidden />
                              )}
                              {expanded
                                ? "Hide problems"
                                : `Show ${t.problemIds.length} problems`}
                            </button>
                          ) : null}
                          {expanded ? (
                            <ul className="cr-topic-problems">
                              {t.problemIds.map((pid) => {
                                const p = problems.find(
                                  (x) =>
                                    (x.id || x._id || "").toString() === pid
                                );
                                if (!p) return null;
                                const done = isSolved(pid, submissions);
                                return (
                                  <li key={pid}>
                                    <button
                                      type="button"
                                      className={cn(
                                        "cr-problem-row",
                                        done && "done"
                                      )}
                                      onClick={() => onSelectProblem(p)}
                                    >
                                      {done ? (
                                        <Check
                                          size={14}
                                          strokeWidth={2}
                                          aria-hidden
                                          className="cr-icon"
                                        />
                                      ) : (
                                        <span
                                          className="cr-problem-dot"
                                          aria-hidden
                                        />
                                      )}
                                      <span className="cr-problem-title">
                                        {p.title}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </>
                      )}

                      <div className="cr-topic-actions">
                        <Button
                          type="button"
                          size="sm"
                          variant={sessionOnTopic ? "primary" : "secondary"}
                          onClick={() => onStartSession?.(t.name)}
                        >
                          <Play
                            size={14}
                            strokeWidth={2}
                            aria-hidden
                            className="cr-icon"
                          />
                          {sessionOnTopic
                            ? "Continue Session"
                            : "Start Session"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
