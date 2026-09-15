import type { FC, ReactNode } from "react";
import { cn } from "../../../lib/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

/** Consistent page header for admin modules. */
export const PageHeader: FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  meta,
  className,
}) => (
  <div className={cn("admin-page-header", className)}>
    <div className="min-w-0">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {meta ? <div className="admin-page-header-meta">{meta}</div> : null}
    </div>
    {actions ? (
      <div className="admin-page-header-actions">{actions}</div>
    ) : null}
  </div>
);
