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
  CalendarClock,
  ChevronDown,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import {
  adminContestApi,
  type AdminContest,
  type ContestStatus,
} from "../../../api/adminContestApi";
import { hasPermission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { ConfirmDialog } from "../../ConfirmDialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { cn } from "../../../lib/cn";
import "../problems/problem-editor.css";

interface Props {
  onOpen: (id: string) => void;
}

type StatusFilter = "all" | ContestStatus;
type SortKey = "start-desc" | "start-asc" | "title-asc" | "status";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "LIVE", label: "Live" },
  { value: "ENDED", label: "Ended" },
  { value: "ARCHIVED", label: "Archived" },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "start-desc", label: "Start · newest" },
  { value: "start-asc", label: "Start · oldest" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "status", label: "Status" },
];

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function formatContestDate(iso?: string) {
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

function DateCell({ iso }: { iso?: string }) {
  const formatted = formatContestDate(iso);
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
}

const ContestCell: FC<{ contest: AdminContest; onOpen: () => void }> = ({
  contest,
  onOpen,
}) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex min-w-0 max-w-[260px] flex-col items-start gap-0.5 rounded-md text-left transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  >
    <span className="font-primary truncate text-sm font-semibold text-foreground">
      {contest.title || "Untitled contest"}
    </span>
    <span
      className="font-code block max-w-full truncate text-[0.7rem] text-muted-foreground"
      title={contest.slug}
    >
      {contest.slug || "—"}
    </span>
  </button>
);

