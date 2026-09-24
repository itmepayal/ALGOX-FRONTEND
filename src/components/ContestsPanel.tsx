import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  Clock,
  Crown,
  FileCode,
  Info,
  Loader2,
  Medal,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
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
      {tone === "live" ? <span className="ct-live-dot" aria-hidden /> : null}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [virtualSession, setVirtualSession] =
    useState<VirtualContestSession | null>(null);
  const [virtualBusy, setVirtualBusy] = useState(false);
  const [virtualAnalytics, setVirtualAnalytics] =
    useState<VirtualContestAnalytics | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const onVirtualSessionChangeRef = useRef(onVirtualSessionChange);
  useEffect(() => {
    onVirtualSessionChangeRef.current = onVirtualSessionChange;
  }, [onVirtualSessionChange]);

  const contestsRef = useRef(contests);
  useEffect(() => {
    contestsRef.current = contests;
  }, [contests]);

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
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "upcoming"
            ? tone === "upcoming"
            : statusFilter === "live"
              ? tone === "live"
              : tone === "ended";

      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    });
  }, [contests, statusFilter, searchQuery]);

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
        onVirtualSessionChangeRef.current?.(null);
        await loadVirtualAnalytics(sessionId);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err?.message || "Unable to finish session."
        );
      } finally {
        setVirtualBusy(false);
      }
    },
    [loadVirtualAnalytics]
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
      const isInitial = contestsRef.current.length === 0;
      if (opts?.soft || !isInitial) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const res = await contestApi.listContests();
        const newContests = res.data || [];
        setContests(newContests);
        contestsRef.current = newContests;
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
              onVirtualSessionChangeRef.current?.(active.data?.id || null);
            } catch {
              setVirtualSession(null);
            }
          }
        }
      } catch {
        setError("Unable to load contests right now.");
        if (contestsRef.current.length === 0) setContests([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authenticated, virtualOk]
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
        {/* BREADCRUMB */}
        <nav className="ct-breadcrumb" aria-label="Breadcrumb">
          <button
            type="button"
            className="ct-crumb-link"
            onClick={() => setSelectedSlug(null)}
          >
            <ArrowLeft size={13} aria-hidden />
            <span>Contests</span>
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
            {/* HERO CARD */}
            <header className="co-dir-card ct-hero-card">
              <div className="ct-hero-content">
                <div className="ct-hero-top-badges">
                  <ContestStatusTag status={c.status} />
                  {c.isRegistered ? (
                    <Badge variant="success" className="ct-tag">
                      Registered
                    </Badge>
                  ) : null}
                </div>
                <h1 className="co-title text-xl sm:text-2xl lg:text-3xl">{c.title}</h1>
                {c.description ? (
                  <p className="co-lede max-w-3xl">{c.description}</p>
                ) : null}

                <div className="ct-hero-meta-row">
                  <span className="ct-hero-meta-item">
                    <Calendar size={14} className="ct-icon-accent" aria-hidden />
                    {formatRange(c.startTime, c.endTime)}
                  </span>
                  {duration ? (
                    <span className="ct-hero-meta-item">
                      <Clock size={14} className="ct-icon-accent" aria-hidden />
                      {duration}
                    </span>
                  ) : null}
                  {problemCount > 0 ? (
                    <span className="ct-hero-meta-item">
                      <FileCode size={14} className="ct-icon-accent" aria-hidden />
                      {problemCount} {problemCount === 1 ? "problem" : "problems"}
                    </span>
                  ) : null}
                  {c.participantCount != null ? (
                    <span className="ct-hero-meta-item">
                      <Users size={14} className="ct-icon-accent" aria-hidden />
                      {participants}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="ct-hero-actions-panel">
                {canRegister ? (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={registering === c.slug}
                    onClick={() => void handleRegister(c.slug)}
                  >
                    {registering === c.slug
                      ? "Registering…"
                      : c.status === "LIVE"
                        ? "Enter Contest"
                        : "Register for Contest"}
                  </Button>
                ) : null}

                {canEnterLive ? (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full sm:w-auto bg-success hover:bg-success/90 text-white gap-2"
                    onClick={() => {
                      document
                        .getElementById("ct-problems-h")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <Play size={16} aria-hidden />
                    Enter Live Contest
                  </Button>
                ) : null}

                {canVirtual && virtualOk ? (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full sm:w-auto gap-2"
                    disabled={virtualBusy}
                    onClick={() => void handleStartVirtual(c.slug, "virtual")}
                  >
                    {virtualBusy ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                    ) : (
                      <Play size={16} aria-hidden />
                    )}
                    Start Virtual Practice
                  </Button>
                ) : null}

                {canVirtual && !virtualOk ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto gap-2 text-warning border-warning/30 hover:border-warning/60"
                    onClick={() => {
                      setPendingPremiumNav("contests", "premium.virtual_contest");
                      setUpgradeOpen(true);
                    }}
                  >
                    <Crown size={16} className="text-warning" aria-hidden />
                    Unlock Virtual Replay
                  </Button>
                ) : null}

                {c.status === "ENDED" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto gap-2"
                    onClick={() =>
                      document
                        .getElementById("ct-leaderboard")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    <Trophy size={16} aria-hidden />
                    View Final Results
                  </Button>
                )}
              </div>
            </header>

            {/* CONTEST STATE BANNER */}
            {c.status === "ENDED" || c.status === "ARCHIVED" ? (
              <div className="ct-state-banner ct-state-ended">
                <div className="ct-state-banner-left">
                  <Badge variant="default" className="ct-tag ct-tag-ended">
                    ENDED
                  </Badge>
                  <div>
                    <h4 className="ct-state-title">Contest Completed</h4>
                    <p className="co-muted text-xs sm:text-sm">
                      Final leaderboard rankings and performance results are available.
                    </p>
                  </div>
                </div>
                <div className="ct-state-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      document
                        .getElementById("ct-leaderboard")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    View Leaderboard
                  </Button>
                  {virtualOk ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleStartVirtual(c.slug, "virtual")}
                    >
                      Practice Contest
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-warning border-warning/30"
                      onClick={() => {
                        setPendingPremiumNav("contests", "premium.virtual_contest");
                        setUpgradeOpen(true);
                      }}
                    >
                      <Crown size={14} className="text-warning mr-1" />
                      Practice Contest (Premium)
                    </Button>
                  )}
                </div>
              </div>
            ) : c.status === "LIVE" ? (
              <div className="ct-state-banner ct-state-live">
                <div className="ct-state-banner-left">
                  <Badge variant="success" className="ct-tag ct-tag-live">
                    <span className="ct-live-dot" aria-hidden />
                    LIVE NOW
                  </Badge>
                  <div>
                    <h4 className="ct-state-title">Contest is Live</h4>
                    <p className="co-muted text-xs sm:text-sm">
                      Solve problems now to earn points and climb the live leaderboard.
                    </p>
                  </div>
                </div>
                {canEnterLive ? (
                  <Button
                    type="button"
                    className="bg-success hover:bg-success/90 text-white"
                    size="sm"
                    onClick={() =>
                      document
                        .getElementById("ct-problems-h")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    <Play size={14} aria-hidden />
                    Enter Contest
                  </Button>
                ) : canRegister ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={registering === c.slug}
                    onClick={() => void handleRegister(c.slug)}
                  >
                    {registering === c.slug ? "Registering…" : "Register & Enter"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="ct-state-banner ct-state-upcoming">
                <div className="ct-state-banner-left">
                  <Badge variant="primary" className="ct-tag ct-tag-upcoming">
                    UPCOMING
                  </Badge>
                  <div>
                    <h4 className="ct-state-title">Scheduled Contest</h4>
                    <p className="co-muted text-xs sm:text-sm">
                      Starts {formatDayTime(c.startTime)}. Register early to prepare.
                    </p>
                  </div>
                </div>
                {canRegister ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={registering === c.slug}
                    onClick={() => void handleRegister(c.slug)}
                  >
                    {registering === c.slug ? "Registering…" : "Register"}
                  </Button>
                ) : c.isRegistered ? (
                  <Badge variant="success" className="ct-tag py-1 px-3">
                    ✓ Registered
                  </Badge>
                ) : null}
              </div>
            )}

            {/* YOUR RESULT BLOCK IF PARTICIPATED */}
            {board?.myEntry ? (
              <section className="ct-block" aria-label="Your result">
                <div className="co-section-head">
                  <p className="co-kicker">PERSONAL SUMMARY</p>
                  <h2 className="co-title text-lg">Your Result</h2>
                  <p className="co-lede">How you performed in this contest.</p>
                </div>
                <div className="ct-overview-grid">
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <Trophy size={15} className="ct-icon-accent text-warning" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">RANK</span>
                    </div>
                    <strong className="ct-overview-value font-mono">#{board.myEntry.rank}</strong>
                  </div>
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <Award size={15} className="ct-icon-accent" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">SCORE</span>
                    </div>
                    <strong className="ct-overview-value font-mono">{board.myEntry.score}</strong>
                  </div>
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <FileCode size={15} className="ct-icon-accent" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">SOLVED</span>
                    </div>
                    <strong className="ct-overview-value font-mono">{board.myEntry.solvedCount}</strong>
                  </div>
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <Timer size={15} className="ct-icon-accent" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">PENALTY</span>
                    </div>
                    <strong className="ct-overview-value font-mono">{board.myEntry.penalty}</strong>
                  </div>
                </div>
              </section>
            ) : null}

            {/* OVERVIEW SECTION */}
            <section className="ct-block" aria-labelledby="ct-overview-h">
              <div className="co-section-head">
                <p className="co-kicker">CONTEST INFORMATION</p>
                <h2 className="co-title text-lg" id="ct-overview-h">
                  Overview
                </h2>
                <p className="co-lede">
                  Key schedule, participation and scoring parameters.
                </p>
              </div>

              <div className="ct-overview-grid">
                <div className="ct-overview-card">
                  <div className="ct-overview-card-header">
                    <Calendar size={15} className="ct-icon-accent" aria-hidden />
                    <span className="co-kicker text-[10px] mb-0">START</span>
                  </div>
                  <strong className="ct-overview-value">{formatDayTime(c.startTime)}</strong>
                </div>

                <div className="ct-overview-card">
                  <div className="ct-overview-card-header">
                    <Clock size={15} className="ct-icon-accent" aria-hidden />
                    <span className="co-kicker text-[10px] mb-0">END</span>
                  </div>
                  <strong className="ct-overview-value">{formatDayTime(c.endTime)}</strong>
                </div>

                {duration ? (
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <Timer size={15} className="ct-icon-accent" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">DURATION</span>
                    </div>
                    <strong className="ct-overview-value">{duration}</strong>
                  </div>
                ) : null}

                {c.participantCount != null ? (
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <Users size={15} className="ct-icon-accent" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">PARTICIPANTS</span>
                    </div>
                    <strong className="ct-overview-value">{c.participantCount}</strong>
                  </div>
                ) : null}

                {problemCount > 0 ? (
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <FileCode size={15} className="ct-icon-accent" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">PROBLEMS</span>
                    </div>
                    <strong className="ct-overview-value">{problemCount}</strong>
                  </div>
                ) : null}

                {maxScore != null && maxScore > 0 ? (
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <Award size={15} className="ct-icon-accent" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">MAX SCORE</span>
                    </div>
                    <strong className="ct-overview-value">{maxScore} pts</strong>
                  </div>
                ) : null}

                {typeof c.isRegistered === "boolean" ? (
                  <div className="ct-overview-card">
                    <div className="ct-overview-card-header">
                      <UserCheck size={15} className="ct-icon-accent" aria-hidden />
                      <span className="co-kicker text-[10px] mb-0">REGISTRATION</span>
                    </div>
                    <strong className={cn("ct-overview-value", c.isRegistered ? "text-success" : "")}>
                      {c.isRegistered ? "Registered" : "Not registered"}
                    </strong>
                  </div>
                ) : null}
              </div>
            </section>

            {/* PREMIUM VIRTUAL PRACTICE SECTION — COMPACT CTA CARD */}
            {canVirtual ? (
              <section className="ct-block" aria-labelledby="ct-practice-h">
                <div className="co-section-head">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="co-kicker mb-0">PREMIUM FEATURE</p>
                    <Badge variant="warning" className="ct-tag">
                      <Crown size={11} className="mr-1 inline" /> Premium
                    </Badge>
                  </div>
                  <h2 className="co-title text-lg" id="ct-practice-h">
                    Virtual Practice
                  </h2>
                  <p className="co-lede">
                    Replay this contest under timed conditions without affecting original standings.
                  </p>
                </div>

                {!virtualOk ? (
                  <div className="ct-premium-cta-banner">
                    <div className="ct-premium-cta-info">
                      <div className="ct-premium-cta-icon-wrap" aria-hidden>
                        <Crown size={20} className="text-warning" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-foreground">
                            Virtual Practice Replay
                          </strong>
                          <Badge variant="warning" className="ct-tag">
                            Premium
                          </Badge>
                        </div>
                        <p className="co-muted text-xs sm:text-sm mt-0.5 max-w-2xl">
                          Replay this contest under timed conditions without affecting original standings.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="ct-premium-cta-btn text-warning border-warning/30 hover:border-warning/60 gap-1.5 shrink-0"
                      onClick={() => {
                        setPendingPremiumNav("contests", "premium.virtual_contest");
                        setUpgradeOpen(true);
                      }}
                    >
                      <span>Upgrade to Premium</span>
                      <ArrowRight size={14} aria-hidden />
                    </Button>
                  </div>
                ) : (
                  <div className="ct-premium-cta-banner">
                    <div className="ct-premium-cta-info">
                      <div className="ct-premium-cta-icon-wrap" aria-hidden>
                        <Play size={18} className="ct-icon-accent" />
                      </div>
                      <div>
                        <strong className="text-sm font-bold text-foreground">
                          Virtual Practice Mode
                        </strong>
                        <p className="co-muted text-xs sm:text-sm mt-0.5 max-w-2xl">
                          Replay this contest under timed conditions without affecting original standings.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        disabled={virtualBusy}
                        onClick={() => void handleStartVirtual(c.slug, "virtual")}
                        className="gap-1.5"
                      >
                        {virtualBusy ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden />
                        ) : (
                          <Play size={14} aria-hidden />
                        )}
                        <span>Start Virtual Practice</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={virtualBusy}
                        onClick={() => void handleStartVirtual(c.slug, "practice")}
                      >
                        Practice Mode
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {/* PROBLEMS SECTION */}
            <section className="ct-block" aria-labelledby="ct-problems-h">
              <div className="co-section-head">
                <p className="co-kicker">CHALLENGE SET</p>
                <h2 className="co-title text-lg" id="ct-problems-h">
                  Problems
                </h2>
                <p className="co-lede">
                  Problems included in this competition.
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
                <div className="ct-problems-list">
                  {c.problems.map((entry, idx) => {
                    const payload = problemOpenPayload(entry);
                    const canOpen = Boolean(
                      onOpenProblem && (payload.id || payload.slug)
                    );
                    const diff = difficultyLabel(
                      problemRef(entry)?.difficulty
                    );
                    const order = `#${String(
                      problemOrderNumber(entry, idx)
                    ).padStart(2, "0")}`;

                    const diffVariant =
                      diff?.toLowerCase() === "easy"
                        ? "success"
                        : diff?.toLowerCase() === "medium"
                          ? "warning"
                          : diff?.toLowerCase() === "hard"
                            ? "danger"
                            : "default";

                    return (
                      <div
                        key={entry._id || idx}
                        className={cn(
                          "ct-problem-row",
                          canOpen && "ct-problem-row-interactive"
                        )}
                        onClick={() => {
                          if (canOpen) {
                            handleOpenProblem(
                              entry,
                              c,
                              virtualSession?.status === "in_progress"
                                ? virtualSession.id
                                : undefined
                            );
                          }
                        }}
                      >
                        <span className="ct-problem-num">{order}</span>
                        <div className="ct-problem-title-cell">
                          <strong className="ct-problem-title">
                            {problemTitle(entry)}
                          </strong>
                        </div>
                        {diff ? (
                          <Badge variant={diffVariant} className="ct-tag">
                            {diff}
                          </Badge>
                        ) : null}
                        {entry.points != null ? (
                          <span className="ct-problem-pts font-mono">
                            {entry.points} pts
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canOpen}
                          className="ct-problem-btn gap-1.5"
                        >
                          <span>Open Problem</span>
                          <ArrowRight size={14} aria-hidden />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* LEADERBOARD SECTION */}
            <section
              className="ct-block"
              id="ct-leaderboard"
              aria-labelledby="ct-lb-h"
            >
              <div className="co-section-head">
                <p className="co-kicker">STANDINGS</p>
                <h2 className="co-title text-lg" id="ct-lb-h">
                  Leaderboard
                </h2>
                <p className="co-lede">
                  Competitive programming rankings based on score and penalty time.
                </p>
              </div>

              {!board?.entries?.length ? (
                <div className="ct-inline-empty">
                  <p className="ct-inline-empty-title">No results yet</p>
                  <p className="co-muted">
                    Leaderboard results will appear as participants submit solutions.
                  </p>
                </div>
              ) : (
                <div className="ct-lb-container">
                  <div className="ct-lb-table-wrapper">
                    <table className="ct-lb-table">
                      <thead>
                        <tr>
                          <th scope="col" className="ct-lb-th-rank">Rank</th>
                          <th scope="col">Participant</th>
                          <th scope="col" className="ct-lb-th-num">Score</th>
                          <th scope="col" className="ct-lb-th-num">Solved</th>
                          <th scope="col" className="ct-lb-th-num">Penalty</th>
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
                                "ct-lb-tr",
                                e.rank === 1 && "ct-lb-top-1",
                                e.rank === 2 && "ct-lb-top-2",
                                e.rank === 3 && "ct-lb-top-3",
                                isYou && "ct-lb-you"
                              )}
                            >
                              <td className="ct-lb-td-rank font-mono">
                                {e.rank === 1 ? (
                                  <span className="ct-rank-badge ct-rank-gold">
                                    <Trophy size={13} aria-hidden /> #1
                                  </span>
                                ) : e.rank === 2 ? (
                                  <span className="ct-rank-badge ct-rank-silver">
                                    <Medal size={13} aria-hidden /> #2
                                  </span>
                                ) : e.rank === 3 ? (
                                  <span className="ct-rank-badge ct-rank-bronze">
                                    <Medal size={13} aria-hidden /> #3
                                  </span>
                                ) : (
                                  `#${e.rank}`
                                )}
                              </td>
                              <td>
                                <div className="ct-lb-user">
                                  <span className="ct-lb-avatar" aria-hidden>
                                    {isYou
                                      ? "YOU"
                                      : participantInitials(String(e.userId))}
                                  </span>
                                  <span className="ct-lb-username">{label}</span>
                                  {isYou ? (
                                    <Badge variant="primary" className="text-[10px] py-0 px-1.5 h-4 ml-1">
                                      You
                                    </Badge>
                                  ) : null}
                                </div>
                              </td>
                              <td className="ct-lb-num font-mono font-bold text-foreground">{e.score}</td>
                              <td className="ct-lb-num font-mono">{e.solvedCount}</td>
                              <td className="ct-lb-num font-mono text-muted-foreground">{e.penalty}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="ct-fineprint">
                    <Info size={13} strokeWidth={2} aria-hidden className="ct-icon" />
                    Rating updates are calculated server-side after the live contest ends.
                  </p>
                </div>
              )}
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
      {/* DASHBOARD HEADER */}
      <header className="co-header">
        <div>
          <p className="co-kicker">COMPETITIVE PROGRAMMING</p>
          <h1 className="co-title">
            <Trophy size={22} strokeWidth={2} aria-hidden className="ct-icon text-primary" />
            Contests
          </h1>
          <p className="co-lede">
            Challenge yourself, improve your rating, and compete with the AlgoPath community.
          </p>
        </div>
        <div className="ct-header-actions">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading || refreshing}
            aria-label="Refresh contests"
            onClick={() => void load({ soft: true })}
            className="gap-2"
          >
            <RefreshCw
              size={14}
              strokeWidth={2}
              aria-hidden
              className={refreshing ? "ct-spin" : ""}
            />
            <span>Refresh</span>
          </Button>
        </div>
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

      {/* ACTIVE VIRTUAL CONTEST BAR */}
      {virtualSession?.status === "in_progress" ? (
        <section className="ct-virtual-bar" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15 border border-primary/20 text-primary-bright">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="co-kicker mb-0">ACTIVE VIRTUAL CONTEST</p>
              <strong className="text-foreground text-sm font-semibold">{virtualSession.sourceContestSlug}</strong>
              <span className="ct-virtual-timer">
                {formatMs(virtualSession.remainingMs)} remaining
              </span>
            </div>
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

      {/* VIRTUAL ANALYTICS REPORT */}
      {virtualAnalytics ? (
        <section className="co-panel ct-section">
          <p className="co-kicker">VIRTUAL CONTEST ANALYTICS</p>
          <p className="co-muted text-xs sm:text-sm">
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

      {/* STATS CARDS SECTION */}
      <section className="ct-stats-section" aria-label="Your contest stats">
        <div className="co-section-head">
          <p className="co-kicker">OVERVIEW</p>
          <h2 className="co-title text-lg">Your Contest Stats</h2>
        </div>

        <div className="ct-stats-grid">
          {/* 1. Total Contests */}
          <div className="ct-stat-card">
            <div className="ct-stat-head">
              <span className="co-kicker">TOTAL CONTESTS</span>
              <div className="ct-stat-icon-wrap" aria-hidden>
                <Trophy size={14} className="ct-icon-accent" />
              </div>
            </div>
            <div className="ct-stat-value">{contests.length}</div>
            <span className="ct-stat-hint">Platform contests</span>
          </div>

          {/* 2. Participated */}
          <div className="ct-stat-card">
            <div className="ct-stat-head">
              <span className="co-kicker">PARTICIPATED</span>
              <div className="ct-stat-icon-wrap" aria-hidden>
                <Users size={14} className="ct-icon-accent" />
              </div>
            </div>
            <div className="ct-stat-value">
              {authenticated && history ? history.contestsEntered : "—"}
            </div>
            <span className="ct-stat-hint">
              {authenticated ? "Contests entered" : "Sign in to track"}
            </span>
          </div>

          {/* 3. Problems Solved */}
          <div className="ct-stat-card">
            <div className="ct-stat-head">
              <span className="co-kicker">PROBLEMS SOLVED</span>
              <div className="ct-stat-icon-wrap" aria-hidden>
                <FileCode size={14} className="ct-icon-accent" />
              </div>
            </div>
            <div className="ct-stat-value">
              {authenticated && history ? history.totalSolved : "—"}
            </div>
            <span className="ct-stat-hint">
              {authenticated ? "In contests" : "Sign in to track"}
            </span>
          </div>

          {/* 4. Best Rank */}
          <div className="ct-stat-card">
            <div className="ct-stat-head">
              <span className="co-kicker">BEST RANK</span>
              <div className="ct-stat-icon-wrap" aria-hidden>
                <Award size={14} className="ct-icon-accent" />
              </div>
            </div>
            <div className="ct-stat-value">
              {authenticated && bestRank != null ? `#${bestRank}` : "—"}
            </div>
            <span className="ct-stat-hint">
              {authenticated && bestRank != null ? "All-time best" : "No rank yet"}
            </span>
          </div>

          {/* 5. Rating */}
          <div className="ct-stat-card">
            <div className="ct-stat-head">
              <span className="co-kicker">RATING</span>
              <div className="ct-stat-icon-wrap" aria-hidden>
                <TrendingUp size={14} className="ct-icon-accent" />
              </div>
            </div>
            <div className="ct-stat-value text-base font-semibold">
              {authenticated && ((history as any)?.rating || (user as any)?.rating)
                ? ((history as any)?.rating || (user as any)?.rating)
                : "Unrated"}
            </div>
            <span className="ct-stat-hint">
              {authenticated ? "Contest rating" : "Sign in to view"}
            </span>
          </div>
        </div>
      </section>

      {/* CONTESTS DIRECTORY SECTION */}
      <section className="ct-list-section">
        <div className="co-section-head">
          <p className="co-kicker">COMPETITIONS</p>
          <h2 className="co-title text-lg">Available Contests</h2>
        </div>

        <div className="co-toolbar-panel">
          <div className="ct-toolbar">
            <div className="ct-filter-group" role="tablist" aria-label="Contest status">
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
                  className={cn(
                    "co-chip",
                    statusFilter === f.id && "co-chip-active"
                  )}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.id === "live" && <span className="ct-live-dot mr-1" aria-hidden />}
                  {f.label}
                </button>
              ))}
            </div>

            <div className="ct-search-wrap">
              <Search size={14} className="text-muted-foreground shrink-0" aria-hidden />
              <input
                type="text"
                placeholder="Search contests…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search contests"
              />
            </div>
          </div>
        </div>

        {/* CONTEST CARDS GRID */}
        {loading && contests.length === 0 ? (
          <div className="ct-cards-grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredContests.length === 0 ? (
          <EmptyState
            title={
              contests.length === 0
                ? "No contests available"
                : searchQuery.trim()
                  ? "No matching contests found"
                  : "No contests in this filter"
            }
            description={
              contests.length === 0
                ? "Check back soon for upcoming competitions."
                : searchQuery.trim()
                  ? `No contests matching "${searchQuery}". Try another query.`
                  : "Try another status filter to see more contests."
            }
            icon={<Trophy size={22} strokeWidth={1.75} aria-hidden />}
          />
        ) : (
          <div
            className={cn(
              "ct-cards-grid",
              refreshing && "ct-grid-refreshing"
            )}
          >
            {filteredContests.map((c) => {
              const duration = formatDuration(c.durationMinutes);
              const hist = historyBySlug.get(c.slug);
              const { tone } = statusDisplay(c.status);

              return (
                <div
                  key={c.slug}
                  className={cn(
                    "co-dir-card ct-card",
                    tone === "live" && "ct-card-live"
                  )}
                  onClick={() => setSelectedSlug(c.slug)}
                >
                  <div className="ct-card-top-row">
                    <div className="ct-card-badges">
                      <ContestStatusTag status={c.status} />
                      {c.isRegistered || hist ? (
                        <Badge variant="success" className="ct-tag">
                          {hist ? "Participated" : "Registered"}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="ct-card-date-badge font-mono">
                      <Calendar size={12} aria-hidden />
                      {formatDayTime(c.startTime)}
                    </span>
                  </div>

                  <h3 className="co-title text-base sm:text-lg">{c.title}</h3>
                  {c.description ? (
                    <p className="co-lede text-xs sm:text-sm line-clamp-2">{c.description}</p>
                  ) : null}

                  <div className="ct-card-meta-row">
                    {duration ? (
                      <span className="ct-meta-item">
                        <Clock size={12} aria-hidden />
                        {duration}
                      </span>
                    ) : null}
                    {c.problems?.length ? (
                      <span className="ct-meta-item">
                        <FileCode size={12} aria-hidden />
                        {c.problems.length}{" "}
                        {c.problems.length === 1 ? "problem" : "problems"}
                      </span>
                    ) : null}
                    {c.participantCount != null ? (
                      <span className="ct-meta-item">
                        <Users size={12} aria-hidden />
                        {c.participantCount}{" "}
                        {c.participantCount === 1 ? "participant" : "participants"}
                      </span>
                    ) : null}
                  </div>

                  {hist ? (
                    <div className="ct-card-result-pill">
                      <Trophy size={13} className="text-warning shrink-0" aria-hidden />
                      <span className="font-mono text-xs">
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

                  <div className="ct-card-footer">
                    <Button
                      type="button"
                      variant={tone === "live" ? "primary" : "secondary"}
                      size="sm"
                      className="ct-card-cta-btn gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSlug(c.slug);
                      }}
                    >
                      <span>
                        {tone === "upcoming"
                          ? c.isRegistered
                            ? "View Contest"
                            : "Register"
                          : tone === "live"
                            ? "Enter Contest"
                            : "View Results"}
                      </span>
                      <ArrowRight size={14} aria-hidden />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
