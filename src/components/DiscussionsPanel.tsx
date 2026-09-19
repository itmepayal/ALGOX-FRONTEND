import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type FormEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowUp,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  discussionApi,
  normalizeDiscussionPost,
  type DiscussionCategory,
  type DiscussionComment,
  type DiscussionPost,
  type DiscussionSortBy,
} from "../api/discussionApi";
import { useAuth } from "../context/AuthContext";
import { useAuthPrompt } from "../context/AuthPromptContext";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { Input } from "./ui/input";
import { cn } from "../lib/cn";
import "./companies/companies.css";
import "./discuss.css";

interface Props {
  authenticated?: boolean;
  onRequireAuth?: () => void;
}

const CATEGORIES: { id: DiscussionCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "general", label: "General" },
  { id: "solution", label: "Solutions" },
  { id: "interview_experience", label: "Interview" },
  { id: "compensation", label: "Compensation" },
  { id: "career", label: "Career" },
];

const SORTS: { id: DiscussionSortBy; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "most_upvoted", label: "Most Upvoted" },
  { id: "hot", label: "Recent Activity" },
];

const REPORT_REASONS: {
  id:
    | "SPAM"
    | "ABUSE"
    | "HARASSMENT"
    | "INCORRECT_CONTENT"
    | "BUG"
    | "COPYRIGHT"
    | "CHEATING"
    | "OTHER";
  label: string;
}[] = [
  { id: "SPAM", label: "Spam" },
  { id: "ABUSE", label: "Abuse" },
  { id: "HARASSMENT", label: "Harassment" },
  { id: "INCORRECT_CONTENT", label: "Incorrect content" },
  { id: "BUG", label: "Bug / platform issue" },
  { id: "COPYRIGHT", label: "Copyright" },
  { id: "CHEATING", label: "Cheating" },
  { id: "OTHER", label: "Other" },
];

const PAGE_SIZE = 20;

function categoryLabel(cat?: string): string {
  const found = CATEGORIES.find((c) => c.id === cat);
  if (found) return found.label;
  if (!cat) return "General";
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Display-only category tag — uppercase via CSS; does not mutate API values. */
function DiscussionTag({
  category,
  className,
}: {
  category?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="primary"
      className={cn("dc-tag", className)}
    >
      {categoryLabel(category)}
    </Badge>
  );
}

/** Safe public display name — never surface raw email as the primary identity. */
function authorDisplayName(raw?: string): string {
  const s = String(raw || "").trim();
  if (!s) return "Anonymous";
  if (s.includes("@")) {
    const local = s.split("@")[0] || "user";
    return local.replace(/[._+]+/g, " ").trim() || "Anonymous";
  }
  return s;
}

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function excerpt(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

const QS = {
  page: "d_page",
  sort: "d_sort",
  cat: "d_cat",
  q: "d_q",
} as const;

function readListQueryFromUrl(): {
  page: number;
  sortBy: DiscussionSortBy;
  category: DiscussionCategory | "all";
  q: string;
} {
  const sp = new URLSearchParams(window.location.search);
  const pageRaw = Number(sp.get(QS.page) || 1);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sortRaw = sp.get(QS.sort) || "latest";
  const sortBy = (
    ["latest", "most_upvoted", "hot"] as DiscussionSortBy[]
  ).includes(sortRaw as DiscussionSortBy)
    ? (sortRaw as DiscussionSortBy)
    : "latest";
  const catRaw = sp.get(QS.cat) || "all";
  const category = (
    [
      "all",
      "general",
      "solution",
      "interview_experience",
      "compensation",
      "career",
    ] as const
  ).includes(catRaw as DiscussionCategory | "all")
    ? (catRaw as DiscussionCategory | "all")
    : "all";
  return { page, sortBy, category, q: sp.get(QS.q) || "" };
}

function writeListQueryToUrl(state: {
  page: number;
  sortBy: DiscussionSortBy;
  category: DiscussionCategory | "all";
  q: string;
}) {
  const url = new URL(window.location.href);
  if (state.page > 1) url.searchParams.set(QS.page, String(state.page));
  else url.searchParams.delete(QS.page);
  if (state.sortBy !== "latest") url.searchParams.set(QS.sort, state.sortBy);
  else url.searchParams.delete(QS.sort);
  if (state.category !== "all") url.searchParams.set(QS.cat, state.category);
  else url.searchParams.delete(QS.cat);
  if (state.q.trim()) url.searchParams.set(QS.q, state.q.trim());
  else url.searchParams.delete(QS.q);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== cur) window.history.replaceState(null, "", next);
}

/** Compact page window: 1 … 4 5 6 … 20 */
function buildPageItems(
  current: number,
  total: number
): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

function AuthorAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={size === "sm" ? "dc-avatar dc-avatar-sm" : "dc-avatar"} aria-hidden>
      {authorInitials(name)}
    </span>
  );
}

