import { useEffect, useState, type FC } from "react";
import { FileCode2 } from "lucide-react";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import type { Submission } from "../../../api/submissionApi";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { WidgetError } from "../shared/WidgetError";
import "./submission.css";

interface Props {
  onOpen: (id: string) => void;
}

export const SubmissionListPage: FC<Props> = ({ onOpen }) => {
  const [rows, setRows] = useState<Submission[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [status, setStatus] = useState("all");
  const [language, setLanguage] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null,
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminSubmissionApi.list({
        page,
        limit: 20,
        status: status === "all" ? undefined : status,
        language: language === "all" ? undefined : language,
      });
      setRows(res.data || []);
      setMeta({
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });
    } catch (err: any) {
      setError({
        title: "Unable to load submissions",
        message: err?.response?.data?.message || err.message || "Failed to fetch submissions",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, language]);

  const idOf = (s: Submission) => String(s.id || s._id || "");

  return (
    <PermissionGuard
      permission="submissions:view"
      fallback={<div className="admin-denied">No submissions permission.</div>}
    >
      <div className="admin-submissions-page">
        <p className="admin-page-lead">
          Inspect live and historical submissions across the platform.
        </p>
        <div className="admin-toolbar admin-toolbar-submissions">
          <div className="admin-toolbar-submissions-filters">
            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="all">All statuses</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="WRONG_ANSWER">WRONG_ANSWER</option>
              <option value="PENDING">PENDING</option>
              <option value="RUNTIME_ERROR">RUNTIME_ERROR</option>
              <option value="COMPILATION_ERROR">COMPILATION_ERROR</option>
            </select>
            <select
              aria-label="Filter language"
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
          </div>
        </div>
        {error ? (
          <WidgetError
            compact
            title={error.title}
            message={error.message}
            onRetry={() => void load()}
          />
        ) : null}
        <DataTable
          className="admin-submissions-table"
          rows={rows}
          rowKey={idOf}
          loading={loading}
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
          emptyTitle="No submissions found"
          emptyDescription="Try a different status or language filter."
          emptyIcon={<FileCode2 size={18} strokeWidth={1.75} />}
          columns={[
            {
              key: "id",
              header: "ID",
              width: "130px",
              render: (s) => (
                <button
                  type="button"
                  className="admin-submission-id-btn"
                  onClick={() => onOpen(idOf(s))}
                  title={idOf(s)}
                >
                  {idOf(s).slice(0, 8)}…
                </button>
              ),
            },
            {
              key: "status",
              header: "Status",
              width: "140px",
              render: (s) => <StatusBadge status={String(s.status)} />,
            },
            {
              key: "language",
              header: "Language",
              width: "110px",
              render: (s) => (
                <span className="admin-submission-lang-badge">
                  {s.language || "—"}
                </span>
              ),
            },
            {
              key: "source",
              header: "Source",
              width: "100px",
              render: (s) => (
                <span className="admin-submission-source-badge">
                  {s.source || "submit"}
                </span>
              ),
            },
            {
              key: "problem",
              header: "Problem",
              render: (s) => (
                <span
                  className="admin-submission-mono-text"
                  title={String(s.problemId || "")}
                >
                  {s.problemId ? String(s.problemId).slice(0, 10) : "—"}
                </span>
              ),
            },
            {
              key: "user",
              header: "User",
              render: (s) => (
                <span
                  className="admin-submission-mono-text"
                  title={String(s.userId || "")}
                >
                  {s.userId ? String(s.userId).slice(0, 10) : "—"}
                </span>
              ),
            },
            {
              key: "created",
              header: "Created",
              width: "160px",
              align: "right",
              render: (s) =>
                s.createdAt ? new Date(s.createdAt).toLocaleString() : "—",
            },
          ]}
        />
      </div>
    </PermissionGuard>
  );
};
