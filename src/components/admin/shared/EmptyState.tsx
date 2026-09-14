import type { FC, ReactNode } from "react";
import { Inbox } from "lucide-react";

export const EmptyState: FC<{
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}> = ({ title, hint, action, icon }) => (
  <div className="admin-empty admin-empty-rich">
    <div className="admin-empty-icon" aria-hidden>
      {icon || <Inbox size={22} />}
    </div>
    <div className="admin-empty-title">{title}</div>
    {hint ? <div className="admin-muted">{hint}</div> : null}
    {action ? <div className="admin-empty-action">{action}</div> : null}
  </div>
);
