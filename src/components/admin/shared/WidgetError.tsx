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
      "flex items-start gap-3 rounded-lg border border-danger/25 bg-danger/10 p-4",
      compact && "p-3",
    )}
    role="alert"
  >
    <div
      className="mt-0.5 shrink-0 text-danger"
      aria-hidden
    >
      <AlertTriangle size={compact ? 16 : 20} strokeWidth={2} className="shrink-0" aria-hidden />
    </div>
    <div className="min-w-0 flex-1">
      <strong className="block font-primary text-sm font-semibold text-foreground">
        {title}
      </strong>
      <p className="mt-1 font-primary text-sm text-muted-foreground">{message}</p>
    </div>
    {onRetry ? (
      <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw size={14} strokeWidth={2} className="size-3.5 shrink-0" aria-hidden />
        Retry
      </Button>
    ) : null}
  </div>
);
