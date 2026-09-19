import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type MouseEvent,
} from "react";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Heart,
  Info,
  Loader2,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";
import {
  engagementApi,
  type FavouriteAccessFilter,
  type FavouriteListResult,
  type FavouriteProblem,
  type FavouriteSolvedFilter,
  type FavouriteSort,
  type FavouriteStats,
} from "../api/engagementApi";
import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import { normalizeProblemId } from "../utils/engagementIds";
import {
  hasAttempted,
  isSheetCompleted,
  normalizeDifficulty,
} from "../utils/problemUtils";
import { hasAccessToken } from "../api/accessToken";
import { cn } from "../lib/cn";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { PremiumBadge } from "./access/PremiumBadge";
import "./submission-analytics.css";
import "./favourites-page.css";

interface FavouritesPageProps {
  submissions: Submission[];
  userId?: string;
  onSelectProblem: (p: Problem) => void;
  onBookmarkChange?: (problemId: string, isBookmarked: boolean) => void;
  onFavoriteChange?: (problemId: string, isFavourite: boolean) => void;
  onExploreQuestions?: () => void;
  /** Bump to force refetch (e.g. after workspace toggle). */
  refreshKey?: number;
}

type CollectionTab =
  | "all"
  | "favorites"
  | "bookmarked"
  | "important"
  | "revision";

const EMPTY_STATS: FavouriteStats = {
  total: 0,
  solved: 0,
  unsolved: 0,
  attempted: 0,
  easy: 0,
  medium: 0,
  hard: 0,
};

function resolveClientStatus(
  problem: FavouriteProblem,
  submissions: Submission[]
): "solved" | "attempted" | "unsolved" {
  if (problem.solvedStatus) return problem.solvedStatus;
  const pid = normalizeProblemId(problem.id || problem._id);
  if (isSheetCompleted(pid, submissions)) return "solved";
  if (hasAttempted(pid, submissions)) return "attempted";
  return "unsolved";
}

function asPagedResult(
  data: Problem[] | FavouriteListResult | undefined
): FavouriteListResult | null {
  if (!data) return null;
  if (Array.isArray(data)) return null;
  if ("items" in data && Array.isArray(data.items)) return data;
  return null;
}

