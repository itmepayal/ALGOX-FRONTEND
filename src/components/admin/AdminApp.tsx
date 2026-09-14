import { useEffect, useMemo, useState, type FC } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  canAccessAdmin,
  hasPermission,
  type Permission,
} from "../../rbac/permissions";
import { AdminShell } from "./AdminShell";
import { ADMIN_TITLE, type AdminTab } from "./adminNav";
import { AdminDashboardHome } from "./dashboard/AdminDashboardHome";
import { ProblemListPage } from "./problems/ProblemListPage";
import { ProblemEditorPage } from "./problems/ProblemEditorPage";
import {
  ProblemAnalyticsPage,
  ProblemBulkImportPage,
  ProblemTestCasesHub,
} from "./problems/ProblemOpsPages";
import { SubmissionListPage } from "./submissions/SubmissionListPage";
import { SubmissionDetailPage } from "./submissions/SubmissionDetailPage";
import { FailedExecutionsPage } from "./submissions/FailedExecutionsPage";
import { UserListPage } from "./users/UserListPage";
import { UserDetailPage } from "./users/UserDetailPage";
import { AuditLogPage } from "./audit/AuditLogPage";
import { SystemHealthPage } from "./health/SystemHealthPage";
import { SettingsPage } from "./settings/SettingsPage";
import { AnalyticsPage } from "./analytics/AnalyticsPage";
import { LeaderboardsPage } from "./leaderboards/LeaderboardsPage";
import { LearningAdminPage } from "./learning/LearningAdminPage";
import { CodeExecutionPage } from "./execution/CodeExecutionPage";
import { RealtimeCenterPage } from "./realtime/RealtimeCenterPage";
import {
  SubmissionAnalyticsPage,
  UserOpsPages,
} from "./ops/OpsPlaceholderPages";
import {
  DiscussionsAdminPage,
  ReportsAdminPage,
} from "./ops/DiscussionsReportsPages";
import { AnnouncementsAdminPage } from "./ops/AnnouncementsAdminPage";
import { SuspiciousSubmissionsPage } from "./ops/SuspiciousSubmissionsPage";
import { ToastProvider } from "../../context/ToastContext";

interface AdminAppProps {
  onBackToUserView: () => void;
}

function readAdminQuery(): { tab: AdminTab; id: string | null } {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = (params.get("admin") || "dashboard") as AdminTab;
    const id = params.get("id");
    return { tab, id };
  } catch {
    return { tab: "dashboard", id: null };
  }
}

function writeAdminQuery(tab: AdminTab, id?: string | null) {
  try {
    const params = new URLSearchParams(window.location.search);
    params.set("admin", tab);
    if (id) params.set("id", id);
    else params.delete("id");
    const path =
      window.location.pathname.startsWith("/admin")
        ? window.location.pathname
        : "/admin";
    window.history.replaceState({}, "", `${path}?${params.toString()}`);
  } catch {
    // ignore
  }
}