type View = "list" | "detail" | "create";

export const DiscussionsPanel: FC<Props> = ({
  authenticated,
  onRequireAuth,
}) => {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const userId = String(user?.id || user?._id || "");
  const listTopRef = useRef<HTMLDivElement | null>(null);
  const loadSeq = useRef(0);
  const urlHydrated = useRef(false);
  const hasLoadedOnce = useRef(false);

  const initialQuery = useMemo(() => readListQueryFromUrl(), []);

  const [view, setView] = useState<View>("list");
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialQuery.page);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");

  const [q, setQ] = useState(initialQuery.q);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery.q);
  const [category, setCategory] = useState<DiscussionCategory | "all">(
    initialQuery.category
  );
  const [sortBy, setSortBy] = useState<DiscussionSortBy>(initialQuery.sortBy);

  const [selected, setSelected] = useState<DiscussionPost | null>(null);
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [createCategory, setCreateCategory] =
    useState<DiscussionCategory>("general");
  const [createTags, setCreateTags] = useState("");
  const [creating, setCreating] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<(typeof REPORT_REASONS)[number]["id"]>("SPAM");
  const [reportDesc, setReportDesc] = useState("");
  const [reporting, setReporting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [commentFocused, setCommentFocused] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!urlHydrated.current) {
      urlHydrated.current = true;
      return;
    }
    setPage(1);
  }, [debouncedQ, category, sortBy]);

  useEffect(() => {
    writeListQueryToUrl({ page, sortBy, category, q: debouncedQ });
  }, [page, sortBy, category, debouncedQ]);

  const requireAuth = () => {
    if (authenticated) return true;
    openAuth({
      tab: "login",
      title: "Sign in to continue",
      message: "Create an account or sign in to post, vote, and comment.",
    });
    onRequireAuth?.();
    return false;
  };

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(totalPages, Math.floor(next)));
      if (clamped === page) return;
      setPage(clamped);
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [page, totalPages]
  );

  const loadPosts = useCallback(
    async (opts?: { soft?: boolean }) => {
      const seq = ++loadSeq.current;
      const soft = Boolean(opts?.soft) || hasLoadedOnce.current;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await discussionApi.listPosts({
          page,
          limit: PAGE_SIZE,
          sortBy,
          q: debouncedQ || undefined,
          category: category === "all" ? undefined : category,
        });
        if (seq !== loadSeq.current) return;
        const list = (res.data?.posts || []).map((p) =>
          normalizeDiscussionPost(p, userId)
        );
        const pages = Math.max(1, Number(res.data?.totalPages) || 1);
        const serverPage = Math.max(1, Number(res.data?.page) || page);
        setPosts(list);
        setTotal(Number(res.data?.total) || 0);
        setTotalPages(pages);
        hasLoadedOnce.current = true;
        if (serverPage !== page) {
          setPage(serverPage);
        }
      } catch {
        if (seq !== loadSeq.current) return;
        setError("Unable to load discussions right now.");
        if (!soft) setPosts([]);
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, sortBy, debouncedQ, category, userId]
  );

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".dc-more-wrap")) return;
      setActionsMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActionsMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [actionsMenuOpen]);

  const openPost = async (post: DiscussionPost) => {
    setView("detail");
    setSelected(normalizeDiscussionPost(post, userId));
    setEditingPost(false);
    setEditingCommentId(null);
    setReportOpen(false);
    setActionError("");
    setActionOk("");
    setLoadingDetail(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        discussionApi.getPost(post._id),
        discussionApi.getComments(post._id),
      ]);
      if (postRes.data) {
        setSelected(normalizeDiscussionPost(postRes.data, userId));
      }
      setComments(commentsRes.data || []);
    } catch {
      setActionError("Unable to load this discussion.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const backToList = () => {
    setView("list");
    setSelected(null);
    setComments([]);
    setReportOpen(false);
    setActionError("");
    setActionOk("");
    void loadPosts({ soft: true });
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireAuth()) return;
    if (!title.trim() || !content.trim()) {
      setActionError("Title and body are required.");
      return;
    }
    if (title.trim().length > 200) {
      setActionError("Title must be 200 characters or fewer.");
      return;
    }
    if (creating) return;
    setCreating(true);
    setActionError("");
    try {
      const tags = createTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await discussionApi.createPost({
        title: title.trim(),
        content: content.trim(),
        category: createCategory,
        tags: tags.length ? tags : undefined,
        authorName: user?.name || undefined,
      });
      setTitle("");
      setContent("");
      setCreateTags("");
      setCreateCategory("general");
      setActionOk("Discussion published.");
      if (res.data) {
        setPage(1);
        await openPost(res.data);
      } else {
        setPage(1);
        setView("list");
        await loadPosts({ soft: true });
      }
    } catch {
      setActionError("Unable to publish this discussion.");
    } finally {
      setCreating(false);
    }
  };

  const patchPostLocal = (updated: DiscussionPost) => {
    const norm = normalizeDiscussionPost(updated, userId);
    setPosts((prev) =>
      prev.map((p) => (p._id === norm._id ? { ...p, ...norm } : p))
    );
    setSelected((p) => (p && p._id === norm._id ? { ...p, ...norm } : p));
  };

  const handleVote = async (postId: string, voteType: "upvote" | "downvote") => {
    if (!requireAuth()) return;
    setVoting(true);
    setActionError("");
    try {
      const res = await discussionApi.votePost(postId, voteType);
      if (res.data) patchPostLocal(res.data);
    } catch {
      setActionError("Unable to update your vote.");
    } finally {
      setVoting(false);
    }
  };

  const handleBookmark = async (postId: string) => {
    if (!requireAuth()) return;
    setBookmarking(true);
    setActionError("");
    try {
      const res = await discussionApi.bookmarkPost(postId);
      if (res.data) patchPostLocal(res.data);
    } catch {
      setActionError("Unable to update bookmark.");
    } finally {
      setBookmarking(false);
    }
  };

  const handleShare = async () => {
    if (!selected) return;
    const url = `${window.location.origin}${window.location.pathname}?discuss=${selected._id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setActionOk("Link copied to clipboard.");
      } else {
        setActionOk(url);
      }
    } catch {
      setActionOk(url);
    }
  };

  const handleComment = async () => {
    if (!requireAuth() || !selected || !commentText.trim()) return;
    setCommenting(true);
    setActionError("");
    try {
      await discussionApi.addComment({
        postId: selected._id,
        content: commentText.trim(),
      });
      setCommentText("");
      const res = await discussionApi.getComments(selected._id);
      setComments(res.data || []);
      setSelected((p) =>
        p
          ? { ...p, commentCount: (p.commentCount || 0) + 1 }
          : p
      );
    } catch {
      setActionError("Unable to post comment.");
    } finally {
      setCommenting(false);
    }
  };

  const handleUpdatePost = async () => {
    if (!selected || !editTitle.trim() || !editContent.trim()) return;
    try {
      const res = await discussionApi.updatePost(selected._id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      if (res.data) patchPostLocal(res.data);
      setEditingPost(false);
    } catch {
      setActionError("Unable to update post.");
    }
  };

  const handleDeletePost = async () => {
    if (!selected || !window.confirm("Delete this discussion permanently?"))
      return;
    try {
      await discussionApi.deletePost(selected._id);
      backToList();
    } catch {
      setActionError("Unable to delete post.");
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      await discussionApi.updateComment(commentId, {
        content: editCommentText.trim(),
      });
      setEditingCommentId(null);
      if (selected) {
        const res = await discussionApi.getComments(selected._id);
        setComments(res.data || []);
      }
    } catch {
      setActionError("Unable to update comment.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await discussionApi.deleteComment(commentId);
      if (selected) {
        const res = await discussionApi.getComments(selected._id);
        setComments(res.data || []);
        setSelected((p) =>
          p
            ? {
                ...p,
                commentCount: Math.max(0, (p.commentCount || 1) - 1),
              }
            : p
        );
      }
    } catch {
      setActionError("Unable to delete comment.");
    }
  };

  const handleReportPost = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireAuth() || !selected) return;
    setReporting(true);
    setActionError("");
    try {
      await discussionApi.reportPost({
        targetType: "DISCUSSION",
        targetId: selected._id,
        reason: reportReason,
        description:
          reportReason === "OTHER" ? reportDesc.trim() || undefined : undefined,
      });
      setReportOpen(false);
      setReportDesc("");
      setActionOk("Report submitted. Thank you.");
    } catch {
      setActionError("Unable to submit report.");
    } finally {
      setReporting(false);
    }
  };

  const isOwnPost = Boolean(
    selected && userId && String(selected.authorId) === userId
  );

  const score = useMemo(() => {
    if (!selected) return 0;
    return (selected.upvotes || 0) - (selected.downvotes || 0);
  }, [selected]);

  /* ───────────── CREATE VIEW ───────────── */
  if (view === "create") {
    return (
      <div className="co-page dc-page">
        <nav className="dc-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="dc-crumb-link" onClick={backToList}>
            Discuss
          </button>
          <span className="dc-crumb-sep" aria-hidden>
            /
          </span>
          <span className="dc-crumb-current">Create Discussion</span>
        </nav>

        <header className="co-header dc-header dc-header-compact">
          <div>
            <h1 className="co-title">Create Discussion</h1>
            <p className="co-lede dc-lede-tight">
              Share a question, solution, or interview insight with the AlgoPath
              community.
            </p>
          </div>
        </header>

        {actionError ? (
          <div className="co-inline-error" role="alert">
            <AlertCircle size={16} strokeWidth={2} aria-hidden className="dc-icon" />
            <p>{actionError}</p>
          </div>
        ) : null}

        <form className="co-panel dc-create-card" onSubmit={(e) => void handleCreate(e)}>
          <div className="dc-field">
            <label htmlFor="dc-title">Title</label>
            <Input
              id="dc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ask a clear question or start a discussion…"
              maxLength={200}
              required
            />
          </div>

          <div className="dc-field">
            <label htmlFor="dc-cat">Category</label>
            <select
              id="dc-cat"
              className="dc-select"
              value={createCategory}
              onChange={(e) =>
                setCreateCategory(e.target.value as DiscussionCategory)
              }
            >
              {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="dc-field">
            <label htmlFor="dc-body">Body</label>
            <textarea
              id="dc-body"
              className="dc-textarea"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your discussion…"
              required
            />
          </div>

          <div className="dc-field">
            <label htmlFor="dc-tags">Tags</label>
            <Input
              id="dc-tags"
              value={createTags}
              onChange={(e) => setCreateTags(e.target.value)}
              placeholder="Add tags (comma-separated)"
            />
          </div>

          <div className="dc-create-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={backToList}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 size={14} className="animate-spin dc-icon" aria-hidden />
                  Publishing…
                </>
              ) : (
                "Publish Discussion"
              )}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  /* ───────────── DETAIL VIEW ───────────── */
  if (view === "detail" && selected) {
    const display = authorDisplayName(selected.authorName);
    const when = formatRelativeTime(selected.createdAt);

    return (
      <div className="co-page dc-page">
        <nav className="dc-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="dc-crumb-link" onClick={backToList}>
            Discuss
          </button>
          <span className="dc-crumb-sep" aria-hidden>
            /
          </span>
          <span className="dc-crumb-current">
            {categoryLabel(selected.category)}
          </span>
          <span className="dc-crumb-sep" aria-hidden>
            /
          </span>
          <span className="dc-crumb-current" title={selected.title}>
            {selected.title}
          </span>
        </nav>

        {(actionError || actionOk) && (
          <div
            className={actionError ? "co-inline-error" : "dc-inline-ok"}
            role={actionError ? "alert" : "status"}
          >
            {actionError ? (
              <AlertCircle size={16} strokeWidth={2} aria-hidden className="dc-icon" />
            ) : null}
            <p>{actionError || actionOk}</p>
            <button
              type="button"
              className="dc-dismiss"
              aria-label="Dismiss"
              onClick={() => {
                setActionError("");
                setActionOk("");
              }}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        )}

        {loadingDetail ? (
          <div className="dc-detail-skel" aria-busy="true">
            <Skeleton className="h-7 w-full max-w-lg" />
            <Skeleton className="mt-3 h-4 w-40" />
            <Skeleton className="mt-5 h-32 w-full" />
            <Skeleton className="mt-3 h-20 w-full" />
          </div>
        ) : (
          <div className="dc-detail-layout">
            <div className="dc-detail-main">
              <article className="co-panel dc-post-card">
                <div className="dc-post-head">
                  <div className="dc-post-badges">
                    <DiscussionTag category={selected.category} />
                    {selected.isPinned ? (
                      <Badge variant="warning">Pinned</Badge>
                    ) : null}
                    {selected.isLocked ? (
                      <Badge variant="default">Locked</Badge>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="platform-icon-btn"
                    aria-label="Back to discussions"
                    onClick={backToList}
                  >
                    <ArrowLeft size={18} strokeWidth={2} aria-hidden className="dc-icon" />
                  </button>
                </div>

                {editingPost ? (
                  <div className="dc-edit-form">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      aria-label="Edit title"
                    />
                    <textarea
                      className="dc-textarea"
                      rows={8}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      aria-label="Edit body"
                    />
                    <div className="dc-row-actions">
                      <Button type="button" onClick={() => void handleUpdatePost()}>
                        Save changes
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingPost(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="dc-post-title">{selected.title}</h1>
                    <div className="dc-post-meta">
                      <AuthorAvatar name={display} />
                      <div>
                        <strong className="dc-author-name">{display}</strong>
                        <p className="dc-meta-line">
                          {[when, `${selected.commentCount || 0} comments`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    <div className="dc-post-body learn-md">
                      <ReactMarkdown>{selected.content}</ReactMarkdown>
                    </div>

                    {selected.tags?.length ? (
                      <ul className="dc-tag-list" aria-label="Tags">
                        {selected.tags.map((t) => (
                          <li key={t}>
                            <Badge variant="technical">{t}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}

                {!editingPost ? (
                  <div className="dc-action-bar">
                    <div
                      className="dc-vote-inline"
                      role="group"
                      aria-label="Post votes"
                    >
                      <button
                        type="button"
                        className={
                          selected.userVote === "upvote"
                            ? "dc-vote-btn dc-vote-active"
                            : "dc-vote-btn"
                        }
                        aria-label="Upvote discussion"
                        aria-pressed={selected.userVote === "upvote"}
                        disabled={voting || !authenticated}
                        onClick={() => void handleVote(selected._id, "upvote")}
                      >
                        <ArrowUp size={16} strokeWidth={2.25} aria-hidden />
                      </button>
                      <span className="dc-vote-score" aria-live="polite">
                        {score}
                      </span>
                      <button
                        type="button"
                        className={
                          selected.userVote === "downvote"
                            ? "dc-vote-btn dc-vote-active-down"
                            : "dc-vote-btn"
                        }
                        aria-label="Downvote discussion"
                        aria-pressed={selected.userVote === "downvote"}
                        disabled={voting || !authenticated}
                        onClick={() => void handleVote(selected._id, "downvote")}
                      >
                        <ChevronDown size={16} strokeWidth={2.25} aria-hidden />
                      </button>
                    </div>

                    <div className="dc-action-buttons">
                      {authenticated ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={bookmarking}
                          aria-pressed={Boolean(selected.isBookmarked)}
                          aria-label={
                            selected.isBookmarked
                              ? "Remove bookmark"
                              : "Save discussion"
                          }
                          title={
                            selected.isBookmarked ? "Saved" : "Save discussion"
                          }
                          onClick={() => void handleBookmark(selected._id)}
                        >
                          <Bookmark
                            size={14}
                            strokeWidth={2}
                            aria-hidden
                            className="dc-icon"
                            fill={
                              selected.isBookmarked ? "currentColor" : "none"
                            }
                          />
                          {selected.isBookmarked ? "Saved" : "Save"}
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label="Share discussion"
                        onClick={() => void handleShare()}
                      >
                        <Share2 size={14} strokeWidth={2} aria-hidden className="dc-icon" />
                        Share
                      </Button>

                      <div className="dc-more-wrap">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-label="More actions"
                          aria-expanded={actionsMenuOpen}
                          onClick={() => setActionsMenuOpen((v) => !v)}
                        >
                          <MoreHorizontal size={14} strokeWidth={2} aria-hidden className="dc-icon" />
                        </Button>
                        {actionsMenuOpen ? (
                          <div className="dc-more-menu" role="menu">
                            {isOwnPost ? (
                              <>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setEditTitle(selected.title);
                                    setEditContent(selected.content);
                                    setEditingPost(true);
                                    setActionsMenuOpen(false);
                                  }}
                                >
                                  <Pencil size={14} aria-hidden className="dc-icon" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setActionsMenuOpen(false);
                                    void handleDeletePost();
                                  }}
                                >
                                  <Trash2 size={14} aria-hidden className="dc-icon" />
                                  Delete
                                </button>
                              </>
                            ) : null}
                            {authenticated && !isOwnPost ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setActionsMenuOpen(false);
                                  setReportOpen(true);
                                }}
                              >
                                <Flag size={14} aria-hidden className="dc-icon" />
                                Report
                              </button>
                            ) : null}
                            {!authenticated && !isOwnPost ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setActionsMenuOpen(false);
                                  requireAuth();
                                }}
                              >
                                Sign in for more
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>

              <section
                className="co-panel dc-comments-card"
                aria-labelledby="dc-comments-h"
              >
                <div className="dc-comments-head">
                  <h2 id="dc-comments-h">Comments</h2>
                  <span className="dc-comments-count">{comments.length}</span>
                </div>

                {comments.length === 0 ? (
                  <div className="dc-comments-empty">
                    <p className="dc-comments-empty-title">No comments yet</p>
                    <p className="co-muted">
                      Be the first to share your thoughts.
                    </p>
                    {authenticated ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => {
                          setCommentFocused(true);
                          requestAnimationFrame(() => {
                            document.getElementById("dc-comment")?.focus();
                          });
                        }}
                      >
                        Write a comment
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <ul className="dc-comment-list">
                    {comments.map((c) => {
                      const own = userId && String(c.authorId) === userId;
                      const name = authorDisplayName(c.authorName);
                      const editing = editingCommentId === c._id;
                      const cWhen = formatRelativeTime(c.createdAt);
                      return (
                        <li key={c._id} className="dc-comment">
                          <AuthorAvatar name={name} size="sm" />
                          <div className="dc-comment-body">
                            <div className="dc-comment-meta">
                              <strong>{name}</strong>
                              {cWhen ? <span>{cWhen}</span> : null}
                            </div>
                            {editing ? (
                              <>
                                <textarea
                                  className="dc-textarea"
                                  rows={2}
                                  value={editCommentText}
                                  onChange={(e) =>
                                    setEditCommentText(e.target.value)
                                  }
                                />
                                <div className="dc-row-actions">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      void handleUpdateComment(c._id)
                                    }
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setEditingCommentId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="dc-comment-text">{c.content}</p>
                                {own ? (
                                  <div className="dc-row-actions">
                                    <button
                                      type="button"
                                      className="dc-text-btn"
                                      onClick={() => {
                                        setEditingCommentId(c._id);
                                        setEditCommentText(c.content);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="dc-text-btn"
                                      onClick={() =>
                                        void handleDeleteComment(c._id)
                                      }
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {authenticated ? (
                  <div
                    className={
                      commentFocused || commentText
                        ? "dc-composer dc-composer-open"
                        : "dc-composer"
                    }
                  >
                    <label htmlFor="dc-comment" className="sr-only">
                      Write a comment
                    </label>
                    <textarea
                      id="dc-comment"
                      className="dc-textarea dc-composer-input"
                      rows={commentFocused || commentText ? 3 : 1}
                      placeholder="Write a comment…"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onFocus={() => setCommentFocused(true)}
                    />
                    {commentFocused || commentText ? (
                      <div className="dc-row-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setCommentFocused(false);
                            setCommentText("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={commenting || !commentText.trim()}
                          onClick={() => void handleComment()}
                        >
                          {commenting ? (
                            <Loader2
                              size={14}
                              className="animate-spin dc-icon"
                              aria-hidden
                            />
                          ) : null}
                          Post Comment
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="dc-signin-hint">
                    Sign in to join the conversation.
                  </p>
                )}
              </section>
            </div>

            <aside className="co-panel dc-info-card" aria-label="Discussion info">
              <p className="dc-info-kicker">Discussion Info</p>
              <dl className="dc-info-list">
                <div>
                  <dt>Category</dt>
                  <dd>
                    <DiscussionTag category={selected.category} />
                  </dd>
                </div>
                <div>
                  <dt>Activity</dt>
                  <dd>{when || "—"}</dd>
                </div>
                <div>
                  <dt>Comments</dt>
                  <dd>{selected.commentCount || 0}</dd>
                </div>
                <div>
                  <dt>Votes</dt>
                  <dd>{score}</dd>
                </div>
                {selected.viewsCount != null ? (
                  <div>
                    <dt>Views</dt>
                    <dd>{selected.viewsCount}</dd>
                  </div>
                ) : null}
              </dl>
            </aside>
          </div>
        )}

        {reportOpen ? (
          <div
            className="dc-modal-backdrop"
            role="presentation"
            onClick={() => setReportOpen(false)}
          >
            <div
              className="co-panel dc-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dc-report-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="dc-report-title">Report this post</h2>
              <p className="co-muted">
                Why are you reporting this discussion?
              </p>
              <form onSubmit={(e) => void handleReportPost(e)}>
                <fieldset className="dc-report-reasons">
                  <legend className="sr-only">Report reason</legend>
                  {REPORT_REASONS.map((r) => (
                    <label key={r.id} className="dc-radio">
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.id}
                        checked={reportReason === r.id}
                        onChange={() => setReportReason(r.id)}
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </fieldset>
                {reportReason === "OTHER" ? (
                  <textarea
                    className="dc-textarea"
                    rows={3}
                    placeholder="Optional details…"
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                  />
                ) : null}
                <div className="dc-create-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setReportOpen(false)}
                    disabled={reporting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={reporting}>
                    {reporting ? (
                      <Loader2
                        size={14}
                        className="animate-spin dc-icon"
                        aria-hidden
                      />
                    ) : null}
                    Submit Report
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ───────────── LIST VIEW ───────────── */
  const pageItems = buildPageItems(page, totalPages);

  return (
    <div className="co-page dc-page" ref={listTopRef}>
      <header className="co-header dc-header dc-header-bar">
        <div>
          <p className="co-kicker">Discussions</p>
          <h1 className="co-title">
            <MessageSquare
              size={22}
              strokeWidth={2}
              aria-hidden
              className="dc-icon"
            />
            Discussion
          </h1>
          <p className="co-lede">
            Ask questions, share ideas, and discuss technical concepts with the
            community.
          </p>
        </div>
        <div className="dc-header-actions">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={refreshing || loading}
            aria-label="Refresh discussions"
            onClick={() => void loadPosts({ soft: true })}
          >
            <RefreshCw
              size={14}
              strokeWidth={2}
              aria-hidden
              className={refreshing ? "dc-icon dc-spin" : "dc-icon"}
            />
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!requireAuth()) return;
              setView("create");
              setActionError("");
            }}
          >
            <Plus size={14} strokeWidth={2} aria-hidden className="dc-icon" />
            New Discussion
          </Button>
        </div>
      </header>

      <div className="dc-toolbar-row">
        <div className="dc-search">
          <Search size={15} strokeWidth={2} aria-hidden className="dc-icon" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search discussions…"
            aria-label="Search discussions"
          />
        </div>
        <select
          className="dc-select dc-select-compact"
          value={category}
          aria-label="Filter by category"
          onChange={(e) =>
            setCategory(e.target.value as DiscussionCategory | "all")
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          className="dc-select dc-select-compact"
          value={sortBy}
          aria-label="Sort discussions"
          onChange={(e) => setSortBy(e.target.value as DiscussionSortBy)}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden className="dc-icon" />
          <div>
            <strong>Unable to load discussions</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadPosts({ soft: true })}
          >
            Retry
          </button>
        </div>
      ) : null}

      {actionError && view === "list" ? (
        <div className="co-inline-error" role="alert">
          <p>{actionError}</p>
        </div>
      ) : null}

      {loading && !refreshing ? (
        <div className="dc-list" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] w-full" />
          ))}
        </div>
      ) : !error && posts.length === 0 ? (
        <EmptyState
          title="No discussions yet"
          description="Start the first conversation with the AlgoPath community."
          icon={<MessageSquare size={22} strokeWidth={1.75} aria-hidden />}
          action={
            authenticated ? (
              <Button type="button" onClick={() => setView("create")}>
                <Plus size={14} strokeWidth={2} aria-hidden className="dc-icon" />
                Create Discussion
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className={
            refreshing ? "dc-list dc-list-refreshing" : "dc-list"
          }
        >
          {posts.map((post) => {
            const name = authorDisplayName(post.authorName);
            const when = formatRelativeTime(post.createdAt);
            const net = (post.upvotes || 0) - (post.downvotes || 0);
            return (
              <li key={post._id}>
                <button
                  type="button"
                  className="co-panel dc-row"
                  onClick={() => void openPost(post)}
                >
                  <div className="dc-row-main">
                    <div className="dc-row-top">
                      <DiscussionTag category={post.category} />
                      {post.isPinned ? (
                        <Badge variant="warning">Pinned</Badge>
                      ) : null}
                    </div>
                    <strong className="dc-row-title">{post.title}</strong>
                    {post.content ? (
                      <p className="dc-row-excerpt">{excerpt(post.content)}</p>
                    ) : null}
                    <div className="dc-row-footer">
                      <span className="dc-row-author">
                        <AuthorAvatar name={name} size="sm" />
                        <span>
                          {name}
                          {when ? ` · ${when}` : ""}
                        </span>
                      </span>
                      <span className="dc-row-stats" aria-label="Activity">
                        <span title="Votes">
                          <ArrowUp size={12} strokeWidth={2} aria-hidden className="dc-icon" />
                          {net}
                        </span>
                        <span title="Comments">
                          <MessageSquare size={12} strokeWidth={2} aria-hidden className="dc-icon" />
                          {post.commentCount || 0}
                        </span>
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && totalPages > 1 ? (
        <nav className="dc-pager" aria-label="Discussions pagination">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 1 || refreshing}
            aria-label="Go to previous page"
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft size={14} strokeWidth={2} aria-hidden className="dc-icon" />
            <span className="dc-pager-prev-label">Previous</span>
            <span className="dc-pager-prev-short">Prev</span>
          </Button>

          <div className="dc-pager-pages" aria-hidden={false}>
            {pageItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`e-${idx}`} className="dc-pager-ellipsis" aria-hidden>
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={
                    item === page
                      ? "dc-pager-num dc-pager-num-active"
                      : "dc-pager-num"
                  }
                  aria-label={`Go to page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  disabled={refreshing || item === page}
                  onClick={() => goToPage(item)}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <span className="dc-pager-mobile-label" aria-live="polite">
            Page {page} of {totalPages}
            {total ? ` · ${total}` : ""}
          </span>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page >= totalPages || refreshing}
            aria-label="Go to next page"
            onClick={() => goToPage(page + 1)}
          >
            <span className="dc-pager-next-label">Next</span>
            <ChevronRight size={14} strokeWidth={2} aria-hidden className="dc-icon" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
};
