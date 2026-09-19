import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from "react";
import {
  AlertCircle,
  Check,
  Pause,
  Play,
  RefreshCw,
  Square,
  Timer,
  WifiOff,
} from "lucide-react";
import type { Problem } from "../api/problemApi";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/cn";
import { useToast } from "../context/ToastContext";
import { useAuthPrompt } from "../context/AuthPromptContext";
import {
  endStudySession,
  formatDurationMs,
  formatHMS,
  getSessionActiveMs,
  LearningPersistError,
  loadActiveSession,
  loadAllSessions,
  pauseStudySession,
  resumeStudySession,
  startStudySession,
  toDateKey,
  type StudySession,
  type StudySessionStatus,
} from "../utils/learningPersistence";
import "./companies/companies.css";
import "./sessions.css";

type SessionFilter = "today" | "week" | "month" | "all";
type SyncState = "synced" | "syncing" | "offline" | "error" | "signed_out";
type UiPhase =
  | "idle"
  | "starting"
  | "active"
  | "ending"
  | "completed"
  | "start_error"
  | "end_error";

interface Props {
  userId?: string;
  problems: Problem[];
  topics: string[];
  refreshKey?: number;
  onSessionChange?: () => void;
  onSelectProblem?: (p: Problem) => void;
}

const FILTER_LABELS: Record<SessionFilter, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All",
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - diff);
  return x;
}

function inFilter(session: StudySession, filter: SessionFilter): boolean {
  const t = session.endedAt || session.startedAt;
  if (filter === "all") return true;
  if (filter === "today") return toDateKey(new Date(t)) === toDateKey(new Date());
  if (filter === "week") return t >= startOfWeek(new Date()).getTime();
  if (filter === "month") {
    const d = new Date(t);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  }
  return true;
}

function groupLabel(endedAt: number): string {
  const key = toDateKey(new Date(endedAt));
  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - 86400000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const d = new Date(endedAt);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function displayTopic(topic?: string | null): string {
  const t = (topic || "").trim();
  return t || "General DSA";
}

function formatStartedAt(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatHistoryWhen(ms: number): string {
  const key = toDateKey(new Date(ms));
  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - 86400000));
  const time = formatStartedAt(ms);
  if (key === today) return `Today · ${time}`;
  if (key === yesterday) return `Yesterday · ${time}`;
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  return `${date} · ${time}`;
}

function SessionTag({
  children,
  variant = "primary",
}: {
  children: string;
  variant?: "primary" | "success" | "warning" | "default";
}) {
  return (
    <Badge variant={variant} className="ss-tag">
      {children}
    </Badge>
  );
}

function statusLabel(status: StudySessionStatus): {
  label: string;
  variant: "primary" | "success" | "warning" | "default";
} {
  if (status === "running") return { label: "Active", variant: "success" };
  if (status === "paused") return { label: "Paused", variant: "warning" };
  return { label: "Completed", variant: "primary" };
}

function isAuthMessage(message: string): boolean {
  return /sign in|unauthorized|401|session expired|authenticate/i.test(message);
}

