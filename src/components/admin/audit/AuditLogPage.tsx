import { useEffect, useState, type FC } from "react";
import { ScrollText } from "lucide-react";
import { adminAuthApi, type AuditLog } from "../../../api/adminAuthApi";
import { DataTable } from "../shared/DataTable";
import { PermissionGuard } from "../shared/PermissionGuard";

export const AuditLogPage: FC = () => {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [resource, setResource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminAuthApi.listAuditLogs({
        page,
        limit: 25,
        resource: resource || undefined,
      });
      setRows(res.data || []);
      setMeta({
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <PermissionGuard
      permission="audit:view"
      fallback={<div className="admin-denied">No audit permission.</div>}
    >
      <div className="admin-toolbar">
        <input
          placeholder="Filter resource (user, problem…)"
          value={resource}
          onChange={(e) => setResource(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
        />
        <button type="button" className="admin-btn" onClick={() => { setPage(1); load(); }}>
          Filter
        </button>
        <span className="admin-muted">Immutable — view only</span>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        page={page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={setPage}
        emptyTitle="No audit logs found"
        emptyDescription="Admin actions will appear here as an immutable trail."
        emptyIcon={<ScrollText size={18} strokeWidth={1.75} />}
        columns={[
          {
            key: "time",
            header: "Time",
            render: (r) => new Date(r.createdAt).toLocaleString(),
          },
          {
            key: "actor",
            header: "Actor",
            render: (r) => r.actorEmail || r.actorId.slice(0, 8),
          },
          { key: "action", header: "Action", render: (r) => r.action },
          { key: "resource", header: "Resource", render: (r) => r.resource },
          {
            key: "rid",
            header: "Resource ID",
            render: (r) => r.resourceId?.slice(0, 10) || "—",
          },
          {
            key: "diff",
            header: "Change",
            render: (r) =>
              JSON.stringify({ before: r.before, after: r.after }).slice(0, 80),
          },
        ]}
      />
    </PermissionGuard>
  );
};
