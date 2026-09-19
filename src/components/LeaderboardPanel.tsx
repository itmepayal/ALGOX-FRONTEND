import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from "react";
import {
  Trophy,
  Medal,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Star,
} from "lucide-react";
import {
  leaderboardApi,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type UserLeaderboardStats,
} from "../api/leaderboardApi";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import "./companies/companies.css";
import "./leaderboard.css";

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all", label: "All Time" },
];

/** Main leaderboard shows Top 10 only — never ranks 11+. */
const TOP_N = 10;

type Props = {
  onExploreProblems?: () => void;
};

function friendlyError(): string {
  return "We couldn't retrieve the rankings right now.";
}

/** Prefer public userName — never surface raw Mongo ids as identity. */
function entryDisplayName(row: LeaderboardEntry): string {
  const n = String(row.userName || row.username || row.name || "").trim();
  return n || "Anonymous";
}

function entrySolved(row: LeaderboardEntry): number | null {
  const v = row.totalSolved ?? row.problemsSolved ?? row.solvedCount;
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

function entryScore(row: LeaderboardEntry): number | null {
  if (row.score == null || !Number.isFinite(Number(row.score))) return null;
  return Number(row.score);
}

function entryRating(row: LeaderboardEntry): number | null {
  if (row.rating == null || !Number.isFinite(Number(row.rating))) return null;
  return Number(row.rating);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="lb-rank lb-rank-1" aria-label="Rank 1">
        <Trophy size={15} strokeWidth={2} aria-hidden className="lb-icon" />
        <span aria-hidden>1</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="lb-rank lb-rank-2" aria-label="Rank 2">
        <Medal size={15} strokeWidth={2} aria-hidden className="lb-icon" />
        <span aria-hidden>2</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="lb-rank lb-rank-3" aria-label="Rank 3">
        <Medal size={15} strokeWidth={2} aria-hidden className="lb-icon" />
        <span aria-hidden>3</span>
      </span>
    );
  }
  return (
    <span className="lb-rank lb-rank-n" aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span className="lb-avatar" aria-hidden>
      {initials(name)}
    </span>
  );
}

function MetricValue({
  value,
  unavailable = "—",
}: {
  value: number | null | undefined;
  unavailable?: string;
}) {
  if (value == null) return <span className="lb-muted">{unavailable}</span>;
  return <span className="lb-mono">{formatNumber(value)}</span>;
}

