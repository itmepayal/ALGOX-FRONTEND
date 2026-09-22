import type { FC, ReactNode } from "react";
import { AlertTriangle, WifiOff, Clock, RefreshCw, XCircle, ShieldAlert } from "lucide-react";
import { normalizeApiError, type NormalizedApiError } from "../../lib/apiError";
import { cn } from "../../lib/cn";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export const ErrorState: FC<ErrorStateProps> = ({
  title,
  message,
  error,
  onRetry,
  isRetrying = false,
  action,
  compact = false,
  className,
}) => {
  let norm: NormalizedApiError | undefined;
  if (error) {
    norm = normalizeApiError(error);
  }

  const displayTitle = title || norm?.title || "Unable to load data";
  const displayMessage =
    message ||
    norm?.message ||
    "Something went wrong while fetching content. Please try again.";
  const canRetry = onRetry && (norm ? norm.retryable : true);

  const getIcon = () => {
    if (!norm) return <AlertTriangle size={compact ? 18 : 22} strokeWidth={1.75} />;
    switch (norm.code) {
      case "NETWORK_ERROR":
        return <WifiOff size={compact ? 18 : 22} strokeWidth={1.75} />;
      case "TIMEOUT_ERROR":
        return <Clock size={compact ? 18 : 22} strokeWidth={1.75} />;
      case "AUTHENTICATION_ERROR":
      case "AUTHORIZATION_ERROR":
        return <ShieldAlert size={compact ? 18 : 22} strokeWidth={1.75} />;
      default:
        return <XCircle size={compact ? 18 : 22} strokeWidth={1.75} />;
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        compact
          ? "gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-6"
          : "gap-4 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-6 py-8",
        className
      )}
    >
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive",
          compact ? "h-10 w-10" : "h-12 w-12"
        )}
        aria-hidden
      >
        {getIcon()}
      </div>

      <div className={cn("flex max-w-md flex-col items-center", compact ? "gap-1" : "gap-2")}>
        <h3 className="font-primary text-sm font-semibold tracking-tight text-foreground">
          {displayTitle}
        </h3>
        <p className="font-primary text-sm leading-relaxed text-muted-foreground">
          {displayMessage}
        </p>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {canRetry ? (
          <button
            type="button"
            className="ax-btn accent inline-flex items-center gap-1.5"
            disabled={isRetrying}
            onClick={onRetry}
          >
            <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        ) : null}
        {action}
      </div>
    </div>
  );
};
