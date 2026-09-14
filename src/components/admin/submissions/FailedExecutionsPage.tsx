import { useEffect, useState, type FC } from "react";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";

const FAIL = new Set([
  "WRONG_ANSWER",
  "RUNTIME_ERROR",
  "COMPILATION_ERROR",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "SYSTEM_ERROR",
]);

interface FailedExecutionsPageProps {
  onOpen?: (id: string) => void;
}

export const FailedExecutionsPage: FC<FailedExecutionsPageProps> = ({
  onOpen,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await adminSubmissionApi.list({ page: 1, limit: 100 });
        const all = res.data || [];
        const failed = all.filter((s: any) => FAIL.has(String(s.status)));
        if (!cancelled) setRows(failed);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  return (
    <PermissionGuard
      permission="submissions:view"
      fallback={<div className="admin-denied">No permission.</div>}
    >
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-stats-grid" style={{ marginBottom: 14 }}>
        <StatsCard label="Failed (page)" value={rows.length} />
        {Object.entries(byStatus)
          .slice(0, 4)
          .map(([k, v]) => (
            <StatsCard key={k} label={k} value={v} />
          ))}
      </div>
      <DataTable
        loading={loading}
        emptyTitle="No failed executions in recent submissions."
        columns={[
          {
            key: "id",
            header: "ID",
            render: (r) => (
              <button
                type="button"
                className="admin-link"
                onClick={() => onOpen?.(String(r.id || r._id))}
              >
                {String(r.id || r._id || "").slice(0, 8)}…
              </button>
            ),
          },
          { key: "problem", header: "Problem", render: (r) => r.problemId || "—" },
          { key: "lang", header: "Language", render: (r) => r.language || "—" },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "at",
            header: "Created",
            render: (r) =>
              r.createdAt ? new Date(r.createdAt).toLocaleString() : "—",
          },
        ]}
        rows={rows}
        rowKey={(r) => String(r.id || r._id)}
      />
    </PermissionGuard>
  );
};
