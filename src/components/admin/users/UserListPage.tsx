import { useEffect, useState, type FC } from "react";
import { Users, UserPlus } from "lucide-react";
import { adminAuthApi, type AdminUser } from "../../../api/adminAuthApi";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { usePermission } from "../../../rbac/usePermission";
import { WidgetError } from "../shared/WidgetError";
import "./user-list.css";

interface Props {
  onOpen: (id: string) => void;
  onCreate?: () => void;
}

export const UserListPage: FC<Props> = ({ onOpen, onCreate }) => {
  const { can } = usePermission();
  const canCreate = can("users:create");
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAuthApi.listUsers({
        page,
        limit: 20,
        search: search || undefined,
        role: role === "all" ? undefined : role,
        status: status === "all" ? undefined : status,
      });
      setRows(res.data || []);
      setMeta({
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });
    } catch (err: any) {
      setError({
        title: "Unable to load users",
        message: err?.response?.data?.message || err.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, role, status]);

  return (
    <PermissionGuard
      permission="users:view"
      fallback={<div className="admin-denied">No users permission.</div>}
    >
      <div className="admin-user-list-page">
        <p className="admin-page-lead">
          Review accounts, roles, and account status across the platform.
        </p>
        <div className="admin-toolbar admin-toolbar-users">
          <input
            className="admin-toolbar-search"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
          />
          <select
            className="admin-toolbar-filter"
            style={{ width: 140 }}
            value={role}
            onChange={(e) => {
              setPage(1);
              setRole(e.target.value);
            }}
          >
            <option value="all">All roles</option>
            <option value="user">user</option>
            <option value="moderator">moderator</option>
            <option value="content_manager">content_manager</option>
            <option value="admin">admin</option>
            <option value="super_admin">super_admin</option>
          </select>
          <select
            className="admin-toolbar-filter"
            style={{ width: 130 }}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="all">All statuses</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="banned">banned</option>
          </select>
          <button
            type="button"
            className="admin-btn admin-toolbar-submit"
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            Search
          </button>
          {canCreate && onCreate ? (
            <button
              type="button"
              className="admin-btn primary admin-toolbar-create"
              onClick={onCreate}
            >
              <UserPlus size={14} /> Create user
            </button>
          ) : null}
        </div>

        {error ? (
          <WidgetError
            title={error.title}
            message={error.message}
            onRetry={load}
          />
        ) : null}

        <DataTable
          rows={rows}
          rowKey={(u) => u.id}
          loading={loading}
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
          emptyTitle="No users found"
          emptyDescription="Try adjusting search or filters, or create a new user."
          emptyIcon={<Users size={20} strokeWidth={1.75} />}
          columns={[
            {
              key: "name",
              header: "Name",
              render: (u) => (
                <button
                  type="button"
                  className="admin-user-name-btn"
                  onClick={() => onOpen(u.id)}
                >
                  {u.name}
                </button>
              ),
            },
            {
              key: "email",
              header: "Email",
              render: (u) => (
                <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>
                  {u.email}
                </span>
              ),
            },
            {
              key: "role",
              header: "Role",
              render: (u) => (
                <span className="admin-user-role-badge">{u.role}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (u) => <StatusBadge status={u.status} />,
            },
            {
              key: "createdAt",
              header: "Joined",
              render: (u) =>
                u.createdAt
                  ? new Date(u.createdAt).toLocaleDateString()
                  : "—",
            },
          ]}
        />
      </div>
    </PermissionGuard>
  );
};
