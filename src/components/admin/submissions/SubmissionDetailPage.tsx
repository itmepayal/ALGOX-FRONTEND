import { useEffect, useState, type FC } from "react";
import { ArrowLeft, AlertTriangle, Trash2, Code2 } from "lucide-react";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import type { Submission } from "../../../api/submissionApi";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { ConfirmDialog } from "../../ConfirmDialog";
import { WidgetError } from "../shared/WidgetError";
import { usePermission } from "../../../rbac/usePermission";
import "./submission.css";

interface Props {
  id: string;
  onBack: () => void;
}

export const SubmissionDetailPage: FC<Props> = ({ id, onBack }) => {
  const { can } = usePermission();
  const [row, setRow] = useState<Submission | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await adminSubmissionApi.getById(id);
        setRow(res.data);
      } catch (err: any) {
        setError({
          title: "Unable to load submission",
          message: err?.response?.data?.message || err.message || "Failed to fetch submission details",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <PermissionGuard
      permission="submissions:view"
      fallback={<div className="admin-denied">No submissions permission.</div>}
    >
      <div className="admin-submission-detail-page">
        <div className="admin-submission-detail-header">
          <div className="admin-submission-detail-title">
            <button
              type="button"
              className="admin-btn"
              onClick={onBack}
              aria-label="Back to submissions"
            >
              <ArrowLeft size={15} /> Back
            </button>
            <h2>Submission #{id.slice(0, 8)}</h2>
            {row ? <StatusBadge status={String(row.status)} /> : null}
          </div>
          {can("submissions:delete") && (
            <button
              type="button"
              className="admin-btn danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>

        {error ? (
          <WidgetError
            compact
            title={error.title}
            message={error.message}
            onRetry={() => {
              setLoading(true);
              setError(null);
              adminSubmissionApi
                .getById(id)
                .then((res) => setRow(res.data))
                .catch((err) =>
                  setError({
                    title: "Unable to load submission",
                    message: err?.response?.data?.message || err.message,
                  }),
                )
                .finally(() => setLoading(false));
            }}
          />
        ) : null}

        {loading && !row ? (
          <div className="admin-skel admin-skel-chart" />
        ) : row ? (
          <>
            <div className="admin-submission-stats-grid">
              <div className="admin-submission-stat-card">
                <span className="admin-submission-stat-label">Status</span>
                <div className="mt-1">
                  <StatusBadge status={String(row.status)} />
                </div>
              </div>
              <div className="admin-submission-stat-card">
                <span className="admin-submission-stat-label">Language</span>
                <span className="admin-submission-stat-val font-mono text-base">
                  {row.language || "—"}
                </span>
              </div>
              <div className="admin-submission-stat-card">
                <span className="admin-submission-stat-label">Test Cases Passed</span>
                <span className="admin-submission-stat-val font-mono text-base">
                  {row.testCasesPassed ?? 0} / {row.totalTestCases ?? "?"}
                </span>
              </div>
              <div className="admin-submission-stat-card">
                <span className="admin-submission-stat-label">Submitted At</span>
                <span className="admin-submission-stat-val text-sm font-medium">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                </span>
              </div>
            </div>

            <div className="admin-submission-code-panel">
              <div className="admin-submission-code-head">
                <span className="inline-flex items-center gap-2">
                  <Code2 size={16} className="text-muted-foreground" /> Source Code
                </span>
                <span className="admin-submission-lang-badge">
                  {row.language || "code"}
                </span>
              </div>
              <pre className="admin-submission-code-body">{row.code}</pre>
            </div>

            {row.error ? (
              <div className="admin-submission-error-panel">
                <div className="admin-submission-error-head">
                  <AlertTriangle size={16} /> Error Output
                </div>
                <pre className="admin-submission-error-body">{row.error}</pre>
              </div>
            ) : null}
          </>
        ) : null}

        <ConfirmDialog
          open={confirmDelete}
          title="Delete submission?"
          description="This action permanently deletes this submission record."
          warning="This action cannot be undone."
          confirmLabel="Delete"
          confirmVariant="danger"
          confirming={deleting}
          confirmingLabel="Deleting…"
          onCancel={() => !deleting && setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              setDeleting(true);
              await adminSubmissionApi.remove(id);
              setConfirmDelete(false);
              onBack();
            } catch (err: unknown) {
              setError({
                title: "Failed to delete submission",
                message: "An error occurred while deleting this record.",
              });
            } finally {
              setDeleting(false);
            }
          }}
        />
      </div>
    </PermissionGuard>
  );
};
