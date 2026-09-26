import type { FC } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../ui/button";
import { cn } from "../../../lib/cn";

interface WidgetErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/** Reusable widget-level error for partial dashboard / panel failures. */
export const WidgetError: FC<WidgetErrorProps> = ({
  title = "Unable to load data",
  message = "Something went wrong while loading this section.",
  onRetry,
  compact,
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3.5 rounded-xl border border-danger/25 bg-danger/10 p-4 text-foreground",
      compact && "p-3.5",
    )}
    role="alert"
  >
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/15 text-danger"
        aria-hidden
      >
        <AlertTriangle size={18} strokeWidth={2} className="shrink-0" />
      </div>
      <div className="min-w-0 flex-1">
        <strong className="block font-primary text-sm font-semibold leading-snug text-foreground">
          {title}
        </strong>
        <p className="mt-0.5 font-primary text-xs leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </div>
    {onRetry ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onRetry}
        className="h-8 shrink-0 gap-1.5 px-3 text-xs"
      >
        <RefreshCw size={13} strokeWidth={2} className="shrink-0" aria-hidden />
        Retry
      </Button>
    ) : null}
  </div>
);
