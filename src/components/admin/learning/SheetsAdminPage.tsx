import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type FormEvent,
} from "react";
import {
  Archive,
  BookMarked,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { ConfirmDialog } from "../../ConfirmDialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { useToast } from "../../../context/ToastContext";
import { usePermission } from "../../../rbac/usePermission";
import {
  adminSheetApi,
  type AdminSheet,
  type AdminSheetAccess,
  type AdminSheetStatus,
  type SheetPreview,
} from "../../../api/adminSheetApi";
import { cn } from "../../../lib/cn";
import "../problems/problem-editor.css";

type StatusFilter = "all" | AdminSheetStatus;
type PanelMode = "closed" | "create" | "edit" | "preview";

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function errMsg(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

function normalizeList(data: unknown): AdminSheet[] {
  if (Array.isArray(data)) return data as AdminSheet[];
  if (data && typeof data === "object") {
    const obj = data as { items?: AdminSheet[]; sheets?: AdminSheet[] };
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.sheets)) return obj.sheets;
  }
  return [];
}

export const SheetsAdminPage: FC = () => {
  const { can } = usePermission();
  const toast = useToast();
  const canCreate = can("sheets:create");
  const canManage = can("sheets:manage");

  const [rows, setRows] = useState<AdminSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [includeArchived, setIncludeArchived] = useState(true);

  const [panel, setPanel] = useState<PanelMode>("closed");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSheet | null>(null);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});
  const [attachDrafts, setAttachDrafts] = useState<Record<string, string>>({});
  const [structureBusy, setStructureBusy] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formSheetId, setFormSheetId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOrder, setFormOrder] = useState("0");
  const [formAccess, setFormAccess] = useState<AdminSheetAccess>("FREE");
  const [sheetIdTouched, setSheetIdTouched] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminSheet | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminSheetApi.list({ includeArchived });
      setRows(normalizeList(res.data));
    } catch (err) {
      setError(errMsg(err, "Failed to load sheets"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.sheetId.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q)
        );
      });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => {
    const draft = rows.filter((r) => r.status === "DRAFT").length;
    const published = rows.filter((r) => r.status === "PUBLISHED").length;
    const archived = rows.filter((r) => r.status === "ARCHIVED").length;
    return { total: rows.length, draft, published, archived };
  }, [rows]);

  const closePanel = () => {
    setPanel("closed");
    setActiveId(null);
    setDetail(null);
    setPreview(null);
    setPanelLoading(false);
    setSaving(false);
  };

  const openCreate = () => {
    setPanel("create");
    setActiveId(null);
    setDetail(null);
    setPreview(null);
    setFormSheetId("");
    setFormTitle("");
    setFormDescription("");
    setFormOrder("0");
    setFormAccess("FREE");
    setSheetIdTouched(false);
  };

  const openEdit = async (sheetId: string) => {
    setPanel("edit");
    setActiveId(sheetId);
    setPreview(null);
    setPanelLoading(true);
    try {
      const res = await adminSheetApi.get(sheetId);
      const sheet = res.data;
      setDetail(sheet);
      setFormSheetId(sheet.sheetId);
      setFormTitle(sheet.title || "");
      setFormDescription(sheet.description || "");
      setFormOrder(String(sheet.order ?? 0));
      setFormAccess(sheet.access === "PREMIUM" ? "PREMIUM" : "FREE");
      setSheetIdTouched(true);
    } catch (err) {
      toast.error(errMsg(err, "Failed to load sheet"));
      closePanel();
    } finally {
      setPanelLoading(false);
    }
  };

  const openPreview = async (sheetId: string) => {
    setPanel("preview");
    setActiveId(sheetId);
    setDetail(null);
    setPanelLoading(true);
    try {
      const [prevRes, getRes] = await Promise.all([
        adminSheetApi.preview(sheetId),
        adminSheetApi.get(sheetId),
      ]);
      setPreview(prevRes.data);
      setDetail(getRes.data);
    } catch (err) {
      toast.error(errMsg(err, "Failed to preview sheet"));
      closePanel();
    } finally {
      setPanelLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    const sheetId = formSheetId.trim().toLowerCase();
    const title = formTitle.trim();
    if (!sheetId || !title) {
      toast.error("Sheet ID and title are required");
      return;
    }
    setSaving(true);
    try {
      await adminSheetApi.create({
        sheetId,
        title,
        description: formDescription.trim(),
        order: Number(formOrder) || 0,
        status: "DRAFT",
        access: formAccess,
      });
      toast.success("Sheet created");
      closePanel();
      await load();
    } catch (err) {
      toast.error(errMsg(err, "Create failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage || !activeId) return;
    setSaving(true);
    try {
      await adminSheetApi.update(activeId, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        order: Number(formOrder) || 0,
        access: formAccess,
      });
      toast.success("Sheet updated");
      closePanel();
      await load();
    } catch (err) {
      toast.error(errMsg(err, "Update failed"));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    sheetId: string,
    action: "publish" | "archive" | "sync",
    label: string
  ) => {
    if (!canManage) return;
    setBusyId(sheetId);
    try {
      if (action === "publish") await adminSheetApi.publish(sheetId);
      else if (action === "archive") await adminSheetApi.archive(sheetId);
      else await adminSheetApi.syncFromCatalog({ sheetId, publish: true });
      toast.success(label);
      await load();
      if (panel !== "closed" && activeId === sheetId) {
        if (panel === "preview") await openPreview(sheetId);
        else if (panel === "edit") await openEdit(sheetId);
      }
    } catch (err) {
      toast.error(errMsg(err, `${label} failed`));
    } finally {
      setBusyId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!canManage) return;
    setBusyId("__sync_all__");
    try {
      await adminSheetApi.syncFromCatalog({ publish: true });
      toast.success("Catalog synced");
      await load();
    } catch (err) {
      toast.error(errMsg(err, "Sync failed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!canManage || !deleteTarget) return;
    const sheetId = deleteTarget.sheetId;
    setBusyId(sheetId);
    try {
      await adminSheetApi.remove(sheetId);
      toast.success("Sheet deleted");
      setDeleteTarget(null);
      if (activeId === sheetId) closePanel();
      await load();
    } catch (err) {
      toast.error(errMsg(err, "Delete failed"));
    } finally {
      setBusyId(null);
    }
  };

  const refreshPreview = useCallback(async (sheetId: string) => {
    const res = await adminSheetApi.preview(sheetId);
    setPreview(res.data || null);
  }, []);

  const handleAddSection = async () => {
    if (!activeId || !newSectionTitle.trim() || !canManage) return;
    setStructureBusy(true);
    try {
      await adminSheetApi.createSection(activeId, {
        title: newSectionTitle.trim(),
      });
      setNewSectionTitle("");
      await refreshPreview(activeId);
      toast.success("Section added");
    } catch (err) {
      toast.error(errMsg(err, "Failed to add section"));
    } finally {
      setStructureBusy(false);
    }
  };

  const handleAddTopic = async (sectionId: string) => {
    if (!activeId || !canManage) return;
    const title = (topicDrafts[sectionId] || "").trim();
    if (!title) return;
    setStructureBusy(true);
    try {
      await adminSheetApi.createTopic(sectionId, { title });
      setTopicDrafts((prev) => ({ ...prev, [sectionId]: "" }));
      await refreshPreview(activeId);
      toast.success("Topic added");
    } catch (err) {
      toast.error(errMsg(err, "Failed to add topic"));
    } finally {
      setStructureBusy(false);
    }
  };

  const handleAttachProblem = async (topicId: string) => {
    if (!activeId || !canManage) return;
    const slug = (attachDrafts[topicId] || "").trim();
    if (!slug) return;
    setStructureBusy(true);
    try {
      await adminSheetApi.attachProblem(topicId, { slug });
      setAttachDrafts((prev) => ({ ...prev, [topicId]: "" }));
      await refreshPreview(activeId);
      toast.success("Problem attached");
    } catch (err) {
      toast.error(errMsg(err, "Failed to attach problem"));
    } finally {
      setStructureBusy(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!activeId || !canManage) return;
    setStructureBusy(true);
    try {
      await adminSheetApi.deleteSection(sectionId);
      await refreshPreview(activeId);
      toast.success("Section deleted");
    } catch (err) {
      toast.error(errMsg(err, "Failed to delete section"));
    } finally {
      setStructureBusy(false);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!activeId || !canManage) return;
    setStructureBusy(true);
    try {
      await adminSheetApi.deleteTopic(topicId);
      await refreshPreview(activeId);
      toast.success("Topic deleted");
    } catch (err) {
      toast.error(errMsg(err, "Failed to delete topic"));
    } finally {
      setStructureBusy(false);
    }
  };

  const handleRemoveProblem = async (topicId: string, problemId: string) => {
    if (!activeId || !canManage || !problemId) return;
    setStructureBusy(true);
    try {
      await adminSheetApi.removeProblem(topicId, problemId);
      await refreshPreview(activeId);
      toast.success("Problem removed");
    } catch (err) {
      toast.error(errMsg(err, "Failed to remove problem"));
    } finally {
      setStructureBusy(false);
    }
  };

  return (
    <PermissionGuard
      permission={["sheets:manage", "sheets:create", "problems:view"]}
      fallback={
        <div className="pe-page">
          <p className="admin-error">You do not have permission to manage learning sheets.</p>
        </div>
      }
    >
      <div className="pe-page mx-auto w-full gap-5">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <div>
              <h2 className="pe-title">Learning Sheets</h2>
              <p className="pe-sub">
                CMS for practice sheets — create, edit, publish, archive, preview, and sync
                from the curated catalog. Backend RBAC enforced on ProblemService.
              </p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
              Refresh
            </Button>
            {canManage ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleSyncAll()}
                disabled={busyId === "__sync_all__"}
              >
                {busyId === "__sync_all__" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Sync catalog
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" variant="primary" size="sm" onClick={openCreate}>
                <Plus size={14} />
                Create sheet
              </Button>
            ) : null}
          </div>
        </header>

        <div className="admin-stats-grid !mb-0">
          <div className="admin-stat-card">
            <div className="label">Total</div>
            <div className="value">{stats.total}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Published</div>
            <div className="value">{stats.published}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Draft</div>
            <div className="value">{stats.draft}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Archived</div>
            <div className="value">{stats.archived}</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
            <Search
              size={14}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sheet id or title…"
              aria-label="Search sheets"
              style={{ paddingLeft: 30 }}
            />
          </div>
          <select
            className="flex h-9 appearance-none rounded-lg border border-border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="all">All status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <label className="admin-muted" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Include archived
          </label>
        </div>

        {error ? (
          <p className="admin-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </p>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: panel === "closed" ? "1fr" : "minmax(0, 1fr) minmax(320px, 420px)",
            gap: 16,
            alignItems: "start",
          }}
        >
          <DataTable
            loading={loading}
            emptyTitle="No sheets yet"
            emptyDescription="Create a draft sheet or sync from the curated catalog (striver-a2z)."
            emptyIcon={<BookMarked size={18} strokeWidth={1.75} />}
            emptyAction={
              canManage || canCreate ? (
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  {canCreate ? (
                    <Button type="button" size="sm" onClick={openCreate}>
                      <Plus size={14} /> Create
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => void handleSyncAll()}>
                      Sync catalog
                    </Button>
                  ) : null}
                </div>
              ) : undefined
            }
            columns={[
              {
                key: "sheet",
                header: "Sheet",
                render: (r) => (
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-primary truncate text-sm font-semibold">{r.title}</span>
                    <span className="font-technical text-[0.7rem] text-muted-foreground">
                      {r.sheetId}
                    </span>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "access",
                header: "Access",
                render: (r) => (
                  <StatusBadge
                    status={r.access === "PREMIUM" ? "premium" : "free"}
                  />
                ),
              },
              {
                key: "problems",
                header: "Problems",
                technical: true,
                render: (r) => r.totalProblems ?? 0,
              },
              {
                key: "order",
                header: "Order",
                technical: true,
                render: (r) => r.order ?? 0,
              },
              {
                key: "actions",
                header: "Actions",
                render: (r) => {
                  const busy = busyId === r.sheetId;
                  return (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="admin-link"
                        disabled={busy}
                        onClick={() => void openPreview(r.sheetId)}
                        title="Preview"
                      >
                        <Eye size={14} />
                      </button>
                      {canManage ? (
                        <button
                          type="button"
                          className="admin-link"
                          disabled={busy}
                          onClick={() => void openEdit(r.sheetId)}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                      ) : null}
                      {canManage && r.status !== "PUBLISHED" ? (
                        <button
                          type="button"
                          className="admin-link"
                          disabled={busy}
                          onClick={() =>
                            void runAction(r.sheetId, "publish", "Sheet published")
                          }
                          title="Publish"
                        >
                          <Send size={14} />
                        </button>
                      ) : null}
                      {canManage && r.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          className="admin-link"
                          disabled={busy}
                          onClick={() =>
                            void runAction(r.sheetId, "archive", "Sheet archived")
                          }
                          title="Archive"
                        >
                          <Archive size={14} />
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          className="admin-link"
                          disabled={busy}
                          onClick={() => setDeleteTarget(r)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  );
                },
              },
            ]}
            rows={filtered}
            rowKey={(r) => r.sheetId}
          />

          {panel !== "closed" ? (
            <aside className="pe-card" style={{ position: "sticky", top: 12, padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1rem" }}>
                  {panel === "create"
                    ? "Create sheet"
                    : panel === "edit"
                      ? "Edit sheet"
                      : "Sheet preview"}
                </h3>
                <button type="button" className="admin-link" onClick={closePanel} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              {panelLoading ? (
                <div className="admin-muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Loader2 size={16} className="animate-spin" /> Loading…
                </div>
              ) : null}

              {(panel === "create" || panel === "edit") && !panelLoading ? (
                <form
                  onSubmit={panel === "create" ? handleCreate : handleUpdate}
                  className="pe-form"
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <label className="admin-field">
                    <span>Title</span>
                    <Input
                      value={formTitle}
                      required
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormTitle(v);
                        if (panel === "create" && !sheetIdTouched) {
                          setFormSheetId(slugify(v));
                        }
                      }}
                      placeholder="e.g. Striver A2Z DSA"
                    />
                  </label>
                  <label className="admin-field">
                    <span>Sheet ID (kebab-case)</span>
                    <Input
                      value={formSheetId}
                      required
                      disabled={panel === "edit"}
                      onChange={(e) => {
                        setSheetIdTouched(true);
                        setFormSheetId(e.target.value.toLowerCase());
                      }}
                      placeholder="striver-a2z"
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    />
                  </label>
                  <label className="admin-field">
                    <span>Description</span>
                    <textarea
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      rows={4}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Short description for learners"
                    />
                  </label>
                  <label className="admin-field">
                    <span>Order</span>
                    <Input
                      type="number"
                      min={0}
                      value={formOrder}
                      onChange={(e) => setFormOrder(e.target.value)}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Learner access</span>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={formAccess}
                      onChange={(e) =>
                        setFormAccess(
                          e.target.value === "PREMIUM" ? "PREMIUM" : "FREE"
                        )
                      }
                    >
                      <option value="FREE">FREE — linked problems free for all</option>
                      <option value="PREMIUM">PREMIUM — requires subscription</option>
                    </select>
                  </label>
                  {panel === "edit" && detail ? (
                    <p className="admin-muted" style={{ margin: 0, fontSize: 12 }}>
                      Status: <StatusBadge status={detail.status} /> · Access:{" "}
                      <StatusBadge
                        status={detail.access === "PREMIUM" ? "premium" : "free"}
                      />{" "}
                      · Problems: {detail.totalProblems ?? 0}
                    </p>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                      {panel === "create" ? "Create draft" : "Save changes"}
                    </Button>
                    {panel === "edit" && activeId && canManage ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === activeId}
                          onClick={() =>
                            void runAction(activeId, "publish", "Sheet published")
                          }
                        >
                          Publish
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === activeId}
                          onClick={() =>
                            void runAction(activeId, "archive", "Sheet archived")
                          }
                        >
                          Archive
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === activeId}
                          onClick={() =>
                            void runAction(activeId, "sync", "Sheet synced")
                          }
                        >
                          Sync this sheet
                        </Button>
                      </>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" onClick={closePanel}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}

              {panel === "preview" && !panelLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {detail ? (
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <strong>{detail.title}</strong>
                        <StatusBadge status={detail.status} />
                      </div>
                      <p className="admin-muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                        {detail.sheetId} · {detail.totalProblems ?? preview?.totalProblems ?? 0}{" "}
                        problems
                      </p>
                      {detail.description ? (
                        <p style={{ marginTop: 8, fontSize: 13 }}>{detail.description}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {canManage && activeId ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => void openEdit(activeId)}>
                        <Pencil size={14} /> Edit
                      </Button>
                    ) : null}
                  </div>
                  <div
                    style={{
                      maxHeight: 480,
                      overflow: "auto",
                      fontSize: 12,
                      border: "1px solid var(--border-subtle, #e5e7eb)",
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    {canManage && activeId ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginBottom: 12,
                          alignItems: "center",
                        }}
                      >
                        <Input
                          value={newSectionTitle}
                          onChange={(e) => setNewSectionTitle(e.target.value)}
                          placeholder="New section title"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={structureBusy || !newSectionTitle.trim()}
                          onClick={() => void handleAddSection()}
                        >
                          Add section
                        </Button>
                      </div>
                    ) : null}
                    {(preview?.sections || []).length === 0 ? (
                      <p className="admin-muted">
                        No sections yet. Sync from catalog or add a section above.
                      </p>
                    ) : (
                      (preview?.sections || []).map((sec) => (
                        <div key={sec.id || sec.title} style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <div className={cn("font-semibold")}>{sec.title}</div>
                            {canManage && sec.id ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={structureBusy}
                                onClick={() => void handleDeleteSection(sec.id!)}
                              >
                                Delete section
                              </Button>
                            ) : null}
                          </div>
                          {(sec.topics || []).map((topic) => (
                            <div
                              key={topic.id || topic.title}
                              style={{ marginLeft: 10, marginTop: 6 }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  alignItems: "center",
                                }}
                              >
                                <div className="admin-muted">
                                  {topic.title || topic.name} (
                                  {(topic.problems || []).length})
                                </div>
                                {canManage && topic.id ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={structureBusy}
                                    onClick={() => void handleDeleteTopic(topic.id!)}
                                  >
                                    Delete topic
                                  </Button>
                                ) : null}
                              </div>
                              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                                {(topic.problems || []).slice(0, 12).map((p) => (
                                  <li
                                    key={p.id || p.slug || p.title}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 8,
                                    }}
                                  >
                                    <span>
                                      {p.title || p.slug || "Problem"}
                                      {p.difficulty ? ` · ${p.difficulty}` : ""}
                                    </span>
                                    {canManage && topic.id && (p.problemId || p.id) ? (
                                      <button
                                        type="button"
                                        className="admin-muted"
                                        style={{
                                          border: 0,
                                          background: "none",
                                          cursor: "pointer",
                                          fontSize: 11,
                                        }}
                                        disabled={structureBusy}
                                        onClick={() =>
                                          void handleRemoveProblem(
                                            topic.id!,
                                            String(p.problemId || p.id)
                                          )
                                        }
                                      >
                                        remove
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                                {(topic.problems || []).length > 12 ? (
                                  <li className="admin-muted">
                                    +{(topic.problems || []).length - 12} more
                                  </li>
                                ) : null}
                              </ul>
                              {canManage && topic.id ? (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    marginTop: 6,
                                    alignItems: "center",
                                  }}
                                >
                                  <Input
                                    value={attachDrafts[topic.id] || ""}
                                    onChange={(e) =>
                                      setAttachDrafts((prev) => ({
                                        ...prev,
                                        [topic.id!]: e.target.value,
                                      }))
                                    }
                                    placeholder="Problem slug"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={
                                      structureBusy ||
                                      !(attachDrafts[topic.id] || "").trim()
                                    }
                                    onClick={() => void handleAttachProblem(topic.id!)}
                                  >
                                    Attach
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                          {canManage && sec.id ? (
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                marginTop: 8,
                                marginLeft: 10,
                                alignItems: "center",
                              }}
                            >
                              <Input
                                value={topicDrafts[sec.id] || ""}
                                onChange={(e) =>
                                  setTopicDrafts((prev) => ({
                                    ...prev,
                                    [sec.id!]: e.target.value,
                                  }))
                                }
                                placeholder="New topic title"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={
                                  structureBusy || !(topicDrafts[sec.id] || "").trim()
                                }
                                onClick={() => void handleAddTopic(sec.id!)}
                              >
                                Add topic
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Delete sheet?"
          description={
            deleteTarget
              ? `Permanently delete “${deleteTarget.title}” (${deleteTarget.sheetId}) including sections, topics, and problem links. This cannot be undone.`
              : ""
          }
          confirmLabel="Delete"
          confirmVariant="danger"
          confirming={busyId === deleteTarget?.sheetId}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
        />
      </div>
    </PermissionGuard>
  );
};
