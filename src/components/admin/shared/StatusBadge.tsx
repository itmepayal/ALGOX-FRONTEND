import type { FC } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  Pause,
  X,
  CircleHelp,
} from "lucide-react";
import { Badge } from "../../ui/badge";
import { cn } from "../../../lib/cn";

export type StatusTone =
  | "success"
  | "danger"
  | "warning"
  | "primary"
  | "default";

function statusTone(status: string): StatusTone {
  const s = status.toLowerCase().trim();
  if (
    s === "ok" ||
    s === "success" ||
    s === "ready" ||
    s === "live" ||
    s.includes("accept") ||
    s === "active" ||
    s === "healthy" ||
    s === "published" ||
    s === "operational" ||
    s === "online" ||
    s === "easy" ||
    s === "completed" ||
    s === "done" ||
    s === "ended"
  ) {
    return "success";
  }
  if (
    s.includes("fail") ||
    s.includes("error") ||
    s === "offline" ||
    s === "blocked" ||
    s === "banned" ||
    s === "hard" ||
    s === "unavailable" ||
    s === "rejected" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "timeout"
  ) {
    return "danger";
  }
  if (
    s.includes("warn") ||
    s === "pending" ||
    s === "queued" ||
    s === "degraded" ||
    s === "draft" ||
    s === "medium" ||
    s === "idle" ||
    s === "reconnecting" ||
    s === "paused" ||
    s === "scheduled" ||
    s === "checking"
  ) {
    return "warning";
  }
  if (
    s.includes("run") ||
    s.includes("process") ||
    s.includes("info") ||
    s === "loading" ||
    s === "sending" ||
    s === "archived"
  ) {
    return "primary";
  }
  if (s === "expired" || s === "failed" || s === "unhealthy") {
    return "danger";
  }
  if (s === "rejected" || s === "unknown") {
    return s === "rejected" ? "danger" : "default";
  }
  return "default";
}

function StatusIcon({ status, tone }: { status: string; tone: StatusTone }) {
  const s = status.toLowerCase().trim();
  const size = 12;
  const sw = 2.25 as const;
  if (s === "live") {
    return <Loader2 size={size} strokeWidth={sw} className="size-3 shrink-0 animate-spin" aria-hidden />;
  }
  if (s === "checking" || s === "loading") {
    return <Loader2 size={size} strokeWidth={sw} className="size-3 shrink-0 animate-spin" aria-hidden />;
  }
  if (s === "scheduled" || s === "pending" || s === "queued") {
    return <Clock size={size} strokeWidth={sw} className="size-3 shrink-0" aria-hidden />;
  }
  if (tone === "success" || s === "ok" || s === "ended" || s === "completed") {
    return <Check size={size} strokeWidth={sw} className="size-3 shrink-0" aria-hidden />;
  }
  if (
    tone === "danger" ||
    s.includes("fail") ||
    s.includes("error") ||
    s === "cancelled" ||
    s === "canceled"
  ) {
    return <X size={size} strokeWidth={sw} className="size-3 shrink-0" aria-hidden />;
  }
  if (s.includes("warn") || s === "draft" || s === "degraded") {
    return <AlertTriangle size={size} strokeWidth={sw} className="size-3 shrink-0" aria-hidden />;
  }
  if (s.includes("process") || s.includes("run") || s === "loading") {
    return <Loader2 size={size} strokeWidth={sw} className="size-3 shrink-0 animate-spin" aria-hidden />;
  }
  if (s === "paused" || s === "idle" || s === "archived") {
    return <Pause size={size} strokeWidth={sw} className="size-3 shrink-0" aria-hidden />;
  }
  if (s.includes("clock") || s.includes("timeout")) {
    return <Clock size={size} strokeWidth={sw} className="size-3 shrink-0" aria-hidden />;
  }
  if (tone === "default") {
    return <CircleHelp size={size} strokeWidth={sw} className="size-3 shrink-0" aria-hidden />;
  }
  return null;
}

function displayStatus(status: string) {
  const s = status.trim();
  if (!s) return "UNKNOWN";
  if (s.toLowerCase() === "ok") return "OK";
  return s.replace(/_/g, " ").toUpperCase();
}

export const StatusBadge: FC<{
  status: string;
  className?: string;
  showIcon?: boolean;
}> = ({ status, className = "", showIcon = true }) => {
  const raw = status || "unknown";
  const tone = statusTone(raw);
  const label = displayStatus(raw);
  const s = raw.toLowerCase().trim();
  /** Difficulty uses DifficultyBadge — skip SVG icons here to avoid "svgEASY" text dumps. */
  const isDifficulty = s === "easy" || s === "medium" || s === "hard";
  const renderIcon = showIcon && !isDifficulty;

  return (
    <Badge
      variant={tone}
      className={cn(
        "font-primary max-w-full truncate text-xs font-medium uppercase tracking-wide",
        className,
      )}
      title={label}
    >
      {renderIcon ? (
        <StatusIcon status={raw} tone={tone} />
      ) : isDifficulty ? (
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80"
          aria-hidden
        />
      ) : null}
      <span>{label}</span>
    </Badge>
  );
};

export { statusTone };
