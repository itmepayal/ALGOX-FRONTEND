import type { FC } from "react";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { cn } from "../../lib/cn";

interface OnlineUsersIndicatorProps {
  problemId?: string | null;
  className?: string;
}

type PresenceState = "live" | "loading" | "offline" | "reconnecting" | "stale";

/**
 * Floating bottom-right live unique-online chip for the problem workspace.
 * Anchored to the LEFT PANEL (absolute), never viewport-fixed.
 * Count comes from RealtimeService Redis/memory presence — never mocked.
 */
export const OnlineUsersIndicator: FC<OnlineUsersIndicatorProps> = ({
  problemId,
  className = "",
}) => {
  const { onlineUsers, connected, reconnecting, unavailable } = useOnlineUsers({
    problemId,
  });

  let state: PresenceState = "live";
  let countText: string | null = null;
  let suffix = "Online";

  if (reconnecting) {
    state = "reconnecting";
    countText = null;
    suffix = "Reconnecting…";
  } else if (!connected && unavailable && onlineUsers == null) {
    state = "offline";
    countText = null;
    suffix = "Online unavailable";
  } else if (onlineUsers == null) {
    state = "loading";
    countText = "—";
    suffix = "Online";
  } else {
    countText = onlineUsers.toLocaleString();
    suffix = "Online";
    state = connected ? "live" : "stale";
  }

  const aria =
    reconnecting
      ? "Reconnecting to online users"
      : onlineUsers == null
        ? "Online users loading"
        : `${onlineUsers} users currently online`;

  return (
    <aside
      className={cn(
        "pointer-events-none absolute bottom-4 right-4 z-[6] md:bottom-4 md:right-5",
        "inline-flex h-8 items-center gap-2 rounded-[10px] border px-3",
        "select-none whitespace-nowrap shadow-md backdrop-blur-md",
        "ring-1 ring-inset ring-white/[0.04]",
        state === "live" &&
          "border-emerald-500/35 bg-slate-950/85 text-emerald-100",
        state === "loading" &&
          "border-slate-600/50 bg-slate-950/85 text-slate-400",
        state === "offline" &&
          "border-slate-600/50 bg-slate-950/85 text-slate-400",
        state === "reconnecting" &&
          "border-slate-500/40 bg-slate-950/85 text-slate-300",
        state === "stale" &&
          "border-amber-500/35 bg-slate-950/85 text-amber-100",
        className,
      )}
      title={
        unavailable && onlineUsers == null
          ? "Online count temporarily unavailable"
          : "Users currently online on AlgoPath"
      }
      aria-live="polite"
      aria-atomic="true"
      aria-label={aria}
    >
      <span
        className={cn(
          "relative h-2 w-2 shrink-0 rounded-full",
          state === "live" && "bg-emerald-400",
          (state === "loading" || state === "offline" || state === "reconnecting") &&
            "bg-slate-400",
          state === "stale" && "bg-amber-400",
        )}
        aria-hidden
      >
        {state === "live" ? (
          <span className="absolute inset-0 motion-safe:animate-ping rounded-full bg-emerald-400/50" />
        ) : null}
      </span>

      <span className="inline-flex items-baseline gap-1.5 leading-none">
        {countText != null ? (
          <span className="font-technical text-[13px] font-semibold tabular-nums tracking-tight text-inherit">
            {countText}
          </span>
        ) : null}
        <span
          className={cn(
            "font-primary text-[12px] font-medium tracking-wide",
            state === "live" && "text-emerald-50/90",
            state === "stale" && "text-amber-50/90",
            (state === "loading" ||
              state === "offline" ||
              state === "reconnecting") &&
              "text-inherit",
          )}
        >
          {suffix}
        </span>
      </span>
    </aside>
  );
};

export default OnlineUsersIndicator;
