import type { FC } from "react";
import { Badge } from "../../ui/badge";
import { cn } from "../../../lib/cn";

type Tone = "success" | "danger" | "warning" | "primary" | "default";

/** Map any realtime/admin event name to an existing Badge tone. Dynamic — not a fixed allow-list. */
export function eventTone(name: string): Tone {
  const n = name.toLowerCase().trim();
  if (!n || n === "—") return "default";

  if (
    n === "user.online" ||
    n.endsWith(".online") ||
    n.includes(".created") ||
    n.includes(".completed") ||
    n.includes(".joined") ||
    n.includes(".open") ||
    n.includes(".published") ||
    n.includes(".success")
  ) {
    return "success";
  }

  if (
    n === "user.offline" ||
    n.endsWith(".offline") ||
    n.includes(".failed") ||
    n.includes(".error") ||
    n.includes(".deleted") ||
    n.includes(".left") ||
    n.includes(".closed") ||
    n.includes("force_disconnect") ||
    n.includes(".timeout") ||
    n.includes("suspicious") ||
    n.includes("alert")
  ) {
    return "danger";
  }

  if (
    n.includes(".queued") ||
    n.includes(".running") ||
    n.includes(".progress") ||
    n.includes(".pending") ||
    n === "user.idle" ||
    n === "user.reconnecting" ||
    n.includes(".maintenance") ||
    n.includes("rate_limit")
  ) {
    return "warning";
  }

  if (
    n.startsWith("presence") ||
    n.startsWith("room.") ||
    n.startsWith("leaderboard") ||
    n.startsWith("notification") ||
    n.includes("heartbeat") ||
    n.includes("broadcast")
  ) {
    return "primary";
  }

  return "default";
}

export const EventBadge: FC<{
  name: string;
  className?: string;
}> = ({ name, className }) => {
  const label = name?.trim() || "—";
  return (
    <Badge
      variant={eventTone(label)}
      className={cn(
        "font-technical max-w-[240px] truncate text-[0.7rem] font-medium normal-case tracking-normal",
        className,
      )}
      title={label}
    >
      {label}
    </Badge>
  );
};
