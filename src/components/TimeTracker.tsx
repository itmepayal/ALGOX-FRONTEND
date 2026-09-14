import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  memo,
  type FC,
  type MouseEvent,
} from "react";
import {
  Clock,
  Pause,
  Play,
  RotateCcw,
  Timer as TimerIcon,
} from "lucide-react";
import {
  clampTimerParts,
  formatHMS,
  getStopwatchElapsedMs,
  getTimerRemainingMs,
  loadTimeTracker,
  msToParts,
  saveTimeTracker,
  type TimeMode,
  type TimeTrackerPersisted,
} from "../utils/timeTrackerPersistence";

interface TimeTrackerProps {
  userId?: string;
  problemId: string;
}

function playTimeUpBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.stop(ctx.currentTime + 0.65);
    void ctx.resume();
  } catch {
    // autoplay blocked — ignore
  }
}

/**
 * Isolated time tracker — owns its own state so ProblemWorkspace
 * (editor / description) does not re-render every second.
 */
export const TimeTracker: FC<TimeTrackerProps> = memo(function TimeTracker({
  userId,
  problemId,
}) {
  const [state, setState] = useState<TimeTrackerPersisted>(() =>
    loadTimeTracker(userId, problemId)
  );
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [timerInputs, setTimerInputs] = useState(() => {
    const parts = msToParts(loadTimeTracker(userId, problemId).timer.durationMs);
    return {
      hours: String(parts.hours).padStart(2, "0"),
      minutes: String(parts.minutes).padStart(2, "0"),
      seconds: String(parts.seconds).padStart(2, "0"),
    };
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const completedBeepRef = useRef(false);

  // Load per-problem state when context changes
  useLayoutEffect(() => {
    const next = loadTimeTracker(userId, problemId);
    // Reconcile running timers after refresh using wall clock
    const n = Date.now();
    if (next.timer.status === "running" && next.timer.endsAt != null) {
      if (next.timer.endsAt <= n) {
        next.timer = {
          ...next.timer,
          status: "completed",
          remainingMs: 0,
          endsAt: null,
        };
      }
    }
    setState(next);
    setNow(n);
    setOpen(false);
    completedBeepRef.current = next.timer.status === "completed";
    const parts = msToParts(next.timer.durationMs);
    setTimerInputs({
      hours: String(parts.hours).padStart(2, "0"),
      minutes: String(parts.minutes).padStart(2, "0"),
      seconds: String(parts.seconds).padStart(2, "0"),
    });
  }, [userId, problemId]);

  // Persist (debounced lightly via rAF batching with effect)
  useEffect(() => {
    saveTimeTracker(userId, problemId, state);
  }, [state, userId, problemId]);

  // Single display tick — only while something is running or popover open
  const needsTick =
    state.stopwatch.status === "running" ||
    state.timer.status === "running" ||
    open;

  useEffect(() => {
    if (!needsTick) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [needsTick]);

  // Visibility: snap clock when returning to tab (interval may have been throttled)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  // Auto-complete timer when remaining hits 0
  useEffect(() => {
    if (state.timer.status !== "running") return;
    const remaining = getTimerRemainingMs(state.timer, now);
    if (remaining > 0) return;
    setState((prev) => {
      if (prev.timer.status !== "running") return prev;
      return {
        ...prev,
        timer: {
          ...prev.timer,
          status: "completed",
          remainingMs: 0,
          endsAt: null,
        },
      };
    });
    if (!completedBeepRef.current) {
      completedBeepRef.current = true;
      playTimeUpBeep();
    }
  }, [now, state.timer]);

  // Outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown as unknown as EventListener);
    document.addEventListener("keydown", onKey as unknown as EventListener);
    return () => {
      document.removeEventListener("mousedown", onDown as unknown as EventListener);
      document.removeEventListener("keydown", onKey as unknown as EventListener);
    };
  }, [open]);

  const stopwatchMs = getStopwatchElapsedMs(state.stopwatch, now);
  const timerMs = getTimerRemainingMs(state.timer, now);

  const displayMs = state.mode === "stopwatch" ? stopwatchMs : timerMs;
  const displayRunning =
    state.mode === "stopwatch"
      ? state.stopwatch.status === "running"
      : state.timer.status === "running";
  const displayLabel = formatHMS(displayMs);

  const setMode = useCallback((mode: TimeMode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const toggleStopwatch = useCallback(() => {
    setState((prev) => {
      const sw = prev.stopwatch;
      const n = Date.now();
      if (sw.status === "running") {
        return {
          ...prev,
          mode: "stopwatch",
          stopwatch: {
            status: "paused",
            accumulatedMs: getStopwatchElapsedMs(sw, n),
            startedAt: null,
          },
        };
      }
      // idle or paused → start/resume (guard: only one running segment)
      return {
        ...prev,
        mode: "stopwatch",
        stopwatch: {
          status: "running",
          accumulatedMs: sw.accumulatedMs,
          startedAt: n,
        },
      };
    });
    setNow(Date.now());
  }, []);

  const resetStopwatch = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stopwatch: { status: "idle", accumulatedMs: 0, startedAt: null },
    }));
    setNow(Date.now());
  }, []);

  const applyTimerDurationFromInputs = useCallback(() => {
    const h = Number(timerInputs.hours);
    const m = Number(timerInputs.minutes);
    const s = Number(timerInputs.seconds);
    const { hours, minutes, seconds, totalMs } = clampTimerParts(h, m, s);
    setTimerInputs({
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    });
    setState((prev) => {
      if (prev.timer.status === "running") return prev;
      return {
        ...prev,
        timer: {
          ...prev.timer,
          status: totalMs > 0 ? "idle" : "completed",
          durationMs: totalMs,
          remainingMs: totalMs,
          endsAt: null,
        },
      };
    });
    completedBeepRef.current = false;
  }, [timerInputs]);

  const toggleTimer = useCallback(() => {
    setState((prev) => {
      const t = prev.timer;
      const n = Date.now();
      if (t.status === "running") {
        return {
          ...prev,
          mode: "timer",
          timer: {
            ...t,
            status: "paused",
            remainingMs: getTimerRemainingMs(t, n),
            endsAt: null,
          },
        };
      }
      const remaining =
        t.status === "completed" ? t.durationMs : Math.max(0, t.remainingMs);
      if (remaining <= 0) return prev;
      completedBeepRef.current = false;
      return {
        ...prev,
        mode: "timer",
        timer: {
          ...t,
          status: "running",
          remainingMs: remaining,
          endsAt: n + remaining,
        },
      };
    });
    setNow(Date.now());
  }, []);

  const resetTimer = useCallback(() => {
    setState((prev) => {
      const duration = Math.max(0, prev.timer.durationMs);
      return {
        ...prev,
        timer: {
          status: duration > 0 ? "idle" : "completed",
          durationMs: duration,
          remainingMs: duration,
          endsAt: null,
        },
      };
    });
    completedBeepRef.current = false;
    setNow(Date.now());
  }, []);

  const onTopBarPrimary = () => {
    // Open popover; play/pause is inside popover / secondary icon
    setOpen((o) => !o);
  };

  const onTopBarToggleRun = (e: MouseEvent) => {
    e.stopPropagation();
    if (state.mode === "stopwatch") toggleStopwatch();
    else toggleTimer();
  };

  const onTopBarReset = (e: MouseEvent) => {
    e.stopPropagation();
    if (state.mode === "stopwatch") resetStopwatch();
    else resetTimer();
  };

  const timerEditable =
    state.timer.status === "idle" ||
    state.timer.status === "paused" ||
    state.timer.status === "completed";

  return (
    <div className="lc-time-tracker" ref={rootRef}>
      <div className="lc-timer-pill lc-timer-pill-interactive">
        <button
          type="button"
          className="lc-timer-run-btn"
          aria-label={
            displayRunning
              ? state.mode === "stopwatch"
                ? "Pause stopwatch"
                : "Pause timer"
              : state.mode === "stopwatch"
                ? "Start stopwatch"
                : "Start timer"
          }
          title={displayRunning ? "Pause" : "Start"}
          onClick={onTopBarToggleRun}
        >
          {displayRunning ? (
            <Pause size={12} fill="currentColor" />
          ) : (
            <Play size={12} fill="currentColor" />
          )}
        </button>

        <button
          type="button"
          className="lc-timer-display-btn"
          aria-label="Open timer panel"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={onTopBarPrimary}
        >
          {state.mode === "timer" && (
            <TimerIcon size={12} className="lc-timer-mode-icon" aria-hidden />
          )}
          <span className="lc-timer-display">{displayLabel}</span>
          {state.timer.status === "completed" && state.mode === "timer" && (
            <span className="lc-timer-done-dot" title="Time's up" />
          )}
        </button>

        <button
          type="button"
          className="lc-timer-reset-btn"
          aria-label={
            state.mode === "stopwatch" ? "Reset stopwatch" : "Reset timer"
          }
          title="Reset"
          onClick={onTopBarReset}
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {open && (
        <div
          className="lc-time-popover"
          role="dialog"
          aria-label="Stopwatch and timer"
        >
          <div className="lc-time-mode-row">
            <button
              type="button"
              className={`lc-time-mode-card ${
                state.mode === "stopwatch" ? "active" : ""
              }`}
              aria-label="Stopwatch"
              aria-pressed={state.mode === "stopwatch"}
              onClick={() => setMode("stopwatch")}
            >
              <Clock size={22} strokeWidth={1.5} />
              <span>Stopwatch</span>
            </button>
            <button
              type="button"
              className={`lc-time-mode-card ${
                state.mode === "timer" ? "active" : ""
              }`}
              aria-label="Timer"
              aria-pressed={state.mode === "timer"}
              onClick={() => setMode("timer")}
            >
              <TimerIcon size={22} strokeWidth={1.5} />
              <span>Timer</span>
            </button>
          </div>

          {state.mode === "stopwatch" ? (
            <div className="lc-time-panel">
              <div className="lc-time-big">{formatHMS(stopwatchMs)}</div>
              <button
                type="button"
                className="lc-time-primary-btn"
                aria-label={
                  state.stopwatch.status === "running"
                    ? "Pause stopwatch"
                    : "Start stopwatch"
                }
                onClick={toggleStopwatch}
              >
                {state.stopwatch.status === "running" ? (
                  <>
                    <Pause size={14} /> Pause
                  </>
                ) : (
                  <>
                    <Play size={14} />{" "}
                    {state.stopwatch.status === "paused" ? "Resume" : "Start"}
                  </>
                )}
              </button>
              <button
                type="button"
                className="lc-time-reset-row"
                aria-label="Reset stopwatch"
                onClick={resetStopwatch}
              >
                <RotateCcw size={14} />
                <span>Reset Stopwatch</span>
              </button>
            </div>
          ) : (
            <div className="lc-time-panel">
              {state.timer.status === "completed" ? (
                <div className="lc-time-big lc-time-up">Time&apos;s up!</div>
              ) : (
                <div className="lc-time-big">{formatHMS(timerMs)}</div>
              )}

              {timerEditable && state.timer.status !== "running" && (
                <div className="lc-timer-inputs" aria-label="Timer duration">
                  <label>
                    <span>Hours</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={timerInputs.hours}
                      onChange={(e) =>
                        setTimerInputs((p) => ({
                          ...p,
                          hours: e.target.value,
                        }))
                      }
                      onBlur={applyTimerDurationFromInputs}
                      aria-label="Timer hours"
                    />
                  </label>
                  <span className="lc-timer-sep">:</span>
                  <label>
                    <span>Min</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={timerInputs.minutes}
                      onChange={(e) =>
                        setTimerInputs((p) => ({
                          ...p,
                          minutes: e.target.value,
                        }))
                      }
                      onBlur={applyTimerDurationFromInputs}
                      aria-label="Timer minutes"
                    />
                  </label>
                  <span className="lc-timer-sep">:</span>
                  <label>
                    <span>Sec</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={timerInputs.seconds}
                      onChange={(e) =>
                        setTimerInputs((p) => ({
                          ...p,
                          seconds: e.target.value,
                        }))
                      }
                      onBlur={applyTimerDurationFromInputs}
                      aria-label="Timer seconds"
                    />
                  </label>
                </div>
              )}

              <button
                type="button"
                className="lc-time-primary-btn"
                aria-label={
                  state.timer.status === "running" ? "Pause timer" : "Start timer"
                }
                disabled={
                  state.timer.status !== "running" &&
                  getTimerRemainingMs(state.timer, now) <= 0 &&
                  state.timer.durationMs <= 0
                }
                onClick={toggleTimer}
              >
                {state.timer.status === "running" ? (
                  <>
                    <Pause size={14} /> Pause
                  </>
                ) : (
                  <>
                    <Play size={14} />{" "}
                    {state.timer.status === "paused"
                      ? "Resume"
                      : state.timer.status === "completed"
                        ? "Restart"
                        : "Start"}
                  </>
                )}
              </button>
              <button
                type="button"
                className="lc-time-reset-row"
                aria-label="Reset timer"
                onClick={resetTimer}
              >
                <RotateCcw size={14} />
                <span>Reset Timer</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
