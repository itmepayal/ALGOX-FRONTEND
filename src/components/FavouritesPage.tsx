import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type MouseEvent,
} from "react";
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  Lock,
  Search,
  Star,
} from "lucide-react";
import {
  engagementApi,
  type FavouriteAccessFilter,
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
import "./favourites-page.css";
import { hasAccessToken } from "../api/accessToken";

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

  // Debounce search
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

  const fetchFavourites = useCallback(async () => {
    if (!userId || !hasAccessToken()) {
      setItems([]);
      setStats(EMPTY_STATS);
      setLoading(false);
      setError("Login to save favourite questions.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await engagementApi.listMyFavourites({
        page,
        limit,
        search: search || undefined,
        difficulty,
        category,
        solved: status,
        accessType,
        sort,
      });
      setItems(res.data?.items || []);
      setStats(res.data?.stats || EMPTY_STATS);
      setCategories(res.data?.filters?.categories || []);
      void engagementApi.getPersonalizationSummary().then((s) => {
        if (s?.data) setSummary(s.data);
      }).catch(() => undefined);
      setTotal(res.meta?.total ?? res.data?.stats?.total ?? 0);
      setTotalPages(res.meta?.totalPages ?? 0);
    } catch (err: any) {
      const statusCode = err?.response?.status;
      if (statusCode === 401) {
        setError("Login to save favourite questions.");
      } else {
        setError(
          err?.response?.data?.message ||
            "Unable to load favourites. Please try again."
        );
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    page,
    limit,
    search,
    difficulty,
    category,
    status,
    accessType,
    sort,
    refreshKey,
  ]);

  useEffect(() => {
    void fetchFavourites();
  }, [fetchFavourites]);

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

  const handleRemove = async (p: FavouriteProblem, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pid = normalizeProblemId(p.id || p._id);
    if (!pid || busyId) return;
    if (!hasAccessToken()) {
      setToast({ type: "error", text: "Login to save favourite questions." });
      return;
    }

    const prevItems = items;
    const prevStats = stats;
    // Optimistic remove
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
      // Refetch to keep pagination / stats accurate
      await fetchFavourites();
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
    if (total === 0) return "0 questions";
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    return `${from}–${to} of ${total}`;
  }, [page, limit, total]);

  const showEmpty = !loading && !error && items.length === 0 && stats.total === 0;
  const showFilteredEmpty =
    !loading && !error && items.length === 0 && stats.total > 0;

  return (
    <div className="fav-page">
      <header className="fav-header">
        <div>
          <h1 className="fav-title">
            <Star size={22} fill="currentColor" aria-hidden />
            My Problems
          </h1>
          <p className="fav-subtitle">
            Favourites are preferred problems (heart). Older saves made from the
            sheet when it said “favourites” were stored as bookmarks — find them
            under Bookmarked on the Problems sheet.
          </p>
        </div>
      </header>

      {summary && (
        <section className="fav-stats" aria-label="Personalization summary">
          {(
            [
              ["Bookmarked", summary.bookmarked],
              ["Favorites", summary.favourites],
              ["Important", summary.important],
              ["Revision", summary.revision],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="fav-stat-card">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>
      )}

      <section className="fav-stats" aria-label="Favourite stats">
        {(
          [
            ["Total", stats.total],
            ["Solved", stats.solved],
            ["Unsolved", stats.unsolved],
            ["Easy", stats.easy],
            ["Medium", stats.medium],
            ["Hard", stats.hard],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="fav-stat-card">
            {loading ? (
              <div className="fav-skel fav-skel-num" />
            ) : (
              <strong>{value}</strong>
            )}
            <span>{label}</span>
          </div>
        ))}
      </section>

      <div className="fav-toolbar">
        <div className="fav-search">
          <Search size={14} aria-hidden />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search favourite questions..."
            aria-label="Search favourite questions"
          />
        </div>
        <select
          value={difficulty}
          aria-label="Difficulty"
          onChange={(e) => {
            setDifficulty(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select
          value={status}
          aria-label="Status"
          onChange={(e) => {
            setStatus(e.target.value as FavouriteSolvedFilter);
            setPage(1);
          }}
        >
          <option value="all">All status</option>
          <option value="solved">Solved</option>
          <option value="attempted">Attempted</option>
          <option value="unsolved">Unsolved</option>
        </select>
        <select
          value={accessType}
          aria-label="Access"
          onChange={(e) => {
            setAccessType(e.target.value as FavouriteAccessFilter);
            setPage(1);
          }}
        >
          <option value="all">All access</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
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
        <select
          value={sort}
          aria-label="Sort"
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
      </div>

      {error && (
        <div className="fav-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="fav-list" aria-busy="true" aria-label="Loading favourites">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="fav-row fav-row-skel">
              <div className="fav-skel fav-skel-icon" />
              <div className="fav-skel-lines">
                <div className="fav-skel fav-skel-title" />
                <div className="fav-skel fav-skel-meta" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && showEmpty && (
        <div className="fav-empty">
          <Bookmark size={40} strokeWidth={1.5} />
          <h2>No favourite questions yet</h2>
          <p>
            Use the heart on a sheet row or question page to favourite. If you
            previously saved items when the sheet said “favourites”, those are
            still under Bookmarked on the Problems sheet.
          </p>
          <button
            type="button"
            className="fav-cta"
            onClick={() => onExploreQuestions?.()}
          >
            Explore Questions
          </button>
        </div>
      )}

      {!loading && showFilteredEmpty && (
        <div className="fav-empty">
          <Search size={36} strokeWidth={1.5} />
          <h2>No matches</h2>
          <p>Try adjusting filters or search.</p>
          <button type="button" className="fav-cta fav-cta-ghost" onClick={resetFilters}>
            Clear filters
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <ul className="fav-list">
            {items.map((p) => {
              const pid = normalizeProblemId(p.id || p._id);
              const diff = normalizeDifficulty(p.difficulty);
              const solvedStatus = resolveClientStatus(p, submissions);
              const premium = Boolean(p.isPremium);
              return (
                <li key={pid} className={`fav-row status-${solvedStatus}`}>
                  <button
                    type="button"
                    className="fav-star on"
                    title="Remove from favourites"
                    aria-label="Remove from favourites"
                    disabled={busyId === pid}
                    onClick={(e) => void handleRemove(p, e)}
                  >
                    {busyId === pid ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Star size={16} fill="currentColor" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="fav-main"
                    onClick={() => onSelectProblem(p)}
                  >
                    <span className="fav-name">
                      {premium && (
                        <Lock size={12} className="fav-lock" aria-label="Premium" />
                      )}
                      {p.title}
                    </span>
                    <span className="fav-meta">
                      <span className={`fav-diff fav-diff-${diff}`}>{diff}</span>
                      {p.category && <span>· {p.category}</span>}
                      {premium ? (
                        <span className="fav-badge premium">PREMIUM</span>
                      ) : (
                        <span className="fav-badge free">FREE</span>
                      )}
                      {solvedStatus === "solved" && (
                        <span className="fav-status solved">
                          <CheckCircle2 size={12} /> Solved
                        </span>
                      )}
                      {solvedStatus === "attempted" && (
                        <span className="fav-status attempted">
                          <Circle size={12} /> Attempted
                        </span>
                      )}
                      {solvedStatus === "unsolved" && (
                        <span className="fav-status unsolved">Not Attempted</span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="fav-open"
                    onClick={() => onSelectProblem(p)}
                  >
                    Open
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="fav-pagination">
            <span className="fav-page-info">{pageLabel}</span>
            <div className="fav-page-btns">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span>
                Page {page}
                {totalPages > 0 ? ` / ${totalPages}` : ""}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading || totalPages === 0}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fav-toast ${toast.type}`} role="status" aria-live="polite">
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
};
