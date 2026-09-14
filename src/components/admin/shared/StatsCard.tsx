import type { FC } from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export const StatsCard: FC<StatsCardProps> = ({ label, value, hint }) => (
  <div className="admin-stat-card">
    <div className="label">{label}</div>
    <div className="value">{value}</div>
    {hint ? <div className="admin-muted">{hint}</div> : null}
  </div>
);