export const LeaderboardPanel: FC<Props> = ({ onExploreProblems }) => {
  const { user } = useAuth();
  const userId = user?.id || (user as { _id?: string } | null)?._id || "";

  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<UserLeaderboardStats | null>(null);
  const [hasMyStats, setHasMyStats] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const requestSeq = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (inFlight.current && opts?.soft) return;
      const seq = ++requestSeq.current;
      inFlight.current = true;
      if (opts?.soft || hasLoadedOnce) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const res = await leaderboardApi.getLeaderboard({
          period,
          page: 1,
          limit: TOP_N,
        });
        if (seq !== requestSeq.current) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        // Hard cap — never render rank 11+ in the main board.
        setEntries(rows.slice(0, TOP_N));
      } catch {
        if (seq !== requestSeq.current) return;
        setError(friendlyError());
        if (!hasLoadedOnce) setEntries([]);
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setRefreshing(false);
          setHasLoadedOnce(true);
          inFlight.current = false;
        }
      }
    },
    [period, hasLoadedOnce]
  );

  const loadMyStats = useCallback(async () => {
    if (!userId) {
      setMyStats(null);
      setHasMyStats(false);
      return;
    }
    try {
      const res = await leaderboardApi.getUserStats(userId);
      setMyStats(res.data || null);
      setHasMyStats(Boolean(res.data));
    } catch {
      setMyStats(null);
      setHasMyStats(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMyStats();
  }, [loadMyStats]);

  const onPeriodChange = (next: LeaderboardPeriod) => {
    if (next === period) return;
    setPeriod(next);
  };

  const onPeriodKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    index: number
  ) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + dir + PERIODS.length) % PERIODS.length;
    onPeriodChange(PERIODS[next].id);
    const btn = e.currentTarget.querySelectorAll<HTMLButtonElement>(
      "[role='tab']"
    )[next];
    btn?.focus();
  };

  /** Defensive — render path must never exceed Top 10. */
  const topEntries = useMemo(() => entries.slice(0, TOP_N), [entries]);

  const myRowOnBoard = useMemo(() => {
    if (!userId) return null;
    return topEntries.find((e) => String(e.userId) === String(userId)) || null;
  }, [topEntries, userId]);

  const showOffBoardRank =
    Boolean(userId) &&
    hasMyStats &&
    myStats?.globalRank != null &&
    period === "all" &&
    !myRowOnBoard &&
    Number(myStats.globalRank) > TOP_N;

  if (loading && !hasLoadedOnce) {
    return (
      <div className="co-page lb-page" aria-busy="true" aria-live="polite">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
        <div className="lb-period-skel">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
        <div className="lb-skel-rows" aria-hidden>
          {Array.from({ length: TOP_N }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="co-page lb-page">
      <header className="co-header lb-header">
        <div>
          <p className="co-kicker">Community</p>
          <h1 className="co-title">
            <Trophy size={22} strokeWidth={2} aria-hidden className="lb-icon" />
            Leaderboard
          </h1>
          <p className="co-lede">Top performers on AlgoPath</p>
          <p className="co-muted lb-sublede">
            See how you rank against the AlgoPath community.
          </p>
          <p className="lb-live" role="status">
            <span className="lb-live-dot" aria-hidden />
            Live rankings
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={refreshing || loading}
          title="Refresh leaderboard"
          aria-label="Refresh leaderboard"
          onClick={() => void load({ soft: true })}
        >
          <RefreshCw
            size={14}
            strokeWidth={2}
            aria-hidden
            className={refreshing ? "lb-icon lb-spin" : "lb-icon"}
          />
          Refresh
        </Button>
      </header>

      <div
        className="lb-period"
        role="tablist"
        aria-label="Leaderboard period"
        onKeyDown={(e) => {
          const tabs = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']")
          );
          const idx = tabs.indexOf(e.target as HTMLButtonElement);
          if (idx >= 0) onPeriodKeyDown(e, idx);
        }}
      >
        {PERIODS.map((p) => {
          const selected = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={
                selected ? "lb-period-btn lb-period-active" : "lb-period-btn"
              }
              disabled={refreshing}
              onClick={() => onPeriodChange(p.id)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden className="lb-icon" />
          <div>
            <strong>Unable to load leaderboard</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void load({ soft: true })}
          >
            Retry
          </button>
        </div>
      ) : null}

      <section
        className={`co-panel lb-board ${refreshing ? "lb-board-refreshing" : ""}`}
        aria-label="Top 10 rankings"
        aria-busy={refreshing}
      >
        {!error && topEntries.length === 0 ? (
          <EmptyState
            title="No rankings yet"
            description="Solve problems to appear on the AlgoPath leaderboard."
            icon={<Trophy size={22} strokeWidth={1.75} aria-hidden />}
            action={
              onExploreProblems ? (
                <Button type="button" onClick={onExploreProblems}>
                  Explore Problems
                </Button>
              ) : undefined
            }
          />
        ) : topEntries.length > 0 ? (
          <>
            <div className="lb-table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">User</th>
                    <th scope="col">Problems Solved</th>
                    <th scope="col">Score</th>
                    <th scope="col">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {topEntries.map((row) => {
                    const name = entryDisplayName(row);
                    const solved = entrySolved(row);
                    const score = entryScore(row);
                    const rating = entryRating(row);
                    const isYou =
                      Boolean(userId) &&
                      String(row.userId) === String(userId);
                    const rank = Number(row.rank) || 0;
                    const rowClass = [
                      isYou ? "lb-row-you" : "",
                      rank === 1 ? "lb-row-gold" : "",
                      rank === 2 ? "lb-row-silver" : "",
                      rank === 3 ? "lb-row-bronze" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <tr
                        key={`${row.userId}-${rank}`}
                        className={rowClass || undefined}
                      >
                        <td>
                          <RankBadge rank={rank} />
                        </td>
                        <td>
                          <div className="lb-user">
                            <UserAvatar name={name} />
                            <div className="lb-user-text">
                              <span className="lb-user-name">{name}</span>
                              {isYou ? (
                                <Badge
                                  variant="primary"
                                  className="lb-you-badge"
                                >
                                  You
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className="lb-metric"
                            title="Problems solved"
                          >
                            <CheckCircle2
                              size={14}
                              strokeWidth={2}
                              aria-hidden
                              className="lb-icon lb-metric-icon lb-metric-ok"
                            />
                            <MetricValue value={solved} />
                          </span>
                        </td>
                        <td>
                          <span className="lb-metric" title="Score">
                            <Trophy
                              size={14}
                              strokeWidth={2}
                              aria-hidden
                              className="lb-icon lb-metric-icon"
                            />
                            <MetricValue value={score} />
                          </span>
                        </td>
                        <td>
                          <span className="lb-metric" title="Rating">
                            <Star
                              size={14}
                              strokeWidth={2}
                              aria-hidden
                              className="lb-icon lb-metric-icon"
                            />
                            <MetricValue value={rating} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="lb-cards">
              {topEntries.map((row) => {
                const name = entryDisplayName(row);
                const solved = entrySolved(row);
                const score = entryScore(row);
                const rating = entryRating(row);
                const isYou =
                  Boolean(userId) && String(row.userId) === String(userId);
                const rank = Number(row.rank) || 0;
                const cardClass = [
                  "lb-card",
                  isYou ? "lb-row-you" : "",
                  rank === 1 ? "lb-row-gold" : "",
                  rank === 2 ? "lb-row-silver" : "",
                  rank === 3 ? "lb-row-bronze" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li key={`card-${row.userId}-${rank}`} className={cardClass}>
                    <div className="lb-card-top">
                      <RankBadge rank={rank} />
                      <div className="lb-user">
                        <UserAvatar name={name} />
                        <div className="lb-user-text">
                          <span className="lb-user-name">{name}</span>
                          {isYou ? (
                            <Badge variant="primary" className="lb-you-badge">
                              You
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <dl className="lb-card-metrics">
                      <div>
                        <dt>Solved</dt>
                        <dd>
                          <MetricValue value={solved} />
                        </dd>
                      </div>
                      <div>
                        <dt>Score</dt>
                        <dd>
                          <MetricValue value={score} />
                        </dd>
                      </div>
                      <div>
                        <dt>Rating</dt>
                        <dd>
                          <MetricValue value={rating} />
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>

            <footer className="lb-footer">
              Showing top {Math.min(TOP_N, topEntries.length)}
            </footer>
          </>
        ) : null}
      </section>

      {showOffBoardRank && myStats?.globalRank != null ? (
        <aside className="lb-offpage" aria-label="Your ranking">
          <div>
            <span className="lb-offpage-label">Your ranking</span>
            <strong>#{formatNumber(myStats.globalRank)}</strong>
          </div>
          <div>
            <span className="lb-offpage-label">Problems Solved</span>
            <strong>
              <MetricValue value={myStats.totalSolved ?? null} />
            </strong>
          </div>
          {myStats.rating != null ? (
            <div>
              <span className="lb-offpage-label">Rating</span>
              <strong>{formatNumber(myStats.rating)}</strong>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
};
