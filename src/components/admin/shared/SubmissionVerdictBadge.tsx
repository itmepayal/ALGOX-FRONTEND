import type { FC } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import { Badge } from "../../ui/badge";
import { cn } from "../../../lib/cn";
import type { StatusTone } from "./StatusBadge";

const VERDICTS: Record<
  string,
  { label: string; tone: StatusTone; Icon: typeof CheckCircle2 }
> = {
  ACCEPTED: { label: "Accepted", tone: "success", Icon: CheckCircle2 },
  WRONG_ANSWER: { label: "Wrong Answer", tone: "danger", Icon: XCircle },
  RUNTIME_ERROR: { label: "Runtime Error", tone: "danger", Icon: AlertTriangle },
  COMPILATION_ERROR: {
    label: "Compilation Error",
    tone: "danger",
    Icon: AlertTriangle,
  },
  TIME_LIMIT_EXCEEDED: {
    label: "Time Limit Exceeded",
    tone: "warning",
    Icon: Clock,
  },
  MEMORY_LIMIT_EXCEEDED: {
    label: "Memory Limit Exceeded",
    tone: "warning",
    Icon: Clock,
  },
  PENDING: { label: "Pending", tone: "warning", Icon: Clock },
  RUNNING: { label: "Running", tone: "primary", Icon: Play },
  SYSTEM_ERROR: { label: "System Error", tone: "danger", Icon: XCircle },
  FAILED: { label: "Failed", tone: "danger", Icon: XCircle },
};

export function normalizeVerdict(raw?: string | null): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export const SubmissionVerdictBadge: FC<{
  status?: string | null;
  className?: string;
  showIcon?: boolean;
}> = ({ status, className, showIcon = true }) => {
  const key = normalizeVerdict(status);
  const meta = VERDICTS[key] || {
    label: key ? key.replace(/_/g, " ") : "Unknown",
    tone: "default" as StatusTone,
    Icon: CircleHelp,
  };
  const Icon = key === "RUNNING" || key === "PENDING" ? (key === "RUNNING" ? Play : Clock) : meta.Icon;

  return (
    <Badge
      variant={meta.tone}
      className={cn(
        "font-primary max-w-full truncate text-xs font-medium tracking-wide",
        className,
      )}
      title={meta.label}
    >
      {showIcon ? (
        <Icon
          size={12}
          strokeWidth={2.25}
          className={cn(
            "size-3 shrink-0",
            key === "RUNNING" && "animate-pulse",
          )}
          aria-hidden
        />
      ) : null}
      <span>{meta.label}</span>
    </Badge>
  );
};

/** Spinner for pending/running when needed elsewhere */
export const VerdictSpinner: FC = () => (
  <Loader2 size={12} strokeWidth={2.25} className="size-3 animate-spin" aria-hidden />
);
