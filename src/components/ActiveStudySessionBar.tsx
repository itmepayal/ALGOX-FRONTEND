import { useEffect, useState, type FC } from "react";
import { Pause, Play, Square, Timer } from "lucide-react";
import {
  endStudySession,
  formatHMS,
  getSessionActiveMs,
  loadActiveSession,
  pauseStudySession,
  resumeStudySession,
  type StudySession,
} from "../utils/learningPersistence";

interface Props {
  userId?: string;
  refreshKey?: number;
  onChange?: () => void;
  onOpenSessions?: () => void;
}

/** Floating compact timer — survives problem workspace / tab changes via localStorage. */
export const ActiveStudySessionBar: FC<Props> = ({
  userId,
  refreshKey = 0,
  onChange,
  onOpenSessions,
}) => {
  const [session, setSession] = useState<StudySession | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSession(loadActiveSession(userId));
  }, [userId, refreshKey]);

  useEffect(() => {
    if (!session || session.status !== "running") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [session?.id, session?.status]);

  if (!session || session.status === "completed") return null;

  void tick;
  const ms = getSessionActiveMs(session);

  const refresh = () => {
    setSession(loadActiveSession(userId));
    onChange?.();
  };

  return (
    <div className="learn-session-bar" role="status">
      <button type="button" className="learn-session-bar-main" onClick={onOpenSessions}>
        <Timer size={14} />
        <strong>{session.topic}</strong>
        <span className="learn-session-bar-time">{formatHMS(ms)}</span>
        <span className="learn-muted">
          {session.solvedProblemIds.length}/{session.attemptedProblemIds.length}
        </span>
      </button>
      <div className="learn-session-bar-actions">
        {session.status === "running" ? (
          <button
            type="button"
            aria-label="Pause session"
            onClick={() => {
              pauseStudySession(userId);
              refresh();
            }}
          >
            <Pause size={14} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Resume session"
            onClick={() => {
              resumeStudySession(userId);
              refresh();
            }}
          >
            <Play size={14} />
          </button>
        )}
        <button
          type="button"
          aria-label="End session"
          onClick={() => {
            endStudySession(userId);
            refresh();
          }}
        >
          <Square size={14} />
        </button>
      </div>
    </div>
  );
};