const ContestActions: FC<{
  contest: AdminContest;
  canManage: boolean;
  busy: boolean;
  onView: () => void;
  onSchedule: () => void;
  onStart: () => void;
  onEnd: () => void;
  onArchive: () => void;
  onDelete: () => void;
}> = ({
  contest,
  canManage,
  busy,
  onView,
  onSchedule,
  onStart,
  onEnd,
  onArchive,
  onDelete,
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

  const status = contest.status;
  const items: Array<{
    key: string;
    label: string;
    icon: typeof Eye;
    onClick: () => void;
    danger?: boolean;
    show: boolean;
  }> = [
    {
      key: "view",
      label: "View",
      icon: Eye,
      onClick: onView,
      show: true,
    },
    {
      key: "schedule",
      label: "Schedule",
      icon: CalendarClock,
      onClick: onSchedule,
      show: canManage && (status === "DRAFT" || status === "SCHEDULED"),
    },
    {
      key: "start",
      label: "Start",
      icon: Play,
      onClick: onStart,
      show: canManage && (status === "SCHEDULED" || status === "DRAFT"),
    },
    {
      key: "end",
      label: "End",
      icon: Square,
      onClick: onEnd,
      show: canManage && status === "LIVE",
    },
    {
      key: "archive",
      label: "Archive",
      icon: Archive,
      onClick: onArchive,
      show: canManage && status !== "ARCHIVED",
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: onDelete,
      danger: true,
      show: canManage,
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
        aria-label={`Actions for ${contest.title || "contest"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden className="size-4" />
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
                  className={cn(
                    "font-primary flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    "disabled:pointer-events-none disabled:opacity-50",
                    item.danger
                      ? "text-danger"
                      : "text-foreground",
                  )}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  <Icon size={14} strokeWidth={1.75} className="size-3.5 shrink-0" aria-hidden />
                  {item.label}
                </button>
              );
            })}
        </div>
      ) : null}
    </div>
  );
};

export const ContestListPage: FC<Props> = ({ onOpen }) => {
  const { user } = useAuth();
  const toast = useToast();
  const canCreate = hasPermission(user?.role, "contests:create");
  const canManage = hasPermission(user?.role, "contests:manage");

  const [rows, setRows] = useState<AdminContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("start-desc");

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<AdminContest | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<AdminContest | null>(null);
  const [confirming, setConfirming] = useState(false);

  const createFormRef = useRef<HTMLElement>(null);

  const load = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setError("");
      const res = await adminContestApi.list(true);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Unable to load contests");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showCreate || startTime) return;
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    setStartTime(toLocalInput(start.toISOString()));
    setEndTime(toLocalInput(end.toISOString()));
  }, [showCreate, startTime]);

  const stats = useMemo(() => {
    const total = rows.length;
    let draft = 0;
    let scheduled = 0;
    let live = 0;
    let ended = 0;
    let archived = 0;
    for (const c of rows) {
      if (c.status === "DRAFT") draft += 1;
      else if (c.status === "SCHEDULED") scheduled += 1;
      else if (c.status === "LIVE") live += 1;
      else if (c.status === "ENDED") ended += 1;
      else if (c.status === "ARCHIVED") archived += 1;
    }
    return { total, draft, scheduled, live, ended, archived };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.title?.toLowerCase().includes(q) ||
        c.slug?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === "title-asc") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sort === "status") {
        return (a.status || "").localeCompare(b.status || "");
      }
      const at = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
      return sort === "start-asc" ? at - bt : bt - at;
    });

    return list;
  }, [rows, search, statusFilter, sort]);

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setStartTime("");
    setEndTime("");
    setDurationMinutes(120);
    setFieldErrors({});
    setFormError("");
  };

  const openCreate = () => {
    setShowCreate(true);
    requestAnimationFrame(() => {
      createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const closeCreate = () => {
    if (saving) return;
    setShowCreate(false);
    resetForm();
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required.";
    const finalSlug = (slug || slugify(title)).trim();
    if (!finalSlug) next.slug = "Slug is required.";
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finalSlug)) {
      next.slug = "Use lowercase letters, numbers, and hyphens only.";
    }
    if (!startTime) next.startTime = "Start time is required.";
    if (!endTime) next.endTime = "End time is required.";
    if (startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
        next.endTime = "End time must be after the start time.";
      }
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      next.durationMinutes = "Duration must be at least 1 minute.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm() || saving) return;
    try {
      setSaving(true);
      setFormError("");
      const res = await adminContestApi.create({
        title: title.trim(),
        slug: (slug || slugify(title)).trim(),
        description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        durationMinutes,
        status: "DRAFT" as ContestStatus,
      });
      const id = adminContestApi.id(res.data);
      toast.success("Contest draft created successfully");
      setShowCreate(false);
      resetForm();
      await load();
      if (id) onOpen(id);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err.message ||
        "Unable to create contest";
      setFormError(message);
      toast.error("Unable to create contest", "Please check the form and try again.");
    } finally {
      setSaving(false);
    }
  };

  const runLifecycle = async (
    contest: AdminContest,
    label: string,
    fn: (id: string) => Promise<unknown>,
  ) => {
    const id = adminContestApi.id(contest);
    if (!id) return;
    try {
      setActionBusyId(id);
      await fn(id);
      toast.success(`${label} succeeded`);
      await load(true);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err.message || `Unable to ${label.toLowerCase()}`,
      );
    } finally {
      setActionBusyId(null);
    }
  };

  const selectWrap =
    "relative inline-flex w-full min-w-0 sm:w-auto sm:flex-none";
  const selectClass = cn(
    "peer flex h-9 w-full appearance-none rounded-lg border border-border bg-background py-0 pr-9 pl-3",
    "font-primary text-sm text-foreground",
    "transition-colors duration-200",
    "hover:border-border",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  return (
    <PermissionGuard
      permission={["contests:manage", "contests:create"]}
      fallback={<div className="admin-denied">No contest permission.</div>}
    >
      <div className="pe-page mx-auto w-full gap-5">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <div>
              <h2 className="pe-title">Contests</h2>
              <p className="pe-sub">
                Create, schedule, and run contests. Lifecycle actions are
                audited.
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
              aria-label={refreshing ? "Refreshing contests" : "Refresh contests"}
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
            {canCreate ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => (showCreate ? closeCreate() : openCreate())}
              >
                {showCreate ? (
                  <>
                    <X size={14} strokeWidth={1.75} className="size-3.5 shrink-0" aria-hidden />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus size={14} strokeWidth={1.75} className="size-3.5 shrink-0" aria-hidden />
                    Create contest
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </header>

        {error ? <p className="admin-error mb-0">{error}</p> : null}

        <div className="admin-stats-grid !mb-0">
          <div className="admin-stat-card">
            <div className="label">Total contests</div>
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
            <div className="label">Live</div>
            <div className="value">{stats.live}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Ended</div>
            <div className="value">{stats.ended}</div>
          </div>
        </div>

        <section className="pe-card !p-0 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="pe-card-head !mb-4">
              <h3>Contests</h3>
              <p>
                {loading
                  ? "Loading contests…"
                  : `${filteredRows.length} of ${rows.length} contest${
                      rows.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>
            <div
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
              role="search"
              aria-label="Contest filters"
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
                  placeholder="Search contests…"
                  aria-label="Search contests"
                  className="bg-background pl-9"
                />
              </div>
              <div className={cn(selectWrap, "lg:w-[160px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  aria-label="Filter by status"
                >
                  {STATUS_FILTERS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
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
              <div className={cn(selectWrap, "lg:w-[168px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort contests"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
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

          <div className="p-0 [&_.admin-table-wrap]:max-h-[min(70vh,720px)] [&_.admin-table-wrap]:rounded-none [&_.admin-table-wrap]:border-0 [&_.admin-table-wrap]:shadow-none">
            <DataTable
              loading={loading}
              minWidth="760px"
              rowKey={(c) => adminContestApi.id(c)}
              rows={filteredRows}
              emptyTitle="No contests yet"
              emptyDescription="Create your first contest to get started."
              emptyIcon={<Trophy size={18} strokeWidth={1.75} aria-hidden />}
              emptyAction={
                canCreate && !showCreate ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={openCreate}
                  >
                    <Plus
                      size={14}
                      strokeWidth={1.75}
                      className="size-3.5 shrink-0"
                      aria-hidden
                    />
                    Create contest
                  </Button>
                ) : undefined
              }
              columns={[
                {
                  key: "contest",
                  header: "Contest",
                  width: "240px",
                  skeletonWidth: "11rem",
                  render: (c) => (
                    <ContestCell
                      contest={c}
                      onOpen={() => onOpen(adminContestApi.id(c))}
                    />
                  ),
                },
                {
                  key: "start",
                  header: "Start",
                  width: "120px",
                  skeletonWidth: "5rem",
                  render: (c) => <DateCell iso={c.startTime} />,
                },
                {
                  key: "end",
                  header: "End",
                  width: "120px",
                  skeletonWidth: "5rem",
                  render: (c) => <DateCell iso={c.endTime} />,
                },
                {
                  key: "duration",
                  header: "Duration",
                  width: "96px",
                  technical: true,
                  skeletonWidth: "3.5rem",
                  render: (c) => (
                    <span className="font-technical text-sm tabular-nums text-foreground">
                      {c.durationMinutes != null
                        ? `${Number(c.durationMinutes).toLocaleString()} min`
                        : "—"}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "120px",
                  skeletonWidth: "4.5rem",
                  render: (c) => <StatusBadge status={c.status} />,
                },
                {
                  key: "actions",
                  header: "Actions",
                  width: "64px",
                  align: "right",
                  skeletonWidth: "2rem",
                  render: (c) => (
                    <ContestActions
                      contest={c}
                      canManage={canManage}
                      busy={actionBusyId === adminContestApi.id(c)}
                      onView={() => onOpen(adminContestApi.id(c))}
                      onSchedule={() =>
                        void runLifecycle(c, "Schedule", adminContestApi.schedule)
                      }
                      onStart={() =>
                        void runLifecycle(c, "Start", adminContestApi.start)
                      }
                      onEnd={() =>
                        void runLifecycle(c, "End", adminContestApi.end)
                      }
                      onArchive={() => setConfirmArchive(c)}
                      onDelete={() => setConfirmDelete(c)}
                    />
                  ),
                },
              ]}
            />
          </div>
        </section>

        {showCreate && canCreate ? (
          <section ref={createFormRef} className="pe-card !p-5">
            <div className="pe-card-head">
              <h3>
                <FileText size={15} strokeWidth={1.75} aria-hidden />
                Create contest
              </h3>
              <p>Save a draft, then schedule and start it when ready.</p>
            </div>

            {formError ? (
              <p className="admin-error" role="alert">
                {formError}
              </p>
            ) : null}

            <form onSubmit={create} className="flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 md:grid-cols-2">
                <div className={cn("admin-field md:col-span-2", fieldErrors.title && "has-error")}>
                  <label htmlFor="ct-title">Title</label>
                  <Input
                    id="ct-title"
                    required
                    value={title}
                    placeholder="Enter contest title"
                    error={Boolean(fieldErrors.title)}
                    aria-invalid={Boolean(fieldErrors.title)}
                    aria-describedby={
                      fieldErrors.title ? "ct-title-err" : undefined
                    }
                    onChange={(e) => {
                      const next = e.target.value;
                      setTitle(next);
                      if (!slugTouched) setSlug(slugify(next));
                      if (fieldErrors.title) {
                        setFieldErrors((prev) => {
                          const { title: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className="bg-background"
                  />
                  {fieldErrors.title ? (
                    <span id="ct-title-err" className="pe-field-hint text-danger">
                      {fieldErrors.title}
                    </span>
                  ) : null}
                </div>

                <div className={cn("admin-field md:col-span-2", fieldErrors.slug && "has-error")}>
                  <label htmlFor="ct-slug">Slug</label>
                  <Input
                    id="ct-slug"
                    required
                    value={slug}
                    placeholder="weekly-dsa-challenge"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    error={Boolean(fieldErrors.slug)}
                    aria-invalid={Boolean(fieldErrors.slug)}
                    aria-describedby="ct-slug-hint"
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                      if (fieldErrors.slug) {
                        setFieldErrors((prev) => {
                          const { slug: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className="bg-background font-code"
                  />
                  <span id="ct-slug-hint" className="pe-field-hint">
                    {fieldErrors.slug ||
                      "Used in the contest URL and identifier."}
                  </span>
                </div>

                <div className="admin-field pe-editor-field md:col-span-2">
                  <label htmlFor="ct-desc">Description</label>
                  <textarea
                    id="ct-desc"
                    value={description}
                    placeholder="Describe the contest…"
                    rows={4}
                    onChange={(e) => setDescription(e.target.value)}
                    className="font-primary min-h-[96px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>

                <div className={cn("admin-field", fieldErrors.startTime && "has-error")}>
                  <label htmlFor="ct-start">Start</label>
                  <Input
                    id="ct-start"
                    type="datetime-local"
                    required
                    value={startTime}
                    error={Boolean(fieldErrors.startTime)}
                    aria-invalid={Boolean(fieldErrors.startTime)}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      if (fieldErrors.startTime) {
                        setFieldErrors((prev) => {
                          const { startTime: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className="bg-background"
                  />
                  {fieldErrors.startTime ? (
                    <span className="pe-field-hint text-danger">
                      {fieldErrors.startTime}
                    </span>
                  ) : null}
                </div>

                <div className={cn("admin-field", fieldErrors.endTime && "has-error")}>
                  <label htmlFor="ct-end">End</label>
                  <Input
                    id="ct-end"
                    type="datetime-local"
                    required
                    value={endTime}
                    error={Boolean(fieldErrors.endTime)}
                    aria-invalid={Boolean(fieldErrors.endTime)}
                    aria-describedby={
                      fieldErrors.endTime ? "ct-end-err" : undefined
                    }
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      if (fieldErrors.endTime) {
                        setFieldErrors((prev) => {
                          const { endTime: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className="bg-background"
                  />
                  {fieldErrors.endTime ? (
                    <span id="ct-end-err" className="pe-field-hint text-danger">
                      {fieldErrors.endTime}
                    </span>
                  ) : null}
                </div>

                <div className={cn("admin-field", fieldErrors.durationMinutes && "has-error")}>
                  <label htmlFor="ct-dur">Duration (minutes)</label>
                  <Input
                    id="ct-dur"
                    type="number"
                    min={1}
                    value={durationMinutes}
                    error={Boolean(fieldErrors.durationMinutes)}
                    aria-invalid={Boolean(fieldErrors.durationMinutes)}
                    aria-describedby="ct-dur-hint"
                    onChange={(e) =>
                      setDurationMinutes(Number(e.target.value) || 0)
                    }
                    className="bg-background font-technical max-w-[180px]"
                  />
                  <span id="ct-dur-hint" className="pe-field-hint">
                    {fieldErrors.durationMinutes ||
                      "Contest duration in minutes."}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={closeCreate}
                >
                  Cancel
                </Button>
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
                    <Plus
                      size={14}
                      strokeWidth={1.75}
                      className="size-3.5 shrink-0"
                      aria-hidden
                    />
                  )}
                  {saving ? "Creating…" : "Create draft"}
                </Button>
              </div>
            </form>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(confirmArchive)}
        title="Archive contest?"
        description={
          <>
            Archive{" "}
            <strong className="text-foreground">
              {confirmArchive?.title || "this contest"}
            </strong>
            ? Archived contests cannot be modified further.
          </>
        }
        cancelLabel="Keep"
        confirmLabel="Archive"
        confirmVariant="danger"
        confirming={confirming}
        confirmingLabel="Archiving…"
        onCancel={() => {
          if (!confirming) setConfirmArchive(null);
        }}
        onConfirm={async () => {
          if (!confirmArchive) return;
          try {
            setConfirming(true);
            await adminContestApi.archive(adminContestApi.id(confirmArchive));
            toast.success("Contest archived");
            setConfirmArchive(null);
            await load(true);
          } catch (err: any) {
            toast.error(
              err?.response?.data?.message || "Unable to archive contest",
            );
          } finally {
            setConfirming(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete contest?"
        description={
          <>
            Permanently delete{" "}
            <strong className="text-foreground">
              {confirmDelete?.title || "this contest"}
            </strong>
            ? This cannot be undone.
          </>
        }
        warning="Deletion is permanent."
        cancelLabel="Keep"
        confirmLabel="Delete"
        confirmVariant="danger"
        confirming={confirming}
        confirmingLabel="Deleting…"
        onCancel={() => {
          if (!confirming) setConfirmDelete(null);
        }}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            setConfirming(true);
            await adminContestApi.remove(adminContestApi.id(confirmDelete));
            toast.success("Contest deleted");
            setConfirmDelete(null);
            await load(true);
          } catch (err: any) {
            toast.error(
              err?.response?.data?.message || "Unable to delete contest",
            );
          } finally {
            setConfirming(false);
          }
        }}
      />
    </PermissionGuard>
  );
};
