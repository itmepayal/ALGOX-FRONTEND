/** Client-only time tracker persistence (no secrets). */

export type TimeMode = "stopwatch" | "timer";
export type StopwatchStatus = "idle" | "running" | "paused";
export type TimerStatus = "idle" | "running" | "paused" | "completed";

export interface StopwatchPersisted {
  status: StopwatchStatus;
  /** Elapsed ms while paused / before current run segment */
  accumulatedMs: number;
  /** Wall-clock start of current running segment (null if not running) */
  startedAt: number | null;
}

export interface TimerPersisted {
  status: TimerStatus;
  /** Configured duration in ms */
  durationMs: number;
  /** Remaining when idle/paused/completed */
  remainingMs: number;
  /** Absolute end timestamp while running */
  endsAt: number | null;
}

export interface TimeTrackerPersisted {
  mode: TimeMode;
  stopwatch: StopwatchPersisted;
  timer: TimerPersisted;
  updatedAt: number;
}

const PREFIX = "algox:time-tracker:";

export const DEFAULT_TIMER_MS = 30 * 60 * 1000;

export function defaultTimeTrackerState(): TimeTrackerPersisted {
  return {
    mode: "stopwatch",
    stopwatch: {
      status: "idle",
      accumulatedMs: 0,
      startedAt: null,
    },
    timer: {
      status: "idle",
      durationMs: DEFAULT_TIMER_MS,
      remainingMs: DEFAULT_TIMER_MS,
      endsAt: null,
    },
    updatedAt: Date.now(),
  };
}

function storageKey(userId: string | undefined, problemId: string): string {
  return `${PREFIX}${userId || "guest"}:${problemId}`;
}

export function loadTimeTracker(
  userId: string | undefined,
  problemId: string
): TimeTrackerPersisted {
  if (!problemId) return defaultTimeTrackerState();
  try {
    const raw = localStorage.getItem(storageKey(userId, problemId));
    if (!raw) return defaultTimeTrackerState();
    const parsed = JSON.parse(raw) as Partial<TimeTrackerPersisted>;
    const base = defaultTimeTrackerState();
    return {
      mode: parsed.mode === "timer" ? "timer" : "stopwatch",
      stopwatch: {
        status:
          parsed.stopwatch?.status === "running" ||
          parsed.stopwatch?.status === "paused"
            ? parsed.stopwatch.status
            : "idle",
        accumulatedMs: Math.max(0, Number(parsed.stopwatch?.accumulatedMs) || 0),
        startedAt:
          typeof parsed.stopwatch?.startedAt === "number"
            ? parsed.stopwatch.startedAt
            : null,
      },
      timer: {
        status:
          parsed.timer?.status === "running" ||
          parsed.timer?.status === "paused" ||
          parsed.timer?.status === "completed"
            ? parsed.timer.status
            : "idle",
        durationMs: Math.max(
          0,
          Number(parsed.timer?.durationMs) || DEFAULT_TIMER_MS
        ),
        remainingMs: Math.max(
          0,
          Number(
            parsed.timer?.remainingMs ??
              parsed.timer?.durationMs ??
              DEFAULT_TIMER_MS
          ) || 0
        ),
        endsAt:
          typeof parsed.timer?.endsAt === "number" ? parsed.timer.endsAt : null,
      },
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return defaultTimeTrackerState();
  }
}

export function saveTimeTracker(
  userId: string | undefined,
  problemId: string,
  state: TimeTrackerPersisted
): void {
  if (!problemId) return;
  try {
    localStorage.setItem(
      storageKey(userId, problemId),
      JSON.stringify({ ...state, updatedAt: Date.now() })
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Live stopwatch elapsed from timestamps (source of truth). */
export function getStopwatchElapsedMs(
  sw: StopwatchPersisted,
  now = Date.now()
): number {
  if (sw.status === "running" && sw.startedAt != null) {
    return Math.max(0, sw.accumulatedMs + (now - sw.startedAt));
  }
  return Math.max(0, sw.accumulatedMs);
}

/** Live timer remaining from timestamps (never negative). */
export function getTimerRemainingMs(
  timer: TimerPersisted,
  now = Date.now()
): number {
  if (timer.status === "running" && timer.endsAt != null) {
    return Math.max(0, timer.endsAt - now);
  }
  if (timer.status === "completed") return 0;
  return Math.max(0, timer.remainingMs);
}

export function formatHMS(totalMs: number): string {
  const totalSec = Math.floor(Math.max(0, totalMs) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function clampTimerParts(h: number, m: number, s: number): {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
} {
  const hours = Math.min(99, Math.max(0, Math.floor(h) || 0));
  const minutes = Math.min(59, Math.max(0, Math.floor(m) || 0));
  const seconds = Math.min(59, Math.max(0, Math.floor(s) || 0));
  return {
    hours,
    minutes,
    seconds,
    totalMs: ((hours * 60 + minutes) * 60 + seconds) * 1000,
  };
}

export function msToParts(ms: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  return {
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}
