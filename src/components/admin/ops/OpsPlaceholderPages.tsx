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
import { usePermission } from "../../../rbac/usePermission";

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
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const [activity, setActivity] = useState<PlatformActivityItem[]>([]);
  const [progress, setProgress] = useState<PlatformProgressRow[]>([]);
  const [sessions, setSessions] = useState<PlatformSessionRow[]>([]);

  useEffect(() => {
    setPage(1);
  }, [mode]);

  useEffect(() => {
    if (mode === "online") return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        if (mode === "activity") {
          const res = await adminAuthApi.listPlatformActivity({
            page,
            limit: 30,
          });
          if (!cancelled) {
            setActivity(res.data || []);
            setMeta({
              total: res.meta?.total || 0,
              totalPages: res.meta?.totalPages || 1,
            });
          }
        } else if (mode === "progress") {
          const res = await adminAuthApi.listPlatformProgress({
            page,
            limit: 20,
            search: searchQ || undefined,
          });
          if (!cancelled) {
            setProgress(res.data || []);
            setMeta({
              total: res.meta?.total || 0,
              totalPages: res.meta?.totalPages || 1,
            });
          }
        } else if (mode === "sessions") {
          const res = await adminAuthApi.listPlatformSessions({
            page,
            limit: 20,
          });
          if (!cancelled) {
            setSessions(res.data || []);
            setMeta({
              total: res.meta?.total || 0,
              totalPages: res.meta?.totalPages || 1,
            });
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, page, searchQ]);

  if (mode === "online") {
    return (
      <p className="admin-muted">
        Use Real-Time → Live Users for presence (RealtimeService sockets).
      </p>
    );
  }

  const title =
    mode === "activity"
      ? "User Activity"
      : mode === "progress"
        ? "User Progress"
        : "User Sessions";

  return (
    <PermissionGuard
      permission="users:view"
      fallback={<div className="admin-denied">No users permission.</div>}
    >
      <p className="admin-page-lead">
        {mode === "activity" &&
          "Security and account events across users (live Auth data)."}
        {mode === "progress" &&
          "Submission progress per account from SubmissionService."}
        {mode === "sessions" &&
          "Active and recent refresh sessions across accounts."}
      </p>

      <div className="admin-toolbar">
        <strong>{title}</strong>
        {mode === "progress" ? (
          <input
            placeholder="Search name or email"
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
        {onGoToUsers ? (
          <button type="button" className="admin-btn" onClick={onGoToUsers}>
            All Users
          </button>
        ) : null}
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {loading ? <p className="admin-muted">Loading…</p> : null}

      {!loading && mode === "activity" ? (
        <DataTable
          rowKey={(a) => a.id}
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
                    className="admin-btn link"
                    onClick={() => onOpenUser(a.userId!)}
                  >
                    {a.userEmail || a.userName || a.userId}
                  </button>
                ) : (
                  a.userEmail || a.userName || a.userId || "—"
                ),
            },
            { key: "type", header: "Type", render: (a) => a.type },
            { key: "action", header: "Action", render: (a) => a.action },
            {
              key: "detail",
              header: "Detail",
              render: (a) => a.detail || "—",
            },
            { key: "ip", header: "IP", render: (a) => a.ip || "—" },
          ]}
          rows={activity}
          emptyTitle="No activity yet"
          emptyDescription="Security and audit events will appear here as they occur."
          emptyIcon={<Activity size={18} strokeWidth={1.75} />}
        />
      ) : null}

      {!loading && mode === "progress" ? (
        <DataTable
          rowKey={(r) => r.userId}
          columns={[
            {
              key: "user",
              header: "User",
              render: (r) =>
                onOpenUser ? (
                  <button
                    type="button"
                    className="admin-btn link"
                    onClick={() => onOpenUser(r.userId)}
                  >
                    {r.name || r.email}
                  </button>
                ) : (
                  r.name || r.email
                ),
            },
            { key: "email", header: "Email", render: (r) => r.email },
            {
              key: "status",
              header: "Status",
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: "attempted",
              header: "Attempted",
              render: (r) => r.problemsAttempted,
            },
            {
              key: "solved",
              header: "Solved",
              render: (r) => r.problemsSolved,
            },
            {
              key: "subs",
              header: "Submissions",
              render: (r) => r.submissionCount,
            },
            {
              key: "accept",
              header: "Accept %",
              render: (r) => `${r.acceptanceRate}%`,
            },
          ]}
          rows={progress}
          emptyTitle="No users found"
          emptyDescription="User progress appears after accounts exist and submit code."
          emptyIcon={<ChartColumn size={18} strokeWidth={1.75} />}
        />
      ) : null}

      {!loading && mode === "sessions" ? (
        <DataTable
          rowKey={(s) => s.id}
          columns={[
            {
              key: "user",
              header: "User",
              render: (s) =>
                s.userId && onOpenUser ? (
                  <button
                    type="button"
                    className="admin-btn link"
                    onClick={() => onOpenUser(s.userId!)}
                  >
                    {s.userEmail || s.userName || s.userId}
                  </button>
                ) : (
                  s.userEmail || s.userName || s.userId || "—"
                ),
            },
            { key: "ip", header: "IP", render: (s) => s.ip || "—" },
            {
              key: "ua",
              header: "User agent",
              render: (s) =>
                s.userAgent ? String(s.userAgent).slice(0, 48) : "—",
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
              render: (s) => (s.expired ? "expired" : "active"),
            },
            {
              key: "actions",
              header: "",
              render: (s) =>
                canUpdate && s.userId && !s.expired ? (
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={async () => {
                      try {
                        await adminAuthApi.revokeUserSession(s.userId!, s.id);
                        setSessions((prev) =>
                          prev.map((row) =>
                            row.id === s.id ? { ...row, expired: true } : row
                          )
                        );
                      } catch (err: any) {
                        setError(
                          err?.response?.data?.message || err.message
                        );
                      }
                    }}
                  >
                    Revoke
                  </button>
                ) : null,
            },
          ]}
          rows={sessions}
          emptyTitle="No sessions"
          emptyDescription="Login sessions will appear here when users authenticate."
          emptyIcon={<Monitor size={18} strokeWidth={1.75} />}
        />
      ) : null}

      {meta.totalPages > 1 ? (
        <div className="admin-pager">
          <button
            type="button"
            className="admin-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="admin-muted">
            Page {page} / {meta.totalPages} · {meta.total} total
          </span>
          <button
            type="button"
            className="admin-btn"
            disabled={page >= meta.totalPages}
            onClick={() =>
              setPage((p) => Math.min(meta.totalPages, p + 1))
            }
          >
            Next
          </button>
        </div>
      ) : null}
    </PermissionGuard>
  );
};