export const FavouritesPage: FC<FavouritesPageProps> = ({
  submissions,
  userId,
  onSelectProblem,
  onBookmarkChange: _onBookmarkChange,
  onFavoriteChange,
  onExploreQuestions,
  refreshKey = 0,
}) => {
  const [items, setItems] = useState<FavouriteProblem[]>([]);
  const [stats, setStats] = useState<FavouriteStats>(EMPTY_STATS);
  const [summary, setSummary] = useState<{
    bookmarked: number;
    favourites: number;
    important: number;
    revision: number;
  } | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [collection, setCollection] = useState<CollectionTab>("favorites");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState<FavouriteSolvedFilter>("all");
  const [accessType, setAccessType] = useState<FavouriteAccessFilter>("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<FavouriteSort>("recent");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const listQuery = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      difficulty,
      category,
      solved: status,
      accessType,
      sort,
      paginated: true as const,
    }),
    [page, limit, search, difficulty, category, status, accessType, sort]
  );

  const fetchLibrary = useCallback(async () => {
    if (!userId || !hasAccessToken()) {
      setItems([]);
      setStats(EMPTY_STATS);
      setLoading(false);
      setError("Login to view your saved problems.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      void engagementApi
        .getPersonalizationSummary()
        .then((s) => {
          if (s?.data) setSummary(s.data);
        })
        .catch(() => undefined);

      if (collection === "important" || collection === "revision") {
        const idsRes =
          collection === "important"
            ? await engagementApi.listMyImportantIds()
            : await engagementApi.listMyRevisions();
        const ids = idsRes.data?.problemIds || [];
        setItems([]);
        setStats({ ...EMPTY_STATS, total: ids.length });
        setCategories([]);
        setTotal(ids.length);
        setTotalPages(0);
        return;
      }

      if (collection === "bookmarked") {
        const res = await engagementApi.listMyBookmarks(listQuery);
        const paged = asPagedResult(res.data);
        if (paged) {
          setItems((paged.items || []) as FavouriteProblem[]);
          setStats(paged.stats || EMPTY_STATS);
          setCategories(paged.filters?.categories || []);
          setTotal(res.meta?.total ?? paged.stats?.total ?? 0);
          setTotalPages(res.meta?.totalPages ?? 0);
        } else {
          const flat = Array.isArray(res.data) ? res.data : [];
          setItems(flat as FavouriteProblem[]);
          setStats({ ...EMPTY_STATS, total: flat.length });
          setCategories([]);
          setTotal(flat.length);
          setTotalPages(flat.length > 0 ? 1 : 0);
        }
        return;
      }

      // all + favorites → favourites endpoint (primary library)
      const res = await engagementApi.listMyFavourites(listQuery);
      setItems(res.data?.items || []);
      setStats(res.data?.stats || EMPTY_STATS);
      setCategories(res.data?.filters?.categories || []);
      setTotal(res.meta?.total ?? res.data?.stats?.total ?? 0);
      setTotalPages(res.meta?.totalPages ?? 0);
    } catch (err: any) {
      const statusCode = err?.response?.status;
      if (statusCode === 401) {
        setError("Login to view your saved problems.");
      } else {
        setError("Unable to load your saved problems.");
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, collection, listQuery, refreshKey]);

  useEffect(() => {
    void fetchLibrary();
  }, [fetchLibrary]);

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setDifficulty("all");
    setStatus("all");
    setAccessType("all");
    setCategory("all");
    setSort("recent");
    setPage(1);
  };

  const filtersActive =
    search !== "" ||
    difficulty !== "all" ||
    status !== "all" ||
    accessType !== "all" ||
    category !== "all" ||
    sort !== "recent";

  const activeFilterLabels = useMemo(() => {
    const parts: string[] = [];
    if (collection !== "all") {
      parts.push(
        collection === "favorites"
          ? "Favorites"
          : collection === "bookmarked"
            ? "Bookmarked"
            : collection === "important"
              ? "Important"
              : "Revision"
      );
    }
    if (difficulty !== "all") {
      parts.push(difficulty.charAt(0).toUpperCase() + difficulty.slice(1));
    }
    if (status !== "all") {
      parts.push(status.charAt(0).toUpperCase() + status.slice(1));
    }
    if (accessType !== "all") {
      parts.push(accessType === "free" ? "Free" : "Premium");
    }
    if (category !== "all") parts.push(category);
    if (sort !== "recent") {
      const sortLabel: Record<FavouriteSort, string> = {
        recent: "Recently Added",
        oldest: "Oldest Added",
        title_asc: "Title A-Z",
        title_desc: "Title Z-A",
        difficulty: "Difficulty",
      };
      parts.push(sortLabel[sort]);
    }
    if (search) parts.push(`“${search}”`);
    return parts;
  }, [collection, difficulty, status, accessType, category, sort, search]);

  const handleRemoveFavorite = async (p: FavouriteProblem, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pid = normalizeProblemId(p.id || p._id);
    if (!pid || busyId) return;
    if (!hasAccessToken()) {
      setToast({ type: "error", text: "Login to manage favourites." });
      return;
    }

    const prevItems = items;
    const prevStats = stats;
    setItems((cur) =>
      cur.filter((x) => normalizeProblemId(x.id || x._id) !== pid)
    );
    setStats((s) => ({
      ...s,
      total: Math.max(0, s.total - 1),
    }));
    onFavoriteChange?.(pid, false);
    setBusyId(pid);

    try {
      await engagementApi.removeFavorite(pid);
      setToast({ type: "success", text: "Removed from favourites" });
      await fetchLibrary();
    } catch {
      setItems(prevItems);
      setStats(prevStats);
      onFavoriteChange?.(pid, true);
      setToast({
        type: "error",
        text: "Unable to update favourites. Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const pageLabel = useMemo(() => {
    if (total === 0) return "0 problems";
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    return `Showing ${from}–${to} of ${total} problems`;
  }, [page, limit, total]);

  const overview = {
    favorites: summary?.favourites ?? 0,
    bookmarked: summary?.bookmarked ?? 0,
    important: summary?.important ?? 0,
    revision: summary?.revision ?? 0,
    // Favorites and bookmarks are independent stores (no invented unique merge).
    total: (summary?.favourites ?? 0) + (summary?.bookmarked ?? 0),
  };

  const isIdOnlyCollection =
    collection === "important" || collection === "revision";
  const showEmpty =
    !loading &&
    !error &&
    items.length === 0 &&
    !isIdOnlyCollection &&
    total === 0 &&
    !filtersActive;
  const showFilteredEmpty =
    !loading &&
    !error &&
    items.length === 0 &&
    !isIdOnlyCollection &&
    (total > 0 || filtersActive);
  const showIdCollectionEmpty =
    !loading && !error && isIdOnlyCollection && total === 0;
  const showIdCollectionInfo =
    !loading && !error && isIdOnlyCollection && total > 0;

  const emptyCopy = (() => {
    if (collection === "bookmarked") {
      return {
        title: "No bookmarked problems yet",
        description:
          "Problems you saved previously will appear here under Bookmarked.",
        cta: "Browse Problems",
      };
    }
    if (collection === "favorites" || collection === "all") {
      return {
        title: "No favorite problems yet",
        description:
          "Use the heart icon on any problem to save it to your favorites.",
        cta: "Explore Questions",
      };
    }
    return {
      title: "No saved problems yet",
      description: "Start building your personal problem library.",
      cta: "Explore Questions",
    };
  })();

  const setCollectionAndReset = (next: CollectionTab) => {
    setCollection(next);
    setPage(1);
  };

  return (
    <div className="co-page ax-page mp-page">
      <header className="ax-header">
        <div className="mp-header-main">
          <p className="ax-kicker">Problem library</p>
          <h1 className="co-title">
            <Heart size={22} aria-hidden className="ax-icon" />
            My Problems
          </h1>
          <p className="ax-lede">
            Your saved problems, favorites, important questions, and revision
            items in one place.
          </p>
          <div className="ax-trust-row">
            <span className="mp-info-note">
              <Info size={14} aria-hidden />
              Favorites use the heart icon. Older saves from when the sheet used
              “favourites” remain available under Bookmarked.
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="ax-alert" role="alert">
          <AlertCircle size={16} aria-hidden />
          <div>
            <strong>Unable to load your saved problems</strong>
            <p>{error === "Unable to load your saved problems." ? "Please try again." : error}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void fetchLibrary()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="ax-layout">
        <section className="co-panel ax-panel" aria-label="Overview">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">Overview</p>
              <h2 className="ax-section-title">Your collections</h2>
              <p className="ax-section-meta">
                Counts from your personalization summary.
              </p>
            </div>
          </div>
          <div className="ax-summary ax-summary-5 mp-overview">
            {(
              [
                ["Favorites", overview.favorites, "Preferred", "favorites"],
                ["Bookmarked", overview.bookmarked, "Saved problems", "bookmarked"],
                ["Important", overview.important, "Marked important", "important"],
                ["Revision", overview.revision, "In revision", "revision"],
                ["Total", overview.total, "Favorites + bookmarks", "all"],
              ] as const
            ).map(([label, value, hint, key]) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "ax-stat",
                  collection === key && "is-active"
                )}
                onClick={() => setCollectionAndReset(key)}
              >
                <span className="ax-stat-label">{label}</span>
                <strong className="ax-stat-value">
                  {summary == null && loading ? "—" : value}
                </strong>
                <span className="ax-stat-hint">{hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="co-panel ax-panel" aria-label="Progress">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">Progress</p>
              <h2 className="ax-section-title">Solving progress</h2>
              <p className="ax-section-meta">
                Based on the current collection list
                {collection === "favorites" || collection === "all"
                  ? " (favorites)"
                  : collection === "bookmarked"
                    ? " (bookmarked)"
                    : ""}.
              </p>
            </div>
          </div>
          <div className="ax-metrics ax-metrics-3 mp-progress">
            {(
              [
                ["Solved", stats.solved],
                ["Attempted", stats.attempted],
                ["Unsolved", stats.unsolved],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="ax-metric">
                <span className="ax-metric-label">{label}</span>
                <strong className="ax-metric-value">
                  {loading && !isIdOnlyCollection ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    value
                  )}
                </strong>
              </div>
            ))}
          </div>
          <div className="ax-diff-row" style={{ marginTop: 12 }}>
            <div className="ax-diff-chip">
              <span>Easy</span>
              <strong>{loading ? "—" : stats.easy}</strong>
            </div>
            <div className="ax-diff-chip">
              <span>Medium</span>
              <strong>{loading ? "—" : stats.medium}</strong>
            </div>
            <div className="ax-diff-chip">
              <span>Hard</span>
              <strong>{loading ? "—" : stats.hard}</strong>
            </div>
          </div>
        </section>

        <section className="co-panel ax-panel" aria-label="Problems">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">Problems</p>
              <h2 className="ax-section-title">Problem library</h2>
              <p className="ax-section-meta">
                Filter and browse your saved problems.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mp-filters-toggle"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              Filters
            </Button>
          </div>

          <div
            className={cn(
              "ax-filters mp-filters",
              filtersOpen && "is-open"
            )}
          >
            <div className="ax-filter-row">
              <span className="ax-filter-label">Collection</span>
              <div className="ax-chips" role="tablist" aria-label="Collection">
                {(
                  [
                    ["all", "All"],
                    ["favorites", "Favorites"],
                    ["bookmarked", "Bookmarked"],
                    ["important", "Important"],
                    ["revision", "Revision"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={collection === id}
                    className={cn(
                      "ax-chip",
                      collection === id && "ax-chip-active"
                    )}
                    onClick={() => setCollectionAndReset(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ax-filter-row">
              <span className="ax-filter-label">Difficulty</span>
              <div className="ax-chips" role="group" aria-label="Difficulty">
                {(
                  [
                    ["all", "All"],
                    ["easy", "Easy"],
                    ["medium", "Medium"],
                    ["hard", "Hard"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "ax-chip",
                      difficulty === id && "ax-chip-active"
                    )}
                    aria-pressed={difficulty === id}
                    disabled={isIdOnlyCollection}
                    onClick={() => {
                      setDifficulty(id);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ax-filter-row">
              <span className="ax-filter-label">Status</span>
              <div className="ax-chips" role="group" aria-label="Status">
                {(
                  [
                    ["all", "All"],
                    ["solved", "Solved"],
                    ["attempted", "Attempted"],
                    ["unsolved", "Unsolved"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "ax-chip",
                      status === id && "ax-chip-active"
                    )}
                    aria-pressed={status === id}
                    disabled={isIdOnlyCollection}
                    onClick={() => {
                      setStatus(id);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ax-filter-row">
              <span className="ax-filter-label">Access</span>
              <div className="ax-chips" role="group" aria-label="Access">
                {(
                  [
                    ["all", "All"],
                    ["free", "Free"],
                    ["premium", "Premium"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "ax-chip",
                      accessType === id && "ax-chip-active"
                    )}
                    aria-pressed={accessType === id}
                    disabled={isIdOnlyCollection}
                    onClick={() => {
                      setAccessType(id);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ax-filter-row mp-filter-controls">
              <label className="mp-search">
                <Search size={14} aria-hidden />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search problems…"
                  aria-label="Search problems"
                  disabled={isIdOnlyCollection}
                />
              </label>
              <select
                value={sort}
                aria-label="Sort"
                disabled={isIdOnlyCollection}
                onChange={(e) => {
                  setSort(e.target.value as FavouriteSort);
                  setPage(1);
                }}
              >
                <option value="recent">Recently Added</option>
                <option value="oldest">Oldest Added</option>
                <option value="title_asc">Title A-Z</option>
                <option value="title_desc">Title Z-A</option>
                <option value="difficulty">Difficulty</option>
              </select>
              {categories.length > 0 && !isIdOnlyCollection ? (
                <select
                  value={category}
                  aria-label="Category"
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>

          {filtersActive && activeFilterLabels.length > 0 ? (
            <div className="mp-active-filters">
              <span className="ax-meta">
                Filters: {activeFilterLabels.join(" · ")}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetFilters}
              >
                Clear all
              </Button>
            </div>
          ) : null}

          {!loading && !isIdOnlyCollection && items.length > 0 ? (
            <p className="ax-showing">{pageLabel}</p>
          ) : null}

          {loading ? (
            <div className="mp-list" aria-busy="true" aria-label="Loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="mp-row mp-row-skel">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="mp-skel-lines">
                    <Skeleton className="h-4 w-2/3 max-w-sm" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && showEmpty ? (
            <EmptyState
              compact
              icon={<Heart size={18} strokeWidth={1.75} aria-hidden />}
              title={emptyCopy.title}
              description={emptyCopy.description}
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => onExploreQuestions?.()}
                >
                  {emptyCopy.cta}
                </Button>
              }
            />
          ) : null}

          {!loading && showFilteredEmpty ? (
            <EmptyState
              compact
              icon={<Search size={18} strokeWidth={1.75} aria-hidden />}
              title="No cards match the current filter"
              description="Try adjusting collection, difficulty, status, or search."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={resetFilters}
                >
                  Clear filters
                </Button>
              }
            />
          ) : null}

          {!loading && showIdCollectionEmpty ? (
            <EmptyState
              compact
              icon={
                collection === "revision" ? (
                  <RotateCcw size={18} strokeWidth={1.75} aria-hidden />
                ) : (
                  <Star size={18} strokeWidth={1.75} aria-hidden />
                )
              }
              title={
                collection === "revision"
                  ? "No revision problems yet"
                  : "No important problems yet"
              }
              description={
                collection === "revision"
                  ? "Accepted solves can automatically enter your revision queue."
                  : "Mark problems as important from a problem page or sheet row."
              }
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => onExploreQuestions?.()}
                >
                  {collection === "revision"
                    ? "Explore Questions"
                    : "Browse Problems"}
                </Button>
              }
            />
          ) : null}

          {!loading && showIdCollectionInfo ? (
            <div className="ax-subcard mp-collection-note">
              <strong>
                {total} {collection === "revision" ? "revision" : "important"}{" "}
                problem{total === 1 ? "" : "s"}
              </strong>
              <p className="ax-section-meta">
                Browse this collection from the Problems sheet using the{" "}
                {collection === "revision" ? "Revision" : "Important"} filter.
              </p>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => onExploreQuestions?.()}
              >
                Open Problems sheet
              </Button>
            </div>
          ) : null}

          {!loading && items.length > 0 ? (
            <>
              <ul className="mp-list">
                {items.map((p) => {
                  const pid = normalizeProblemId(p.id || p._id);
                  const diff = normalizeDifficulty(p.difficulty);
                  const solvedStatus = resolveClientStatus(p, submissions);
                  const premium = Boolean(p.isPremium);
                  const isFav =
                    collection === "favorites" ||
                    collection === "all" ||
                    Boolean(p.isFavourite);
                  return (
                    <li key={pid} className={`mp-row status-${solvedStatus}`}>
                      {collection === "bookmarked" ? (
                        <span
                          className="mp-icon-btn is-bookmark"
                          title="Bookmarked"
                          aria-label="Bookmarked"
                        >
                          <Bookmark size={16} fill="currentColor" aria-hidden />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={cn("mp-icon-btn", isFav && "is-fav")}
                          title={
                            isFav
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                          aria-label={
                            isFav
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                          aria-pressed={isFav}
                          disabled={busyId === pid || !isFav}
                          onClick={(e) => void handleRemoveFavorite(p, e)}
                        >
                          {busyId === pid ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Heart
                              size={16}
                              fill={isFav ? "currentColor" : "none"}
                              aria-hidden
                            />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className="mp-main"
                        onClick={() => onSelectProblem(p)}
                      >
                        <span className="mp-name">{p.title}</span>
                        <span className="mp-meta">
                          <span className={`mp-diff mp-diff-${diff}`}>
                            {diff}
                          </span>
                          {solvedStatus === "solved" ? (
                            <span className="mp-status is-solved">
                              <CheckCircle2 size={12} aria-hidden /> Solved
                            </span>
                          ) : solvedStatus === "attempted" ? (
                            <span className="mp-status is-attempted">
                              <Circle size={12} aria-hidden /> Attempted
                            </span>
                          ) : (
                            <span className="mp-status is-unsolved">
                              Unsolved
                            </span>
                          )}
                          {premium ? (
                            <PremiumBadge label="Premium" />
                          ) : (
                            <span className="mp-access">Free</span>
                          )}
                          {p.isImportant ? (
                            <span className="mp-tag">
                              <Star size={11} aria-hidden /> Important
                            </span>
                          ) : null}
                          {p.isRevision ? (
                            <span className="mp-tag">
                              <RotateCcw size={11} aria-hidden /> Revision
                            </span>
                          ) : null}
                          {p.category ? (
                            <span className="ax-meta">{p.category}</span>
                          ) : null}
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mp-open"
                        onClick={() => onSelectProblem(p)}
                      >
                        Open
                      </Button>
                    </li>
                  );
                })}
              </ul>

              <div className="mp-pagination">
                <span className="ax-pager-label">{pageLabel}</span>
                <div className="mp-page-btns">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} aria-hidden /> Previous
                  </Button>
                  <span className="ax-meta">
                    Page {page}
                    {totalPages > 0 ? ` / ${totalPages}` : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={page >= totalPages || loading || totalPages === 0}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  >
                    Next <ChevronRight size={16} aria-hidden />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {toast ? (
        <div
          className={`mp-toast ${toast.type}`}
          role="status"
          aria-live="polite"
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
};
