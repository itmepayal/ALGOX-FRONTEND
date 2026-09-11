import { useEffect, useMemo, useState, type FC } from "react";
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
  const now = Date.now();
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
  const [tick, setTick] = useState(0);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    setActive(loadActiveSession(userId));
  }, [userId, refreshKey]);

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

  const history = useMemo(() => {
    void historyTick;
    void refreshKey;
    return loadAllSessions(userId).filter((s) => inFilter(s, filter));
  }, [userId, filter, historyTick, refreshKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of history) {
      const label = groupLabel(s.endedAt || s.startedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return [...map.entries()];
  }, [history]);

  void tick;
  const displayMs = active ? getSessionActiveMs(active) : 0;

  const bump = () => {
    setHistoryTick((n) => n + 1);
    onSessionChange?.();
  };

  const handleStart = () => {
    const s = startStudySession(userId, topic);
    setActive(s);
    bump();
  };

  const handlePause = () => {
    const s = pauseStudySession(userId);
    setActive(s);
    bump();
  };

  const handleResume = () => {
    const s = resumeStudySession(userId);
    setActive(s);
    bump();
  };

  const handleEnd = () => {
    endStudySession(userId);
    setActive(null);
    bump();
  };

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <Timer size={22} /> Study Sessions
          </h1>
          <p>Focused DSA sessions with a timer that survives navigation.</p>
        </div>
      </header>

      <div className="learn-grid-2">
        <section className="learn-card learn-session-active">
          <h2>Active session</h2>
          {active && active.status !== "completed" ? (
            <>
              <div className="learn-session-topic">{active.topic} Session</div>
              <div className="learn-session-timer" aria-live="polite">
                {formatHMS(displayMs)}
              </div>
              <div className="learn-day-stats">
                <div>
                  <strong>{active.solvedProblemIds.length}</strong>
                  <span>Solved</span>
                </div>
                <div>
                  <strong>{active.attemptedProblemIds.length}</strong>
                  <span>Attempted</span>
                </div>
                <div>
                  <strong>
                    {active.attemptedProblemIds.length
                      ? Math.round(
                          (active.solvedProblemIds.length /
                            active.attemptedProblemIds.length) *
                            100
                        )
                      : 0}
                    %
                  </strong>
                  <span>Accuracy</span>
                </div>
              </div>
              <div className="learn-session-actions">
                {active.status === "running" ? (
                  <button type="button" onClick={handlePause}>
                    <Pause size={14} /> Pause
                  </button>
                ) : (
                  <button type="button" onClick={handleResume}>
                    <Play size={14} /> Resume
                  </button>
                )}
                <button type="button" className="danger" onClick={handleEnd}>
                  <Square size={14} /> End Session
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="learn-empty">No active session. Start one to track focus time.</p>
              <label className="learn-field">
                Topic
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
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
                className="learn-primary-btn"
                onClick={handleStart}
              >
                <Play size={14} /> Start Session
              </button>
            </>
          )}
        </section>

        <section className="learn-card">
          <div className="learn-card-head">
            <h2>Session History</h2>
            <div className="learn-filter-pills">
              {(
                [
                  ["today", "Today"],
                  ["week", "This Week"],
                  ["month", "This Month"],
                  ["all", "All Time"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {grouped.length === 0 ? (
            <p className="learn-empty">No sessions completed yet.</p>
          ) : (
            <div className="learn-session-history">
              {grouped.map(([label, list]) => (
                <div key={label} className="learn-session-group">
                  <h3>{label}</h3>
                  {list.map((s) => {
                    const attempted = s.attemptedProblemIds.length;
                    const solved = s.solvedProblemIds.length;
                    const acc = attempted
                      ? Math.round((solved / attempted) * 100)
                      : 0;
                    return (
                      <article key={s.id} className="learn-session-row">
                        <div>
                          <strong>{s.topic}</strong>
                          <span className="learn-muted">
                            <Clock size={12} /> {formatDurationMs(s.accumulatedMs)}
                          </span>
                        </div>
                        <div className="learn-session-meta">
                          {attempted} problems · {solved} solved · {acc}%
                        </div>
                        {s.solvedProblemIds.length > 0 && onSelectProblem && (
                          <div className="learn-topic-problems">
                            {s.solvedProblemIds.slice(0, 4).map((pid) => {
                              const p = problems.find(
                                (x) => (x.id || x._id || "").toString() === pid
                              );
                              if (!p) return null;
                              return (
                                <button
                                  key={pid}
                                  type="button"
                                  className="done"
                                  onClick={() => onSelectProblem(p)}
                                >
                                  ✓ {p.title}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
