import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type FormEvent,
} from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock,
  FilePenLine,
  Info,
  Loader2,
  Megaphone,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  TriangleAlert,
  Trophy,
  Wrench,
  X,
} from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { WidgetError } from "../shared/WidgetError";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ConfirmDialog } from "../../ConfirmDialog";
import {
  adminAnnouncementApi,
  announcementId,
  type AdminAnnouncement,
} from "../../../api/adminAnnouncementApi";
import { useToast } from "../../../context/ToastContext";
import { normalizeApiError } from "../../../lib/apiError";
import { usePermission } from "../../../rbac/usePermission";
import { cn } from "../../../lib/cn";
import "../problems/problem-editor.css";

const TYPES = [
  { id: "INFO", label: "Info", icon: Info },
  { id: "SUCCESS", label: "Success", icon: CheckCircle2 },
  { id: "WARNING", label: "Warning", icon: TriangleAlert },
  { id: "MAINTENANCE", label: "Maintenance", icon: Wrench },
  { id: "CONTEST", label: "Contest", icon: Trophy },
  { id: "PLATFORM_UPDATE", label: "Platform Update", icon: Megaphone },
] as const;

const AUDIENCES = [
  {
    id: "ALL_USERS",
    label: "All users",
    hint: "Available to all eligible AlgoPath users.",
  },
  {
    id: "ONLINE_USERS",
    label: "Online users",
    hint: "Delivered to currently connected users.",
  },
] as const;

