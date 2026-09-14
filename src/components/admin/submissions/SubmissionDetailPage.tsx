import { useEffect, useState, type FC } from "react";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import type { Submission } from "../../../api/submissionApi";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { ConfirmDialog } from "../../ConfirmDialog";
import { hasPermission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";

interface Props {
  id: string;
  onBack: () => void;
}

export const SubmissionDetailPage: FC<Props> = ({ id, onBack }) => {
  const { user } = useAuth();
  const [row, setRow] = useState<Submission | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminSubmissionApi.getById(id);
        setRow(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message);
      }
    })();
  }, [id]);

  return (
    <PermissionGuard
      permission="submissions:view"
      fallback={<div className="admin-denied">No submissions permission.</div>}
    >
      <div className="admin-toolbar">
        <button type="button" className="admin-btn" onClick={onBack}>
          ← Back
        </button>
        {hasPermission(user?.role, "submissions:delete") && (
          <button
            type="button"
            className="admin-btn danger"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        )}
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {!row ? (
        <p className="admin-muted">Loading…</p>
      ) : (
        <div>
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="label">Status</div>
              <StatusBadge status={String(row.status)} />
            </div>
            <div className="admin-stat-card">
              <div className="label">Language</div>
              <div className="value" style={{ fontSize: "1rem" }}>
                {row.language}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="label">Passed</div>
              <div className="value" style={{ fontSize: "1rem" }}>
                {row.testCasesPassed ?? 0}/{row.totalTestCases ?? "?"}
              </div>
            </div>
          </div>
          <div className="admin-field">
            <label>Code</label>
            <pre
              className="admin-preview"
              style={{ fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}
            >
              {row.code}
            </pre>
          </div>
          {row.error ? (
            <div className="admin-field">
              <label>Error</label>
              <pre className="admin-preview">{row.error}</pre>
            </div>
          ) : null}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete submission?"
        description="This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await adminSubmissionApi.remove(id);
          setConfirmDelete(false);
          onBack();
        }}
      />
    </PermissionGuard>
  );
};
