import type { FC } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
    className={`admin-widget-error ${compact ? "compact" : ""}`}
    role="alert"
  >
    <div className="admin-widget-error-icon" aria-hidden>
      <AlertTriangle size={compact ? 16 : 20} />
    </div>
    <div className="admin-widget-error-body">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
    {onRetry ? (
      <button type="button" className="admin-btn" onClick={onRetry}>
        <RefreshCw size={14} />
        Retry
      </button>
    ) : null}
  </div>
);
