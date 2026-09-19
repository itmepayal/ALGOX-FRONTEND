import { useCallback, useEffect, useMemo, useState, type FC, type FormEvent } from "react";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { adminContentApi } from "../../../api/adminContentApi";
import { useToast } from "../../../context/ToastContext";
import { usePermission } from "../../../rbac/usePermission";
import { ConfirmDialog } from "../../ConfirmDialog";
import { AddCompanyProblemDialog } from "./AddCompanyProblemDialog";

type CompanyRow = {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  isPremium?: boolean;
  freePreviewLimit?: number;
  isPublished?: boolean;
  roles?: string[];
  questionCount?: number;
};

function cid(r: CompanyRow) {
  return String(r.id || r._id || "");
}

export const CompaniesAdmin: FC = () => {
  const { can } = usePermission();
  const toast = useToast();
  const canCreate = can("content:create");
  const canUpdate = can("content:update");
  const canDelete = can("content:delete");

  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [questionsFor, setQuestionsFor] = useState<CompanyRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminContentApi.listCompanies({ page, limit: 20 });
      setRows(res.data || []);
      setMeta({
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });
    } catch (err: unknown) {
      toast.apiError(err, "Failed to load companies");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const emptyForm = (): CompanyRow => ({
    name: "",
    slug: "",
    description: "",
    isPremium: true,
    freePreviewLimit: 3,
    isPublished: false,
    roles: [],
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const payload = {
      name: editing.name,
      slug: editing.slug || undefined,
      description: editing.description || "",
      isPremium: Boolean(editing.isPremium),
      freePreviewLimit: Number(editing.freePreviewLimit) || 0,
      isPublished: Boolean(editing.isPublished),
      roles: editing.roles || [],
    };
    try {
      const id = cid(editing);
      if (id) {
        await adminContentApi.updateCompany(id, payload);
        toast.success("Company updated");
      } else {
        await adminContentApi.createCompany(payload);
        toast.success("Company created");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err: unknown) {
      toast.apiError(err, "Save failed");
    }
  };

  return (
    <PermissionGuard permission="content:view">
      <p className="admin-page-lead">
        Configure company interview sets. Frequency and last-seen are optional —
        leave blank rather than inventing stats.
      </p>
      <div className="admin-toolbar">
        {canCreate ? (
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => {
              setEditing(emptyForm());
              setFormOpen(true);
            }}
          >
            <Plus size={14} /> New company
          </button>
        ) : null}
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {formOpen && editing ? (
        <form className="admin-card" onSubmit={save} style={{ marginBottom: 16 }}>
          <h3>{cid(editing) ? "Edit company" : "New company"}</h3>
          <div className="admin-field">
            <label>Name</label>
            <input
              required
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
          <div className="admin-field">
            <label>Slug (optional)</label>
            <input
              value={editing.slug || ""}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              placeholder="auto from name"
            />
          </div>
          <div className="admin-field">
            <label>Description</label>
            <textarea
              value={editing.description || ""}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="admin-field">
            <label>Roles (comma-separated)</label>
            <input
              value={(editing.roles || []).join(", ")}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  roles: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="SDE, Frontend, Backend"
            />
          </div>
          <div className="admin-field">
            <label>Free preview limit</label>
            <input
              type="number"
              min={0}
              max={100}
              value={editing.freePreviewLimit ?? 0}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  freePreviewLimit: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={Boolean(editing.isPremium)}
              onChange={(e) =>
                setEditing({ ...editing, isPremium: e.target.checked })
              }
            />
            Premium company set
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={Boolean(editing.isPublished)}
              onChange={(e) =>
                setEditing({ ...editing, isPublished: e.target.checked })
              }
            />
            Published
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="submit" className="admin-btn primary" disabled={!canUpdate && !canCreate}>
              Save
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <DataTable
        rows={rows}
        rowKey={cid}
        loading={loading}
        emptyTitle="No companies yet"
        emptyDescription="Create a company, then attach configured interview questions."
        emptyIcon={<Briefcase size={18} strokeWidth={1.75} />}
        page={page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={setPage}
        columns={[
          {
            key: "name",
            header: "Company",
            render: (r) => (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  setEditing(r);
                  setFormOpen(true);
                }}
              >
                {r.name}
              </button>
            ),
          },
          { key: "slug", header: "Slug", render: (r) => r.slug },
          {
            key: "access",
            header: "Access",
            render: (r) => (
              <StatusBadge status={r.isPremium ? "premium" : "free"} />
            ),
          },
          {
            key: "preview",
            header: "Free preview",
            render: (r) => String(r.freePreviewLimit ?? 0),
          },
          {
            key: "qs",
            header: "Questions",
            render: (r) => String(r.questionCount ?? 0),
          },
          {
            key: "pub",
            header: "Status",
            render: (r) => (
              <StatusBadge status={r.isPublished ? "published" : "draft"} />
            ),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setQuestionsFor(r)}
                >
                  Questions
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setDeleteId(cid(r))}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      {questionsFor ? (
        <CompanyQuestionsPanel
          company={questionsFor}
          onClose={() => setQuestionsFor(null)}
          canCreate={canCreate}
          canDelete={canDelete}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete company?"
        description="This removes the company and all of its configured questions."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminContentApi.deleteCompany(deleteId);
            toast.success("Company deleted");
            setDeleteId(null);
            await load();
          } catch (err: unknown) {
            toast.apiError(err, "Delete failed");
          }
        }}
        onCancel={() => setDeleteId(null)}
      />
    </PermissionGuard>
  );
};

const CompanyQuestionsPanel: FC<{
  company: CompanyRow;
  onClose: () => void;
  canCreate: boolean;
  canDelete: boolean;
}> = ({ company, onClose, canCreate, canDelete }) => {
  const toast = useToast();
  const id = cid(company);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachedSearch, setAttachedSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminContentApi.listCompanyQuestions(id, {
        page: 1,
        limit: 100,
      });
      setRows(res.data || []);
    } catch (err: unknown) {
      toast.apiError(err, "Failed to load questions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const attachedIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.problemId) s.add(String(r.problemId));
    }
    return s;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = attachedSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.title,
        r.problemId,
        r.slug,
        r.role,
        r.difficulty,
        ...(Array.isArray(r.topics) ? r.topics : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, attachedSearch]);

  return (
    <div className="admin-card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h3>Questions — {company.name}</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canCreate ? (
            <button
              type="button"
              className="admin-btn primary"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={14} /> Add Problem
            </button>
          ) : null}
          <button type="button" className="admin-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div style={{ margin: "12px 0" }}>
        <input
          type="search"
          placeholder="Search attached questions..."
          value={attachedSearch}
          onChange={(e) => setAttachedSearch(e.target.value)}
          aria-label="Search attached questions"
          style={{ width: "100%", maxWidth: 360 }}
        />
      </div>

      <DataTable
        rows={filteredRows}
        rowKey={(r) => String(r.id || r._id)}
        loading={loading}
        emptyTitle="No questions"
        emptyDescription={
          attachedSearch.trim()
            ? "No attached questions match your search."
            : "Click Add Problem to attach an existing AlgoPath problem."
        }
        columns={[
          {
            key: "title",
            header: "Title",
            render: (r) => (
              <span>
                {r.title}
                <br />
                <span className="admin-muted" style={{ fontSize: 11 }}>
                  {r.problemId}
                </span>
              </span>
            ),
          },
          { key: "diff", header: "Diff", render: (r) => r.difficulty },
          { key: "role", header: "Role", render: (r) => r.role || "—" },
          {
            key: "freq",
            header: "Frequency",
            render: (r) =>
              typeof r.frequency === "number" ? String(r.frequency) : "—",
          },
          {
            key: "seen",
            header: "Last seen",
            render: (r) =>
              r.lastSeenAt
                ? new Date(r.lastSeenAt).toLocaleDateString()
                : "—",
          },
          {
            key: "prem",
            header: "Access",
            render: (r) => (
              <StatusBadge status={r.isPremium ? "premium" : "free"} />
            ),
          },
          {
            key: "del",
            header: "",
            render: (r) =>
              canDelete ? (
                <button
                  type="button"
                  className="admin-btn"
                  aria-label={`Remove ${r.title}`}
                  onClick={() =>
                    void adminContentApi
                      .deleteCompanyQuestion(id, String(r.id || r._id))
                      .then(() => {
                        toast.success("Question removed");
                        return load();
                      })
                      .catch((err) => toast.apiError(err, "Delete failed"))
                  }
                >
                  <Trash2 size={14} />
                </button>
              ) : null,
          },
        ]}
      />

      <AddCompanyProblemDialog
        open={addOpen}
        companyId={id}
        companyName={company.name}
        companyRoles={company.roles || []}
        attachedProblemIds={attachedIds}
        onClose={() => setAddOpen(false)}
        onAttached={() => void load()}
      />
    </div>
  );
};
