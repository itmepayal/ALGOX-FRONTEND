import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Info,
  Loader2,
  RefreshCw,
  Trophy,
  AlertCircle,
} from "lucide-react";
import {
  contestApi,
  type Contest,
  type ContestLeaderboardPayload,
  type ContestHistoryPayload,
  type ContestProblem,
  type ContestStatus,
} from "../api/contestApi";
import {
  virtualContestApi,
  type VirtualContestAnalytics,
  type VirtualContestSession,
} from "../api/virtualContestApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { formatDisplayDate } from "../lib/formatDisplayDate";
import { cn } from "../lib/cn";
import { PremiumFeatureLock } from "./access/PremiumFeatureLock";
import { PremiumUpgradeModal } from "./access/PremiumUpgradeModal";
import { setPendingPremiumNav } from "../access/pendingPremiumNav";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { connectRealtimeSocket } from "../realtime/socket";
import "./companies/companies.css";
import "./contests.css";

interface Props {
  authenticated?: boolean;
  onOpenProblem?: (
    problem: { id?: string; slug?: string; title?: string },
    contestId?: string,
    virtualSessionId?: string
  ) => void;
  onVirtualSessionChange?: (sessionId: string | null) => void;
}

type StatusFilter = "all" | "upcoming" | "live" | "ended";

function problemRef(entry: ContestProblem) {
  const p = entry.problemId;
  if (typeof p === "object" && p) return p;
  if (typeof p === "string") return { _id: p };
  return undefined;
}

function problemTitle(entry: ContestProblem): string {
  return problemRef(entry)?.title || "Untitled problem";
}

