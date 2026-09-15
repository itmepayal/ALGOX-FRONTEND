import type { FC } from "react";
import { AdminDashboardHome } from "../dashboard/AdminDashboardHome";
import type { AdminTab } from "../adminNav";

interface AnalyticsPageProps {
  onNavigate?: (tab: AdminTab, id?: string) => void;
}

/** Platform analytics — same resilient dashboard surface. */
export const AnalyticsPage: FC<AnalyticsPageProps> = ({ onNavigate }) => (
  <AdminDashboardHome onNavigate={onNavigate} />
);
