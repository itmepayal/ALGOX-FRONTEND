import { useCallback, useEffect, useState, type FC } from "react";
import { AlertTriangle } from "lucide-react";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";

const FAIL_STATUSES = [
  "WRONG_ANSWER",
  "RUNTIME_ERROR",
  "COMPILATION_ERROR",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "SYSTEM_ERROR",
] as const;

interface FailedExecutionsPageProps {
  onOpen?: (id: string) => void;
}

export const FailedExecutionsPage: FC<FailedExecutionsPageProps> = ({
  onOpen,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [status, setStatus] = useState("all");
  const [language, setLanguage] = useState("all");
  const [problemId, setProblemId] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminSubmissionApi.listFailed({
        page,
        limit: 25,
        status: status !== "all" ? status : undefined,
        language: language !== "all" ? language : undefined,
        problemId: problemId.trim() || undefined,
        userId: userId.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setRows(res.data || []);
      setMeta({
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, language, problemId, userId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  return (
    <PermissionGuard
      permission="submissions:view"
      fallback={<div className="admin-denied">No permission.</div>}
    >
      <p className="admin-page-lead">
        Server-filtered failed executions (WA, RE, TLE, MLE, CE).
      </p>
      <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="all">All failures</option>
          {FAIL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={language}
          onChange={(e) => {
            setPage(1);
            setLanguage(e.target.value);
          }}
        >
          <option value="all">All languages</option>
          <option value="javascript">javascript</option>
          <option value="python">python</option>
          <option value="cpp">cpp</option>
          <option value="java">java</option>
        </select>
        <input
          placeholder="Problem ID"
          value={problemId}
          onChange={(e) => setProblemId(e.target.value)}
        />
        <input
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setPage(1);
            setFrom(e.target.value);
          }}
          title="From"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setPage(1);
            setTo(e.target.value);
          }}
          title="To"
        />
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            setPage(1);
            void load();
          }}
        >
          Apply
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-stats-grid" style={{ marginBottom: 14 }}>
        <StatsCard label="Total matching" value={meta.total} />
        {Object.entries(byStatus)
          .slice(0, 4)
          .map(([k, v]) => (
            <StatsCard key={k} label={k} value={v} />
          ))}
      </div>
      <DataTable
        loading={loading}
        emptyTitle="No failed executions"
        emptyDescription="No matching failures for these filters."
        emptyIcon={<AlertTriangle size={18} strokeWidth={1.75} />}
        rowKey={(r) => String(r.id || r._id)}
        rows={rows}
        page={page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={setPage}
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
                {String(r.id || r._id).slice(-8)}
              </button>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "language",
            header: "Lang",
            render: (r) => r.language || "—",
          },
          {
            key: "problemId",
            header: "Problem",
            render: (r) => String(r.problemId || "—").slice(-8),
          },
          {
            key: "userId",
            header: "User",
            render: (r) => String(r.userId || "—").slice(-8),
          },
          {
            key: "createdAt",
            header: "When",
            render: (r) =>
              r.createdAt ? new Date(r.createdAt).toLocaleString() : "—",
          },
        ]}
      />
    </PermissionGuard>
  );
};
