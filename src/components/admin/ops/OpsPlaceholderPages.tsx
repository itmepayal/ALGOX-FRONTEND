import type { FC } from "react";
import { Users } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { adminAuthApi } from "../../../api/adminAuthApi";
import { useEffect, useState } from "react";
import { DataTable } from "../shared/DataTable";

/** Cross-user online presence lives in Realtime; deep links from Users nav. */
export const UserOpsPages: FC<{
  mode: "activity" | "online" | "progress" | "sessions";
}> = ({ mode }) => {
  if (mode === "online") {
    return (
      <p className="admin-muted">
        Use Real-Time → Live Users for presence (RealtimeService sockets).
      </p>
    );
  }

  if (mode === "activity" || mode === "progress" || mode === "sessions") {
    return (
      <PermissionGuard permission="users:view">
        <p className="admin-muted" style={{ marginBottom: 12 }}>
          Open a user from All Users for full{" "}
          {mode === "activity"
            ? "activity timeline"
            : mode === "progress"
              ? "progress stats"
              : "session revoke"}
          . Showing recent users below as a quick jump list.
        </p>
        <RecentUsersJump />
      </PermissionGuard>
    );
  }

  return null;
};

const RecentUsersJump: FC = () => {
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
    <DataTable
      loading={loading}
      emptyTitle="No users found"
      emptyDescription="Recent accounts will appear here for quick jumps."
      emptyIcon={<Users size={18} strokeWidth={1.75} />}
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
  );
};