function problemOpenPayload(entry: ContestProblem) {
  const p = problemRef(entry);
  return {
    id: p?._id,
    slug: p?.slug,
    title: p?.title || problemTitle(entry),
  };
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDayTime(iso: string): string {
  const day = formatDisplayDate(iso);
  const time = formatClock(iso);
  return day ? `${day} · ${time}` : time;
}

function formatRange(start: string, end: string): string {
  const startDay = formatDisplayDate(start);
  const endDay = formatDisplayDate(end);
  const startT = formatClock(start);
  const endT = formatClock(end);
  if (startDay && endDay && startDay === endDay) {
    return `${startDay} · ${startT} – ${endT}`;
  }
  return `${formatDayTime(start)} – ${formatDayTime(end)}`;
}

function formatDuration(minutes?: number): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function statusDisplay(status: ContestStatus | string): {
  label: string;
  tone: "upcoming" | "live" | "ended";
} {
  const s = String(status || "").toUpperCase();
  if (s === "LIVE") return { label: "Live", tone: "live" };
  if (s === "SCHEDULED" || s === "DRAFT")
    return { label: "Upcoming", tone: "upcoming" };
  return { label: "Ended", tone: "ended" };
}

function ContestStatusTag({ status }: { status: ContestStatus | string }) {
  const { label, tone } = statusDisplay(status);
  return (
    <Badge
      variant={
        tone === "live" ? "success" : tone === "upcoming" ? "primary" : "default"
      }
      className={cn("ct-tag", `ct-tag-${tone}`)}
    >
      {label}
    </Badge>
  );
}

function participantLabel(count?: number): string | null {
  if (count == null || !Number.isFinite(count)) return null;
  return count === 1 ? "1 participant" : `${count} participants`;
}

function difficultyLabel(raw?: string): string | null {
  if (!raw) return null;
  return raw.replace(/_/g, " ").trim();
}

function problemOrderNumber(entry: ContestProblem, idx: number): number {
  const o = entry.order;
  if (typeof o === "number" && Number.isFinite(o) && o > 0) return o;
  return idx + 1;
}

function participantInitials(userId: string): string {
  const tail = String(userId || "").slice(-2).toUpperCase();
  return tail || "?";
}

export const ContestsPanel: FC<Props> = ({
  authenticated,
  onOpenProblem,
  onVirtualSessionChange,
}) => {
  const { user } = useAuth();
  const virtualOk = canAccess(user, "premium.virtual_contest");

  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<Contest | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [board, setBoard] = useState<ContestLeaderboardPayload | null>(null);
  const [history, setHistory] = useState<ContestHistoryPayload | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [virtualSession, setVirtualSession] =
    useState<VirtualContestSession | null>(null);
  const [virtualBusy, setVirtualBusy] = useState(false);
  const [virtualAnalytics, setVirtualAnalytics] =
    useState<VirtualContestAnalytics | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const historyBySlug = useMemo(() => {
    const map = new Map<string, ContestHistoryPayload["items"][number]>();
    for (const item of history?.items || []) {
      if (item.slug) map.set(item.slug, item);
    }
    return map;
  }, [history]);

  const bestRank = useMemo(() => {
    const ranks = (history?.items || [])
      .map((i) => i.rank)
      .filter((r): r is number => r != null && Number.isFinite(r) && r > 0);
    if (!ranks.length) return null;
    return Math.min(...ranks);
  }, [history]);

  const filteredContests = useMemo(() => {
    return contests.filter((c) => {
      const tone = statusDisplay(c.status).tone;
      if (statusFilter === "all") return true;
      if (statusFilter === "upcoming") return tone === "upcoming";
      if (statusFilter === "live") return tone === "live";
      return tone === "ended";
    });
  }, [contests, statusFilter]);

  const loadVirtualAnalytics = useCallback(async (sessionId: string) => {
    try {
      const res = await virtualContestApi.analytics(sessionId);
      setVirtualAnalytics(res.data || null);
    } catch {
      setVirtualAnalytics(null);
    }
  }, []);

  const finishVirtual = useCallback(
    async (sessionId: string) => {
      setVirtualBusy(true);
      try {
        const r = await virtualContestApi.complete(sessionId);
        setVirtualSession(r.data);
        onVirtualSessionChange?.(null);
        await loadVirtualAnalytics(sessionId);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err?.message || "Unable to finish session."
        );
      } finally {
        setVirtualBusy(false);
      }
    },
    [loadVirtualAnalytics, onVirtualSessionChange]
  );

  const loadDetail = useCallback(async (slug: string) => {
    const res = await contestApi.getContestBySlug(slug);
    setDetail(res.data || null);
    try {
      const lb = await contestApi.getLeaderboard(slug, { limit: 20 });
      setBoard(lb.data || null);
    } catch {
      setBoard(null);
    }
    return res.data || null;
  }, []);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await contestApi.listContests();
        setContests(res.data || []);
        if (authenticated) {
          try {
            const hist = await contestApi.getMySummary();
            setHistory(hist.data || null);
          } catch {
            setHistory(null);
          }
          if (virtualOk) {
            try {
              const active = await virtualContestApi.getActive();
              setVirtualSession(active.data || null);
              onVirtualSessionChange?.(active.data?.id || null);
            } catch {
              setVirtualSession(null);
            }
          }
        }
      } catch {
        setError("Unable to load contests right now.");
        if (!opts?.soft) setContests([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authenticated, virtualOk, onVirtualSessionChange]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedSlug) {
      setDetail(null);
      setBoard(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      setError("");
      try {
        if (!cancelled) await loadDetail(selectedSlug);
      } catch {
        if (!cancelled) {
          setError("Unable to load this contest.");
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSlug, loadDetail]);

  useEffect(() => {
    if (!selectedSlug || detail?.status !== "LIVE") return;
    const t = setInterval(() => {
      void loadDetail(selectedSlug).catch(() => undefined);
    }, 8_000);
    return () => clearInterval(t);
  }, [selectedSlug, detail?.status, loadDetail]);

  useEffect(() => {
    if (!authenticated || !selectedSlug || !detail) return;
    const contestId = detail._id || detail.id;
    if (!contestId) return;
    if (detail.status !== "LIVE" && detail.status !== "SCHEDULED") return;

    const socket = connectRealtimeSocket();
    if (!socket) return;

    const room = `contest:${contestId}`;
    const refresh = () => {
      void loadDetail(selectedSlug).catch(() => undefined);
    };

    const join = () => {
      socket.emit("room.join", { room });
    };
    join();
    socket.on("connect", join);
    socket.on("leaderboard.updated", refresh);
    socket.on("contest.started", refresh);
    socket.on("contest.ended", refresh);
    socket.on("contest.status_changed", refresh);

    return () => {
      socket.off("connect", join);
      socket.off("leaderboard.updated", refresh);
      socket.off("contest.started", refresh);
      socket.off("contest.ended", refresh);
      socket.off("contest.status_changed", refresh);
      socket.emit("room.leave", { room });
    };
  }, [
    authenticated,
    selectedSlug,
    detail?._id,
    detail?.id,
    detail?.status,
    loadDetail,
  ]);

  useEffect(() => {
    if (!virtualSession || virtualSession.status !== "in_progress") return;
    const t = setInterval(() => {
      void virtualContestApi
        .getById(virtualSession.id)
        .then((res) => {
          setVirtualSession(res.data);
          onVirtualSessionChange?.(
            res.data?.status === "in_progress" ? res.data.id : null
          );
        })
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, [virtualSession?.id, virtualSession?.status, onVirtualSessionChange]);

  useEffect(() => {
    if (selectedSlug) return;
    const t = setInterval(() => {
      void contestApi
        .listContests()
        .then((res) => setContests(res.data || []))
        .catch(() => undefined);
    }, 15_000);
    return () => clearInterval(t);
  }, [selectedSlug]);

  const handleRegister = async (slug: string) => {
    if (!authenticated) {
      setError("Sign in to register for contests.");
      return;
    }
    setRegistering(slug);
    setError("");
    try {
      await contestApi.register(slug);
      await load({ soft: true });
      if (selectedSlug === slug) await loadDetail(slug);
    } catch {
      setError("Registration failed. You may already be registered, or registration is closed.");
    } finally {
      setRegistering(null);
    }
  };

  const handleStartVirtual = async (
    slug: string,
    mode: "practice" | "virtual"
  ) => {
    if (!virtualOk) return;
    setVirtualBusy(true);
    setError("");
    try {
      const res = await virtualContestApi.start(slug, mode);
      setVirtualSession(res.data);
      onVirtualSessionChange?.(res.data.id);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Unable to start virtual practice."
      );
    } finally {
      setVirtualBusy(false);
    }
  };

  const handleOpenProblem = (
    entry: ContestProblem,
    contest?: Contest,
    virtualId?: string
  ) => {
    if (!onOpenProblem) return;
    const payload = problemOpenPayload(entry);
    if (!payload.id && !payload.slug) return;
    const contestId = virtualId ? undefined : contest?._id || contest?.id;
    onOpenProblem(payload, contestId, virtualId);
  };

  /* ───────────── DETAIL VIEW ───────────── */
  if (selectedSlug) {
    const c = detail;
    const canRegister =
      authenticated &&
      c &&
      !c.isRegistered &&
      (c.status === "SCHEDULED" || c.status === "LIVE");
    const canEnterLive =
      authenticated && c && c.isRegistered && c.status === "LIVE";
    const canVirtual = Boolean(
      c && (c.status === "ENDED" || c.status === "ARCHIVED")
    );
    const duration = c ? formatDuration(c.durationMinutes) : null;
    const participants = c ? participantLabel(c.participantCount) : null;
    const problemCount = c?.problems?.length ?? 0;
    const maxScore =
      c?.problems?.reduce((sum, p) => sum + (Number(p.points) || 0), 0) || null;

    const retryDetail = () => {
      if (!selectedSlug) return;
      setLoadingDetail(true);
      setError("");
      void loadDetail(selectedSlug)
        .catch(() => setError("Unable to load this contest."))
        .finally(() => setLoadingDetail(false));
    };

    return (
      <div className="co-page ct-page">
        <nav className="ct-breadcrumb" aria-label="Breadcrumb">
          <button
            type="button"
            className="ct-crumb-link"
            onClick={() => setSelectedSlug(null)}
          >
            Contests
          </button>
          <span className="ct-crumb-sep" aria-hidden>
            /
          </span>
          <span className="ct-crumb-current" title={c?.title || "Contest"}>
            {c?.title || "Contest"}
          </span>
        </nav>

        {error && !loadingDetail ? (
          <div className="co-inline-error" role="alert">
            <AlertCircle size={16} strokeWidth={2} aria-hidden className="ct-icon" />
            <div>
              <strong>Unable to load contest</strong>
              <p>{error}</p>
            </div>
            <button type="button" onClick={retryDetail}>
              Retry
            </button>
          </div>
        ) : null}

        {loadingDetail ? (
          <div className="ct-detail-skel" aria-busy="true">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-3 h-9 w-full max-w-xl" />
            <Skeleton className="mt-2 h-16 w-full max-w-2xl" />
            <Skeleton className="mt-3 h-4 w-56" />
            <Skeleton className="mt-4 h-10 w-48" />
            <div className="ct-skel-grid">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="mt-3 h-28 w-full" />
            <Skeleton className="mt-3 h-36 w-full" />
          </div>
        ) : c ? (
          <div className="ct-detail">
            <header className="ct-hero">
              <div className="ct-hero-top">
                <ContestStatusTag status={c.status} />
                {c.isRegistered ? (
                  <Badge variant="success" className="ct-tag">
                    Registered
                  </Badge>
                ) : null}
              </div>
              <h1 className="ct-hero-title">{c.title}</h1>
              {c.description ? (
                <p className="ct-hero-desc">{c.description}</p>
              ) : null}

              <ul className="ct-hero-facts" aria-label="Contest summary">
                {formatDisplayDate(c.startTime) ? (
                  <li>{formatDisplayDate(c.startTime)}</li>
                ) : null}
                {duration ? <li>{duration} duration</li> : null}
                {participants ? <li>{participants}</li> : null}
                {problemCount > 0 ? (
                  <li>
                    {problemCount}{" "}
                    {problemCount === 1 ? "problem" : "problems"}
                  </li>
                ) : null}
              </ul>

              <div className="ct-hero-actions">
                {canRegister ? (
                  <Button
                    type="button"
                    disabled={registering === c.slug}
                    onClick={() => void handleRegister(c.slug)}
                  >
                    {registering === c.slug
                      ? "Registering…"
                      : c.status === "LIVE"
                        ? "Enter Contest"
                        : "Register"}
                  </Button>
                ) : null}
                {canEnterLive ? (
                  <Badge variant="success" className="ct-tag">
                    You are registered
                  </Badge>
                ) : null}
                {canVirtual && virtualOk ? (
                  <Button
                    type="button"
                    disabled={virtualBusy}
                    onClick={() => void handleStartVirtual(c.slug, "virtual")}
                  >
                    {virtualBusy ? (
                      <Loader2
                        size={14}
                        className="animate-spin ct-icon"
                        aria-hidden
                      />
                    ) : null}
                    Start Virtual Practice
                  </Button>
                ) : null}
                {canVirtual && !virtualOk ? (
                  <span className="ct-hero-premium-hint">
                    <Badge variant="warning" className="ct-tag">
                      Premium
                    </Badge>
                    Virtual practice available with Premium
                  </span>
                ) : null}
                {board?.myEntry && !canVirtual && !canRegister ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      document
                        .getElementById("ct-leaderboard")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    View Results
                  </Button>
                ) : null}
              </div>
            </header>

            {board?.myEntry ? (
              <section className="ct-block" aria-label="Your result">
                <div className="ct-block-head">
                  <h2 className="ct-block-title">Your Result</h2>
                  <p className="ct-block-lede">How you performed in this contest.</p>
                </div>
                <div className="ct-result-grid">
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Rank</span>
                    <strong>#{board.myEntry.rank}</strong>
                  </div>
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Score</span>
                    <strong>{board.myEntry.score}</strong>
                  </div>
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Solved</span>
                    <strong>{board.myEntry.solvedCount}</strong>
                  </div>
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Penalty</span>
                    <strong>{board.myEntry.penalty}</strong>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="ct-block" aria-labelledby="ct-overview-h">
              <div className="ct-block-head">
                <p className="ct-section-kicker">Contest</p>
                <h2 className="ct-block-title" id="ct-overview-h">
                  Overview
                </h2>
                <p className="ct-block-lede">
                  Contest schedule and participation details.
                </p>
              </div>
              <div className="ct-overview-tiles">
                <div className="ct-stat-tile">
                  <span className="ct-stat-label">Start</span>
                  <strong>{formatDayTime(c.startTime)}</strong>
                </div>
                <div className="ct-stat-tile">
                  <span className="ct-stat-label">End</span>
                  <strong>{formatDayTime(c.endTime)}</strong>
                </div>
                {duration ? (
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Duration</span>
                    <strong>{duration}</strong>
                  </div>
                ) : null}
                {c.participantCount != null ? (
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Participants</span>
                    <strong>{c.participantCount}</strong>
                    <span className="ct-stat-hint">
                      {participantLabel(c.participantCount)}
                    </span>
                  </div>
                ) : null}
                {problemCount > 0 ? (
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Problems</span>
                    <strong>{problemCount}</strong>
                  </div>
                ) : null}
                {maxScore != null && maxScore > 0 ? (
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Max Score</span>
                    <strong>{maxScore}</strong>
                  </div>
                ) : null}
                {typeof c.isRegistered === "boolean" ? (
                  <div className="ct-stat-tile">
                    <span className="ct-stat-label">Registration</span>
                    <strong>
                      {c.isRegistered ? "Registered" : "Not registered"}
                    </strong>
                  </div>
                ) : null}
              </div>
            </section>

            {canVirtual ? (
              <section
                className="ct-block ct-practice-block"
                aria-labelledby="ct-practice-h"
              >
                <div className="ct-block-head">
                  <p className="ct-section-kicker">Practice</p>
                  <h2 className="ct-block-title" id="ct-practice-h">
                    Past Contest Practice
                  </h2>
                  <p className="ct-block-lede">
                    Missed the contest or want another attempt? Replay under
                    timed conditions without affecting the original ranking.
                  </p>
                </div>
                {!virtualOk ? (
                  <div className="ct-practice-premium-wrap">
                    <PremiumFeatureLock
                      feature="premium.virtual_contest"
                      title="Virtual Practice"
                      description="Replay the contest under timed conditions and test your problem-solving speed."
                      benefits={[
                        "Replay contests under timed conditions",
                        "Practice without affecting original ranking",
                        "Test and improve problem-solving speed",
                      ]}
                      onUpgradeClick={() => {
                        setPendingPremiumNav("contests", "premium.virtual_contest");
                        setUpgradeOpen(true);
                      }}
                    />
                  </div>
                ) : (
                  <div className="ct-practice-body">
                    <ul className="ct-practice-facts">
                      <li>
                        <span className="ct-stat-label">Mode</span>
                        <strong>Virtual Practice</strong>
                      </li>
                      {duration ? (
                        <li>
                          <span className="ct-stat-label">Duration</span>
                          <strong>{duration}</strong>
                        </li>
                      ) : null}
                      {problemCount > 0 ? (
                        <li>
                          <span className="ct-stat-label">Problems</span>
                          <strong>{problemCount}</strong>
                        </li>
                      ) : null}
                    </ul>
                    <p className="ct-practice-why">
                      Replay the contest under timed conditions and test your
                      problem-solving speed.
                    </p>
                    <div className="ct-practice-actions">
                      <Button
                        type="button"
                        disabled={virtualBusy}
                        onClick={() =>
                          void handleStartVirtual(c.slug, "virtual")
                        }
                      >
                        {virtualBusy ? (
                          <Loader2
                            size={14}
                            className="animate-spin ct-icon"
                            aria-hidden
                          />
                        ) : null}
                        Start Virtual Practice
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={virtualBusy}
                        onClick={() =>
                          void handleStartVirtual(c.slug, "practice")
                        }
                      >
                        Practice Mode
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            <section className="ct-block" aria-labelledby="ct-problems-h">
              <div className="ct-block-head">
                <p className="ct-section-kicker">Problems</p>
                <h2 className="ct-block-title" id="ct-problems-h">
                  Problems
                </h2>
                <p className="ct-block-lede">
                  Problems included in this contest.
                </p>
              </div>
              {!c.problems?.length ? (
                <div className="ct-inline-empty">
                  <p className="ct-inline-empty-title">
                    No problems published yet
                  </p>
                  <p className="co-muted">
                    Problems for this contest haven&apos;t been published yet.
                  </p>
                </div>
              ) : (
                <ul className="ct-problem-list">
                  {c.problems.map((entry, idx) => {
                    const payload = problemOpenPayload(entry);
                    const canOpen = Boolean(
                      onOpenProblem && (payload.id || payload.slug)
                    );
                    const diff = difficultyLabel(
                      problemRef(entry)?.difficulty
                    );
                    const order = String(
                      problemOrderNumber(entry, idx)
                    ).padStart(2, "0");
                    return (
                      <li key={entry._id || idx}>
                        <button
                          type="button"
                          className="ct-problem-row"
                          disabled={!canOpen}
                          aria-label={`Open ${problemTitle(entry)}`}
                          onClick={() =>
                            handleOpenProblem(
                              entry,
                              c,
                              virtualSession?.status === "in_progress"
                                ? virtualSession.id
                                : undefined
                            )
                          }
                        >
                          <span className="ct-problem-order">{order}</span>
                          <span className="ct-problem-main">
                            <strong>{problemTitle(entry)}</strong>
                          </span>
                          {diff ? (
                            <Badge variant="default" className="ct-tag">
                              {diff}
                            </Badge>
                          ) : null}
                          {entry.points != null ? (
                            <span className="ct-problem-pts">
                              {entry.points} pts
                            </span>
                          ) : null}
                          {canOpen ? (
                            <ArrowRight
                              size={16}
                              strokeWidth={2}
                              aria-hidden
                              className="ct-icon ct-problem-arrow"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section
              className="ct-block"
              id="ct-leaderboard"
              aria-labelledby="ct-lb-h"
            >
              <div className="ct-block-head">
                <p className="ct-section-kicker">Rankings</p>
                <h2 className="ct-block-title" id="ct-lb-h">
                  Leaderboard
                </h2>
                <p className="ct-block-lede">
                  See how participants performed.
                </p>
              </div>
              {!board?.entries?.length ? (
                <div className="ct-inline-empty">
                  <p className="ct-inline-empty-title">No results yet</p>
                  <p className="co-muted">
                    Leaderboard results will appear as participants complete the
                    contest.
                  </p>
                </div>
              ) : (
                <div className="ct-lb-wrap">
                  <table className="ct-lb-table">
                    <thead>
                      <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">Participant</th>
                        <th scope="col">Score</th>
                        <th scope="col">Solved</th>
                        <th scope="col">Penalty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.entries.map((e) => {
                        const isYou = board.myEntry?.userId === e.userId;
                        const label = isYou
                          ? "You"
                          : `Participant ${String(e.userId).slice(-6)}`;
                        return (
                          <tr
                            key={`${e.userId}-${e.rank}`}
                            className={cn(
                              "ct-lb-row",
                              e.rank <= 3 && `ct-lb-top-${e.rank}`,
                              isYou && "ct-lb-you"
                            )}
                          >
                            <td className="ct-lb-rank">#{e.rank}</td>
                            <td>
                              <span className="ct-lb-user">
                                <span className="ct-lb-avatar" aria-hidden>
                                  {isYou
                                    ? "YO"
                                    : participantInitials(String(e.userId))}
                                </span>
                                <span>{label}</span>
                              </span>
                            </td>
                            <td className="ct-lb-num">{e.score}</td>
                            <td className="ct-lb-num">{e.solvedCount}</td>
                            <td className="ct-lb-num">{e.penalty}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="ct-fineprint">
                <Info size={12} strokeWidth={2} aria-hidden className="ct-icon" />
                Rating updates are calculated server-side after the live contest
                ends.
              </p>
            </section>
          </div>
        ) : (
          <EmptyState
            title="Contest not found"
            description="This contest may have been removed or is no longer available."
            action={
              <Button type="button" onClick={() => setSelectedSlug(null)}>
                <ArrowLeft size={14} strokeWidth={2} aria-hidden className="ct-icon" />
                Back to Contests
              </Button>
            }
          />
        )}
      </div>
    );
  }

  /* ───────────── LIST VIEW ───────────── */
  return (
    <div className="co-page ct-page">
      <header className="co-header ct-header">
        <div>
          <p className="co-kicker">Contests</p>
          <h1 className="co-title">
            <Trophy
              size={22}
              strokeWidth={2}
              aria-hidden
              className="ct-icon"
            />
            Contests
          </h1>
          <p className="co-lede">
            Compete, solve problems, and climb the leaderboard.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || refreshing}
          aria-label="Refresh contests"
          onClick={() => void load({ soft: true })}
        >
          <RefreshCw
            size={14}
            strokeWidth={2}
            aria-hidden
            className={refreshing ? "ct-icon ct-spin" : "ct-icon"}
          />
        </Button>
      </header>

      {error ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden className="ct-icon" />
          <div>
            <strong>Unable to load contests</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => void load({ soft: true })}>
            Retry
          </button>
        </div>
      ) : null}

      {virtualSession?.status === "in_progress" ? (
        <section className="co-panel ct-virtual-bar" aria-live="polite">
          <div>
            <p className="ct-section-kicker">Active Virtual Contest</p>
            <strong>{virtualSession.sourceContestSlug}</strong>
            <span className="ct-virtual-timer">
              {formatMs(virtualSession.remainingMs)} remaining
            </span>
          </div>
          <div className="ct-virtual-actions">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={virtualBusy}
              onClick={() => void finishVirtual(virtualSession.id)}
            >
              Finish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={virtualBusy}
              onClick={() =>
                void virtualContestApi
                  .abandon(virtualSession.id)
                  .then((r) => {
                    setVirtualSession(r.data);
                    setVirtualAnalytics(null);
                    onVirtualSessionChange?.(null);
                  })
              }
            >
              Abandon
            </Button>
          </div>
        </section>
      ) : null}

      {virtualAnalytics ? (
        <section className="co-panel ct-section">
          <p className="ct-section-kicker">Virtual Contest Analytics</p>
          <p className="co-muted">
            Solved {virtualAnalytics.breakdown.solvedCount} · Attempted{" "}
            {virtualAnalytics.breakdown.attemptedCount} · Unsolved{" "}
            {virtualAnalytics.breakdown.unsolvedCount} · Mode{" "}
            {virtualAnalytics.breakdown.mode} · Rating impact:{" "}
            {virtualAnalytics.breakdown.ratingImpact}
          </p>
          {(virtualAnalytics.recommendations || []).length ? (
            <ul className="ct-rec-list">
              {virtualAnalytics.recommendations.map((rec, i) => (
                <li key={`${rec.title}-${i}`}>
                  <strong>{rec.title}</strong>
                  <span>
                    {" "}
                    — {rec.evidence}. {rec.action}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {authenticated && history ? (
        <section className="co-panel ct-stats-card" aria-label="Your contest stats">
          <p className="ct-section-kicker">Your Contest Stats</p>
          <div className="ct-stats-grid">
            <div className="ct-stat">
              <span className="ct-stat-label">Contests</span>
              <strong>{history.contestsEntered}</strong>
            </div>
            <div className="ct-stat">
              <span className="ct-stat-label">Solved</span>
              <strong>{history.totalSolved}</strong>
            </div>
            <div className="ct-stat">
              <span className="ct-stat-label">Total Score</span>
              <strong>{history.totalScore}</strong>
            </div>
            <div className="ct-stat">
              <span className="ct-stat-label">Best Rank</span>
              <strong>{bestRank != null ? `#${bestRank}` : "—"}</strong>
            </div>
          </div>
          {(history.items || []).length === 0 ? (
            <div className="ct-history-empty">
              <p className="ct-history-empty-title">No contest history yet</p>
              <p className="co-muted">
                {contests.some((c) => statusDisplay(c.status).tone !== "ended")
                  ? "Join an upcoming contest to start building your competitive profile."
                  : "Your contest activity will appear here after you participate."}
              </p>
            </div>
          ) : (
            <ul className="ct-history-list" aria-label="Recent contests">
              {history.items.slice(0, 6).map((item) => (
                <li key={item.contestId}>
                  <button
                    type="button"
                    className="ct-history-row"
                    disabled={!item.slug}
                    onClick={() => item.slug && setSelectedSlug(item.slug)}
                  >
                    <span className="ct-history-title">
                      {item.title || item.slug || "Contest"}
                    </span>
                    <span className="ct-history-meta">
                      {[
                        item.rank != null ? `Rank #${item.rank}` : null,
                        `Score ${item.score}`,
                        `Solved ${item.solvedCount}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="ct-filters" role="tablist" aria-label="Contest status">
        {(
          [
            { id: "all", label: "All" },
            { id: "upcoming", label: "Upcoming" },
            { id: "live", label: "Live" },
            { id: "ended", label: "Ended" },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={statusFilter === f.id}
            className={
              statusFilter === f.id ? "ct-chip ct-chip-active" : "ct-chip"
            }
            onClick={() => setStatusFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && !refreshing ? (
        <div className="ct-list" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] w-full" />
          ))}
        </div>
      ) : filteredContests.length === 0 ? (
        <EmptyState
          title={
            contests.length === 0
              ? "No contests available"
              : "No contests in this filter"
          }
          description={
            contests.length === 0
              ? "Check back soon for upcoming competitions."
              : "Try another status filter to see more contests."
          }
          icon={<Trophy size={22} strokeWidth={1.75} aria-hidden />}
        />
      ) : (
        <ul
          className={
            refreshing ? "ct-list ct-list-refreshing" : "ct-list"
          }
        >
          {filteredContests.map((c) => {
            const duration = formatDuration(c.durationMinutes);
            const hist = historyBySlug.get(c.slug);
            const meta = [
              formatRange(c.startTime, c.endTime),
              duration,
              participantLabel(c.participantCount),
            ].filter(Boolean);

            return (
              <li key={c.slug}>
                <button
                  type="button"
                  className="co-panel ct-card"
                  onClick={() => setSelectedSlug(c.slug)}
                >
                  <div className="ct-card-top">
                    <ContestStatusTag status={c.status} />
                    {c.isRegistered || hist ? (
                      <Badge variant="success" className="ct-tag">
                        {hist ? "Participated" : "Registered"}
                      </Badge>
                    ) : null}
                  </div>
                  <strong className="ct-card-title">{c.title}</strong>
                  {c.description ? (
                    <p className="ct-card-desc">{c.description}</p>
                  ) : null}
                  <p className="ct-card-meta">{meta.join(" · ")}</p>
                  {hist ? (
                    <div className="ct-card-result">
                      <span className="ct-stat-label">Your Result</span>
                      <span>
                        {[
                          hist.rank != null ? `Rank #${hist.rank}` : null,
                          `Score ${hist.score}`,
                          `Solved ${hist.solvedCount}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  ) : null}
                  <span className="ct-card-cta" aria-hidden>
                    View contest
                    <ArrowRight size={14} strokeWidth={2} className="ct-icon" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <PremiumUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="premium.virtual_contest"
        title="Virtual Practice is a Premium feature"
        description="Upgrade to Premium to unlock virtual replay of ended contests."
      />
    </div>
  );
};
