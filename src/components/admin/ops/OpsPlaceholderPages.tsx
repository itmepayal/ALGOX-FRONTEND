import { useEffect, useState, type FC } from "react";
import { Activity, ChartColumn, Monitor } from "lucide-react";
import {
  adminAuthApi,
  type PlatformActivityItem,
  type PlatformProgressRow,
  type PlatformSessionRow,
} from "../../../api/adminAuthApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { WidgetError } from "../shared/WidgetError";
import { usePermission } from "../../../rbac/usePermission";
import "./user-ops.css";

export const UserOpsPages: FC<{
  mode: "activity" | "online" | "progress" | "sessions";
  onGoToUsers?: () => void;
  onOpenUser?: (id: string) => void;
}> = ({ mode, onGoToUsers, onOpenUser }) => {
  const { can } = usePermission();
  const canUpdate = can("users:update");

  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const [activity, setActivity] = useState<PlatformActivityItem[]>([]);
  const [progress, setProgress] = useState<PlatformProgressRow[]>([]);
  const [sessions, setSessions] = useState<PlatformSessionRow[]>([]);

  useEffect(() => {
    setPage(1);
  }, [mode]);

  const loadData = async () => {
    if (mode === "online") return;
    try {
      setLoading(true);
      setError(null);
      if (mode === "activity") {
        const res = await adminAuthApi.listPlatformActivity({
          page,
          limit: 30,
        });
        setActivity(res.data || []);
        setMeta({
          total: res.meta?.total || 0,
          totalPages: res.meta?.totalPages || 1,
        });
      } else if (mode === "progress") {
        const res = await adminAuthApi.listPlatformProgress({
          page,
          limit: 20,
          search: searchQ || undefined,
        });
        setProgress(res.data || []);
        setMeta({
          total: res.meta?.total || 0,
          totalPages: res.meta?.totalPages || 1,
        });
      } else if (mode === "sessions") {
        const res = await adminAuthApi.listPlatformSessions({
          page,
          limit: 20,
        });
        setSessions(res.data || []);
        setMeta({
          total: res.meta?.total || 0,
          totalPages: res.meta?.totalPages || 1,
        });
      }
    } catch (err: any) {
      setError({
        title: `Unable to load ${mode}`,
        message: err?.response?.data?.message || err.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page, searchQ]);

  if (mode === "online") {
    return (
      <div className="admin-user-ops-page">
        <p className="admin-page-lead">
          Use Real-Time → Live Users for presence (RealtimeService sockets).
        </p>
      </div>
    );
  }

  const subtitle =
    mode === "activity"
      ? "Security and account events across users."
      : mode === "progress"
        ? "Submission progress per account from SubmissionService."
        : "Active and recent refresh sessions across accounts.";

  return (
    <PermissionGuard
      permission="users:view"
      fallback={<div className="admin-denied">No users permission.</div>}
    >
      <div className="admin-user-ops-page">
        <p className="admin-page-lead">{subtitle}</p>

        <div className="admin-toolbar admin-toolbar-ops">
          <div className="admin-toolbar-ops-group">
            {mode === "progress" ? (
              <input
                className="admin-toolbar-search"
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setSearchQ(search.trim());
                  }
                }}
              />
            ) : null}
            {mode === "progress" ? (
              <button
                type="button"
                className="admin-btn"
                style={{ height: 38 }}
                onClick={() => {
                  setPage(1);
                  setSearchQ(search.trim());
                }}
              >
                Search
              </button>
            ) : null}
          </div>

          {onGoToUsers ? (
            <button
              type="button"
              className="admin-btn"
              style={{ height: 38 }}
              onClick={onGoToUsers}
            >
              All Users
            </button>
          ) : null}
        </div>

        {error ? (
          <WidgetError
            title={error.title}
            message={error.message}
            onRetry={loadData}
          />
        ) : null}

        {mode === "activity" && (
          <DataTable
            rowKey={(a) => a.id}
            loading={loading}
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={setPage}
            columns={[
              {
                key: "createdAt",
                header: "When",
                render: (a) =>
                  a.createdAt ? new Date(a.createdAt).toLocaleString() : "—",
              },
              {
                key: "user",
                header: "User",
                render: (a) =>
                  a.userId && onOpenUser ? (
                    <button
                      type="button"
                      className="admin-ops-user-link"
                      onClick={() => onOpenUser(a.userId!)}
                    >
                      {a.userEmail || a.userName || a.userId}
                    </button>
                  ) : (
                    <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                      {a.userEmail || a.userName || a.userId || "—"}
                    </span>
                  ),
              },
              {
                key: "type",
                header: "Type",
                render: (a) => (
                  <span className="admin-ops-mono-text">{a.type}</span>
                ),
              },
              {
                key: "action",
                header: "Action",
                render: (a) => <StatusBadge status={a.action} />,
              },
              {
                key: "detail",
                header: "Detail",
                render: (a) => (
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>
                    {a.detail || "—"}
                  </span>
                ),
              },
              {
                key: "ip",
                header: "IP",
                render: (a) => (
                  <span className="admin-ops-mono-text">{a.ip || "—"}</span>
                ),
              },
            ]}
            rows={activity}
            emptyTitle="No activity yet"
            emptyDescription="Security and audit events will appear here as they occur."
            emptyIcon={<Activity size={20} strokeWidth={1.75} />}
          />
        )}

        {mode === "progress" && (
          <DataTable
            rowKey={(r) => r.userId}
            loading={loading}
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={setPage}
            columns={[
              {
                key: "user",
                header: "User",
                render: (r) =>
                  onOpenUser ? (
                    <button
                      type="button"
                      className="admin-ops-user-link"
                      onClick={() => onOpenUser(r.userId)}
                    >
                      {r.name || r.email}
                    </button>
                  ) : (
                    <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                      {r.name || r.email}
                    </span>
                  ),
              },
              {
                key: "email",
                header: "Email",
                render: (r) => (
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>
                    {r.email}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "attempted",
                header: "Attempted",
                render: (r) => (
                  <span className="admin-ops-mono-text">{r.problemsAttempted}</span>
                ),
              },
              {
                key: "solved",
                header: "Solved",
                render: (r) => (
                  <span className="admin-ops-mono-text">{r.problemsSolved}</span>
                ),
              },
              {
                key: "subs",
                header: "Submissions",
                render: (r) => (
                  <span className="admin-ops-mono-text">{r.submissionCount}</span>
                ),
              },
              {
                key: "accept",
                header: "Accept %",
                render: (r) => (
                  <span className="admin-ops-mono-text">{r.acceptanceRate}%</span>
                ),
              },
            ]}
            rows={progress}
            emptyTitle="No users found"
            emptyDescription="User progress appears after accounts exist and submit code."
            emptyIcon={<ChartColumn size={20} strokeWidth={1.75} />}
          />
        )}

        {mode === "sessions" && (
          <DataTable
            rowKey={(s) => s.id}
            loading={loading}
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={setPage}
            columns={[
              {
                key: "user",
                header: "User",
                render: (s) =>
                  s.userId && onOpenUser ? (
                    <button
                      type="button"
                      className="admin-ops-user-link"
                      onClick={() => onOpenUser(s.userId!)}
                    >
                      {s.userEmail || s.userName || s.userId}
                    </button>
                  ) : (
                    <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                      {s.userEmail || s.userName || s.userId || "—"}
                    </span>
                  ),
              },
              {
                key: "ip",
                header: "IP",
                render: (s) => (
                  <span className="admin-ops-mono-text">{s.ip || "—"}</span>
                ),
              },
              {
                key: "ua",
                header: "User Agent",
                render: (s) => (
                  <span className="admin-ops-ua-text">
                    {s.userAgent ? String(s.userAgent) : "—"}
                  </span>
                ),
              },
              {
                key: "createdAt",
                header: "Created",
                render: (s) =>
                  s.createdAt ? new Date(s.createdAt).toLocaleString() : "—",
              },
              {
                key: "expired",
                header: "State",
                render: (s) => (
                  <StatusBadge status={s.expired ? "expired" : "active"} />
                ),
              },
              {
                key: "actions",
                header: "",
                render: (s) =>
                  canUpdate && s.userId && !s.expired ? (
                    <button
                      type="button"
                      className="admin-btn danger-secondary"
                      style={{ height: 30, padding: "0 10px", fontSize: "0.75rem" }}
                      onClick={async () => {
                        try {
                          await adminAuthApi.revokeUserSession(s.userId!, s.id);
                          setSessions((prev) =>
                            prev.map((row) =>
                              row.id === s.id ? { ...row, expired: true } : row
                            )
                          );
                        } catch (err: any) {
                          setError({
                            title: "Failed to revoke session",
                            message: err?.response?.data?.message || err.message,
                          });
                        }
                      }}
                    >
                      Revoke
                    </button>
                  ) : null,
              },
            ]}
            rows={sessions}
            emptyTitle="No active sessions"
            emptyDescription="Login sessions will appear here when users authenticate."
            emptyIcon={<Monitor size={20} strokeWidth={1.75} />}
          />
        )}
      </div>
    </PermissionGuard>
  );
};
