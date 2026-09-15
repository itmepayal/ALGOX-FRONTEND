import type { FC } from "react";
import { Badge } from "../../ui/badge";
import { cn } from "../../../lib/cn";

type Tone = "success" | "danger" | "warning" | "primary" | "default" | "technical";

export function sourceTone(source: string): Tone {
  const s = source.toLowerCase().trim();
  if (!s) return "default";
  if (s === "system" || s === "gateway" || s === "websocket" || s === "ws") {
    return "primary";
  }
  if (s === "api" || s === "http" || s === "out") return "technical";
  if (s === "worker" || s === "queue" || s === "in") return "warning";
  if (s === "user" || s === "client") return "default";
  return "default";
}

export const SourceBadge: FC<{
  source: string;
  className?: string;
}> = ({ source, className }) => {
  const label = source?.trim() || "—";
  if (label === "—") {
    return (
      <span className="font-primary text-xs text-muted-foreground">—</span>
    );
  }
  return (
    <Badge
      variant={sourceTone(label)}
      className={cn(
        "max-w-[140px] truncate font-primary text-[0.7rem] font-medium normal-case tracking-normal",
        className,
      )}
      title={label}
    >
      {label}
    </Badge>
  );
};
