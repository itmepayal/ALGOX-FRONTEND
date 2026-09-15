import type { FC, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/cn";

export type EmptyStateProps = {
  title: string;
  /** Supporting description under the title */
  description?: string;
  /** @deprecated Prefer `description` */
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  /** Denser layout for table cells / compact panels */
  compact?: boolean;
};

/**
 * Shared empty state for Admin + product surfaces.
 * Uses theme tokens only (foreground, muted, card, border, accent, primary).
 */
export const EmptyState: FC<EmptyStateProps> = ({
  title,
  description,
  hint,
  action,
  icon,
  className,
  compact = false,
}) => {
  const body = description ?? hint;

  return (
    <div
      role="status"
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        compact
          ? "gap-2 rounded-lg px-4 py-8"
          : "gap-4 rounded-xl border border-dashed border-border bg-muted/40 p-6 py-8",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
        aria-hidden
      >
        {icon ?? <Inbox size={compact ? 18 : 22} strokeWidth={1.75} />}
      </div>
      <div className={cn("flex max-w-md flex-col items-center", compact ? "gap-1" : "gap-2")}>
        <h3 className="font-primary text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {body ? (
          <p className="font-primary text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
};
