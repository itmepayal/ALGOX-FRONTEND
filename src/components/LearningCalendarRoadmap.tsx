import { useEffect, useMemo, useState, type FC } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Flame,
} from "lucide-react";
import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import {
  loadAllSessions,
  toDateKey,
  type StudySession,
} from "../utils/learningPersistence";
import { learningApi } from "../api/learningApi";
import {
  buildDayActivityMap,
  buildRoadmap,
  computeStreaks,
  type DayActivity,
} from "../utils/learningStats";
import { isSolved } from "../utils/problemUtils";

interface Props {
  problems: Problem[];
  submissions: Submission[];
  userId?: string;
  refreshKey?: number;
  onSelectProblem: (p: Problem) => void;
  onStartSession?: (topic: string) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export const LearningCalendarRoadmap: FC<Props> = ({
  problems,
  submissions,
  userId,
  refreshKey = 0,
  onSelectProblem,
  onStartSession,
}) => {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selectedKey, setSelectedKey] = useState(toDateKey(today));
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [plannedByDate, setPlannedByDate] = useState<Record<string, number>>(
    {}
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        if (!cancelled) {
          setSessions([]);
          setPlannedByDate({});
        }
        return;
      }
      try {
        const from = toDateKey(new Date(cursor.year, cursor.month, 1));
        const to = toDateKey(
          new Date(cursor.year, cursor.month + 1, 0)
        );
        const [listRes, plansRes] = await Promise.all([
          loadAllSessions(userId),
          learningApi.listPlans(from, to),
        ]);
        const map: Record<string, number> = {};
        for (const plan of plansRes.data || []) {
          map[plan.date] = (plan.tasks || []).filter(
            (t) => t.type === "problem"
          ).length;
        }
        if (!cancelled) {
          setSessions(listRes);
          setPlannedByDate(map);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
          setPlannedByDate({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, cursor.year, cursor.month, refreshKey]);

  const activity = useMemo(
    () => buildDayActivityMap(submissions, sessions, plannedByDate),
    [submissions, sessions, plannedByDate]
  );

  const streaks = useMemo(() => computeStreaks(activity), [activity]);
  const roadmap = useMemo(
    () => buildRoadmap(problems, submissions),
    [problems, submissions]
  );

  const selected: DayActivity | undefined = activity.get(selectedKey);
  const selectedProblems = useMemo(() => {
    const ids = new Set(selected?.solvedProblemIds || []);
    return problems.filter((p) => ids.has((p.id || p._id || "").toString()));
  }, [problems, selected]);

  const firstDow = (() => {
    const dow = new Date(cursor.year, cursor.month, 1).getDay(); // 0 Sun
    return dow === 0 ? 6 : dow - 1; // Mon=0
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

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <CalendarDays size={22} /> Calendar + Roadmap
          </h1>
          <p>
            Track daily DSA activity from real submissions and study sessions.{" "}
            <span style={{ color: "var(--text-muted)" }}>
              Stored on this device (not synced to server).
            </span>
          </p>
        </div>
        <div className="learn-stat-pills">
          <span>
            <Flame size={14} /> Streak {streaks.current}d
          </span>
          <span>Best {streaks.longest}d</span>
        </div>
      </header>

      <div className="learn-grid-2">
        <section className="learn-card">
          <div className="learn-card-head">
            <h2>Calendar</h2>
            <div className="learn-month-nav">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setCursor((c) => {
                    const m = c.month - 1;
                    return m < 0
                      ? { year: c.year - 1, month: 11 }
                      : { year: c.year, month: m };
                  })
                }
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{monthLabel(cursor.year, cursor.month)}</strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setCursor((c) => {
                    const m = c.month + 1;
                    return m > 11
                      ? { year: c.year + 1, month: 0 }
                      : { year: c.year, month: m };
                  })
                }
              >
                <ChevronRight size={16} />
              </button>
              <button type="button" className="learn-today-btn" onClick={goToday}>
                Today
              </button>
            </div>
          </div>

          <div className="learn-cal-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="learn-cal-grid">
            {cells.map((c, i) => {
              if (c.day == null) {
                return <div key={`e-${i}`} className="learn-cal-cell empty" />;
              }
              const act = activity.get(c.key!);
              const isToday = c.key === toDateKey(today);
              const level = act?.level || "none";
              return (
                <button
                  key={c.key}
                  type="button"
                  className={`learn-cal-cell ${level} ${
                    selectedKey === c.key ? "selected" : ""
                  } ${isToday ? "today" : ""}`}
                  onClick={() => setSelectedKey(c.key!)}
                  aria-label={`${c.key} ${level}`}
                >
                  <span className="learn-cal-num">{c.day}</span>
                  <span className="learn-cal-dot" aria-hidden />
                </button>
              );
            })}
          </div>

          <div className="learn-legend">
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

        <section className="learn-card">
          <h2>{selectedKey}</h2>
          {!selected ||
          (selected.acceptedCount === 0 &&
            selected.sessionsCompleted === 0 &&
            selectedProblems.length === 0) ? (
            <p className="learn-empty">No activity yet for this day.</p>
          ) : (
            <>
              <div className="learn-day-stats">
                <div>
                  <strong>{selected.acceptedCount}</strong>
                  <span>Accepted</span>
                </div>
                <div>
                  <strong>{selected.sessionsCompleted}</strong>
                  <span>Sessions</span>
                </div>
                <div>
                  <strong>
                    {Math.round(selected.studyMs / 60000) || 0}m
                  </strong>
                  <span>Study time</span>
                </div>
              </div>
              <h3 className="learn-subhead">Problems</h3>
              <ul className="learn-problem-list">
                {selectedProblems.length === 0 && (
                  <li className="learn-empty">No accepted problems logged.</li>
                )}
                {selectedProblems.map((p) => (
                  <li key={p.id || p._id}>
                    <Check size={14} className="ok" />
                    <button type="button" onClick={() => onSelectProblem(p)}>
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="learn-card">
        <div className="learn-card-head">
          <h2>Roadmap</h2>
          <span className="learn-muted">
            Auto-updates from Accepted submissions
          </span>
        </div>
        {roadmap.length === 0 || roadmap.every((t) => t.total === 0) ? (
          <p className="learn-empty">Start your DSA journey — problems will map onto this roadmap by category.</p>
        ) : (
          <div className="learn-roadmap">
            {roadmap.map((t) => (
              <div key={t.name} className={`learn-roadmap-row ${t.status}`}>
                <div className="learn-roadmap-top">
                  <div className="learn-roadmap-title">
                    {t.status === "COMPLETED" ? (
                      <Check size={16} className="ok" />
                    ) : t.status === "IN_PROGRESS" ? (
                      <Circle size={16} className="prog" />
                    ) : (
                      <Circle size={16} className="todo" />
                    )}
                    <strong>{t.name}</strong>
                    <span className="learn-status-pill">
                      {t.status.replace("_", " ")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="learn-link-btn"
                    onClick={() => onStartSession?.(t.name)}
                  >
                    Start session
                  </button>
                </div>
                <div className="learn-progress-meta">
                  {t.solved} / {t.total} solved · {t.pct}%
                </div>
                <div className="learn-progress-bar">
                  <span style={{ width: `${t.pct}%` }} />
                </div>
                <div className="learn-diff-mini">
                  <span>E {t.easy}</span>
                  <span>M {t.medium}</span>
                  <span>H {t.hard}</span>
                </div>
                <div className="learn-topic-problems">
                  {t.problemIds.length === 0 ? (
                    <span className="learn-muted">No problems linked yet</span>
                  ) : (
                    t.problemIds.slice(0, 6).map((pid) => {
                      const p = problems.find(
                        (x) => (x.id || x._id || "").toString() === pid
                      );
                      if (!p) return null;
                      const done = isSolved(pid, submissions);
                      return (
                        <button
                          key={pid}
                          type="button"
                          className={done ? "done" : ""}
                          onClick={() => onSelectProblem(p)}
                        >
                          {done ? "✓ " : "○ "}
                          {p.title}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
