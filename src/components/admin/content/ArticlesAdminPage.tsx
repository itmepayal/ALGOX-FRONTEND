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
  ChevronDown,
  CircleCheck,
  Eye,
  FilePenLine,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Undo2,
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
import { usePermission } from "../../../rbac/usePermission";
import { cn } from "../../../lib/cn";
import {
  ArticleStatusBadge,
  resolveArticleStatus,
} from "./ArticleStatusBadge";
import "../problems/problem-editor.css";

/** Backend article categories (ContentService enum). */
const ARTICLE_CATEGORIES = [
  { value: "guide", label: "Guide" },
  { value: "tutorial", label: "Tutorial" },
  { value: "system-design", label: "System Design" },
  { value: "company-insights", label: "Company Insights" },
] as const;

type CategoryValue = (typeof ARTICLE_CATEGORIES)[number]["value"];
type PublishFilter = "all" | "draft" | "published";
type SortKey = "updated-desc" | "created-desc" | "created-asc" | "title-asc" | "title-desc";

type ArticleRow = {
  _id?: string;
  id?: string;
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  category?: string;
  authorName?: string;
  authorAvatar?: string;
  isPublished?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  readTimeMinutes?: number;
};

function articleId(r: ArticleRow) {
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
  const found = ARTICLE_CATEGORIES.find((c) => c.value === value);
  return found?.label || value || "—";
}