export const AdminApp: FC<AdminAppProps> = ({ onBackToUserView }) => {
  const { user, signout } = useAuth();
  const initial = useMemo(() => readAdminQuery(), []);
  const [tab, setTab] = useState<AdminTab>(initial.tab || "dashboard");
  const [editProblemId, setEditProblemId] = useState<string | null>(
    initial.tab === "problem-editor" ? initial.id : null
  );
  const [submissionId, setSubmissionId] = useState<string | null>(
    initial.tab === "submission-detail" ? initial.id : null
  );
  const [userId, setUserId] = useState<string | null>(
    initial.tab === "user-detail" ? initial.id : null
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  useEffect(() => {
    if (!window.location.pathname.startsWith("/admin")) {
      window.history.replaceState(
        {},
        "",
        `/admin${window.location.search || "?admin=dashboard"}`
      );
    }
  }, []);

  useEffect(() => {
    const id =
      tab === "problem-editor"
        ? editProblemId
        : tab === "submission-detail"
          ? submissionId
          : tab === "user-detail"
            ? userId
            : null;
    writeAdminQuery(tab, id);
  }, [tab, editProblemId, submissionId, userId]);

  if (!canAccessAdmin(user?.role)) {
    return (
      <div className="admin-root">
        <div className="admin-denied" style={{ margin: "auto" }}>
          <h2>Access denied</h2>
          <p>You do not have permission to open the admin console.</p>
          <button type="button" className="admin-btn" onClick={onBackToUserView}>
            Back to app
          </button>
        </div>
      </div>
    );
  }

  const navigate = (next: AdminTab, id?: string) => {
    setTab(next);
    if (next === "problem-editor") {
      setEditProblemId(id || null);
    } else {
      setEditProblemId(null);
    }
    if (next === "submission-detail" && id) {
      setSubmissionId(id);
    } else if (next !== "submission-detail") {
      setSubmissionId(null);
    }
    if (next === "user-detail" && id) {
      setUserId(id);
    } else if (next !== "user-detail") {
      setUserId(null);
    }
  };

  const openSubmission = (id: string) => {
    setSubmissionId(id);
    setTab("submission-detail");
  };

  const title =
    tab === "problem-editor"
      ? editProblemId
        ? "Edit problem"
        : "New problem"
      : ADMIN_TITLE[tab] || "Admin";

  const lastUpdatedLabel = (() => {
    const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (secs < 8) return "Just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    return lastUpdated.toLocaleTimeString();
  })();

  return (
    <ToastProvider>
    <AdminShell
      tab={tab}
      title={title}
      canView={(perm) => !perm || hasPermission(user?.role, perm as Permission)}
      onNavigate={navigate}
      onBackToUserView={onBackToUserView}
      onSignOut={() => signout()}
      onRefresh={() => {
        setRefreshKey((k) => k + 1);
        setLastUpdated(new Date());
      }}
      lastUpdatedLabel={lastUpdatedLabel}
      adminName={user?.name}
      adminEmail={user?.email}
      adminRole={user?.role}
    >
      <div key={refreshKey} className="admin-content-refresh">
      {tab === "dashboard" && (
        <AdminDashboardHome onNavigate={navigate} />
      )}
      {tab === "problems" && (
        <ProblemListPage
          onEdit={(id) => {
            setEditProblemId(id);
            setTab("problem-editor");
          }}
        />
      )}
      {tab === "problem-editor" && (
        <ProblemEditorPage
          problemId={editProblemId}
          onBack={() => navigate("problems")}
        />
      )}
      {tab === "problem-test-cases" && <ProblemTestCasesHub />}
      {tab === "problem-analytics" && <ProblemAnalyticsPage />}
      {tab === "problem-bulk-import" && <ProblemBulkImportPage />}

      {tab === "submissions" && (
        <SubmissionListPage onOpen={openSubmission} />
      )}
      {tab === "submission-detail" && submissionId && (
        <SubmissionDetailPage
          id={submissionId}
          onBack={() => navigate("submissions")}
        />
      )}
      {tab === "submission-analytics" && <SubmissionAnalyticsPage />}
      {tab === "submission-failed" && (
        <FailedExecutionsPage onOpen={openSubmission} />
      )}
      {tab === "submission-suspicious" && <SuspiciousSubmissionsPage />}

      {tab === "users" && (
        <UserListPage
          onOpen={(id) => {
            setUserId(id);
            setTab("user-detail");
          }}
        />
      )}
      {tab === "user-detail" && userId && (
        <UserDetailPage id={userId} onBack={() => navigate("users")} />
      )}
      {tab === "user-activity" && <UserOpsPages mode="activity" />}
      {tab === "user-online" && <RealtimeCenterPage mode="users" />}
      {tab === "user-progress" && <UserOpsPages mode="progress" />}
      {tab === "user-sessions" && <UserOpsPages mode="sessions" />}

      {tab === "realtime" && <RealtimeCenterPage mode="dashboard" />}
      {tab === "realtime-users" && <RealtimeCenterPage mode="users" />}
      {tab === "realtime-submissions" && (
        <RealtimeCenterPage mode="submissions" onOpenSubmission={openSubmission} />
      )}
      {tab === "realtime-executions" && (
        <RealtimeCenterPage mode="executions" />
      )}
      {tab === "realtime-leaderboard" && (
        <RealtimeCenterPage mode="leaderboard" />
      )}
      {tab === "realtime-connections" && (
        <RealtimeCenterPage mode="connections" />
      )}
      {tab === "realtime-rooms" && <RealtimeCenterPage mode="rooms" />}
      {tab === "realtime-events" && <RealtimeCenterPage mode="events" />}
      {tab === "realtime-broadcast" && <RealtimeCenterPage mode="broadcast" />}

      {tab === "leaderboards" && <LeaderboardsPage period="global" />}
      {tab === "leaderboards-daily" && <LeaderboardsPage period="daily" />}
      {tab === "leaderboards-weekly" && <LeaderboardsPage period="weekly" />}
      {tab === "leaderboards-monthly" && <LeaderboardsPage period="monthly" />}
      {tab === "leaderboards-contest" && <LeaderboardsPage period="contest" />}

      {tab === "learning-sheets" && <LearningAdminPage mode="sheets" />}
      {tab === "learning-topics" && <LearningAdminPage mode="topics" />}
      {tab === "learning-difficulty" && <LearningAdminPage mode="difficulty" />}
      {tab === "learning-revision" && <LearningAdminPage mode="revision" />}
      {tab === "learning-progress" && <LearningAdminPage mode="progress" />}

      {tab === "discussions" && <DiscussionsAdminPage />}
      {tab === "reports" && <ReportsAdminPage />}
      {tab === "announcements" && <AnnouncementsAdminPage />}
      {tab === "analytics" && <AnalyticsPage />}
      {tab === "code-execution" && <CodeExecutionPage />}
      {tab === "health" && <SystemHealthPage />}
      {tab === "audit" && <AuditLogPage />}
      {tab === "settings" && <SettingsPage />}
      </div>
    </AdminShell>
    </ToastProvider>
  );
};
