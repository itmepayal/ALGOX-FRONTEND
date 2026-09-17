import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
  Clock,
  Pause,
  Play,
  Square,
  Timer,
} from "lucide-react";
import type { Problem } from "../api/problemApi";
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
} from "../utils/learningPersistence";

type SessionFilter = "today" | "week" | "month" | "all";

interface Props {
  userId?: string;
  problems: Problem[];
  topics: string[];
  refreshKey?: number;
  onSessionChange?: () => void;
  onSelectProblem?: (p: Problem) => void;
}

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
  return key;
}

export const StudySessionsPanel: FC<Props> = ({
  userId,
  problems,
  topics,
  refreshKey = 0,
  onSessionChange,
  onSelectProblem,
}) => {
  const [topic, setTopic] = useState(topics[0] || "General");
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [active, setActive] = useState<StudySession | null>(null);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setActive(null);
      setHistory([]);
      setError("Sign in to sync study sessions across devices.");
      return;
    }
    setError(null);
    try {
      const [a, h] = await Promise.all([
        loadActiveSession(userId),
        loadAllSessions(userId),
      ]);
      setActive(a);
      setHistory(h);
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Failed to load sessions"
      );
    }
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
    if (topics.length && !topics.includes(topic)) {
      setTopic(topics[0]);
    }
  }, [topics, topic]);

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

  void tick;
  const displayMs = active ? getSessionActiveMs(active) : 0;

  const bump = () => {
    onSessionChange?.();
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
      bump();
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Session action failed"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <Timer size={22} /> Study Sessions
          </h1>
          <p>
            Focused DSA sessions with a timer that survives navigation.{" "}
            <span style={{ color: "var(--text-muted)" }}>
              Synced to your account (multi-device).
            </span>
          </p>
        </div>
      </header>

      {error ? (
        <div className="learn-card" style={{ marginBottom: 12, color: "var(--danger, #b91c1c)" }}>
          {error}
        </div>
      ) : null}

      <div className="learn-grid-2">
        <section className="learn-card">
          <div className="learn-card-head">
            <h2>
              <Clock size={16} /> Active timer
            </h2>
          </div>
          {active && active.status !== "completed" ? (
            <>
              <div className="learn-timer">{formatHMS(displayMs)}</div>
              <p className="learn-muted">
                {active.topic} · solved {active.solvedProblemIds.length} /{" "}
                {active.attemptedProblemIds.length} attempted
              </p>
              <div className="learn-actions">
                {active.status === "running" ? (
                  <button
                    type="button"
                    className="learn-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await pauseStudySession(userId);
                      })
                    }
                  >
                    <Pause size={14} /> Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="learn-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await resumeStudySession(userId);
                      })
                    }
                  >
                    <Play size={14} /> Resume
                  </button>
                )}
                <button
                  type="button"
                  className="learn-btn danger"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await endStudySession(userId);
                    })
                  }
                >
                  <Square size={14} /> End
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="learn-field">
                Topic
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={!userId || busy}
                >
                  {(topics.length ? topics : ["General"]).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="learn-btn primary"
                disabled={!userId || busy}
                onClick={() =>
                  void run(async () => {
                    await startStudySession(userId, topic);
                  })
                }
              >
                <Play size={14} /> Start session
              </button>
            </>
          )}
        </section>

        <section className="learn-card">
          <div className="learn-card-head">
            <h2>History</h2>
            <div className="learn-filters">
              {(["today", "week", "month", "all"] as SessionFilter[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    className={filter === f ? "active" : undefined}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                )
              )}
            </div>
          </div>
          {grouped.length === 0 ? (
            <p className="learn-muted">No completed sessions yet.</p>
          ) : (
            grouped.map(([label, rows]) => (
              <div key={label} className="learn-history-group">
                <h3>{label}</h3>
                <ul>
                  {rows.map((s) => (
                    <li key={s.id}>
                      <strong>{s.topic}</strong>
                      <span>{formatDurationMs(s.accumulatedMs)}</span>
                      <span className="learn-muted">
                        {s.solvedProblemIds.length} solved
                      </span>
                      {onSelectProblem && s.solvedProblemIds[0] ? (
                        <button
                          type="button"
                          className="learn-link"
                          onClick={() => {
                            const p = problems.find(
                              (x) =>
                                String(x.id || x._id) ===
                                String(s.solvedProblemIds[0])
                            );
                            if (p) onSelectProblem(p);
                          }}
                        >
                          Open
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
};
