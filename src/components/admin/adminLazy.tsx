import {
  Component,
  lazy,
  Suspense,
  type ComponentType,
  type FC,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";

/** Named-export → default for React.lazy. */
function lazyNamed<T extends ComponentType<any>>(
  loader: () => Promise<Record<string, T>>,
  exportName: string
) {
  return lazy(async () => {
    const mod = await loader();
    const Comp = mod[exportName];
    if (!Comp) {
      throw new Error(`Admin lazy export missing: ${exportName}`);
    }
    return { default: Comp };
  });
}

export const LazyAdminDashboardHome = lazyNamed(
  () => import("./dashboard/AdminDashboardHome"),
  "AdminDashboardHome"
);
export const LazyProblemListPage = lazyNamed(
  () => import("./problems/ProblemListPage"),
  "ProblemListPage"
);
export const LazyProblemEditorPage = lazyNamed(
  () => import("./problems/ProblemEditorPage"),
  "ProblemEditorPage"
);
export const LazyProblemTestCasesHub = lazyNamed(
  () => import("./problems/ProblemOpsPages"),
  "ProblemTestCasesHub"
);
export const LazyProblemAnalyticsPage = lazyNamed(
  () => import("./problems/ProblemAnalyticsPage"),
  "ProblemAnalyticsPage"
);
export const LazyProblemBulkImportPage = lazyNamed(
  () => import("./problems/ProblemBulkImportPage"),
  "ProblemBulkImportPage"
);
export const LazySubmissionListPage = lazyNamed(
  () => import("./submissions/SubmissionListPage"),
  "SubmissionListPage"
);
export const LazySubmissionDetailPage = lazyNamed(
  () => import("./submissions/SubmissionDetailPage"),
  "SubmissionDetailPage"
);
export const LazyFailedExecutionsPage = lazyNamed(
  () => import("./submissions/FailedExecutionsPage"),
  "FailedExecutionsPage"
);
export const LazySubmissionAnalyticsPage = lazyNamed(
  () => import("./submissions/SubmissionAnalyticsPage"),
  "SubmissionAnalyticsPage"
);
export const LazyUserListPage = lazyNamed(
  () => import("./users/UserListPage"),
  "UserListPage"
);
export const LazyUserDetailPage = lazyNamed(
  () => import("./users/UserDetailPage"),
  "UserDetailPage"
);
export const LazyUserCreatePage = lazyNamed(
  () => import("./users/UserCreatePage"),
  "UserCreatePage"
);
export const LazyUserOpsPages = lazyNamed(
  () => import("./ops/OpsPlaceholderPages"),
  "UserOpsPages"
);
export const LazySuspiciousSubmissionsPage = lazyNamed(
  () => import("./ops/SuspiciousSubmissionsPage"),
  "SuspiciousSubmissionsPage"
);
export const LazyRealtimeCenterPage = lazyNamed(
  () => import("./realtime/RealtimeCenterPage"),
  "RealtimeCenterPage"
);
export const LazyLeaderboardsPage = lazyNamed(
  () => import("./leaderboards/LeaderboardsPage"),
  "LeaderboardsPage"
);
export const LazyContestListPage = lazyNamed(
  () => import("./contests/ContestListPage"),
  "ContestListPage"
);
export const LazyContestDetailPage = lazyNamed(
  () => import("./contests/ContestDetailPage"),
  "ContestDetailPage"
);
export const LazyLearningAdminPage = lazyNamed(
  () => import("./learning/LearningAdminPage"),
  "LearningAdminPage"
);
export const LazyDiscussionsAdminPage = lazyNamed(
  () => import("./ops/DiscussionsReportsPages"),
  "DiscussionsAdminPage"
);
export const LazyReportsAdminPage = lazyNamed(
  () => import("./ops/DiscussionsReportsPages"),
  "ReportsAdminPage"
);
export const LazyChallengesAdminPage = lazyNamed(
  () => import("./challenges/ChallengesAdminPage"),
  "ChallengesAdminPage"
);
export const LazyAnnouncementsAdminPage = lazyNamed(
  () => import("./ops/AnnouncementsAdminPage"),
  "AnnouncementsAdminPage"
);
export const LazyNotificationsAdminPage = lazyNamed(
  () => import("./notifications/NotificationsAdminPage"),
  "NotificationsAdminPage"
);
export const LazyContentAdminPage = lazyNamed(
  () => import("./content/ContentAdminPage"),
  "ContentAdminPage"
);
export const LazyAnalyticsPage = lazyNamed(
  () => import("./analytics/AnalyticsPage"),
  "AnalyticsPage"
);
export const LazyUserAnalyticsPage = lazyNamed(
  () => import("./analytics/UserLanguageAnalyticsPages"),
  "UserAnalyticsPage"
);
export const LazyLanguageAnalyticsPage = lazyNamed(
  () => import("./analytics/UserLanguageAnalyticsPages"),
  "LanguageAnalyticsPage"
);
export const LazyCodeExecutionPage = lazyNamed(
  () => import("./execution/CodeExecutionPage"),
  "CodeExecutionPage"
);
export const LazySystemHealthPage = lazyNamed(
  () => import("./health/SystemHealthPage"),
  "SystemHealthPage"
);
export const LazyAuditLogPage = lazyNamed(
  () => import("./audit/AuditLogPage"),
  "AuditLogPage"
);
export const LazyRolesPermissionsPage = lazyNamed(
  () => import("./roles/RolesPermissionsPage"),
  "RolesPermissionsPage"
);
export const LazySettingsPage = lazyNamed(
  () => import("./settings/SettingsPage"),
  "SettingsPage"
);

export const AdminRouteFallback: FC = () => (
  <div
    className="admin-muted"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "24px 4px",
      minHeight: 120,
    }}
    role="status"
    aria-live="polite"
  >
    <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden />
    Loading admin view…
  </div>
);

type BoundaryState = { error: Error | null };

/** Catches lazy-chunk load failures without changing page UI when healthy. */
export class AdminRouteErrorBoundary extends Component<
  { children: ReactNode; onRetry?: () => void },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="admin-panel" style={{ padding: 16 }} role="alert">
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            Failed to load this admin view
          </p>
          <p className="admin-muted" style={{ margin: "0 0 12px" }}>
            {this.state.error.message || "Chunk load error"}
          </p>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry?.();
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AdminRouteSuspense: FC<{ children: ReactNode }> = ({
  children,
}) => (
  <AdminRouteErrorBoundary>
    <Suspense fallback={<AdminRouteFallback />}>{children}</Suspense>
  </AdminRouteErrorBoundary>
);
