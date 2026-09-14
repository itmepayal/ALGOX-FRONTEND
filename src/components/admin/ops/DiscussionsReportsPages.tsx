import { useCallback, useEffect, useState, type FC } from "react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import {
  adminDiscussionApi,
  type AdminDiscussionPost,
  type AdminReport,
} from "../../../api/adminDiscussionApi";

export const DiscussionsAdminPage: FC = () => {
  const [rows, setRows] = useState<AdminDiscussionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminDiscussionApi.listPosts({
        page: 1,
        limit: 50,
        q: q || undefined,
        status: status || undefined,
      });
      setRows(res.data?.posts || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const moderate = async (
    id: string,
    action: "pin" | "unpin" | "lock" | "unlock" | "hide" | "restore" | "delete"
  ) => {
    try {
      await adminDiscussionApi.moderate(id, action);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Moderation failed");
    }
  };

  return (
    <PermissionGuard permission="discussions:view">
      <div className="admin-toolbar" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          className="admin-input"
          placeholder="Search discussions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="admin-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="HIDDEN">HIDDEN</option>
          <option value="LOCKED">LOCKED</option>
          <option value="DELETED">DELETED</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle="No discussions found."
        columns={[
          {
            key: "title",
            header: "Title",
            render: (r) => r.title,
          },
          { key: "author", header: "Author", render: (r) => r.authorName },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "flags",
            header: "Flags",
            render: (r) =>
              [r.isPinned ? "pinned" : null, r.isLocked ? "locked" : null]
                .filter(Boolean)
                .join(", ") || "—",
          },
          { key: "votes", header: "Votes", render: (r) => r.upvotes },
          { key: "comments", header: "Comments", render: (r) => r.commentCount },
          {
            key: "actions",
            header: "Moderate",
            render: (r) => (
              <PermissionGuard permission="discussions:moderate">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <button type="button" className="admin-link" onClick={() => void moderate(r._id, r.isPinned ? "unpin" : "pin")}>
                    {r.isPinned ? "Unpin" : "Pin"}
                  </button>
                  <button type="button" className="admin-link" onClick={() => void moderate(r._id, r.isLocked ? "unlock" : "lock")}>
                    {r.isLocked ? "Unlock" : "Lock"}
                  </button>
                  <button type="button" className="admin-link" onClick={() => void moderate(r._id, r.status === "HIDDEN" ? "restore" : "hide")}>
                    {r.status === "HIDDEN" ? "Restore" : "Hide"}
                  </button>
                  <button type="button" className="admin-link" onClick={() => void moderate(r._id, "delete")}>
                    Delete
                  </button>
                </div>
              </PermissionGuard>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r._id}
      />
    </PermissionGuard>
  );
};

export const ReportsAdminPage: FC = () => {
  const [rows, setRows] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("OPEN");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminDiscussionApi.listReports({
        page: 1,
        limit: 50,
        status: status || undefined,
      });
      setRows(res.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (
    id: string,
    kind: "review" | "resolve" | "dismiss" | "reopen"
  ) => {
    try {
      if (kind === "review") await adminDiscussionApi.reviewReport(id);
      if (kind === "resolve")
        await adminDiscussionApi.resolveReport(id, "Resolved by admin");
      if (kind === "dismiss")
        await adminDiscussionApi.dismissReport(id, "Dismissed by admin");
      if (kind === "reopen") await adminDiscussionApi.reopenReport(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Action failed");
    }
  };

  return (
    <PermissionGuard permission="reports:view">
      <div className="admin-toolbar" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select
          className="admin-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="OPEN">OPEN</option>
          <option value="UNDER_REVIEW">UNDER_REVIEW</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="DISMISSED">DISMISSED</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle="No reports in queue."
        columns={[
          { key: "type", header: "Target", render: (r) => `${r.targetType}:${r.targetId.slice(0, 8)}` },
          { key: "reason", header: "Reason", render: (r) => r.reason },
          {
            key: "priority",
            header: "Priority",
            render: (r) => <StatusBadge status={r.priority} />,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "at",
            header: "Created",
            render: (r) => new Date(r.createdAt).toLocaleString(),
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <PermissionGuard permission="reports:review">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <button type="button" className="admin-link" onClick={() => void act(r._id, "review")}>
                    Review
                  </button>
                  <PermissionGuard permission="reports:resolve">
                    <button type="button" className="admin-link" onClick={() => void act(r._id, "resolve")}>
                      Resolve
                    </button>
                    <button type="button" className="admin-link" onClick={() => void act(r._id, "dismiss")}>
                      Dismiss
                    </button>
                  </PermissionGuard>
                  <button type="button" className="admin-link" onClick={() => void act(r._id, "reopen")}>
                    Reopen
                  </button>
                </div>
              </PermissionGuard>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r._id}
      />
    </PermissionGuard>
  );
};
