import type { FC, ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}

/** Consistent page header for admin modules (use under dashboard-style pages). */
export const PageHeader: FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  meta,
}) => (
  <div className="admin-page-header">
    <div className="admin-page-header-text">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {meta ? <div className="admin-page-header-meta">{meta}</div> : null}
    </div>
    {actions ? <div className="admin-page-header-actions">{actions}</div> : null}
  </div>
);
