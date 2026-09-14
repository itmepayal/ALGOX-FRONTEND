import type { FC } from "react";
import { ModuleGate } from "../shared/ModuleGate";
import { PermissionGuard } from "../shared/PermissionGuard";
import { adminAuthApi } from "../../../api/adminAuthApi";
import { useEffect, useState } from "react";
import { DataTable } from "../shared/DataTable";

export const SubmissionAnalyticsPage: FC = () => (
  <PermissionGuard permission="analytics:view">
    <ModuleGate
      title="Submission analytics"
      description="Dedicated submission charts (status mix, language, latency) are available on Analytics / Dashboard today via AnalyticsService."
      status="live"
    />
  </PermissionGuard>
);

type UserExtraMode = "activity" | "online" | "progress" | "sessions";

export const UserOpsPages: FC<{ mode: UserExtraMode }> = ({ mode }) => {
  if (mode === "online") {
    return (
      <ModuleGate
        title="Online users"
        description="Use Real-Time → Live Users — presence is served by RealtimeService socket connections."
        status="live"
      />
    );
  }

  if (mode === "activity") {
    return (
      <PermissionGuard permission="users:view">
        <ModuleGate
          title="User activity timeline"
          description="Cross-service activity feed (opens, runs, solves, logins) will aggregate Auth security logs + submissions. Use Audit Logs and User Detail for current investigation."
          status="backend"
        />
      </PermissionGuard>
    );
  }

  if (mode === "progress") {
    return (
      <PermissionGuard permission="users:view">
        <ModuleGate
          title="User progress overview"
          description="Open a user from All Users for role/status. Deep progress (solved/attempted/sheets) will join Submission + UserProblemProgress APIs on User Detail."
          status="backend"
        />
      </PermissionGuard>
    );
  }

  return <AdminSessionsProbe />;
};

const AdminSessionsProbe: FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminAuthApi.listUsers({ page: 1, limit: 30 });
        setUsers(res.data || []);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PermissionGuard permission="users:view">
      <p className="admin-muted" style={{ marginBottom: 10 }}>
        Session revoke for arbitrary users needs AuthService admin session APIs.
        Showing recent users (last active) as an interim ops view.
      </p>
      <DataTable
        loading={loading}
        emptyTitle="No users"
        columns={[
          { key: "name", header: "User", render: (u) => u.name || u.email },
          { key: "email", header: "Email", render: (u) => u.email },
          { key: "role", header: "Role", render: (u) => u.role },
          { key: "status", header: "Status", render: (u) => u.status },
          {
            key: "last",
            header: "Last active",
            render: (u) =>
              u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : "—",
          },
        ]}
        rows={users}
        rowKey={(u) => u.id}
      />
    </PermissionGuard>
  );
};
