import { useCallback, useEffect, useState, type FC } from "react";
import { ShieldAlert } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import {
  adminSuspiciousApi,
  type SuspiciousRow,
} from "../../../api/adminSuspiciousApi";

export const SuspiciousSubmissionsPage: FC = () => {
  const [rows, setRows] = useState<SuspiciousRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("FLAGGED");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminSuspiciousApi.list({
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

  return (
    <PermissionGuard permission="suspicious:view">
      <p className="admin-muted" style={{ marginBottom: 10 }}>
        Heuristic flags only — no automatic bans. Confirm or dismiss after review.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select
          className="admin-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="FLAGGED">FLAGGED</option>
          <option value="REVIEWING">REVIEWING</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="DISMISSED">DISMISSED</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle="No flagged submissions"
        emptyDescription="Heuristic flags for the selected status will appear here."
        emptyIcon={<ShieldAlert size={18} strokeWidth={1.75} />}
        columns={[
          {
            key: "user",
            header: "User",
            render: (r) => String(r.userId).slice(0, 10),
          },
          {
            key: "sub",
            header: "Submission",
            render: (r) => String(r.submissionId).slice(0, 10),
          },
          { key: "score", header: "Score", render: (r) => r.score },
          {
            key: "sev",
            header: "Severity",
            render: (r) => <StatusBadge status={r.severity} />,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "signals",
            header: "Signals",
            render: (r) => (r.signals || []).join(", "),
          },
          {
            key: "actions",
            header: "Review",
            render: (r) => (
              <PermissionGuard permission="suspicious:review">
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="admin-link"
                    onClick={() =>
                      void adminSuspiciousApi.review(r._id).then(load)
                    }
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    className="admin-link"
                    onClick={() =>
                      void adminSuspiciousApi
                        .confirm(r._id, "Confirmed suspicious")
                        .then(load)
                    }
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="admin-link"
                    onClick={() =>
                      void adminSuspiciousApi
                        .dismiss(r._id, "False positive")
                        .then(load)
                    }
                  >
                    Dismiss
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
