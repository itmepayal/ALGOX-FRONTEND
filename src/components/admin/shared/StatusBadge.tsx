import type { FC } from "react";

export const StatusBadge: FC<{ status: string; className?: string }> = ({
  status,
  className = "",
}) => (
  <span className={`admin-badge ${status.toLowerCase()} ${className}`.trim()}>
    {status}
  </span>
);