export const StudySessionsPanel: FC<Props> = ({
  userId,
  problems,
  topics,
  refreshKey = 0,
  onSessionChange,
  onSelectProblem,
}) => {
  const toast = useToast();
  const { openAuth } = useAuthPrompt();
  const topicOptions = topics.length ? topics : ["Array", "General DSA"];
  const [topic, setTopic] = useState(topicOptions[0] || "Array");
  const [topicQuery, setTopicQuery] = useState("");
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [active, setActive] = useState<StudySession | null>(null);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [tick, setTick] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("syncing");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [justEnded, setJustEnded] = useState<StudySession | null>(null);

  const reload = useCallback(async (): Promise<{
    active: StudySession | null;
    ok: boolean;
  }> => {
    if (!userId) {
      setActive(null);
      setHistory([]);
      setSyncError(null);
      setSyncState("signed_out");
      setPhase("idle");
      setLoadedOnce(true);
      return { active: null, ok: false };
    }
    setSyncState("syncing");

    const activeOutcome = await loadActiveSession(userId)
      .then((a) => ({ ok: true as const, value: a }))
      .catch((err) => ({ ok: false as const, err }));
    const historyOutcome = await loadAllSessions(userId)
      .then((h) => ({ ok: true as const, value: h }))
      .catch((err) => ({ ok: false as const, err }));

    let nextActive: StudySession | null = null;
    if (activeOutcome.ok) {
      nextActive = activeOutcome.value;
      setActive(activeOutcome.value);
      if (activeOutcome.value && activeOutcome.value.status !== "completed") {
        setPhase("active");
        setJustEnded(null);
      }
    }
    if (historyOutcome.ok) {
      setHistory(historyOutcome.value);
    }

    if (activeOutcome.ok && historyOutcome.ok) {
      setSyncError(null);
      setSyncState("synced");
      setLoadedOnce(true);
      return { active: nextActive, ok: true };
    }

    const firstErr = !activeOutcome.ok
      ? activeOutcome.err
      : !historyOutcome.ok
        ? historyOutcome.err
        : null;
    const message =
      firstErr instanceof LearningPersistError
        ? firstErr.message
        : "Unable to sync session data";
    setSyncError(message);
    if (isAuthMessage(message)) {
      setSyncState("signed_out");
    } else {
      setSyncState(
        /connection|reach|offline|unavailable/i.test(message)
          ? "offline"
          : "error"
      );
    }
    setLoadedOnce(true);
    return { active: nextActive, ok: false };
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    if (!active || active.status !== "running") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [active?.id, active?.status]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setTick((n) => n + 1);
      }
    };
    const onOffline = () => setSyncState("offline");
    const onOnline = () => {
      setSyncState("syncing");
      void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [reload]);

  useEffect(() => {
    if (!endConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEndConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endConfirm]);

  useEffect(() => {
    if (topicOptions.length && !topicOptions.includes(topic)) {
      setTopic(topicOptions[0]);
    }
  }, [topicOptions, topic]);

  const filteredTopics = useMemo(() => {
    const q = topicQuery.trim().toLowerCase();
    if (!q) return topicOptions;
    return topicOptions.filter((t) => t.toLowerCase().includes(q));
  }, [topicOptions, topicQuery]);

  const recentTopics = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of history) {
      const t = displayTopic(s.topic);
      if (!seen.has(t) && topicOptions.includes(t)) {
        seen.add(t);
        out.push(t);
      }
      if (out.length >= 4) break;
    }
    return out;
  }, [history, topicOptions]);

  const filtered = useMemo(
    () => history.filter((s) => inFilter(s, filter)),
    [history, filter]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of filtered) {
      const label = groupLabel(s.endedAt || s.startedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return [...map.entries()];
  }, [filtered]);

  const todayStats = useMemo(() => {
    const today = toDateKey(new Date());
    const weekStart = startOfWeek(new Date()).getTime();
    let todayCount = 0;
    let todayMs = 0;
    let weekMs = 0;
    for (const s of history) {
      const t = s.endedAt || s.startedAt;
      const ms = s.accumulatedMs || 0;
      if (toDateKey(new Date(t)) === today) {
        todayCount += 1;
        todayMs += ms;
      }
      if (t >= weekStart) weekMs += ms;
    }
    return { todayCount, todayMs, weekMs };
  }, [history]);

  void tick;
  const displayMs = active ? getSessionActiveMs(active) : 0;
  const attempted = active?.attemptedProblemIds?.length || 0;
  const solved = active?.solvedProblemIds?.length || 0;
  const isLive = Boolean(active && active.status !== "completed");

  const bump = () => onSessionChange?.();

  const handleStart = async () => {
    if (!userId || busy || !topic.trim() || isLive) return;
    setBusy(true);
    setPhase("starting");
    setSyncError(null);
    try {
      const started = await startStudySession(userId, topic.trim());
      setActive(started);
      setPhase("active");
      setJustEnded(null);
      setSyncState("synced");
      toast.success("Session started");
      bump();
      await reload();
    } catch (err) {
      const message =
        err instanceof LearningPersistError
          ? err.message
          : "Couldn't start your session.";
      // Conflict / existing active: recover into Active UI without a hard error
      const recovered = await reload();
      if (
        recovered.active &&
        recovered.active.status !== "completed"
      ) {
        setPhase("active");
        setSyncError(null);
        setSyncState("synced");
        toast.info("Another study session is already active");
      } else {
        setPhase("start_error");
        setSyncError(message);
        if (isAuthMessage(message)) {
          setSyncState("signed_out");
        } else {
          setSyncState(
            /connection|reach|offline|unavailable/i.test(message)
              ? "offline"
              : "error"
          );
        }
        toast.error("Unable to start session", message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    if (!userId || busy || !isLive) return;
    setBusy(true);
    try {
      await pauseStudySession(userId);
      await reload();
      bump();
    } catch (err) {
      const message =
        err instanceof LearningPersistError
          ? err.message
          : "Couldn't pause the session.";
      setSyncError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    if (!userId || busy || !isLive) return;
    setBusy(true);
    try {
      await resumeStudySession(userId);
      await reload();
      bump();
    } catch (err) {
      const message =
        err instanceof LearningPersistError
          ? err.message
          : "Couldn't resume the session.";
      setSyncError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleEndConfirm = async () => {
    if (!userId || busy || !isLive) return;
    setBusy(true);
    setPhase("ending");
    setEndConfirm(false);
    try {
      const ended = await endStudySession(userId);
      setActive(null);
      setSyncError(null);
      setSyncState("synced");
      setPhase("completed");
      if (ended) {
        setJustEnded(ended);
        setHistory((prev) =>
          [ended, ...prev.filter((s) => s.id !== ended.id)].slice(0, 200)
        );
      }
      toast.success("Session ended and saved");
      bump();
    } catch (err) {
      setPhase("end_error");
      const message =
        err instanceof LearningPersistError
          ? err.message
          : "Couldn't end the session.";
      setSyncError(message);
      toast.error("Unable to end session", message);
      await reload();
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="co-page ss-page">
      <header className="co-header ss-header">
        <div>
          <p className="co-kicker">Focus</p>
          <h1 className="co-title">
            <Timer size={22} strokeWidth={2} aria-hidden className="ss-icon" />
            Study Sessions
          </h1>
          <p className="co-lede">
            Build consistent problem-solving habits with focused DSA sessions.
          </p>
          <p
            className={cn(
              "ss-sync-line",
              syncState === "synced" && "ss-sync-ok",
              syncState === "syncing" && "ss-sync-syncing",
              (syncState === "error" || syncState === "offline") &&
                "ss-sync-bad"
            )}
            role="status"
          >
            {syncState === "synced" ? (
              <Check size={12} strokeWidth={2.5} aria-hidden className="ss-icon" />
            ) : syncState === "syncing" ? (
              <RefreshCw size={12} aria-hidden className="ss-icon ss-spin" />
            ) : syncState === "offline" ? (
              <WifiOff size={12} aria-hidden className="ss-icon" />
            ) : syncState === "error" ? (
              <AlertCircle size={12} aria-hidden className="ss-icon" />
            ) : null}
            {syncLabel}
          </p>
        </div>
      </header>

      {syncError ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden className="ss-icon" />
          <div>
            <strong>
              {phase === "start_error"
                ? "Couldn't start your session"
                : phase === "end_error"
                  ? "Couldn't end the session"
                  : syncState === "signed_out"
                    ? "Your session could not be synced"
                    : "Unable to load study sessions"}
            </strong>
            <p>
              {phase === "end_error"
                ? "Your session is still active. Retry or continue focusing."
                : syncState === "signed_out"
                  ? "Please sign in again to continue."
                  : syncError}
            </p>
          </div>
          {syncState === "signed_out" ? (
            <button
              type="button"
              onClick={() =>
                openAuth({
                  tab: "login",
                  title: "Sign in to sync study sessions",
                })
              }
            >
              Sign In
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !userId}
              onClick={() => void reload()}
            >
              Retry
            </button>
          )}
        </div>
      ) : null}

      {!loadedOnce ? (
        <div className="ss-layout" aria-busy="true">
          <div className="ss-stats">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-56 w-full" />
          <div className="ss-history-list">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ) : (
        <div className="ss-layout">
          {/* TODAY STATS — from real history */}
          {userId ? (
            <section className="ss-stats" aria-label="Today summary">
              <div className="ss-stat">
                <strong>{todayStats.todayCount}</strong>
                <span className="ss-stat-label">Sessions today</span>
              </div>
              <div className="ss-stat">
                <strong>{formatDurationMs(todayStats.todayMs)}</strong>
                <span className="ss-stat-label">Study time today</span>
              </div>
              <div className="ss-stat">
                <strong>{formatDurationMs(todayStats.weekMs)}</strong>
                <span className="ss-stat-label">This week</span>
              </div>
            </section>
          ) : null}

          {/* COMPLETED BANNER */}
          {justEnded && phase === "completed" && !isLive ? (
            <section className="co-panel ss-card ss-complete-card">
              <p className="ss-kicker">Session Complete</p>
              <h2 className="ss-card-title">
                {displayTopic(justEnded.topic)}
              </h2>
              <p className="ss-complete-meta">
                {formatDurationMs(justEnded.accumulatedMs)} focused · Saved to
                your account
              </p>
              <div className="ss-actions">
                <Button
                  type="button"
                  onClick={() => {
                    setJustEnded(null);
                    setPhase("idle");
                  }}
                >
                  <Play size={14} strokeWidth={2} aria-hidden className="ss-icon" />
                  Start Another Session
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setJustEnded(null);
                    setPhase("idle");
                    document
                      .getElementById("ss-history")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  View History
                </Button>
              </div>
            </section>
          ) : null}

          {/* ACTIVE SESSION */}
          {isLive && active ? (
            <section
              className="co-panel ss-card ss-active-card"
              aria-label="Current session"
            >
              <div className="ss-active-top">
                <div>
                  <p className="ss-kicker">Current Session</p>
                  <h2 className="ss-topic">{displayTopic(active.topic)}</h2>
                </div>
                <Badge
                  variant={active.status === "paused" ? "warning" : "success"}
                  className="ss-tag"
                >
                  {active.status === "paused" ? "Paused" : "Active"}
                </Badge>
              </div>

              <div className="ss-timer" aria-live="off">
                <span className="ss-timer-value">{formatHMS(displayMs)}</span>
                <span className="ss-timer-caption">Focused study time</span>
              </div>
              <p className="sr-only" aria-live="polite">
                Session {active.status === "paused" ? "paused" : "running"} for{" "}
                {formatDurationMs(displayMs)}
              </p>

              <ul className="ss-active-facts">
                <li>
                  <span className="ss-stat-label">Started</span>
                  <strong>{formatStartedAt(active.startedAt)}</strong>
                </li>
                <li>
                  <span className="ss-stat-label">Duration</span>
                  <strong>{formatDurationMs(displayMs)}</strong>
                </li>
                {attempted > 0 || solved > 0 ? (
                  <>
                    <li>
                      <span className="ss-stat-label">Attempted</span>
                      <strong>{attempted}</strong>
                    </li>
                    <li>
                      <span className="ss-stat-label">Solved</span>
                      <strong>{solved}</strong>
                    </li>
                  </>
                ) : null}
              </ul>

              <div className="ss-actions">
                {active.status === "running" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void handlePause()}
                    aria-label="Pause study session"
                  >
                    <Pause size={14} strokeWidth={2} aria-hidden className="ss-icon" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleResume()}
                    aria-label="Continue study session"
                  >
                    <Play size={14} strokeWidth={2} aria-hidden className="ss-icon" />
                    Continue Session
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy || phase === "ending"}
                  onClick={() => setEndConfirm(true)}
                  aria-label="End study session"
                >
                  <Square size={14} strokeWidth={2} aria-hidden className="ss-icon" />
                  {phase === "ending" ? "Ending…" : "End Session"}
                </Button>
              </div>
            </section>
          ) : null}

          {/* START */}
          {!isLive && phase !== "completed" ? (
            <section className="co-panel ss-card" aria-label="Start focused session">
              <p className="ss-kicker">Focused Session</p>
              <h2 className="ss-card-title">Choose a topic</h2>
              <p className="ss-lede">
                Pick a topic and focus on solving problems. The timer survives
                navigation and syncs to your account.
              </p>

              {recentTopics.length > 0 ? (
                <div className="ss-topic-block">
                  <p className="ss-stat-label">Recent</p>
                  <div className="ss-topic-grid">
                    {recentTopics.map((t) => (
                      <button
                        key={`recent-${t}`}
                        type="button"
                        className={
                          topic === t
                            ? "ss-topic-chip ss-topic-chip-active"
                            : "ss-topic-chip"
                        }
                        aria-pressed={topic === t}
                        disabled={!userId || busy}
                        onClick={() => setTopic(t)}
                      >
                        {topic === t ? (
                          <Check size={12} strokeWidth={2.5} aria-hidden />
                        ) : null}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="ss-topic-block">
                <p className="ss-stat-label">All topics</p>
                <label className="ss-search">
                  <span className="sr-only">Search topics</span>
                  <input
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                    placeholder="Search topics…"
                    disabled={!userId || busy}
                  />
                </label>
                <div className="ss-topic-grid" role="listbox" aria-label="Topics">
                  {filteredTopics.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="option"
                      aria-selected={topic === t}
                      className={
                        topic === t
                          ? "ss-topic-chip ss-topic-chip-active"
                          : "ss-topic-chip"
                      }
                      disabled={!userId || busy}
                      onClick={() => setTopic(t)}
                    >
                      {topic === t ? (
                        <Check size={12} strokeWidth={2.5} aria-hidden />
                      ) : null}
                      {t}
                    </button>
                  ))}
                </div>
                {filteredTopics.length === 0 ? (
                  <p className="co-muted ss-hint">No topics match your search.</p>
                ) : null}
              </div>

              <Button
                type="button"
                size="lg"
                className="ss-start-cta"
                disabled={!userId || busy || !topic.trim() || phase === "starting"}
                onClick={() => void handleStart()}
                aria-label="Start focused session"
              >
                <Play size={16} strokeWidth={2} aria-hidden className="ss-icon" />
                {phase === "starting"
                  ? "Starting…"
                  : "Start Focused Session"}
              </Button>
              {!userId ? (
                <p className="ss-hint">Sign in to start synced study sessions.</p>
              ) : null}
            </section>
          ) : null}

          {/* HISTORY */}
          <section
            className="co-panel ss-card"
            id="ss-history"
            aria-label="Session history"
          >
            <div className="ss-history-head">
              <div>
                <p className="ss-kicker">History</p>
                <h2 className="ss-card-title">Session History</h2>
              </div>
              <div className="ss-filters" role="tablist" aria-label="History range">
                {(Object.keys(FILTER_LABELS) as SessionFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={filter === f}
                    className={
                      filter === f ? "ss-chip ss-chip-active" : "ss-chip"
                    }
                    onClick={() => setFilter(f)}
                  >
                    {FILTER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {filter === "today" && filtered.length > 0 ? (
              <p className="ss-history-summary">
                {filtered.length} session{filtered.length === 1 ? "" : "s"} ·{" "}
                {formatDurationMs(
                  filtered.reduce((n, s) => n + (s.accumulatedMs || 0), 0)
                )}{" "}
                focused
              </p>
            ) : null}

            {grouped.length === 0 ? (
              history.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Timer size={18} strokeWidth={1.75} aria-hidden />}
                  title="No sessions yet"
                  description="You haven't completed a focused session yet. Choose a DSA topic and start your first focused session."
                  action={
                    !isLive ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={!userId || busy}
                        onClick={() =>
                          document
                            .querySelector<HTMLElement>(".ss-start-cta")
                            ?.scrollIntoView({ behavior: "smooth" })
                        }
                      >
                        <Play size={14} aria-hidden className="ss-icon" />
                        Start Focused Session
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <div className="ss-inline-empty">
                  <p className="ss-inline-empty-title">
                    No sessions {FILTER_LABELS[filter].toLowerCase()}
                  </p>
                  <p className="co-muted">
                    Your previous sessions are still available in All.
                  </p>
                </div>
              )
            ) : (
              grouped.map(([label, rows]) => (
                <div key={label} className="ss-history-group">
                  <h3>{label}</h3>
                  <ul className="ss-history-list">
                    {rows.map((s) => {
                      const a = s.attemptedProblemIds?.length || 0;
                      const sol = s.solvedProblemIds?.length || 0;
                      const st = statusLabel(s.status);
                      return (
                        <li key={s.id} className="ss-history-row">
                          <div className="ss-history-main">
                            <div className="ss-history-top">
                              <strong>{displayTopic(s.topic)}</strong>
                              <SessionTag variant={st.variant}>
                                {st.label}
                              </SessionTag>
                            </div>
                            <p className="ss-history-when">
                              {formatHistoryWhen(s.endedAt || s.startedAt)}
                            </p>
                            <p className="ss-history-dur">
                              {formatDurationMs(s.accumulatedMs)} focused
                              {a > 0 || sol > 0
                                ? ` · ${sol} solved · ${a} attempted`
                                : ""}
                            </p>
                          </div>
                          {onSelectProblem && s.solvedProblemIds?.[0] ? (
                            <button
                              type="button"
                              className="ss-history-open"
                              onClick={() => {
                                const p = problems.find(
                                  (x) =>
                                    String(x.id || x._id) ===
                                    String(s.solvedProblemIds[0])
                                );
                                if (p) onSelectProblem(p);
                              }}
                            >
                              Open last solved
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {endConfirm ? (
        <div
          className="ss-modal-backdrop"
          role="presentation"
          onClick={() => setEndConfirm(false)}
        >
          <div
            className="co-panel ss-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ss-end-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ss-end-title">End this session?</h2>
            <p className="co-muted">
              Your focused session will be saved to your history.
            </p>
            <div className="ss-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEndConfirm(false)}
              >
                Keep Session
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void handleEndConfirm()}
              >
                End Session
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
