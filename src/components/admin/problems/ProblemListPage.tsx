import { useEffect, useState, type FC } from "react";
import { Plus, Copy, Archive, Trash2, BookOpen } from "lucide-react";
import {
  adminProblemApi,
  type AdminProblem,
  type ProblemStatus,
} from "../../../api/adminProblemApi";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { ConfirmDialog } from "../../ConfirmDialog";
import { usePermission } from "../../../rbac/usePermission";
import { useToast } from "../../../context/ToastContext";
import { normalizeApiError } from "../../../lib/apiError";
import { WidgetError } from "../shared/WidgetError";
import { DifficultyBadge } from "../shared/DifficultyBadge";
import "./problem-list.css";

interface Props {
  onEdit: (id: string | null) => void;
}

export const ProblemListPage: FC<Props> = ({ onEdit }) => {
  const { can } = usePermission();
  const toast = useToast();
  const [rows, setRows] = useState<AdminProblem[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [access, setAccess] = useState("all");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminProblemApi.list({
        page,
        limit: 20,
        search: search || undefined,
        status: status === "all" ? undefined : status,
        difficulty: difficulty === "all" ? undefined : difficulty,
        access: access === "all" ? undefined : access,
      });
      setRows(res.data || []);
      setMeta({
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });
    } catch (err: unknown) {
      const n = normalizeApiError(err);
      setError({ title: n.title, message: n.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, difficulty, access]);

  const idOf = (p: AdminProblem) => p.id || p._id || "";

  const setProblemStatus = async (id: string, next: ProblemStatus) => {
    try {
      await adminProblemApi.setStatus(id, next);
      toast.success(
        next === "published" ? "Problem published" : `Problem marked ${next}`
      );
      await load();
    } catch (err: unknown) {
      toast.apiError(err, "Failed to update problem status");
    }
  };

  const bulkStatus = async (next: ProblemStatus) => {
    if (!selected.size) return;
    try {
      await adminProblemApi.bulk({
        ids: [...selected],
        action: "status",
        status: next,
      });
      toast.success(
        next === "published"
          ? "Selected problems published"
          : `Selected problems ${next}`
      );
      setSelected(new Set());
      await load();
    } catch (err: unknown) {
      toast.apiError(err, "Bulk update failed");
    }
  };

  return (
    <PermissionGuard
      permission="problems:view"
      fallback={<div className="admin-denied">No problems permission.</div>}
    >
      <div className="admin-problems-page">
      <p className="admin-page-lead">
        Search, filter, and manage the AlgoPath problem catalog.
      </p>
      <div className="admin-toolbar admin-toolbar-problems">
        <input
          className="admin-toolbar-search"
          placeholder="Search title, slug, tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
        />
        <select
          className="admin-toolbar-filter admin-toolbar-filter--status"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          className="admin-toolbar-filter admin-toolbar-filter--difficulty"
          value={difficulty}
          onChange={(e) => {
            setPage(1);
            setDifficulty(e.target.value);
          }}
        >
          <option value="all">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select
          className="admin-toolbar-filter admin-toolbar-filter--access"
          value={access}
          onChange={(e) => {
            setPage(1);
            setAccess(e.target.value);
          }}
          aria-label="Access"
        >
          <option value="all">All access</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <button
          type="button"
          className="admin-btn admin-toolbar-submit"
          onClick={() => { setPage(1); load(); }}
        >
          Search
        </button>
        {can("problems:create") && (
          <button
            type="button"
            className="admin-btn primary admin-toolbar-create"
            onClick={() => onEdit(null)}
          >
            <Plus size={14} /> New problem
          </button>
        )}
        {can("problems:publish") && selected.size > 0 && (
          <>
            <button type="button" className="admin-btn bulk" onClick={() => bulkStatus("published")}>
              Publish selected
            </button>
            <button type="button" className="admin-btn bulk" onClick={() => bulkStatus("archived")}>
              <Archive size={14} /> Archive
            </button>
          </>
        )}
        {can("problems:update") && selected.size > 0 && (
          <>
            <button
              type="button"
              className="admin-btn bulk"
              onClick={async () => {
                try {
                  await adminProblemApi.bulk({
                    ids: [...selected],
                    action: "premium",
                    isPremium: true,
                  } as any);
                  toast.success("Marked selected as Premium");
                  setSelected(new Set());
                  await load();
                } catch (err: unknown) {
                  toast.apiError(err, "Bulk premium update failed");
                }
              }}
            >
              Mark Premium
            </button>
            <button
              type="button"
              className="admin-btn bulk"
              onClick={async () => {
                try {
                  await adminProblemApi.bulk({
                    ids: [...selected],
                    action: "premium",
                    isPremium: false,
                  } as any);
                  toast.success("Marked selected as Free");
                  setSelected(new Set());
                  await load();
                } catch (err: unknown) {
                  toast.apiError(err, "Bulk free update failed");
                }
              }}
            >
              Mark Free
            </button>
          </>
        )}
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
        className="admin-problems-table"
        rows={rows}
        rowKey={idOf}
        loading={loading}
        emptyTitle="No problems found"
        emptyDescription="Try adjusting filters, or create a new problem."
        emptyIcon={<BookOpen size={18} strokeWidth={1.75} />}
        selectedIds={selected}
        onToggleSelect={(id) => {
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onToggleSelectAll={() => {
          if (rows.every((r) => selected.has(idOf(r)))) setSelected(new Set());
          else setSelected(new Set(rows.map(idOf)));
        }}
        page={page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={setPage}
        columns={[
          {
            key: "title",
            header: "Title",
            render: (p) => (
              <button
                type="button"
                className="admin-problem-title-link"
                onClick={() => onEdit(idOf(p))}
              >
                {p.title}
              </button>
            ),
          },
          {
            key: "difficulty",
            header: "Difficulty",
            render: (p) => <DifficultyBadge difficulty={p.difficulty} />,
          },
          {
            key: "access",
            header: "Access",
            render: (p) => (
              <span
                className={
                  p.isPremium
                    ? "admin-access-badge admin-access-badge--premium"
                    : "admin-access-badge admin-access-badge--free"
                }
              >
                {p.isPremium ? "Premium" : "Free"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (p) => <StatusBadge status={p.status || "draft"} />,
          },
          {
            key: "tags",
            header: "Tags",
            render: (p) => (p.tags || []).slice(0, 3).join(", "),
          },
          {
            key: "actions",
            header: "Actions",
            render: (p) => {
              const id = idOf(p);
              return (
                <div className="admin-problems-actions">
                  {can("problems:publish") && p.status !== "published" && (
                    <button
                      type="button"
                      className="admin-icon-action admin-icon-action--publish"
                      onClick={() => setProblemStatus(id, "published")}
                    >
                      Publish
                    </button>
                  )}
                  {can("problems:create") && (
                    <button
                      type="button"
                      className="admin-icon-action"
                      aria-label="Duplicate problem"
                      title="Duplicate"
                      onClick={async () => {
                        const res = await adminProblemApi.duplicate(id);
                        const nid = res.data?.id || (res.data as any)?._id;
                        if (nid) onEdit(String(nid));
                        else await load();
                      }}
                    >
                      <Copy size={14} />
                    </button>
                  )}
                  {can("problems:delete") && (
                    <button
                      type="button"
                      className="admin-icon-action admin-icon-action--danger"
                      aria-label="Delete problem"
                      title="Delete"
                      onClick={() => setConfirmDelete(id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
      />
      </div>
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete problem?"
        description="This permanently removes the problem and its test cases."
        warning="This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        confirming={deleting}
        confirmingLabel="Deleting…"
        onCancel={() => !deleting && setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            setDeleting(true);
            await adminProblemApi.remove(confirmDelete);
            toast.success("Problem deleted successfully");
            setConfirmDelete(null);
            await load();
          } catch (err: unknown) {
            toast.apiError(err, "Failed to delete problem");
          } finally {
            setDeleting(false);
          }
        }}
      />
    </PermissionGuard>
  );
};