function formatArticleDate(iso?: string) {
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

const DateCell: FC<{ iso?: string }> = ({ iso }) => {
  const formatted = formatArticleDate(iso);
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

const ArticleCell: FC<{ row: ArticleRow }> = ({ row }) => {
  const title = row.title?.trim() || "Untitled article";
  const summary = row.summary?.trim() || "";
  const slug = row.slug?.trim() || "";
  return (
    <div className="flex min-w-0 max-w-[300px] flex-col gap-0.5">
      <span className="font-primary truncate text-sm font-semibold text-foreground" title={title}>
        {title}
      </span>
      {summary ? (
        <span className="font-primary line-clamp-2 text-[0.75rem] leading-snug text-muted-foreground" title={summary}>
          {summary}
        </span>
      ) : null}
      {slug ? (
        <span className="font-code mt-0.5 block truncate text-[0.7rem] text-muted-foreground" title={slug}>
          {slug}
        </span>
      ) : null}
    </div>
  );
};

const AuthorCell: FC<{ row: ArticleRow }> = ({ row }) => {
  const name = row.authorName?.trim();
  if (name) {
    return (
      <span className="font-primary block max-w-[140px] truncate text-sm text-foreground" title={name}>
        {name}
      </span>
    );
  }
  return <span className="font-primary text-sm text-muted-foreground">—</span>;
};

const ArticleActions: FC<{
  row: ArticleRow;
  canUpdate: boolean;
  canDelete: boolean;
  busy: boolean;
  onView: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}> = ({
  row,
  canUpdate,
  canDelete,
  busy,
  onView,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const uiStatus = resolveArticleStatus(row);
  const published = uiStatus === "published";

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
      key: "publish",
      label: "Publish",
      icon: Send,
      onClick: onPublish,
      show: canUpdate && !published,
    },
    {
      key: "unpublish",
      label: "Unpublish",
      icon: Undo2,
      onClick: onUnpublish,
      show: canUpdate && published,
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
        aria-label={`Actions for ${row.title || "article"}`}
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
          className="absolute top-full right-0 z-30 mt-1 min-w-[168px] rounded-lg border border-border bg-card py-1 shadow-md"
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

export const ArticlesAdmin: FC<{ category?: string }> = ({ category }) => {
  const toast = useToast();
  const { can, user } = usePermission();
  const canCreate = can("content:create");
  const canUpdate = can("content:update");
  const canDelete = can("content:delete");

  const lockedCategory = category as CategoryValue | undefined;
  const isTutorialMode = lockedCategory === "tutorial";
  const pageTitle = isTutorialMode ? "Tutorials" : "Articles";
  const pageSub = isTutorialMode
    ? "Create and manage tutorial articles for the learning platform."
    : "Create, manage, publish, and organize learning articles for the platform.";

  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("updated-desc");

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ArticleRow | null>(null);
  const [editorReadOnly, setEditorReadOnly] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [formCategory, setFormCategory] = useState<CategoryValue>(
    lockedCategory || "guide",
  );
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ArticleRow | null>(null);
  const [confirmPublish, setConfirmPublish] = useState<ArticleRow | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState<ArticleRow | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);

  const formRef = useRef<HTMLElement>(null);

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
        const res = await adminContentApi.listArticles({
          page: 1,
          limit: 50,
          category:
            lockedCategory ||
            (categoryFilter !== "all" ? categoryFilter : undefined),
          published:
            publishFilter === "published"
              ? "true"
              : publishFilter === "draft"
                ? "false"
                : undefined,
        });
        let list: ArticleRow[] = Array.isArray(res.data) ? res.data : [];
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          list = list.filter(
            (r) =>
              r.title?.toLowerCase().includes(q) ||
              r.slug?.toLowerCase().includes(q) ||
              r.authorName?.toLowerCase().includes(q) ||
              r.summary?.toLowerCase().includes(q),
          );
        }
        setRows(list);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Unable to load articles",
        );
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, lockedCategory, categoryFilter, publishFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    let published = 0;
    let drafts = 0;
    let pending = 0;
    for (const r of rows) {
      const s = resolveArticleStatus(r);
      if (s === "published") published += 1;
      else if (s === "pending") pending += 1;
      else drafts += 1;
    }
    return { total, published, drafts, pending };
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
      const aCreated = formatArticleDate(a.createdAt)?.ts || 0;
      const bCreated = formatArticleDate(b.createdAt)?.ts || 0;
      const aUpdated = formatArticleDate(a.updatedAt)?.ts || aCreated;
      const bUpdated = formatArticleDate(b.updatedAt)?.ts || bCreated;
      if (sort === "created-asc") return aCreated - bCreated;
      if (sort === "created-desc") return bCreated - aCreated;
      return bUpdated - aUpdated;
    });
    return list;
  }, [rows, sort]);

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    publishFilter !== "all" ||
    (!lockedCategory && categoryFilter !== "all");

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setSummary("");
    setContent("");
    setFormCategory(lockedCategory || "guide");
    setFieldErrors({});
    setFormError("");
    setEditing(null);
    setEditorReadOnly(false);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
    setEditing(null);
    setEditorReadOnly(false);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openEditor = (row: ArticleRow, readOnly: boolean) => {
    setShowCreate(false);
    setEditing(row);
    setEditorReadOnly(readOnly);
    setTitle(row.title || "");
    setSlug(row.slug || "");
    setSlugTouched(true);
    setSummary(row.summary || "");
    setContent(row.content || "");
    setFormCategory(
      (ARTICLE_CATEGORIES.some((c) => c.value === row.category)
        ? row.category
        : lockedCategory || "guide") as CategoryValue,
    );
    setFieldErrors({});
    setFormError("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    setPublishFilter("all");
    setCategoryFilter("all");
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 2) {
      next.title = "Title must be at least 2 characters.";
    } else if (cleanTitle.length > 300) {
      next.title = "Title must be at most 300 characters.";
    } else if (
      /^(create article|create study plan|save|submit|publish|untitled)$/i.test(
        cleanTitle
      )
    ) {
      next.title = "Enter a real article title (not a button label).";
    } else {
      for (let len = 1; len <= Math.floor(cleanTitle.length / 2); len += 1) {
        if (cleanTitle.length % len !== 0) continue;
        const unit = cleanTitle.slice(0, len);
        const reps = cleanTitle.length / len;
        if (reps >= 2 && unit.repeat(reps) === cleanTitle) {
          next.title =
            "Title looks duplicated. Enter the article name once.";
          break;
        }
      }
    }
    const finalSlug = (slug || slugify(title)).trim();
    if (!finalSlug || finalSlug.length < 2) {
      next.slug = "Slug is required.";
    }
    if (!summary.trim()) next.summary = "Description is required.";
    else if (summary.trim().length > 2000) {
      next.summary = "Description must be at most 2000 characters.";
    }
    if (!content.trim() && !summary.trim() && !title.trim()) {
      next.content = "Content is required.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const createDraft = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm() || saving) return;
    try {
      setSaving(true);
      setFormError("");
      await adminContentApi.createArticle({
        title: title.trim(),
        slug: (slug || slugify(title)).trim(),
        authorName: user?.name || "Admin",
        summary: summary.trim() || title.trim(),
        content: content.trim() || summary.trim() || title.trim(),
        category: lockedCategory || formCategory,
        isPublished: false,
        tags: [],
      });
      toast.success("Article draft created successfully.");
      closeForm();
      await load(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        "Unable to create article. Please try again.";
      setFormError(message);
      toast.error("Unable to create article. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || editorReadOnly || !validateForm() || saving) return;
    const id = articleId(editing);
    if (!id) return;
    try {
      setSaving(true);
      setFormError("");
      await adminContentApi.updateArticle(id, {
        title: title.trim(),
        slug: (slug || slugify(title)).trim(),
        summary: summary.trim() || title.trim(),
        content: content.trim() || summary.trim() || title.trim(),
        category: lockedCategory || formCategory,
      });
      toast.success("Article saved successfully.");
      closeForm();
      await load(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Unable to save article.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const setPublished = async (row: ArticleRow, isPublished: boolean) => {
    const id = articleId(row);
    if (!id) return;
    try {
      setBusyId(id);
      await adminContentApi.updateArticle(id, { isPublished });
      toast.success(
        isPublished
          ? "Article published successfully."
          : "Article unpublished successfully.",
      );
      await load(true);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          (isPublished
            ? "Unable to publish article."
            : "Unable to unpublish article."),
      );
    } finally {
      setBusyId(null);
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
              <h2
                className={cn(
                  "pe-title",
                  isTutorialMode && "pe-title--tutorials",
                )}
              >
                {pageTitle}
              </h2>
              <p className="pe-sub">{pageSub}</p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => void load(true)}
              aria-label={refreshing ? "Refreshing" : "Refresh articles"}
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
                onClick={() => (formOpen && showCreate ? closeForm() : openCreate())}
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
                    Create Article
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </header>

        <div className="admin-stats-grid !mb-0">
          <div className="admin-stat-card">
            <div className="label">Total articles</div>
            <div className="value flex items-center justify-between gap-2">
              <span>{stats.total}</span>
              <FileText
                size={16}
                strokeWidth={1.75}
                className="text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Published</div>
            <div className="value flex items-center justify-between gap-2">
              <span>{stats.published}</span>
              <CircleCheck
                size={16}
                strokeWidth={1.75}
                className="text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Drafts</div>
            <div className="value flex items-center justify-between gap-2">
              <span>{stats.drafts}</span>
              <FilePenLine
                size={16}
                strokeWidth={1.75}
                className="text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
          {stats.pending > 0 ? (
            <div className="admin-stat-card">
              <div className="label">Pending</div>
              <div className="value flex items-center justify-between gap-2">
                <span>{stats.pending}</span>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="pe-card !p-4" role="alert">
            <p className="font-primary mb-1 text-sm font-semibold text-foreground">
              Unable to load articles
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
              <h3 className={isTutorialMode ? "pe-title--tutorials" : undefined}>
                {pageTitle}
              </h3>
              <p>
                {loading
                  ? "Loading…"
                  : `${filteredRows.length} article${
                      filteredRows.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>
            <div
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
              role="search"
              aria-label="Article filters"
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
                  placeholder="Search by title, slug, or author…"
                  aria-label="Search articles"
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
                  value={publishFilter}
                  onChange={(e) =>
                    setPublishFilter(e.target.value as PublishFilter)
                  }
                  aria-label="Filter by status"
                >
                  <option value="all">All status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>

              {!lockedCategory ? (
                <div className={cn(selectWrap, "lg:w-[180px]")}>
                  <select
                    className={cn(selectClass, "lg:w-full")}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filter by category"
                  >
                    <option value="all">All categories</option>
                    {ARTICLE_CATEGORIES.map((c) => (
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
              ) : null}

              <div className={cn(selectWrap, "lg:w-[168px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort articles"
                >
                  <option value="updated-desc">Recently updated</option>
                  <option value="created-desc">Newest</option>
                  <option value="created-asc">Oldest</option>
                  <option value="title-asc">Title A–Z</option>
                  <option value="title-desc">Title Z–A</option>
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
              minWidth="880px"
              rows={filteredRows}
              rowKey={(r) => articleId(r)}
              emptyTitle={
                hasActiveFilters ? "No matching articles" : "No articles found"
              }
              emptyDescription={
                hasActiveFilters
                  ? "Try changing your search or filters."
                  : "Create your first article to get started."
              }
              emptyIcon={<FileText size={18} strokeWidth={1.75} aria-hidden />}
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
                    Create Article
                  </Button>
                ) : undefined
              }
              columns={[
                {
                  key: "article",
                  header: "Article",
                  width: "280px",
                  skeletonWidth: "12rem",
                  render: (r) => <ArticleCell row={r} />,
                },
                {
                  key: "author",
                  header: "Author",
                  width: "140px",
                  skeletonWidth: "5rem",
                  render: (r) => <AuthorCell row={r} />,
                },
                {
                  key: "category",
                  header: "Category",
                  width: "132px",
                  skeletonWidth: "4.5rem",
                  render: (r) => (
                    <Badge variant="default" className="max-w-full truncate">
                      {categoryLabel(r.category)}
                    </Badge>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "120px",
                  skeletonWidth: "4.5rem",
                  render: (r) => <ArticleStatusBadge article={r} />,
                },
                {
                  key: "created",
                  header: "Created",
                  width: "120px",
                  skeletonWidth: "5rem",
                  render: (r) => <DateCell iso={r.createdAt} />,
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
                    <ArticleActions
                      row={r}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      busy={busyId === articleId(r)}
                      onView={() => openEditor(r, true)}
                      onEdit={() => openEditor(r, false)}
                      onPublish={() => setConfirmPublish(r)}
                      onUnpublish={() => setConfirmUnpublish(r)}
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
                    ? "View article"
                    : "Edit article"
                  : "Create article"}
              </h3>
              <p>
                {editing
                  ? editing.title || "Article details"
                  : "Save a draft, then publish when ready."}
              </p>
            </div>

            {formError ? (
              <p className="admin-error" role="alert">
                {formError}
              </p>
            ) : null}

            <form
              onSubmit={editing ? saveEdit : createDraft}
              className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"
              noValidate
            >
              <div className="flex min-w-0 flex-col gap-3.5">
                <div
                  className={cn(
                    "admin-field",
                    fieldErrors.title && "has-error",
                  )}
                >
                  <label htmlFor="art-title">Title</label>
                  <Input
                    id="art-title"
                    value={title}
                    disabled={editorReadOnly}
                    placeholder="Article title"
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
                    fieldErrors.summary && "has-error",
                  )}
                >
                  <label htmlFor="art-summary">Description</label>
                  <textarea
                    id="art-summary"
                    value={summary}
                    disabled={editorReadOnly}
                    placeholder="Short summary of the article…"
                    rows={3}
                    onChange={(e) => setSummary(e.target.value)}
                    className="font-primary min-h-[80px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                  />
                  {fieldErrors.summary ? (
                    <span className="pe-field-hint text-danger">
                      {fieldErrors.summary}
                    </span>
                  ) : (
                    <span className="pe-field-hint">
                      {summary.length}/2000
                    </span>
                  )}
                </div>

                <div
                  className={cn(
                    "admin-field pe-editor-field",
                    fieldErrors.content && "has-error",
                  )}
                >
                  <label htmlFor="art-content">Content</label>
                  <textarea
                    id="art-content"
                    value={content}
                    disabled={editorReadOnly}
                    placeholder="Markdown article content…"
                    rows={12}
                    onChange={(e) => setContent(e.target.value)}
                    className="font-code min-h-[220px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                  />
                  {fieldErrors.content ? (
                    <span className="pe-field-hint text-danger">
                      {fieldErrors.content}
                    </span>
                  ) : null}
                </div>
              </div>

              <aside className="flex min-w-0 flex-col gap-3.5 rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="font-primary m-0 text-sm font-semibold text-foreground">
                  Article settings
                </h4>

                <div
                  className={cn("admin-field", fieldErrors.slug && "has-error")}
                >
                  <label htmlFor="art-slug">Slug</label>
                  <Input
                    id="art-slug"
                    value={slug}
                    disabled={editorReadOnly}
                    placeholder="article-title"
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    className="bg-background font-code"
                  />
                  <span className="pe-field-hint">
                    {fieldErrors.slug || "URL identifier for this article."}
                  </span>
                </div>

                <div className="admin-field">
                  <label htmlFor="art-category">Category</label>
                  <div className="relative">
                    <select
                      id="art-category"
                      className={cn(selectClass, "w-full")}
                      value={lockedCategory || formCategory}
                      disabled={editorReadOnly || Boolean(lockedCategory)}
                      onChange={(e) =>
                        setFormCategory(e.target.value as CategoryValue)
                      }
                    >
                      {ARTICLE_CATEGORIES.map((c) => (
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

                {editing ? (
                  <div className="admin-field">
                    <span className="font-primary mb-1.5 block text-sm font-medium text-foreground">
                      Status
                    </span>
                    <ArticleStatusBadge article={editing} />
                  </div>
                ) : null}

                <div className="admin-field">
                  <span className="font-primary mb-1.5 block text-sm font-medium text-foreground">
                    Author
                  </span>
                  <span className="font-primary text-sm text-muted-foreground">
                    {editing?.authorName || user?.name || "Admin"}
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
                      ) : editing ? (
                        <FilePenLine
                          size={14}
                          strokeWidth={1.75}
                          className="size-3.5 shrink-0"
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
            </form>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(confirmPublish)}
        title="Publish article?"
        description={
          <>
            This article will become visible to users:{" "}
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
            await setPublished(confirmPublish, true);
            setConfirmPublish(null);
          } finally {
            setConfirming(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmUnpublish)}
        title="Unpublish article?"
        description={
          <>
            Move{" "}
            <strong className="text-foreground">
              {confirmUnpublish?.title || "this article"}
            </strong>{" "}
            back to draft? It will no longer be visible to users.
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Unpublish"
        confirmVariant="danger"
        confirming={confirming}
        confirmingLabel="Unpublishing…"
        onCancel={() => {
          if (!confirming) setConfirmUnpublish(null);
        }}
        onConfirm={async () => {
          if (!confirmUnpublish) return;
          try {
            setConfirming(true);
            await setPublished(confirmUnpublish, false);
            setConfirmUnpublish(null);
          } finally {
            setConfirming(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete article?"
        description={
          <>
            Are you sure you want to delete{" "}
            <strong className="text-foreground">
              {confirmDelete?.title || "this article"}
            </strong>
            ?
          </>
        }
        warning="This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete article"
        confirmVariant="danger"
        confirming={confirming}
        confirmingLabel="Deleting…"
        onCancel={() => {
          if (!confirming) setConfirmDelete(null);
        }}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const id = articleId(confirmDelete);
          try {
            setConfirming(true);
            await adminContentApi.deleteArticle(id);
            toast.success("Article deleted.");
            setConfirmDelete(null);
            if (editing && articleId(editing) === id) closeForm();
            await load(true);
          } catch (err: any) {
            toast.error(
              err?.response?.data?.message || "Unable to delete article.",
            );
          } finally {
            setConfirming(false);
          }
        }}
      />
    </PermissionGuard>
  );
};
