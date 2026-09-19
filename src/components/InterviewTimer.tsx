import { memo, useEffect, useRef, useState, type FC } from "react";
import { Clock } from "lucide-react";
import { cn } from "../lib/cn";

export type InterviewTimerProps = {
  /** Server-authoritative interview end instant (ISO). */
  endsAt: string;
  /**
   * Server clock at the moment remaining was computed (ISO).
   * Used once to establish client/server offset for display only.
   */
  serverNow?: string;
  /** Optional initial remaining from API (ms) — used if serverNow missing. */
  initialRemainingMs?: number;
  className?: string;
  urgentBelowMs?: number;
  /** Called once when display reaches zero (does not finalize session locally). */
  onExpireDisplay?: () => void;
};

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Display-only countdown. Parent must NOT store remainingMs —
 * only this component updates every second.
 * Expiration / status transitions remain server-authoritative.
 */
export const InterviewTimer: FC<InterviewTimerProps> = memo(
  function InterviewTimer({
    endsAt,
    serverNow,
    initialRemainingMs,
    className,
    urgentBelowMs = 60_000,
    onExpireDisplay,
  }) {
    const onExpireRef = useRef(onExpireDisplay);
    useEffect(() => {
      onExpireRef.current = onExpireDisplay;
    }, [onExpireDisplay]);

    const [remainingMs, setRemainingMs] = useState(() => {
      const end = new Date(endsAt).getTime();
      if (serverNow) {
        const offset = Date.now() - new Date(serverNow).getTime();
        return Math.max(0, end - (Date.now() - offset));
      }
      if (typeof initialRemainingMs === "number") {
        return Math.max(0, initialRemainingMs);
      }
      return Math.max(0, end - Date.now());
    });

    useEffect(() => {
      const end = new Date(endsAt).getTime();
      const offset = serverNow
        ? Date.now() - new Date(serverNow).getTime()
        : 0;

      const compute = () => Math.max(0, end - (Date.now() - offset));
      // Align display when endsAt/serverNow change; interval owns subsequent ticks.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync external clock anchors
      setRemainingMs(compute());

      let expiredNotified = false;
      const id = window.setInterval(() => {
        const next = compute();
        setRemainingMs(next);
        if (next <= 0 && !expiredNotified) {
          expiredNotified = true;
          onExpireRef.current?.();
        }
      }, 1000);

      return () => window.clearInterval(id);
      // Intentionally omit onExpireDisplay — held in ref so one interval stays alive.
    }, [endsAt, serverNow]);

    return (
      <span
        className={cn(
          "free-home-muted mock-interview-timer",
          remainingMs < urgentBelowMs && "mock-interview-timer-urgent",
          className
        )}
        aria-live="polite"
      >
        <Clock size={14} aria-hidden /> {formatMs(remainingMs)} left
      </span>
    );
  }
);