/** Backend status enum — no Pending in AuthService model. */
const STATUS_FILTERS = [
  { value: "all", label: "All status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "EXPIRED", label: "Expired" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

function typeLabel(type?: string) {
  const found = TYPES.find((t) => t.id === type);
  return found?.label || String(type || "").replace(/_/g, " ") || "Unknown";
}

function audienceLabel(audience?: string) {
  const found = AUDIENCES.find((a) => a.id === audience);
  if (found) return found.label;
  return String(audience || "").replace(/_/g, " ") || "—";
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
    full: d.toLocaleString(),
  };
}

const DateCell: FC<{ iso?: string | null }> = ({ iso }) => {
  const formatted = formatDate(iso);
  if (!formatted) {
    return <span className="font-primary text-muted-foreground">—</span>;
  }
  return (
    <span className="block min-w-0" title={formatted.full}>
      <span className="font-primary block text-sm text-foreground">
        {formatted.date}
      </span>
      <span className="font-technical mt-0.5 block text-[0.7rem] text-muted-foreground tabular-nums">
        {formatted.time}
      </span>
    </span>
  );
};

export const AnnouncementTypeBadge: FC<{ type?: string; className?: string }> = ({
  type,
  className,
}) => {
  const meta = TYPES.find((t) => t.id === type);
  const Icon = meta?.icon || Info;
  return (
    <Badge
      variant="default"
      className={cn("max-w-full truncate", className)}
      title={typeLabel(type)}
    >
      <Icon size={12} strokeWidth={2} className="size-3 shrink-0" aria-hidden />
      <span>{typeLabel(type)}</span>
    </Badge>
  );
};

const AnnouncementActions: FC<{
  row: AdminAnnouncement;
  canPublish: boolean;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onExpire: () => void;
  onArchive: () => void;
  onSchedule: () => void;
}> = ({
  row,
  canPublish,
  canEdit,
  busy,
  onEdit,
  onPublish,
  onExpire,
  onArchive,
  onSchedule,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canPublish && !canEdit) return null;

  const items = [
    {
      key: "edit",
      label: "Edit",
      icon: FilePenLine,
      onClick: onEdit,
      show: canEdit,
    },
    {
      key: "publish",
      label: "Publish",
      icon: Send,
      onClick: onPublish,
      show:
        canPublish &&
        (row.status === "DRAFT" || row.status === "SCHEDULED"),
    },
    {
      key: "schedule",
      label: "Schedule",
      icon: Clock,
      onClick: onSchedule,
      show: canPublish && row.status === "DRAFT",
    },
    {
      key: "expire",
      label: "Expire",
      icon: Clock,
      onClick: onExpire,
      show:
        canPublish &&
        (row.status === "PUBLISHED" || row.status === "SCHEDULED"),
    },
    {
      key: "archive",
      label: "Archive",
      icon: Archive,
      onClick: onArchive,
      show: canPublish && row.status !== "ARCHIVED",
    },
  ];

  return (
    <div className="relative flex justify-end" ref={rootRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={busy}
        aria-label={`Actions for ${row.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal
          size={16}
          strokeWidth={1.75}
          className="size-4"
          aria-hidden
        />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-md"
        >
          {items
            .filter((i) => i.show)
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  className="font-primary flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  <Icon
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                  {item.label}
                </button>
              );
            })}
        </div>
      ) : null}
    </div>
  );
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export const AnnouncementsAdminPage: FC = () => {
  const toast = useToast();
  const { can } = usePermission();
  const canCreate = can("announcements:create");
  const canPublish = can("announcements:publish");

  const [rows, setRows] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<string>("INFO");
  const [audience, setAudience] = useState("ALL_USERS");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] =
    useState<AdminAnnouncement | null>(null);
  const [confirmSchedule, setConfirmSchedule] =
    useState<AdminAnnouncement | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (manual = false) => {
      try {
        if (manual) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const res = await adminAnnouncementApi.list({
          page: 1,
          limit: 50,
          search: debouncedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          type: typeFilter === "all" ? undefined : typeFilter,
        });
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (err: unknown) {
        const n = normalizeApiError(err);
        setError({ title: n.title, message: n.message });
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, statusFilter, typeFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let draft = 0;
    let scheduled = 0;
    let published = 0;
    for (const r of rows) {
      if (r.status === "DRAFT") draft += 1;
      else if (r.status === "SCHEDULED") scheduled += 1;
      else if (r.status === "PUBLISHED") published += 1;
    }
    return { total: rows.length, draft, scheduled, published };
  }, [rows]);

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    statusFilter !== "all" ||
    typeFilter !== "all";

  const validate = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required.";
    else if (title.trim().length > 200) {
      next.title = "Title must be at most 200 characters.";
    }
    if (!message.trim()) next.message = "Message is required.";
    else if (message.trim().length > 5000) {
      next.message = "Message must be at most 5000 characters.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setType("INFO");
    setAudience("ALL_USERS");
    setFieldErrors({});
    setEditingId(null);
  };

  const startEdit = (row: AdminAnnouncement) => {
    setEditingId(announcementId(row));
    setTitle(row.title);
    setMessage(row.message);
    setType(row.type || "INFO");
    setAudience(row.audience || "ALL_USERS");
    setFieldErrors({});
  };

  const create = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!validate() || saving) return;
    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        audience,
      };
      if (editingId) {
        await adminAnnouncementApi.update(editingId, payload);
        toast.success("Announcement updated.");
      } else {
        await adminAnnouncementApi.create({
          ...payload,
          status: "DRAFT",
        });
        toast.success("Announcement saved as draft.");
      }
      resetForm();
      await load(true);
    } catch (err: unknown) {
      toast.apiError(err, "Unable to save announcement. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    id: string,
    action: "publish" | "expire" | "archive",
    label: string,
  ) => {
    try {
      setActionId(id);
      if (action === "publish") await adminAnnouncementApi.publish(id);
      else if (action === "expire") await adminAnnouncementApi.expire(id);
      else await adminAnnouncementApi.archive(id);
      toast.success(label);
      await load(true);
    } catch (err: unknown) {
      toast.apiError(err, `Failed to ${action}`);
    } finally {
      setActionId(null);
    }
  };

  const selectWrap =
    "relative inline-flex w-full min-w-0 sm:w-auto sm:flex-none";
  const selectClass = cn(
    "peer flex h-9 w-full appearance-none rounded-lg border border-border bg-background py-0 pr-9 pl-3",
    "font-primary text-sm text-foreground",
    "transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  const TypeIcon = TYPES.find((t) => t.id === type)?.icon || Info;
  const audienceMeta = AUDIENCES.find((a) => a.id === audience);

  return (
    <PermissionGuard permission="announcements:view">
      <div className="pe-page mx-auto w-full gap-5">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <span
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
              aria-hidden
            >
              <Megaphone size={16} strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="pe-title">Announcements</h2>
              <p className="pe-sub">
                Draft, schedule, and publish platform-wide messages to AlgoPath
                users.
              </p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => void load(true)}
              aria-label={refreshing ? "Refreshing" : "Refresh announcements"}
            >
              {refreshing ? (
                <Loader2
                  size={14}
                  strokeWidth={1.75}
                  className="size-3.5 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <RefreshCw
                  size={14}
                  strokeWidth={1.75}
                  className="size-3.5 shrink-0"
                  aria-hidden
                />
              )}
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </header>

        <div className="admin-stats-grid !mb-0">
          <div className="admin-stat-card">
            <div className="label">Total</div>
            <div className="value">{stats.total}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Draft</div>
            <div className="value">{stats.draft}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Scheduled</div>
            <div className="value">{stats.scheduled}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Published</div>
            <div className="value">{stats.published}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          {canCreate ? (
            <section className="pe-card !p-5">
              <div className="pe-card-head">
                <h3>
                  <Megaphone size={15} strokeWidth={1.75} aria-hidden />
                  {editingId ? "Edit announcement" : "New announcement"}
                </h3>
                <p>
                  {editingId
                    ? "Update fields and save changes."
                    : "Saved as draft until you publish."}
                </p>
              </div>

              <form
                onSubmit={(e) => void create(e)}
                className="flex flex-col gap-4"
                noValidate
              >
                <div
                  className={cn(
                    "admin-field",
                    fieldErrors.title && "has-error",
                  )}
                >
                  <label htmlFor="ann-title">Title</label>
                  <Input
                    id="ann-title"
                    value={title}
                    maxLength={200}
                    placeholder="Enter announcement title…"
                    error={Boolean(fieldErrors.title)}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-background"
                  />
                  {fieldErrors.title ? (
                    <span className="pe-field-hint text-danger">
                      {fieldErrors.title}
                    </span>
                  ) : (
                    <span className="pe-field-hint">{title.length}/200</span>
                  )}
                </div>

                <div
                  className={cn(
                    "admin-field",
                    fieldErrors.message && "has-error",
                  )}
                >
                  <label htmlFor="ann-message">Message</label>
                  <textarea
                    id="ann-message"
                    value={message}
                    maxLength={5000}
                    placeholder="Write your announcement message…"
                    rows={6}
                    onChange={(e) => setMessage(e.target.value)}
                    className="font-primary min-h-[140px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  {fieldErrors.message ? (
                    <span className="pe-field-hint text-danger">
                      {fieldErrors.message}
                    </span>
                  ) : (
                    <span className="pe-field-hint">{message.length}/5000</span>
                  )}
                </div>

                <fieldset className="m-0 border-0 p-0">
                  <legend className="font-primary mb-2 text-sm font-medium text-foreground">
                    Type
                  </legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Announcement type">
                    {TYPES.map((t) => {
                      const Icon = t.icon;
                      const selected = type === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={cn(
                            "font-primary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            selected
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                          onClick={() => setType(t.id)}
                        >
                          <Icon
                            size={13}
                            strokeWidth={1.75}
                            className="size-3.5 shrink-0"
                            aria-hidden
                          />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="m-0 border-0 p-0">
                  <legend className="font-primary mb-2 text-sm font-medium text-foreground">
                    Audience
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Audience">
                    {AUDIENCES.map((a) => {
                      const selected = audience === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            selected
                              ? "border-primary/40 bg-primary/10"
                              : "border-border bg-background hover:bg-muted",
                          )}
                          onClick={() => setAudience(a.id)}
                        >
                          <span className="font-primary block text-sm font-semibold text-foreground">
                            {a.label}
                          </span>
                          <span className="font-primary mt-1 block text-xs text-muted-foreground">
                            {a.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                  {editingId ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={resetForm}
                    >
                      Cancel edit
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2
                        size={14}
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <FilePenLine
                        size={14}
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0"
                        aria-hidden
                      />
                    )}
                    {saving
                      ? "Saving…"
                      : editingId
                        ? "Save changes"
                        : "Save draft"}
                  </Button>
                </div>
              </form>
            </section>
          ) : (
            <section className="pe-card !p-5">
              <p className="font-primary m-0 text-sm text-muted-foreground">
                You do not have permission to create announcements.
              </p>
            </section>
          )}

          <aside className="pe-card !p-5 h-fit">
            <div className="pe-card-head">
              <h3>Preview</h3>
              <p>Updates as you type.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                  <TypeIcon size={14} strokeWidth={1.75} aria-hidden />
                </span>
                <AnnouncementTypeBadge type={type} />
              </div>
              <p className="font-primary m-0 text-sm font-semibold text-foreground">
                {title.trim() || "Announcement title"}
              </p>
              <p className="font-primary mt-2 mb-0 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {message.trim() || "Your message will appear here."}
              </p>
              <p className="font-primary mt-4 mb-0 text-xs text-muted-foreground">
                {audienceMeta?.label || "Audience"} · Draft
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-border p-3">
              <p className="font-primary m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Delivery
              </p>
              <p className="font-primary mt-1 mb-0 text-sm text-foreground">
                {audienceMeta?.hint}
              </p>
            </div>
          </aside>
        </div>

        <section className="pe-card !p-0 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="pe-card-head mb-4">
              <h3>Recent announcements</h3>
              <p>
                {loading
                  ? "Loading…"
                  : `${rows.length} announcement${rows.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
              role="search"
              aria-label="Announcement filters"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  size={15}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search announcements…"
                  aria-label="Search announcements"
                  className="bg-background pr-9 pl-9"
                />
                {search ? (
                  <button
                    type="button"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X size={14} strokeWidth={1.75} aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className={cn(selectWrap, "lg:w-[150px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div className={cn(selectWrap, "lg:w-[170px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  aria-label="Filter by type"
                >
                  <option value="all">All types</option>
                  {TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="p-4">
              <WidgetError
                title={error.title || "Unable to load announcements"}
                message={error.message}
                onRetry={() => void load(true)}
                compact
              />
            </div>
          ) : (
            <div className="p-0 [&_.admin-table-wrap]:max-h-[min(70vh,640px)] [&_.admin-table-wrap]:rounded-none [&_.admin-table-wrap]:border-0 [&_.admin-table-wrap]:shadow-none">
              <DataTable
                loading={loading}
                minWidth="880px"
                rows={rows}
                rowKey={(r) => announcementId(r)}
                emptyTitle={
                  hasActiveFilters
                    ? "No matching announcements"
                    : "No announcements yet"
                }
                emptyDescription={
                  hasActiveFilters
                    ? "Try changing your search or filters."
                    : "Create your first announcement to communicate important updates to AlgoPath users."
                }
                emptyIcon={
                  <Megaphone size={18} strokeWidth={1.75} aria-hidden />
                }
                emptyAction={
                  hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setDebouncedSearch("");
                        setStatusFilter("all");
                        setTypeFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
                columns={[
                  {
                    key: "title",
                    header: "Title",
                    width: "260px",
                    skeletonWidth: "11rem",
                    render: (r) => (
                      <div className="flex min-w-0 max-w-[260px] flex-col gap-0.5">
                        <span
                          className="font-primary truncate text-sm font-semibold text-foreground"
                          title={r.title}
                        >
                          {r.title}
                        </span>
                        <span
                          className="font-primary line-clamp-2 text-[0.75rem] text-muted-foreground"
                          title={r.message}
                        >
                          {r.message}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "type",
                    header: "Type",
                    width: "140px",
                    skeletonWidth: "5rem",
                    render: (r) => <AnnouncementTypeBadge type={r.type} />,
                  },
                  {
                    key: "audience",
                    header: "Audience",
                    width: "110px",
                    skeletonWidth: "4rem",
                    render: (r) => (
                      <span className="font-primary text-sm text-muted-foreground">
                        {audienceLabel(r.audience)}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "120px",
                    skeletonWidth: "4.5rem",
                    render: (r) => <StatusBadge status={r.status || "unknown"} />,
                  },
                  {
                    key: "created",
                    header: "Created",
                    width: "120px",
                    skeletonWidth: "5rem",
                    render: (r) => <DateCell iso={r.createdAt} />,
                  },
                  {
                    key: "published",
                    header: "Published",
                    width: "120px",
                    skeletonWidth: "5rem",
                    render: (r) => <DateCell iso={r.publishedAt} />,
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    width: "64px",
                    align: "right",
                    skeletonWidth: "2rem",
                    render: (r) => (
                      <AnnouncementActions
                        row={r}
                        canPublish={canPublish}
                        canEdit={canCreate}
                        busy={actionId === announcementId(r)}
                        onEdit={() => startEdit(r)}
                        onPublish={() => setConfirmPublish(r)}
                        onExpire={() =>
                          void runAction(
                            announcementId(r),
                            "expire",
                            "Announcement expired."
                          )
                        }
                        onArchive={() =>
                          void runAction(
                            announcementId(r),
                            "archive",
                            "Announcement archived."
                          )
                        }
                        onSchedule={() => {
                          const start = new Date(Date.now() + 60 * 60 * 1000);
                          setScheduleAt(toLocalInput(start));
                          setConfirmSchedule(r);
                        }}
                      />
                    ),
                  },
                ]}
              />
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmPublish)}
        title="Publish announcement?"
        description={
          <>
            This message will be sent to{" "}
            <strong className="text-foreground">
              {audienceLabel(confirmPublish?.audience)}
            </strong>
            :{" "}
            <strong className="text-foreground">
              {confirmPublish?.title || "Untitled"}
            </strong>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Publish"
        confirmVariant="primary"
        confirming={confirming}
        confirmingLabel="Publishing…"
        onCancel={() => {
          if (!confirming) setConfirmPublish(null);
        }}
        onConfirm={async () => {
          if (!confirmPublish) return;
          try {
            setConfirming(true);
            await runAction(
              announcementId(confirmPublish),
              "publish",
              "Announcement published successfully.",
            );
            setConfirmPublish(null);
          } finally {
            setConfirming(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmSchedule)}
        title="Schedule announcement?"
        description={
          <div className="flex flex-col gap-3">
            <p className="m-0">
              Schedule{" "}
              <strong className="text-foreground">
                {confirmSchedule?.title || "this announcement"}
              </strong>
              .
            </p>
            <div className="admin-field mb-0">
              <label htmlFor="ann-schedule-at">Publish at</label>
              <Input
                id="ann-schedule-at"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
        }
        cancelLabel="Cancel"
        confirmLabel="Schedule"
        confirmVariant="primary"
        confirming={confirming}
        confirmingLabel="Scheduling…"
        onCancel={() => {
          if (!confirming) setConfirmSchedule(null);
        }}
        onConfirm={async () => {
          if (!confirmSchedule || !scheduleAt) {
            toast.warning("Choose a valid schedule time.");
            return;
          }
          const when = new Date(scheduleAt);
          if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
            toast.warning("Schedule time must be in the future.");
            return;
          }
          try {
            setConfirming(true);
            const id = announcementId(confirmSchedule);
            setActionId(id);
            await adminAnnouncementApi.schedule(
              id,
              when.toISOString(),
            );
            toast.success("Announcement scheduled.");
            setConfirmSchedule(null);
            await load(true);
          } catch (err: unknown) {
            toast.apiError(err, "Unable to schedule announcement.");
          } finally {
            setConfirming(false);
            setActionId(null);
          }
        }}
      />
    </PermissionGuard>
  );
};
