import { useEffect, useMemo, useState, type FC } from "react";
import { useAuth } from "../../context/AuthContext";
import { type Permission } from "../../rbac/permissions";
import { usePermission } from "../../rbac/usePermission";
import { AdminShell } from "./AdminShell";
import { ADMIN_TITLE, type AdminTab } from "./adminNav";
import { ToastProvider } from "../../context/ToastContext";
import {
  AdminRouteSuspense,
  LazyAdminDashboardHome,
  LazyAnalyticsPage,
  LazyAnnouncementsAdminPage,
  LazyAuditLogPage,
  LazyCodeExecutionPage,
  LazyContentAdminPage,
  LazyContestDetailPage,
  LazyContestListPage,
  LazyDiscussionsAdminPage,
  LazyFailedExecutionsPage,
  LazyLanguageAnalyticsPage,
  LazyLeaderboardsPage,
  LazyLearningAdminPage,
  LazyNotificationsAdminPage,
  LazyProblemAnalyticsPage,
  LazyProblemBulkImportPage,
  LazyProblemEditorPage,
  LazyProblemListPage,
  LazyProblemTestCasesHub,
  LazyRealtimeCenterPage,
  LazyReportsAdminPage,
  LazyChallengesAdminPage,
  LazyRolesPermissionsPage,
  LazySettingsPage,
  LazySubmissionAnalyticsPage,
  LazySubmissionDetailPage,
  LazySubmissionListPage,
  LazySuspiciousSubmissionsPage,
  LazySystemHealthPage,
  LazyUserAnalyticsPage,
  LazyUserCreatePage,
  LazyUserDetailPage,
  LazyUserListPage,
  LazyUserOpsPages,
} from "./adminLazy";

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
  const { can, canAdmin } = usePermission();
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
  const [contestId, setContestId] = useState<string | null>(
    initial.tab === "contest-detail" ? initial.id : null
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
            : tab === "contest-detail"
              ? contestId
              : null;
    writeAdminQuery(tab, id);
  }, [tab, editProblemId, submissionId, userId, contestId]);

  if (!canAdmin) {
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
    if (next === "contest-detail" && id) {
      setContestId(id);
    } else if (next !== "contest-detail") {
      setContestId(null);
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
        canView={(perm) => !perm || can(perm as Permission)}
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
          <AdminRouteSuspense>
            {tab === "dashboard" && (
              <LazyAdminDashboardHome onNavigate={navigate} />
            )}
            {tab === "problems" && (
              <LazyProblemListPage
                onEdit={(id) => {
                  setEditProblemId(id);
                  setTab("problem-editor");
                }}
              />
            )}
            {tab === "problem-editor" && (
              <LazyProblemEditorPage
                problemId={editProblemId}
                onBack={() => navigate("problems")}
              />
            )}
            {tab === "problem-test-cases" && <LazyProblemTestCasesHub />}
            {tab === "problem-analytics" && <LazyProblemAnalyticsPage />}
            {tab === "problem-bulk-import" && <LazyProblemBulkImportPage />}

            {tab === "submissions" && (
              <LazySubmissionListPage onOpen={openSubmission} />
            )}
            {tab === "submission-detail" && submissionId && (
              <LazySubmissionDetailPage
                id={submissionId}
                onBack={() => navigate("submissions")}
              />
            )}
            {tab === "submission-analytics" && <LazySubmissionAnalyticsPage />}
            {tab === "submission-failed" && (
              <LazyFailedExecutionsPage onOpen={openSubmission} />
            )}
            {tab === "submission-suspicious" && (
              <LazySuspiciousSubmissionsPage />
            )}

            {tab === "users" && (
              <LazyUserListPage
                onOpen={(id) => {
                  setUserId(id);
                  setTab("user-detail");
                }}
                onCreate={() => navigate("user-create")}
              />
            )}
            {tab === "user-create" && (
              <LazyUserCreatePage
                onCancel={() => navigate("users")}
                onCreated={(id) => {
                  setUserId(id);
                  setTab("user-detail");
                }}
              />
            )}
            {tab === "user-detail" && userId && (
              <LazyUserDetailPage id={userId} onBack={() => navigate("users")} />
            )}
            {tab === "user-activity" && (
              <LazyUserOpsPages
                key="user-activity"
                mode="activity"
                onGoToUsers={() => navigate("users")}
                onOpenUser={(id) => {
                  setUserId(id);
                  setTab("user-detail");
                }}
              />
            )}
            {tab === "user-online" && <LazyRealtimeCenterPage mode="users" />}
            {tab === "user-progress" && (
              <LazyUserOpsPages
                key="user-progress"
                mode="progress"
                onGoToUsers={() => navigate("users")}
                onOpenUser={(id) => {
                  setUserId(id);
                  setTab("user-detail");
                }}
              />
            )}
            {tab === "user-sessions" && (
              <LazyUserOpsPages
                key="user-sessions"
                mode="sessions"
                onGoToUsers={() => navigate("users")}
                onOpenUser={(id) => {
                  setUserId(id);
                  setTab("user-detail");
                }}
              />
            )}

            {tab === "realtime" && (
              <LazyRealtimeCenterPage mode="dashboard" />
            )}
            {tab === "realtime-users" && (
              <LazyRealtimeCenterPage mode="users" />
            )}
            {tab === "realtime-submissions" && (
              <LazyRealtimeCenterPage
                mode="submissions"
                onOpenSubmission={openSubmission}
              />
            )}
            {tab === "realtime-executions" && (
              <LazyRealtimeCenterPage mode="executions" />
            )}
            {tab === "realtime-leaderboard" && (
              <LazyRealtimeCenterPage mode="leaderboard" />
            )}
            {tab === "realtime-connections" && (
              <LazyRealtimeCenterPage mode="connections" />
            )}
            {tab === "realtime-rooms" && (
              <LazyRealtimeCenterPage mode="rooms" />
            )}
            {tab === "realtime-events" && (
              <LazyRealtimeCenterPage mode="events" />
            )}
            {tab === "realtime-broadcast" && (
              <LazyRealtimeCenterPage mode="broadcast" />
            )}

            {tab === "leaderboards" && (
              <LazyLeaderboardsPage period="global" onNavigate={navigate} />
            )}
            {tab === "leaderboards-daily" && (
              <LazyLeaderboardsPage period="daily" onNavigate={navigate} />
            )}
            {tab === "leaderboards-weekly" && (
              <LazyLeaderboardsPage period="weekly" onNavigate={navigate} />
            )}
            {tab === "leaderboards-monthly" && (
              <LazyLeaderboardsPage period="monthly" onNavigate={navigate} />
            )}
            {tab === "leaderboards-contest" && (
              <LazyLeaderboardsPage period="contest" onNavigate={navigate} />
            )}

            {tab === "contests" && (
              <LazyContestListPage
                onOpen={(id) => {
                  setContestId(id);
                  setTab("contest-detail");
                }}
              />
            )}
            {tab === "challenges" && <LazyChallengesAdminPage />}
            {tab === "contest-detail" && contestId && (
              <LazyContestDetailPage
                id={contestId}
                onBack={() => navigate("contests")}
              />
            )}

            {tab === "learning-sheets" && (
              <LazyLearningAdminPage mode="sheets" />
            )}
            {tab === "learning-topics" && (
              <LazyLearningAdminPage mode="topics" />
            )}
            {tab === "learning-difficulty" && (
              <LazyLearningAdminPage mode="difficulty" />
            )}
            {tab === "learning-revision" && (
              <LazyLearningAdminPage mode="revision" />
            )}
            {tab === "learning-progress" && (
              <LazyLearningAdminPage mode="progress" />
            )}

            {tab === "discussions" && <LazyDiscussionsAdminPage />}
            {tab === "reports" && <LazyReportsAdminPage />}
            {tab === "announcements" && <LazyAnnouncementsAdminPage />}
            {tab === "notifications" && <LazyNotificationsAdminPage />}
            {tab === "content-articles" && (
              <LazyContentAdminPage mode="articles" />
            )}
            {tab === "content-tutorials" && (
              <LazyContentAdminPage mode="tutorials" />
            )}
            {tab === "content-study-plans" && (
              <LazyContentAdminPage mode="study-plans" />
            )}
            {tab === "content-companies" && (
              <LazyContentAdminPage mode="companies" />
            )}
            {tab === "content-editorials" && (
              <LazyContentAdminPage mode="editorials" />
            )}
            {tab === "content-notes" && <LazyContentAdminPage mode="notes" />}
            {tab === "analytics" && (
              <LazyAnalyticsPage onNavigate={navigate} />
            )}
            {tab === "analytics-users" && <LazyUserAnalyticsPage />}
            {tab === "analytics-languages" && <LazyLanguageAnalyticsPage />}
            {tab === "code-execution" && <LazyCodeExecutionPage />}
            {tab === "health" && <LazySystemHealthPage />}
            {tab === "audit" && <LazyAuditLogPage />}
            {tab === "roles" && <LazyRolesPermissionsPage />}
            {tab === "settings" && <LazySettingsPage />}
          </AdminRouteSuspense>
        </div>
      </AdminShell>
    </ToastProvider>
  );
};

export default AdminApp;
