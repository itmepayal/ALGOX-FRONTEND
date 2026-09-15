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
  BookOpen,
  ChevronDown,
  Eye,
  FilePenLine,
  Layers,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ConfirmDialog } from "../../ConfirmDialog";
import { adminContentApi } from "../../../api/adminContentApi";
import { useToast } from "../../../context/ToastContext";
import { hasPermission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";
import { cn } from "../../../lib/cn";
import "../problems/problem-editor.css";

/** Backend study plan categories (ContentService enum). */
const PLAN_CATEGORIES = [
  { value: "interview", label: "Interview" },
  { value: "algorithm", label: "Algorithms" },
  { value: "data-structure", label: "Data Structures" },
  { value: "sql", label: "SQL" },
] as const;

type CategoryValue = (typeof PLAN_CATEGORIES)[number]["value"];
type SortKey =
  | "updated-desc"
  | "created-desc"
  | "created-asc"
  | "title-asc"
  | "title-desc"
  | "problems-desc";

type StudyCard = {
  title: string;
  description: string;
  problemIds: string[];
};

type StudyPlanRow = {
  _id?: string;
  id?: string;
  title?: string;
  slug?: string;
  description?: string;
  coverImage?: string;
  category?: string;
  cards?: StudyCard[];
  totalProblemsCount?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Forward-compat only — not on current schema. */
  status?: string | null;
};

function planId(r: StudyPlanRow) {
  return String(r._id || r.id || "");
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function categoryLabel(value?: string) {
  const found = PLAN_CATEGORIES.find((c) => c.value === value);
  return found?.label || value || "Uncategorized";
}

function formatDate(iso?: string) {
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
    ts: d.getTime(),
  };
}

function countProblems(plan: StudyPlanRow) {
  if (typeof plan.totalProblemsCount === "number") {
    return plan.totalProblemsCount;
  }
  return (plan.cards || []).reduce(
    (sum, c) => sum + (c.problemIds?.length || 0),
    0,
  );
}

function recomputeProblemCount(cards: StudyCard[]) {
  return cards.reduce((sum, c) => sum + (c.problemIds?.length || 0), 0);
}

const DateCell: FC<{ iso?: string }> = ({ iso }) => {
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

const PlanCell: FC<{ row: StudyPlanRow }> = ({ row }) => {
  const title = row.title?.trim() || "Untitled plan";
  const description = row.description?.trim() || "";
  return (
    <div className="flex min-w-0 max-w-[300px] flex-col gap-0.5">
      <span
        className="font-primary truncate text-sm font-semibold text-foreground"
        title={title}
      >
        {title}
      </span>
      {description ? (
        <span
          className="font-primary line-clamp-2 text-[0.75rem] leading-snug text-muted-foreground"
          title={description}
        >
          {description}
        </span>
      ) : null}
    </div>
  );
};

const PlanActions: FC<{
  row: StudyPlanRow;
  canUpdate: boolean;
  canDelete: boolean;
  busy: boolean;
  onView: () => void;
  onEdit: () => void;
  onManage: () => void;
  onDelete: () => void;
}> = ({
  row,
  canUpdate,
  canDelete,
  busy,
  onView,
  onEdit,
  onManage,
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

  const items: Array<{
    key: string;
    label: string;
    icon: typeof Eye;
    onClick: () => void;
    danger?: boolean;
    show: boolean;
  }> = [
    { key: "view", label: "View", icon: Eye, onClick: onView, show: true },
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      onClick: onEdit,
      show: canUpdate,
    },
    {
      key: "manage",
      label: "Manage content",
      icon: Layers,
      onClick: onManage,
      show: canUpdate,
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: onDelete,
      danger: true,
      show: canDelete,
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
        aria-label={`Actions for ${row.title || "study plan"}`}
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
          className="absolute top-full right-0 z-30 mt-1 min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-md"
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
                    item.danger ? "text-danger" : "text-foreground",
                  )}
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

export const StudyPlansAdmin: FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const canCreate = hasPermission(user?.role, "content:create");
  const canUpdate = hasPermission(user?.role, "content:update");
  const canDelete = hasPermission(user?.role, "content:delete");

  const [rows, setRows] = useState<StudyPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("updated-desc");

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<StudyPlanRow | null>(null);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [focusCards, setFocusCards] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [formCategory, setFormCategory] = useState<CategoryValue>("interview");
  const [coverImage, setCoverImage] = useState("");
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StudyPlanRow | null>(null);
  const [confirming, setConfirming] = useState(false);

  const formRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (manual = false) => {
      try {
        if (manual) setRefreshing(true);
        else setLoading(true);
        setError("");
        const res = await adminContentApi.listStudyPlans({
          page: 1,
          limit: 50,
          search: debouncedSearch || undefined,
        });
        let list: StudyPlanRow[] = Array.isArray(res.data) ? res.data : [];
        if (categoryFilter !== "all") {
          list = list.filter((r) => r.category === categoryFilter);
        }
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          list = list.filter(
            (r) =>
              r.title?.toLowerCase().includes(q) ||
              r.slug?.toLowerCase().includes(q) ||
              r.category?.toLowerCase().includes(q) ||
              r.description?.toLowerCase().includes(q),
          );
        }
        setRows(list);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Unable to load study plans",
        );
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, categoryFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const modules = rows.reduce((sum, r) => sum + (r.cards?.length || 0), 0);
    const problems = rows.reduce((sum, r) => sum + countProblems(r), 0);
    return { total, modules, problems };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      if (sort === "title-asc") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sort === "title-desc") {
        return (b.title || "").localeCompare(a.title || "");
      }
      if (sort === "problems-desc") {
        return countProblems(b) - countProblems(a);
      }
      const aCreated = formatDate(a.createdAt)?.ts || 0;
      const bCreated = formatDate(b.createdAt)?.ts || 0;
      const aUpdated = formatDate(a.updatedAt)?.ts || aCreated;
      const bUpdated = formatDate(b.updatedAt)?.ts || bCreated;
      if (sort === "created-asc") return aCreated - bCreated;
      if (sort === "created-desc") return bCreated - aCreated;
      return bUpdated - aUpdated;
    });
    return list;
  }, [rows, sort]);

  const hasActiveFilters =
    Boolean(debouncedSearch) || categoryFilter !== "all";

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setFormCategory("interview");
    setCoverImage("");
    setCards([]);
    setFieldErrors({});
    setFormError("");
    setEditing(null);
    setEditorReadOnly(false);
    setFocusCards(false);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openEditor = (
    row: StudyPlanRow,
    opts: { readOnly?: boolean; manage?: boolean } = {},
  ) => {
    setShowCreate(false);
    setEditing(row);
    setEditorReadOnly(Boolean(opts.readOnly));
    setFocusCards(Boolean(opts.manage));
    setTitle(row.title || "");
    setSlug(row.slug || "");
    setSlugTouched(true);
    setDescription(row.description || "");
    setCoverImage(row.coverImage || "");
    setFormCategory(
      (PLAN_CATEGORIES.some((c) => c.value === row.category)
        ? row.category
        : "interview") as CategoryValue,
    );
    setCards(
      (row.cards || []).map((c) => ({
        title: c.title || "",
        description: c.description || "",
        problemIds: Array.isArray(c.problemIds) ? [...c.problemIds] : [],
      })),
    );
    setFieldErrors({});
    setFormError("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (opts.manage) {
        cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const closeForm = () => {
    if (saving) return;
    setShowCreate(false);
    resetForm();
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCategoryFilter("all");
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 2) {
      next.title = "Title must be at least 2 characters.";
    } else if (title.trim().length > 300) {
      next.title = "Title must be at most 300 characters.";
    }
    const finalSlug = (slug || slugify(title)).trim();
    if (!finalSlug || finalSlug.length < 2) {
      next.slug = "Slug is required.";
    }
    if (!description.trim()) {
      next.description = "Description is required.";
    } else if (description.trim().length > 5000) {
      next.description = "Description must be at most 5000 characters.";
    }
    if (coverImage.trim() && !/^https?:\/\//i.test(coverImage.trim())) {
      next.coverImage = "Cover image must be a valid URL (or leave empty).";
    }
    for (let i = 0; i < cards.length; i += 1) {
      if (!cards[i].title.trim()) {
        next[`card-${i}-title`] = "Module title is required.";
      }
      if (!cards[i].description.trim()) {
        next[`card-${i}-desc`] = "Module description is required.";
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => {
    const normalizedCards = cards.map((c) => ({
      title: c.title.trim(),
      description: c.description.trim(),
      problemIds: c.problemIds.map((id) => id.trim()).filter(Boolean),
    }));
    return {
      title: title.trim(),
      slug: (slug || slugify(title)).trim(),
      description: description.trim() || title.trim(),
      category: formCategory,
      coverImage: coverImage.trim() || undefined,
      cards: normalizedCards,
      totalProblemsCount: recomputeProblemCount(normalizedCards),
    };
  };

  const createPlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm() || saving) return;
    try {
      setSaving(true);
      setFormError("");
      await adminContentApi.createStudyPlan(buildPayload());
      toast.success("Study plan draft created successfully.");
      closeForm();
      await load(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        "Unable to create study plan. Please try again.";
      setFormError(message);
      toast.error("Unable to create study plan. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || editorReadOnly || !validateForm() || saving) return;
    const id = planId(editing);
    if (!id) return;
    try {
      setSaving(true);
      setFormError("");
      await adminContentApi.updateStudyPlan(id, buildPayload());
      toast.success("Study plan saved successfully.");
      closeForm();
      await load(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Unable to save study plan.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const addCard = () => {
    setCards((prev) => [
      ...prev,
      { title: "", description: "", problemIds: [] },
    ]);
  };

  const updateCard = (index: number, patch: Partial<StudyCard>) => {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  };

  const removeCard = (index: number) => {
    setCards((prev) => prev.filter((_, i) => i !== index));
  };

  const moveCard = (index: number, dir: -1 | 1) => {
    setCards((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
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

  const formOpen = showCreate || Boolean(editing);

  return (
    <PermissionGuard
      permission="content:view"
      fallback={<div className="admin-denied">No content permission.</div>}
    >
      <div className="pe-page mx-auto w-full gap-5">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <div>
              <h2 className="pe-title">Study Plans</h2>
              <p className="pe-sub">
                Create and manage structured learning paths to help users master
                DSA, programming, and interview topics.
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
              aria-label={refreshing ? "Refreshing" : "Refresh study plans"}
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
                onClick={() =>
                  formOpen && showCreate ? closeForm() : openCreate()
                }
              >
                {showCreate ? (
                  <>
                    <X
                      size={14}
                      strokeWidth={1.75}
                      className="size-3.5 shrink-0"
                      aria-hidden
                    />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus
                      size={14}
                      strokeWidth={1.75}
                      className="size-3.5 shrink-0"
                      aria-hidden
                    />
                    Create Study Plan
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </header>

        <div className="admin-stats-grid !mb-0">
          <div className="admin-stat-card">
            <div className="label">Total plans</div>
            <div className="value flex items-center justify-between gap-2">
              <span>{stats.total}</span>
              <BookOpen
                size={16}
                strokeWidth={1.75}
                className="text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Modules</div>
            <div className="value flex items-center justify-between gap-2">
              <span>{stats.modules}</span>
              <Layers
                size={16}
                strokeWidth={1.75}
                className="text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Problems</div>
            <div className="value flex items-center justify-between gap-2">
              <span>{stats.problems}</span>
              <FilePenLine
                size={16}
                strokeWidth={1.75}
                className="text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="pe-card !p-4" role="alert">
            <p className="font-primary mb-1 text-sm font-semibold text-foreground">
              Unable to load study plans
            </p>
            <p className="font-primary mb-3 text-sm text-muted-foreground">
              {error}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load(true)}
            >
              Try again
            </Button>
          </div>
        ) : null}

        <section className="pe-card !p-0 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="pe-card-head mb-4">
              <h3>Study plans</h3>
              <p>
                {loading
                  ? "Loading…"
                  : `${filteredRows.length} plan${
                      filteredRows.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>
            <div
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
              role="search"
              aria-label="Study plan filters"
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
                  placeholder="Search study plans by title, slug, category…"
                  aria-label="Search study plans"
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

              <div className={cn(selectWrap, "lg:w-[180px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {PLAN_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
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

              <div className={cn(selectWrap, "lg:w-[180px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort study plans"
                >
                  <option value="updated-desc">Recently updated</option>
                  <option value="created-desc">Newest</option>
                  <option value="created-asc">Oldest</option>
                  <option value="title-asc">Title A–Z</option>
                  <option value="title-desc">Title Z–A</option>
                  <option value="problems-desc">Most problems</option>
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
              minWidth="840px"
              rows={filteredRows}
              rowKey={(r) => planId(r)}
              emptyTitle={
                hasActiveFilters
                  ? "No matching study plans"
                  : "No study plans yet"
              }
              emptyDescription={
                hasActiveFilters
                  ? "Try changing your search or filters."
                  : "Create a study plan to organize structured learning paths for users."
              }
              emptyIcon={<BookOpen size={18} strokeWidth={1.75} aria-hidden />}
              emptyAction={
                hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : canCreate ? (
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
                    Create Study Plan
                  </Button>
                ) : undefined
              }
              columns={[
                {
                  key: "plan",
                  header: "Plan",
                  width: "280px",
                  skeletonWidth: "12rem",
                  render: (r) => <PlanCell row={r} />,
                },
                {
                  key: "slug",
                  header: "Slug",
                  width: "160px",
                  skeletonWidth: "7rem",
                  render: (r) =>
                    r.slug ? (
                      <span
                        className="font-code block max-w-[160px] truncate text-xs text-muted-foreground"
                        title={r.slug}
                      >
                        {r.slug}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                {
                  key: "category",
                  header: "Category",
                  width: "140px",
                  skeletonWidth: "5rem",
                  render: (r) => (
                    <Badge variant="default" className="max-w-full truncate">
                      {categoryLabel(r.category)}
                    </Badge>
                  ),
                },
                {
                  key: "content",
                  header: "Content",
                  width: "120px",
                  technical: true,
                  skeletonWidth: "4.5rem",
                  render: (r) => {
                    const modules = r.cards?.length || 0;
                    const problems = countProblems(r);
                    return (
                      <span className="font-technical block text-sm tabular-nums text-foreground">
                        {problems.toLocaleString()} problems
                        <span className="mt-0.5 block text-[0.7rem] text-muted-foreground">
                          {modules} module{modules === 1 ? "" : "s"}
                        </span>
                      </span>
                    );
                  },
                },
                {
                  key: "updated",
                  header: "Updated",
                  width: "120px",
                  skeletonWidth: "5rem",
                  render: (r) => <DateCell iso={r.updatedAt} />,
                },
                {
                  key: "actions",
                  header: "Actions",
                  width: "64px",
                  align: "right",
                  skeletonWidth: "2rem",
                  render: (r) => (
                    <PlanActions
                      row={r}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      busy={busyId === planId(r)}
                      onView={() => openEditor(r, { readOnly: true })}
                      onEdit={() => openEditor(r, { readOnly: false })}
                      onManage={() =>
                        openEditor(r, { readOnly: false, manage: true })
                      }
                      onDelete={() => setConfirmDelete(r)}
                    />
                  ),
                },
              ]}
            />
          </div>
        </section>

        {formOpen ? (
          <section ref={formRef} className="pe-card !p-5">
            <div className="pe-card-head">
              <h3>
                {editing
                  ? editorReadOnly
                    ? "View study plan"
                    : focusCards
                      ? "Manage content"
                      : "Edit study plan"
                  : "Create study plan"}
              </h3>
              <p>
                {editing
                  ? editing.title || "Plan details"
                  : "Define the learning path, then add modules and problems."}
              </p>
            </div>

            {formError ? (
              <p className="admin-error" role="alert">
                {formError}
              </p>
            ) : null}

            <form
              onSubmit={editing ? savePlan : createPlan}
              className="flex flex-col gap-5"
              noValidate
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="flex min-w-0 flex-col gap-3.5">
                  <div
                    className={cn(
                      "admin-field",
                      fieldErrors.title && "has-error",
                    )}
                  >
                    <label htmlFor="sp-title">Title</label>
                    <Input
                      id="sp-title"
                      value={title}
                      disabled={editorReadOnly}
                      placeholder="Enter study plan title"
                      error={Boolean(fieldErrors.title)}
                      onChange={(e) => {
                        const next = e.target.value;
                        setTitle(next);
                        if (!slugTouched && !editing) setSlug(slugify(next));
                      }}
                      className="bg-background"
                    />
                    {fieldErrors.title ? (
                      <span className="pe-field-hint text-danger">
                        {fieldErrors.title}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={cn(
                      "admin-field",
                      fieldErrors.description && "has-error",
                    )}
                  >
                    <label htmlFor="sp-desc">Description</label>
                    <textarea
                      id="sp-desc"
                      value={description}
                      disabled={editorReadOnly}
                      placeholder="Describe what users will learn from this study plan…"
                      rows={4}
                      onChange={(e) => setDescription(e.target.value)}
                      className="font-primary min-h-[96px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                    />
                    {fieldErrors.description ? (
                      <span className="pe-field-hint text-danger">
                        {fieldErrors.description}
                      </span>
                    ) : (
                      <span className="pe-field-hint">
                        {description.length}/5000
                      </span>
                    )}
                  </div>
                </div>

                <aside className="flex min-w-0 flex-col gap-3.5 rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="font-primary m-0 text-sm font-semibold text-foreground">
                    Plan settings
                  </h4>

                  <div
                    className={cn(
                      "admin-field",
                      fieldErrors.slug && "has-error",
                    )}
                  >
                    <label htmlFor="sp-slug">Slug</label>
                    <Input
                      id="sp-slug"
                      value={slug}
                      disabled={editorReadOnly}
                      placeholder="study-plan-slug"
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(e.target.value);
                      }}
                      className="bg-background font-code"
                    />
                    <span className="pe-field-hint">
                      {fieldErrors.slug || "URL identifier for this plan."}
                    </span>
                  </div>

                  <div className="admin-field">
                    <label htmlFor="sp-category">Category</label>
                    <div className="relative">
                      <select
                        id="sp-category"
                        className={cn(selectClass, "w-full")}
                        value={formCategory}
                        disabled={editorReadOnly}
                        onChange={(e) =>
                          setFormCategory(e.target.value as CategoryValue)
                        }
                      >
                        {PLAN_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
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

                  <div
                    className={cn(
                      "admin-field",
                      fieldErrors.coverImage && "has-error",
                    )}
                  >
                    <label htmlFor="sp-cover">Cover image URL</label>
                    <Input
                      id="sp-cover"
                      value={coverImage}
                      disabled={editorReadOnly}
                      placeholder="https://…"
                      onChange={(e) => setCoverImage(e.target.value)}
                      className="bg-background"
                    />
                    <span className="pe-field-hint">
                      {fieldErrors.coverImage || "Optional."}
                    </span>
                  </div>

                  <div className="admin-field">
                    <span className="font-primary mb-1.5 block text-sm font-medium text-foreground">
                      Totals
                    </span>
                    <span className="font-technical text-sm tabular-nums text-muted-foreground">
                      {cards.length} modules ·{" "}
                      {recomputeProblemCount(cards)} problems
                    </span>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={closeForm}
                    >
                      Cancel
                    </Button>
                    {!editorReadOnly ? (
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
                          ? editing
                            ? "Saving…"
                            : "Creating…"
                          : editing
                            ? "Save changes"
                            : "Create draft"}
                      </Button>
                    ) : canUpdate ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setEditorReadOnly(false)}
                      >
                        <Pencil
                          size={14}
                          strokeWidth={1.75}
                          className="size-3.5 shrink-0"
                          aria-hidden
                        />
                        Edit
                      </Button>
                    ) : null}
                  </div>
                </aside>
              </div>

              <div
                ref={cardsRef}
                className={cn(
                  "rounded-lg border border-border p-4",
                  focusCards && "ring-2 ring-primary/30",
                )}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-primary m-0 text-sm font-semibold text-foreground">
                      Modules / content
                    </h4>
                    <p className="font-primary m-0 mt-1 text-xs text-muted-foreground">
                      Ordered cards with problem IDs for this learning path.
                    </p>
                  </div>
                  {!editorReadOnly ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addCard}
                    >
                      <Plus
                        size={14}
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0"
                        aria-hidden
                      />
                      Add module
                    </Button>
                  ) : null}
                </div>

                {cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                    <Layers
                      size={18}
                      strokeWidth={1.75}
                      className="mx-auto mb-2 text-muted-foreground"
                      aria-hidden
                    />
                    <p className="font-primary m-0 text-sm font-medium text-foreground">
                      No modules yet
                    </p>
                    <p className="font-primary m-0 mt-1 text-xs text-muted-foreground">
                      Add modules to structure problems in this study plan.
                    </p>
                  </div>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {cards.map((card, index) => (
                      <li
                        key={`card-${index}`}
                        className="rounded-lg border border-border bg-card p-3"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-technical text-xs font-semibold text-muted-foreground tabular-nums">
                            Module {index + 1}
                          </span>
                          {!editorReadOnly ? (
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                disabled={index === 0}
                                aria-label="Move module up"
                                onClick={() => moveCard(index, -1)}
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                disabled={index === cards.length - 1}
                                aria-label="Move module down"
                                onClick={() => moveCard(index, 1)}
                              >
                                ↓
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-danger"
                                aria-label="Remove module"
                                onClick={() => removeCard(index)}
                              >
                                <Trash2
                                  size={14}
                                  strokeWidth={1.75}
                                  aria-hidden
                                />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div
                            className={cn(
                              "admin-field",
                              fieldErrors[`card-${index}-title`] && "has-error",
                            )}
                          >
                            <label htmlFor={`sp-card-title-${index}`}>
                              Title
                            </label>
                            <Input
                              id={`sp-card-title-${index}`}
                              value={card.title}
                              disabled={editorReadOnly}
                              placeholder="Arrays"
                              onChange={(e) =>
                                updateCard(index, { title: e.target.value })
                              }
                              className="bg-background"
                            />
                            {fieldErrors[`card-${index}-title`] ? (
                              <span className="pe-field-hint text-danger">
                                {fieldErrors[`card-${index}-title`]}
                              </span>
                            ) : null}
                          </div>
                          <div className="admin-field">
                            <label htmlFor={`sp-card-problems-${index}`}>
                              Problem IDs
                            </label>
                            <Input
                              id={`sp-card-problems-${index}`}
                              value={card.problemIds.join(", ")}
                              disabled={editorReadOnly}
                              placeholder="id1, id2, id3"
                              onChange={(e) =>
                                updateCard(index, {
                                  problemIds: e.target.value
                                    .split(/[\s,]+/)
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="bg-background font-code"
                            />
                            <span className="pe-field-hint">
                              {card.problemIds.length} problem
                              {card.problemIds.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "admin-field md:col-span-2",
                              fieldErrors[`card-${index}-desc`] && "has-error",
                            )}
                          >
                            <label htmlFor={`sp-card-desc-${index}`}>
                              Description
                            </label>
                            <textarea
                              id={`sp-card-desc-${index}`}
                              value={card.description}
                              disabled={editorReadOnly}
                              placeholder="What this module covers…"
                              rows={2}
                              onChange={(e) =>
                                updateCard(index, {
                                  description: e.target.value,
                                })
                              }
                              className="font-primary min-h-[64px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                            />
                            {fieldErrors[`card-${index}-desc`] ? (
                              <span className="pe-field-hint text-danger">
                                {fieldErrors[`card-${index}-desc`]}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete study plan?"
        description={
          <>
            Are you sure you want to delete{" "}
            <strong className="text-foreground">
              {confirmDelete?.title || "this study plan"}
            </strong>
            ?
          </>
        }
        warning="This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete study plan"
        confirmVariant="danger"
        confirming={confirming}
        confirmingLabel="Deleting…"
        onCancel={() => {
          if (!confirming) setConfirmDelete(null);
        }}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const id = planId(confirmDelete);
          try {
            setConfirming(true);
            setBusyId(id);
            await adminContentApi.deleteStudyPlan(id);
            toast.success("Study plan deleted successfully.");
            setConfirmDelete(null);
            if (editing && planId(editing) === id) closeForm();
            await load(true);
          } catch (err: any) {
            toast.error(
              err?.response?.data?.message || "Unable to delete study plan.",
            );
          } finally {
            setConfirming(false);
            setBusyId(null);
          }
        }}
      />
    </PermissionGuard>
  );
};
