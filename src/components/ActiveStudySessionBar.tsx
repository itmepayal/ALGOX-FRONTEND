import { useCallback, useEffect, useState, type FC } from "react";
import { Pause, Play, Square, Timer } from "lucide-react";
import {
  endStudySession,
  formatHMS,
  getSessionActiveMs,
  LearningPersistError,
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

/** Floating compact timer — active session state is server-authoritative. */
export const ActiveStudySessionBar: FC<Props> = ({
  userId,
  refreshKey = 0,
  onChange,
  onOpenSessions,
}) => {
  const [session, setSession] = useState<StudySession | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSession(null);
      return;
    }
    try {
      const s = await loadActiveSession(userId);
      setSession(s);
      setError(null);
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Failed to load session"
      );
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!session || session.status !== "running") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [session?.id, session?.status]);

  if (!session || session.status === "completed") return null;

  void tick;
  const ms = getSessionActiveMs(session);

  const act = async (fn: () => Promise<StudySession | null | unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      onChange?.();
    } catch (err) {
      setError(
        err instanceof LearningPersistError
          ? err.message
          : "Session action failed"
      );
      // Re-sync from server so we do not keep a zombie timer if end already persisted.
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = () =>
    void act(async () => {
      await endStudySession(userId);
      // Successful end: hide immediately; server is SoT (cache already cleared).
      setSession(null);
    });

  return (
    <div className="learn-session-bar" role="status">
      <button type="button" className="learn-session-bar-main" onClick={onOpenSessions}>
        <Timer size={14} />
        <strong>{session.topic}</strong>
        <span className="learn-session-bar-time">{formatHMS(ms)}</span>
        <span className="learn-muted">
          {session.solvedProblemIds.length}/{session.attemptedProblemIds.length}
        </span>
        {error ? <span className="learn-muted"> · {error}</span> : null}
      </button>
      <div className="learn-session-bar-actions">
        {session.status === "running" ? (
          <button
            type="button"
            aria-label="Pause session"
            disabled={busy}
            onClick={() => void act(() => pauseStudySession(userId))}
          >
            <Pause size={14} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Resume session"
            disabled={busy}
            onClick={() => void act(() => resumeStudySession(userId))}
          >
            <Play size={14} />
          </button>
        )}
        <button
          type="button"
          aria-label="End session"
          disabled={busy}
          onClick={handleEnd}
        >
          <Square size={14} />
        </button>
      </div>
    </div>
  );
};
