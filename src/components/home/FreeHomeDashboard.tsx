import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Target,
  Trophy,
  AlertCircle,
  Flame,
  Snowflake,
  WifiOff,
} from "lucide-react";
import type { Problem } from "../../api/problemApi";
import { problemApi } from "../../api/problemApi";
import type { Submission } from "../../api/submissionApi";
import {
  engagementApi,
  type FavouriteProblem,
  type FavouriteStats,
} from "../../api/engagementApi";
import {
  sheetProgressApi,
  STRIVER_A2Z_SHEET_ID,
  type SheetProgress,
} from "../../api/sheetProgressApi";
import { progressApi, type ProgressImportStatus } from "../../api/progressApi";
import {
  challengeApi,
  type ChallengeCalendarDay,
  type DailyChallengePublic,
  type StreakView,
  type TodayChallengeResponse,
} from "../../api/challengeApi";
import {
  leaderboardApi,
  type UserLeaderboardStats,
} from "../../api/leaderboardApi";
import type { StudySession } from "../../utils/learningPersistence";
import { toDateKey } from "../../utils/learningPersistence";
import {
  buildRoadmap,
  everAcceptedProblemIds,
  type RoadmapTopic,
} from "../../utils/learningStats";
import { normalizeDifficulty } from "../../utils/problemUtils";
import { getProblemId } from "../../utils/workspacePersistence";
import {
  findProblemByIdOrSlug,
  hasChallengeProblemRef,
  resolveChallengeProblem,
} from "../../utils/challengeProblem";
import { isAcceptedStatus } from "../../utils/submissionUtils";
import { EmptyState } from "../ui/empty-state";
import { MetricCard } from "../ui/metric-card";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAuth } from "../../context/AuthContext";
import { isPremium } from "../../access/accessModel";
import { canAccess } from "../../access/canAccess";
import { authApi } from "../../api/authApi";
import { getErrorToastMessage, normalizeApiError } from "../../lib/apiError";
import { SubscriptionStatusBar } from "./SubscriptionStatusBar";
import { PremiumPreparationSection } from "./PremiumPreparationSection";
import { UpgradePrompt } from "../access/UpgradePrompt";
import type { FreeHomeNavTab } from "./types";
import "../companies/companies.css";

export type { FreeHomeNavTab } from "./types";

interface FreeHomeDashboardProps {
  userName: string;
  userId: string;
  problems: Problem[];
  submissions: Submission[];
  studySessions: StudySession[];
  loadingProblems?: boolean;
  loadingSubmissions?: boolean;
  onSelectProblem: (p: Problem) => void;
  onNavigate: (tab: FreeHomeNavTab) => void;
  refreshKey?: number;
}

type ActivityEvent = {
  key: string;
  at: number;
  dateLabel: string;
  label: string;
  detail: string;
};

function difficultyBreakdown(
  problems: Problem[],
  solvedIds: Set<string>
): { easy: number; medium: number; hard: number; total: number } {
  let easy = 0;
  let medium = 0;
  let hard = 0;
  for (const p of problems) {
    const id = getProblemId(p);
    if (!id || !solvedIds.has(id)) continue;
    const d = normalizeDifficulty(p.difficulty);
    if (d === "easy") easy += 1;
    else if (d === "medium") medium += 1;
    else if (d === "hard") hard += 1;
  }
  return { easy, medium, hard, total: easy + medium + hard };
}

function recentOfficialSubmissions(submissions: Submission[], limit = 8) {
  return [...submissions]
    .filter((s) => s.source !== "run")
    .sort((a, b) => {
      const ta = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return tb - ta;
    })
    .slice(0, limit);
}

function weakTopics(roadmap: RoadmapTopic[], limit = 5): RoadmapTopic[] {
  return [...roadmap]
    .filter((t) => t.total > 0 && t.status !== "COMPLETED")
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, limit);
}

function recommendFromWeak(
  problems: Problem[],
  weak: RoadmapTopic[],
  solvedIds: Set<string>,
  limit = 5
): Problem[] {
  const weakNames = new Set(weak.map((w) => w.name.toLowerCase()));
  const out: Problem[] = [];
  for (const p of problems) {
    const id = getProblemId(p);
    if (!id || solvedIds.has(id)) continue;
    const cat = String(p.category || "").toLowerCase();
    const tags = (p.tags || []).map((t) => String(t).toLowerCase());
    const hit =
      weakNames.has(cat) ||
      tags.some((t) => [...weakNames].some((w) => w.includes(t) || t.includes(w)));
    if (hit) out.push(p);
    if (out.length >= limit) break;
  }
  if (out.length < limit) {
    for (const p of problems) {
      const id = getProblemId(p);
      if (!id || solvedIds.has(id)) continue;
      if (out.includes(p)) continue;
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function formatDateLabel(iso?: string | number | Date | null): string {
  if (iso == null) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status?: string): string {
  if (!status) return "—";
  if (isAcceptedStatus(status)) return "Accepted";
  return status.replace(/_/g, " ");
}

function execTimeLabel(s: Submission): string {
  if (s.executionTime == null || !Number.isFinite(Number(s.executionTime))) {
    return "—";
  }
  return `${Math.round(Number(s.executionTime))} ms`;
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.min(100, Math.max(0, Math.round((n / d) * 100)));
}

function diffVariant(
  d: string
): "success" | "warning" | "danger" | "default" {
  const n = normalizeDifficulty(d);
  if (n === "easy") return "success";
  if (n === "medium") return "warning";
  if (n === "hard") return "danger";
  return "default";
}

type SectionKey =
  | "challenge"
  | "streak"
  | "sheet"
  | "progress"
  | "favourites"
  | "leaderboard";

type SectionErrors = Partial<Record<SectionKey, string>>;

const SectionError: FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  retryBusy?: boolean;
}> = ({ title, message, onRetry, retryBusy }) => (
  <div className="free-home-section-error" role="alert">
    {title ? <p className="free-home-section-error-title">{title}</p> : null}
    <p>{message}</p>
    {onRetry ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onRetry}
        disabled={retryBusy}
        aria-busy={retryBusy}
        aria-label={retryBusy ? "Retrying" : "Retry loading"}
      >
        {retryBusy ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Retrying…
          </>
        ) : (
          "Retry"
        )}
      </Button>
    ) : null}
  </div>
);

export const FreeHomeDashboard: FC<FreeHomeDashboardProps> = ({
  userName,
  userId,
  problems,
  submissions,
  studySessions,
  loadingProblems: _loadingProblems = false,
  loadingSubmissions: _loadingSubmissions = false,
  onSelectProblem,
  onNavigate,
  refreshKey = 0,
}) => {
  const { setUser, user } = useAuth();
  const premiumUser = isPremium(user);
  const [entitlementTick, setEntitlementTick] = useState(0);

  const [sheetProgress, setSheetProgress] = useState<SheetProgress | null>(null);
  const [progressStatus, setProgressStatus] =
    useState<ProgressImportStatus | null>(null);
  const [favourites, setFavourites] = useState<FavouriteProblem[]>([]);
  const [favStats, setFavStats] = useState<FavouriteStats | null>(null);
  const [lbStats, setLbStats] = useState<UserLeaderboardStats | null>(null);
  const [lbMissing, setLbMissing] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({});
  const [refreshing, setRefreshing] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [todayChallenge, setTodayChallenge] =
    useState<TodayChallengeResponse | null>(null);
  const [streakView, setStreakView] = useState<StreakView | null>(null);
  const [challengeDays, setChallengeDays] = useState<ChallengeCalendarDay[]>(
    []
  );
  const [challengeActionTone, setChallengeActionTone] = useState<
    "ok" | "err" | "incomplete" | ""
  >("");
  const [challengeActionMsg, setChallengeActionMsg] = useState("");
  const [challengeStatusRefreshing, setChallengeStatusRefreshing] =
    useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [openChallengeBusy, setOpenChallengeBusy] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [historyItems, setHistoryItems] = useState<DailyChallengePublic[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [weeklyTarget, setWeeklyTarget] = useState(5);
  const [monthlyTarget, setMonthlyTarget] = useState(20);
  const todayKey = toDateKey(new Date());
  const canFreeze = canAccess(user, "premium.streak_freeze");
  const canHistory = canAccess(user, "premium.challenge_history");

  const loadRemote = useCallback(async () => {
    if (!userId) {
      setRemoteLoading(false);
      setHasLoadedOnce(true);
      return;
    }
    setRemoteError("");
    const nextErrors: SectionErrors = {};
    try {
      const calFrom = toDateKey(new Date(Date.now() - 27 * 86400000));
      const histFrom = toDateKey(
        new Date(Date.now() - (canHistory ? 89 : 6) * 86400000)
      );
      const [
        sheetRes,
        statusRes,
        favRes,
        lbRes,
        todayRes,
        streakRes,
        calRes,
        histRes,
      ] = await Promise.allSettled([
        sheetProgressApi.getProgress(STRIVER_A2Z_SHEET_ID),
        progressApi.getStatus(),
        engagementApi.listMyFavourites({ limit: 6, page: 1, sort: "recent" }),
        leaderboardApi.getUserStats(userId),
        challengeApi.getToday(),
        challengeApi.getStreak(),
        challengeApi.getCalendar(calFrom, todayKey),
        challengeApi.getHistory(histFrom, todayKey),
      ]);

      if (sheetRes.status === "fulfilled") {
        setSheetProgress(sheetRes.value?.data ?? null);
      } else {
        nextErrors.sheet = getErrorToastMessage(sheetRes.reason);
      }
      if (statusRes.status === "fulfilled") {
        setProgressStatus(statusRes.value?.data ?? null);
      } else {
        nextErrors.progress = getErrorToastMessage(statusRes.reason);
      }
      if (favRes.status === "fulfilled") {
        const data = favRes.value?.data;
        setFavourites(data?.items || []);
        setFavStats(data?.stats || null);
      } else {
        nextErrors.favourites = getErrorToastMessage(favRes.reason);
      }
      if (lbRes.status === "fulfilled") {
        setLbStats(lbRes.value?.data ?? null);
        setLbMissing(false);
      } else {
        setLbStats(null);
        setLbMissing(true);
        nextErrors.leaderboard = getErrorToastMessage(lbRes.reason);
      }
      if (todayRes.status === "fulfilled") {
        const today = todayRes.value?.data ?? null;
        setTodayChallenge(today);
        if (today?.completed) {
          setChallengeActionTone((prev) =>
            prev === "incomplete" ? "" : prev
          );
        }
      } else {
        nextErrors.challenge =
          "We couldn't retrieve the latest challenge status. Please try again.";
      }
      if (streakRes.status === "fulfilled") {
        const streak = streakRes.value?.data ?? null;
        setStreakView(streak);
        if (streak?.weeklyGoal?.target) setWeeklyTarget(streak.weeklyGoal.target);
        if (streak?.monthlyGoal?.target)
          setMonthlyTarget(streak.monthlyGoal.target);
      } else {
        nextErrors.streak = getErrorToastMessage(streakRes.reason);
      }
      if (calRes.status === "fulfilled") {
        setChallengeDays(calRes.value?.data?.days || []);
      }
      if (histRes.status === "fulfilled") {
        setHistoryItems(histRes.value?.data?.items || []);
      }

      setSectionErrors(nextErrors);

      const hardFail =
        sheetRes.status === "rejected" &&
        statusRes.status === "rejected" &&
        favRes.status === "rejected" &&
        todayRes.status === "rejected" &&
        streakRes.status === "rejected";
      if (hardFail) {
        setRemoteError(
          "Unable to load dashboard data. Check your connection and try again."
        );
      }

    } catch (err) {
      const n = normalizeApiError(err);
      setRemoteError(`${n.title}. ${n.message}`);
    } finally {
      setRemoteLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [userId, todayKey, canHistory]);

  useEffect(() => {
    if (!hasLoadedOnce) setRemoteLoading(true);
    void loadRemote();
  }, [loadRemote, refreshKey]);

  useEffect(() => {
    const onOff = () => setOffline(true);
    const onOn = () => {
      setOffline(false);
      void loadRemote();
    };
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, [loadRemote]);

  const solvedIds = useMemo(
    () => everAcceptedProblemIds(submissions),
    [submissions]
  );

  const byDiff = useMemo(
    () => difficultyBreakdown(problems, solvedIds),
    [problems, solvedIds]
  );

  const roadmap = useMemo(
    () => buildRoadmap(problems, submissions, studySessions),
    [problems, submissions, studySessions]
  );

  const weak = useMemo(() => weakTopics(roadmap), [roadmap]);
  const recommended = useMemo(
    () => recommendFromWeak(problems, weak, solvedIds),
    [problems, weak, solvedIds]
  );
  const dailyProblem = useMemo(() => {
    const ch = todayChallenge?.challenge;
    if (!ch || ch.accessLocked) return null;
    return findProblemByIdOrSlug(problems, ch.problemId, ch.problemSlug);
  }, [todayChallenge, problems]);

  const challengeHasProblemRef = useMemo(() => {
    const ch = todayChallenge?.challenge;
    if (!ch || ch.accessLocked) return false;
    return hasChallengeProblemRef(ch);
  }, [todayChallenge]);

  const recent = useMemo(
    () => recentOfficialSubmissions(submissions),
    [submissions]
  );

  const streakCurrent = streakView?.currentStreak ?? 0;
  const streakLongest = streakView?.longestStreak ?? 0;
  const challengeDaySet = useMemo(() => {
    const m = new Map<string, ChallengeCalendarDay>();
    for (const d of challengeDays) m.set(d.dateKey, d);
    return m;
  }, [challengeDays]);

  const calendarStrip = useMemo(() => {
    const keys: string[] = [];
    for (let i = 13; i >= 0; i--) {
      keys.push(toDateKey(new Date(Date.now() - i * 86400000)));
    }
    return keys;
  }, [todayKey]);

  const activityEvents = useMemo(() => {
    const events: ActivityEvent[] = [];

    if (todayChallenge?.completed && todayChallenge.challenge) {
      const at = Date.now();
      events.push({
        key: `chal-${todayChallenge.dateKey}`,
        at,
        dateLabel: formatDateLabel(todayChallenge.dateKey),
        label: "Completed Daily Challenge",
        detail:
          todayChallenge.challenge.title ||
          dailyProblem?.title ||
          "Today's challenge",
      });
    }

    for (const s of recent.slice(0, 6)) {
      const at = new Date(s.createdAt || s.updatedAt || 0).getTime();
      if (!at) continue;
      const pid = String(s.problemId || "");
      const problem = problems.find(
        (p) => getProblemId(p) === pid || p.slug === pid
      );
      events.push({
        key: `sub-${s.id || s._id || `${pid}-${at}`}`,
        at,
        dateLabel: formatDateLabel(at),
        label: isAcceptedStatus(s.status)
          ? "Accepted solution"
          : "Submitted solution",
        detail: problem?.title || "Problem",
      });
    }

    for (const sess of studySessions.slice(0, 4)) {
      const at = Number(sess.endedAt || sess.updatedAt || sess.startedAt || 0);
      if (!at) continue;
      events.push({
        key: `sess-${sess.id}`,
        at,
        dateLabel: formatDateLabel(at),
        label:
          sess.status === "completed"
            ? "Completed study session"
            : "Study session",
        detail: sess.topic || "Practice session",
      });
    }

    for (const item of historyItems) {
      if (!item.completed) continue;
      if (item.dateKey === todayChallenge?.dateKey) continue;
      const at = new Date(`${item.dateKey}T12:00:00`).getTime();
      events.push({
        key: `hist-${item.dateKey}-${item.tier}`,
        at,
        dateLabel: formatDateLabel(item.dateKey),
        label: "Completed Daily Challenge",
        detail: item.title || "Challenge",
      });
    }

    return events.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [
    todayChallenge,
    dailyProblem,
    recent,
    problems,
    studySessions,
    historyItems,
  ]);

  const handleOpenChallengeProblem = async (
    challenge: DailyChallengePublic | null | undefined
  ) => {
    if (openChallengeBusy) return;
    setChallengeActionMsg("");
    setChallengeActionTone("");
    setOpenChallengeBusy(true);
    try {
      const result = await resolveChallengeProblem(problems, challenge, {
        getById: (id) => problemApi.getProblemById(id),
        getBySlug: (slug) => problemApi.getProblemBySlug(slug),
      });
      if (!result.ok) {
        setChallengeActionTone("err");
        setChallengeActionMsg(result.message);
        return;
      }
      onSelectProblem(result.problem);
    } finally {
      setOpenChallengeBusy(false);
    }
  };

  const handleCompleteChallenge = async () => {
    if (completeBusy || todayChallenge?.completed) return;
    setChallengeActionMsg("");
    setChallengeActionTone("");
    setCompleteBusy(true);
    try {
      const res = await challengeApi.complete();
      if (res.data) {
        setStreakView(res.data.streak);
        setTodayChallenge((prev) =>
          prev
            ? { ...prev, completed: true, dateKey: res.data!.dateKey }
            : prev
        );
        setChallengeActionTone("ok");
        setChallengeActionMsg(
          res.data.duplicate
            ? "Already completed today."
            : "Challenge completed — streak updated on server."
        );
        await loadRemote();
      }
    } catch (err) {
      const n = normalizeApiError(err);
      const msg = n.message || "";
      if (/accepted submission/i.test(msg)) {
        setChallengeActionTone("incomplete");
        setChallengeActionMsg("");
      } else {
        setChallengeActionTone("err");
        setChallengeActionMsg(
          msg && !/AxiosError|ERR_|HTTP \d|Internal Server|highlighted fields/i.test(msg)
            ? msg
            : "We couldn't mark today's challenge complete. Please try again."
        );
      }
    } finally {
      setCompleteBusy(false);
    }
  };

  const refreshChallengeStatus = async () => {
    if (challengeStatusRefreshing) return;
    setChallengeStatusRefreshing(true);
    try {
      await loadRemote();
    } finally {
      setChallengeStatusRefreshing(false);
    }
  };

  const handleFreeze = async () => {
    if (!canFreeze) return;
    setFreezeBusy(true);
    setChallengeActionTone("");
    try {
      const res = await challengeApi.useFreeze();
      if (res.data) {
        setStreakView(res.data);
        setChallengeActionTone("ok");
        await loadRemote();
      }
    } catch {
      setChallengeActionTone("err");
    } finally {
      setFreezeBusy(false);
    }
  };

  const handleSelectChallengeDay = async (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setChallengeActionTone("");
    try {
      await challengeApi.getByDate(dateKey);
    } catch {
      setChallengeActionTone("err");
    }
  };

  const continueTopic = weak[0] || roadmap.find((t) => t.total > 0) || null;

  const solvedTotal =
    progressStatus?.problemsSolved ?? lbStats?.totalSolved ?? byDiff.total;

  const easyCount = lbStats?.solvedEasy ?? byDiff.easy;
  const mediumCount = lbStats?.solvedMedium ?? byDiff.medium;
  const hardCount = lbStats?.solvedHard ?? byDiff.hard;
  const attemptedCount =
    progressStatus?.problemsAttempted ?? solvedIds.size;

  const weekDone = streakView?.weeklyGoal?.completed ?? 0;
  const weekTarget = streakView?.weeklyGoal?.target ?? weeklyTarget;
  const monthDone = streakView?.monthlyGoal?.completed ?? 0;
  const monthTarget = streakView?.monthlyGoal?.target ?? monthlyTarget;
  const dayDone = todayChallenge?.completed ? 1 : 0;

  const sheetPct = Math.min(
    100,
    Math.max(0, Math.round(Number(sheetProgress?.progress) || 0))
  );

  const bootLoading = remoteLoading && !hasLoadedOnce;

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setJustUpdated(false);
    void (async () => {
      try {
        const res = await authApi.getProfile();
        if (res.data) {
          setUser(res.data as typeof user);
          localStorage.setItem("user", JSON.stringify(res.data));
          setEntitlementTick((n) => n + 1);
        }
      } catch {
      }
      await loadRemote();
      setJustUpdated(true);
    })();
  };

  const firstName = userName ? userName.split(" ")[0] : "";
  const serverChallengeDateKey =
    todayChallenge?.dateKey || streakView?.todayKey || null;
  const challengeDateLabel = formatDateLabel(
    serverChallengeDateKey || todayKey
  );
  const challengeDiff = normalizeDifficulty(
    todayChallenge?.challenge?.difficulty || dailyProblem?.difficulty
  );
  const challengeCategory =
    todayChallenge?.challenge?.category || dailyProblem?.category || "";

  if (bootLoading) {
    return (
      <div className="co-page free-home" aria-busy="true" aria-live="polite">
        <header className="co-header free-home-welcome">
          <div>
            <Skeleton className="h-3.5 w-24 mb-1.5" />
            <Skeleton className="h-7 w-64 mb-1" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </header>

        <Skeleton className="h-14 w-full rounded-xl" />

        <div className="free-home-focus">
          <div className="free-home-card" aria-label="Loading Daily Challenge">
            <div className="free-home-card-head">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-3.5 w-24" />
            </div>

            <div className="mt-2 space-y-3">
              <Skeleton className="h-5 w-3/4 max-w-sm" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-5 w-24 rounded-md" />
              </div>
              <Skeleton className="h-3.5 w-full max-w-md" />
              <Skeleton className="h-3.5 w-4/5 max-w-sm" />
              <div className="pt-1 flex gap-2">
                <Skeleton className="h-8 w-32 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
              <div className="pt-2 flex gap-1.5 overflow-hidden">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-7 rounded-md shrink-0" />
                ))}
              </div>
            </div>
          </div>

          <div className="free-home-card free-home-progress-stack" aria-label="Loading Daily Progress">
            <div>
              <Skeleton className="h-4.5 w-32 mb-3" />
              <div className="flex justify-between items-baseline mb-2">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-12" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-12" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>

            <div className="pt-1 flex justify-between items-center">
              <div>
                <Skeleton className="h-3.5 w-24 mb-1" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        </div>
        <section aria-label="Loading Progress Overview">
          <Skeleton className="h-5 w-40 mb-3" />
          <div className="free-home-metrics">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="free-home-card space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>
        </section>

        <div className="free-home-split">
          <div className="free-home-card space-y-3" aria-label="Loading Continue Learning">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4.5 w-36" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <Skeleton className="h-5 w-48 mt-1" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-8 w-32 rounded-lg mt-2" />
          </div>

          <div className="free-home-card space-y-3" aria-label="Loading Weak Topics">
            <Skeleton className="h-4.5 w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-3.5 w-10 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getGreeting = (name?: string) => {
    const hour = new Date().getHours();
    let timeStr = "Good morning";
    if (hour >= 12 && hour < 17) timeStr = "Good afternoon";
    else if (hour >= 17) timeStr = "Good evening";
    return name ? `${timeStr}, ${name}` : timeStr;
  };

  return (
    <div
      className={`co-page free-home${refreshing ? " free-home-refreshing" : ""}`}
    >
      {/* 1. DASHBOARD HEADER */}
      <header className="co-header free-home-welcome">
        <div>
          <p className="free-home-kicker">Your learning overview</p>
          <h1 className="free-home-title">
            {getGreeting(firstName)} 👋
          </h1>
          <p className="free-home-lede">
            Your practice snapshot from real submissions and learning activity.
          </p>
        </div>
        <div className="free-home-header-actions">
          {justUpdated && !refreshing ? (
            <p className="free-home-updated" role="status">
              Updated just now
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh dashboard"
          >
            {refreshing ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Refreshing…
              </>
            ) : (
              <>
                <RefreshCw size={14} aria-hidden />
                Refresh
              </>
            )}
          </Button>
        </div>
      </header>

      {offline ? (
        <div className="free-home-offline" role="status">
          <WifiOff size={14} aria-hidden />
          You&apos;re offline. Some AlgoPath features may be unavailable.
        </div>
      ) : null}

      {/* 2. ACCOUNT / PREMIUM STATUS */}
      <SubscriptionStatusBar
        onUpgraded={() => setEntitlementTick((n) => n + 1)}
      />

      {remoteError ? (
        <div className="free-home-error-card" role="alert" aria-live="assertive">
          <div className="free-home-error-icon-wrapper">
            <AlertCircle size={20} className="free-home-error-icon" aria-hidden />
          </div>
          <div className="free-home-error-content">
            <h3 className="free-home-error-title">Unable to load dashboard data</h3>
            <p className="free-home-error-message">
              We couldn&apos;t retrieve your latest dashboard information. Check your connection and try again.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={refreshing}
            onClick={handleRefresh}
            aria-label="Retry loading dashboard data"
          >
            {refreshing ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Retrying…
              </>
            ) : (
              "Retry"
            )}
          </Button>
        </div>
      ) : null}

      <div className="free-home-focus">
        <section className="free-home-card" aria-labelledby="daily-challenge-heading">
          <div className="free-home-card-head">
            <h2 id="daily-challenge-heading">
              <Target size={16} aria-hidden /> Daily Challenge
            </h2>
            <span className="free-home-muted">
              {challengeDateLabel}
              {todayChallenge
                ? todayChallenge.completed
                  ? " · Completed"
                  : " · Not completed"
                : ""}
            </span>
          </div>

          {sectionErrors.challenge ? (
            <SectionError
              title="Unable to load today's challenge"
              message={sectionErrors.challenge}
              onRetry={() => void loadRemote()}
              retryBusy={remoteLoading || refreshing}
            />
          ) : todayChallenge?.challenge?.accessLocked ? (
            <UpgradePrompt
              feature="premium.daily_challenge_advanced"
              title="Advanced daily challenge"
            />
          ) : todayChallenge?.challenge || dailyProblem ? (
            <div className="free-home-daily-block">
              <div className="free-home-daily">
                <div>
                  <p className="free-home-daily-title">
                    {todayChallenge?.challenge?.title ||
                      dailyProblem?.title ||
                      "Today's challenge"}
                  </p>
                  <div className="free-home-meta-row">
                    {challengeDiff ? (
                      <Badge variant={diffVariant(challengeDiff)}>
                        {challengeDiff}
                      </Badge>
                    ) : null}
                    {challengeCategory ? (
                      <span className="free-home-muted">{challengeCategory}</span>
                    ) : null}
                    {todayChallenge?.completed ? (
                      <Badge variant="success">
                        <CheckCircle2 size={12} aria-hidden /> Completed
                      </Badge>
                    ) : (
                      <Badge variant="warning">Not completed</Badge>
                    )}
                  </div>
                  <p className="free-home-muted" style={{ marginTop: 6 }}>
                    {challengeActionMsg
                      ? challengeActionMsg
                      : todayChallenge?.completed
                        ? "Great work. Today's challenge is complete."
                        : challengeActionTone === "incomplete"
                          ? "Your challenge is ready — an Accepted submission is still required."
                          : "Solve today's challenge and mark it complete on the server."}
                  </p>
                </div>
                <div className="free-home-daily-actions">
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      openChallengeBusy ||
                      remoteLoading ||
                      !challengeHasProblemRef
                    }
                    aria-label={
                      openChallengeBusy
                        ? "Opening today's challenge problem"
                        : "Continue Challenge"
                    }
                    aria-busy={openChallengeBusy}
                    onClick={() =>
                      void handleOpenChallengeProblem(todayChallenge?.challenge)
                    }
                  >
                    {openChallengeBusy ? (
                      <>
                        <Loader2 size={14} className="animate-spin" aria-hidden />
                        Opening…
                      </>
                    ) : (
                      <>
                        Continue Challenge <ArrowRight size={14} aria-hidden />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      Boolean(todayChallenge?.completed) || completeBusy
                    }
                    onClick={() => void handleCompleteChallenge()}
                  >
                    {completeBusy ? (
                      <>
                        <Loader2 size={14} className="animate-spin" aria-hidden />
                        Completing…
                      </>
                    ) : todayChallenge?.completed ? (
                      <>
                        <CheckCircle2 size={14} aria-hidden /> Completed
                      </>
                    ) : (
                      "Mark complete"
                    )}
                  </Button>
                </div>
              </div>
              {!remoteLoading &&
                todayChallenge?.challenge &&
                !todayChallenge.challenge.accessLocked &&
                !challengeHasProblemRef ? (
                <div className="free-home-chal-callout is-error" role="alert">
                  <AlertCircle size={16} aria-hidden />
                  <div className="free-home-chal-callout-body">
                    <p className="free-home-chal-callout-title">
                      Unable to load today's challenge
                    </p>
                    <p className="free-home-chal-callout-desc">
                      Today&apos;s challenge problem reference could not be resolved.
                    </p>
                    <div className="free-home-chal-callout-actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={challengeStatusRefreshing || remoteLoading}
                        aria-label="Retry loading Daily Challenge"
                        onClick={() => void refreshChallengeStatus()}
                      >
                        {challengeStatusRefreshing ? (
                          <>
                            <Loader2
                              size={14}
                              className="animate-spin"
                              aria-hidden
                            />
                            Retrying…
                          </>
                        ) : (
                          "Retry"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              compact
              title="Unable to load today's challenge"
              description="Check your connection and try again."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadRemote()}
                >
                  Retry
                </Button>
              }
            />
          )}

          <div className="free-home-challenge-strip" aria-label="Challenge calendar">
            {calendarStrip.map((key) => {
              const day = challengeDaySet.get(key);
              const isToday = key === (serverChallengeDateKey || todayKey);
              const isSelected = key === selectedDateKey;
              return (
                <button
                  key={key}
                  type="button"
                  className={`free-home-chal-day${day ? ` is-${day.kind}` : ""}${isToday ? " is-today" : ""
                    }${isSelected ? " is-selected" : ""}`}
                  title={day ? `${key}: ${day.kind}` : `${key}: not started`}
                  onClick={() => void handleSelectChallengeDay(key)}
                >
                  {key.slice(8)}
                </button>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Daily Progress */}
        <section className="free-home-card free-home-progress-stack" aria-label="Daily progress">
          {sectionErrors.streak ? (
            <SectionError
              message={sectionErrors.streak}
              onRetry={() => void loadRemote()}
            />
          ) : null}
          <div>
            <h2 className="free-home-section-title" style={{ marginBottom: 8 }}>
              Daily Progress
            </h2>
            <div className="free-home-progress-metric">
              <div>
                <p className="free-home-progress-value">
                  {dayDone} / 1
                </p>
                <p className="free-home-muted">Today&apos;s challenge</p>
              </div>
              {todayChallenge?.completed ? (
                <CheckCircle2
                  size={20}
                  aria-hidden
                  style={{ color: "var(--success)" }}
                />
              ) : null}
            </div>
            <div
              className="free-home-bar"
              role="progressbar"
              aria-valuenow={dayDone}
              aria-valuemin={0}
              aria-valuemax={1}
              aria-label="Today's challenge progress"
              style={{ marginTop: 8 }}
            >
              <span style={{ width: `${dayDone * 100}%` }} />
            </div>
          </div>

          <div className="free-home-progress-goals">
            <div>
            <div className="free-home-goal-meta">
              <span>Weekly</span>
              <span>
                {weekDone} / {weekTarget}
              </span>
            </div>
            <div
              className="free-home-bar thin free-home-bar-week"
              role="progressbar"
              aria-valuenow={weekDone}
              aria-valuemin={0}
              aria-valuemax={weekTarget || 1}
              aria-label="Weekly challenge goal"
              style={{ marginTop: 4 }}
            >
              <span style={{ width: `${pct(weekDone, weekTarget)}%` }} />
            </div>
          </div>

            <div>
            <div className="free-home-goal-meta">
              <span>Monthly</span>
              <span>
                {monthDone} / {monthTarget}
              </span>
            </div>
            <div
              className="free-home-bar thin free-home-bar-month"
              role="progressbar"
              aria-valuenow={monthDone}
              aria-valuemin={0}
              aria-valuemax={monthTarget || 1}
              aria-label="Monthly challenge goal"
              style={{ marginTop: 4 }}
            >
              <span style={{ width: `${pct(monthDone, monthTarget)}%` }} />
            </div>
            </div>
          </div>
        </section>
      </div>

      {/* 4. KEY METRICS (4 columns) */}
      <section aria-label="Key Metrics">
        <div className="free-home-metrics">
          <MetricCard
            className="free-home-kpi"
            label="Problems Solved"
            value={solvedTotal}
            hint={`${attemptedCount} attempted`}
            icon={<Trophy size={16} />}
          />
          <MetricCard
            className="free-home-kpi"
            label="Current Streak"
            value={`${streakCurrent} days`}
            hint={`Longest ${streakLongest} days`}
            icon={<CalendarDays size={16} />}
          />
          <MetricCard
            className="free-home-kpi"
            label="Longest Streak"
            value={`${streakLongest} days`}
            hint="Longest streak"
            icon={<CalendarDays size={16} />}
          />
          <MetricCard
            className="free-home-kpi"
            label="Contest Rating"
            value={
              sectionErrors.leaderboard
                ? "—"
                : lbMissing || lbStats?.rating == null
                  ? "—"
                  : Math.round(Number(lbStats.rating))
            }
            hint={
              sectionErrors.leaderboard
                ? "Data unavailable"
                : lbMissing
                  ? "Data unavailable"
                  : lbStats?.globalRank
                    ? `Global rank #${lbStats.globalRank}`
                    : "From leaderboard"
            }
            icon={<Trophy size={16} />}
          />
        </div>
      </section>

      <div className="free-home-insight">
      {/* 5. PROGRESS OVERVIEW */}
      <section
        className="free-home-card free-home-overview-card free-home-insight-overview"
        aria-labelledby="progress-overview-heading"
      >
        <div className="free-home-overview-head">
          <h2 id="progress-overview-heading" className="free-home-section-title">
            Progress Overview
          </h2>
          <p className="free-home-muted">
            Track your difficulty progress, solving activity, and streak.
          </p>
        </div>
        <div className="free-home-overview-grid">
          <div className="free-home-diff-distribution">
            <h3 className="free-home-subhead">Difficulty Progress</h3>
            {solvedTotal === 0 && easyCount + mediumCount + hardCount === 0 ? (
              <p className="free-home-muted free-home-overview-empty">
                Submit an accepted solution to start tracking difficulty progress.
              </p>
            ) : (
              <div className="free-home-overview-rows">
                <div className="free-home-diff-row">
                  <div className="free-home-goal-meta">
                    <span className="free-home-diff-label is-easy">Easy</span>
                    <span>{easyCount} solved</span>
                  </div>
                  <div
                    className="free-home-overview-bar"
                    role="progressbar"
                    aria-valuenow={pct(easyCount, Math.max(1, solvedTotal))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Easy progress"
                  >
                    <span
                      className="is-easy"
                      style={{ width: `${pct(easyCount, Math.max(1, solvedTotal))}%` }}
                    />
                  </div>
                </div>
                <div className="free-home-diff-row">
                  <div className="free-home-goal-meta">
                    <span className="free-home-diff-label is-medium">Medium</span>
                    <span>{mediumCount} solved</span>
                  </div>
                  <div
                    className="free-home-overview-bar"
                    role="progressbar"
                    aria-valuenow={pct(mediumCount, Math.max(1, solvedTotal))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Medium progress"
                  >
                    <span
                      className="is-medium"
                      style={{ width: `${pct(mediumCount, Math.max(1, solvedTotal))}%` }}
                    />
                  </div>
                </div>
                <div className="free-home-diff-row">
                  <div className="free-home-goal-meta">
                    <span className="free-home-diff-label is-hard">Hard</span>
                    <span>{hardCount} solved</span>
                  </div>
                  <div
                    className="free-home-overview-bar"
                    role="progressbar"
                    aria-valuenow={pct(hardCount, Math.max(1, solvedTotal))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Hard progress"
                  >
                    <span
                      className="is-hard"
                      style={{ width: `${pct(hardCount, Math.max(1, solvedTotal))}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="free-home-streak-summary">
            <h3 className="free-home-subhead">
              <Flame size={15} aria-hidden />
              Streak &amp; Freeze
            </h3>
            <div className="free-home-streak-metrics">
              <div className="free-home-streak-metric">
                <span className="free-home-streak-label">
                  <Flame size={16} aria-hidden />
                  Current streak
                </span>
                <strong>{streakCurrent} days</strong>
              </div>
              <div className="free-home-streak-metric">
                <span className="free-home-streak-label">
                  <Trophy size={16} aria-hidden />
                  Longest streak
                </span>
                <strong>{streakLongest} days</strong>
              </div>
              <div className="free-home-streak-metric">
                <span className="free-home-streak-label">
                  <Snowflake size={13} aria-hidden />
                  Streak freeze
                </span>
                {canFreeze ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="free-home-freeze-btn"
                    disabled={freezeBusy}
                    onClick={() => void handleFreeze()}
                  >
                    <Snowflake size={12} aria-hidden /> Freeze ({streakView?.freezeBalance ?? 0})
                  </Button>
                ) : (
                  <strong>Premium</strong>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PremiumPreparationSection
        userId={userId}
        problems={problems}
        submissions={submissions}
        refreshKey={refreshKey + entitlementTick}
        onSelectProblem={onSelectProblem}
        onNavigate={onNavigate}
      />
      </div>

      {/* 2-COLUMN MAIN CONTENT GRID */}
      <div className="free-home-split">
        {/* LEFT COLUMN */}
        <div className="free-home-col">
          {/* 6. CONTINUE LEARNING */}
          <section className="free-home-card free-home-slot-continue" aria-labelledby="continue-learning-heading">
            <div className="free-home-card-head">
              <div>
                <h2 id="continue-learning-heading">Continue Learning</h2>
                <p className="free-home-muted" style={{ margin: 0 }}>Pick up where you left off.</p>
              </div>
              <button
                type="button"
                className="free-home-link"
                onClick={() => onNavigate("calendar")}
              >
                View all →
              </button>
            </div>
            {sheetProgress || continueTopic || sectionErrors.sheet ? (
              <div className="free-home-continue-block" style={{ gap: 14 }}>
                {sectionErrors.sheet ? (
                  <SectionError
                    message={sectionErrors.sheet}
                    onRetry={() => void loadRemote()}
                  />
                ) : null}
                {sheetProgress ? (
                  <>
                    <div>
                      <p className="free-home-daily-title">
                        {sheetProgress.sheetName || "AlgoPath Sheet"}
                      </p>
                      <p className="free-home-muted">Learn DSA from A to Z</p>
                    </div>
                    <div>
                      <div className="free-home-goal-meta" style={{ marginBottom: 6 }}>
                        <span>Progress</span>
                        <span>
                          {sheetProgress.completed} / {sheetProgress.total}
                          {" · "}
                          {sheetPct}%
                        </span>
                      </div>
                      <div
                        className="free-home-bar"
                        role="progressbar"
                        aria-valuenow={sheetPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Sheet progress"
                      >
                        <span style={{ width: `${sheetPct}%` }} />
                      </div>
                    </div>
                  </>
                ) : !sectionErrors.sheet ? (
                  <p className="free-home-muted">Progress unavailable</p>
                ) : null}
                {continueTopic ? (
                  <div className="free-home-topic-callout">
                    <p className="free-home-kicker">Current topic</p>
                    <p className="free-home-daily-title">{continueTopic.name}</p>
                    <p className="free-home-muted">
                      {continueTopic.solved} / {continueTopic.total}
                      {" · "}
                      {continueTopic.status.replace(/_/g, " ")}
                    </p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="free-home-continue-cta"
                  onClick={() => onNavigate("problems")}
                >
                  Continue Learning <ArrowRight size={14} aria-hidden />
                </Button>
              </div>
            ) : (
              <EmptyState
                compact
                title="No learning session yet"
                description="Start solving problems to build your learning history."
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onNavigate("problems")}
                  >
                    Explore Problems
                  </Button>
                }
              />
            )}
          </section>

          {/* 7. WEAK TOPICS */}
          <section className="free-home-card free-home-slot-weak" aria-labelledby="weak-topics-heading">
            <div className="free-home-card-head">
              <div>
                <h2 id="weak-topics-heading">Weak Topics</h2>
                <p className="free-home-muted" style={{ margin: 0 }}>Based on your actual learning activity.</p>
              </div>
              <button
                type="button"
                className="free-home-link"
                onClick={() => onNavigate(premiumUser ? "analytics" : "calendar")}
              >
                View analysis →
              </button>
            </div>
            {weak.length === 0 ? (
              <EmptyState
                compact
                title="Not enough activity yet"
                description="Solve a few problems across different topics to identify your weak areas."
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onNavigate("problems")}
                  >
                    Practice Problems
                  </Button>
                }
              />
            ) : (
              <ul className="free-home-topics">
                {weak.map((t) => (
                  <li key={t.name}>
                    <div className="free-home-topic-row">
                      <strong>{t.name}</strong>
                      <span className="free-home-muted">
                        {t.solved}/{t.total} ({t.pct}%)
                      </span>
                    </div>
                    <div
                      className="free-home-bar thin"
                      role="progressbar"
                      aria-valuenow={t.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${t.name} progress`}
                    >
                      <span style={{ width: `${t.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>

        {/* RIGHT COLUMN */}
        <div className="free-home-col">
          {/* 10. RECOMMENDED PROBLEMS */}
          <section className="free-home-card free-home-slot-recommended" aria-labelledby="recommended-heading">
            <div className="free-home-card-head">
              <h2 id="recommended-heading">Recommended Problems</h2>
              <button
                type="button"
                className="free-home-link"
                onClick={() => onNavigate("problems")}
              >
                View all →
              </button>
            </div>
            {recommended.length === 0 ? (
              <EmptyState
                compact
                title="No recommendations yet"
                description="Solve a few problems to unlock personalized recommendations."
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onNavigate("problems")}
                  >
                    Explore Problems
                  </Button>
                }
              />
            ) : (
              <ul className="free-home-list">
                {recommended.map((p) => (
                  <li key={getProblemId(p) || p.slug}>
                    <button
                      type="button"
                      className="free-home-list-row"
                      onClick={() => onSelectProblem(p)}
                    >
                      <span className="free-home-list-main">
                        <strong>{p.title}</strong>
                        <span className="free-home-muted">
                          {normalizeDifficulty(p.difficulty)}
                          {p.category ? ` · ${p.category}` : ""}
                        </span>
                        <span className="free-home-muted" style={{ fontSize: "0.75rem", display: "block", marginTop: 2 }}>
                          Recommended from your active learning topics.
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProblem(p);
                        }}
                      >
                        Practice
                      </Button>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      </div>

      <div className="free-home-trio">
          <section className="free-home-card free-home-slot-recent" aria-labelledby="recent-subs-heading">
            <div className="free-home-card-head">
              <h2 id="recent-subs-heading">Recent Submissions</h2>
              <button
                type="button"
                className="free-home-link"
                onClick={() => onNavigate("profile")}
              >
                View all →
              </button>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                compact
                title="No submissions yet"
                description="Run and submit a solution to start building your activity history."
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onNavigate("problems")}
                  >
                    Explore Problems
                  </Button>
                }
              />
            ) : (
              <ul className="free-home-list">
                {recent.map((s) => {
                  const pid = String(s.problemId || "");
                  const problem = problems.find(
                    (p) => getProblemId(p) === pid || p.slug === pid
                  );
                  return (
                    <li key={s.id || s._id || `${pid}-${s.createdAt}`}>
                      <button
                        type="button"
                        className="free-home-list-row"
                        disabled={!problem}
                        onClick={() => problem && onSelectProblem(problem)}
                      >
                        <span className="free-home-list-main">
                          <strong>{problem?.title || "Problem"}</strong>
                          <span className="free-home-muted">
                            {s.language || "—"}
                            {s.executionTime != null
                              ? ` · ${execTimeLabel(s)}`
                              : ""}
                            {" · "}
                            {formatShortTime(s.createdAt)}
                          </span>
                        </span>
                        <span
                          className={`free-home-verdict ${isAcceptedStatus(s.status) ? "ok" : "bad"
                            }`}
                        >
                          {statusLabel(s.status)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {/* 11. SAVED PROBLEMS */}
          <section className="free-home-card free-home-slot-saved" aria-labelledby="saved-heading">
            <div className="free-home-card-head">
              <div>
                <h2 id="saved-heading">Saved Problems</h2>
                <p className="free-home-muted" style={{ margin: 0 }}>
                  Your favorites, bookmarks and revision items.
                </p>
              </div>
              <button
                type="button"
                className="free-home-link"
                onClick={() => onNavigate("favourites")}
              >
                View all →
              </button>
            </div>
            <div className="free-home-saved-grid">
              <button
                type="button"
                className="free-home-saved-metric"
                onClick={() => onNavigate("favourites")}
              >
                <span className="free-home-saved-label">Favorites</span>
                <span className="free-home-saved-value">{favStats?.total ?? favourites.length}</span>
              </button>
              <button
                type="button"
                className="free-home-saved-metric"
                onClick={() => onNavigate("favourites")}
              >
                <span className="free-home-saved-label">Bookmarks</span>
                <span className="free-home-saved-value">{favourites.filter(f => f.isBookmarked).length}</span>
              </button>
              <button
                type="button"
                className="free-home-saved-metric"
                onClick={() => onNavigate("favourites")}
              >
                <span className="free-home-saved-label">Important</span>
                <span className="free-home-saved-value">{favourites.filter(f => f.isImportant).length}</span>
              </button>
              <button
                type="button"
                className="free-home-saved-metric"
                onClick={() => onNavigate("favourites")}
              >
                <span className="free-home-saved-label">Revision</span>
                <span className="free-home-saved-value">{favourites.filter(f => f.isRevision).length}</span>
              </button>
            </div>
          </section>

        {/* 12. RECENT ACTIVITY */}
        <section className="free-home-card free-home-slot-activity" aria-labelledby="activity-heading">
        <div className="free-home-card-head">
          <h2 id="activity-heading">Recent Activity</h2>
        </div>
        {activityEvents.length === 0 ? (
          <EmptyState
            compact
            title="No recent activity"
            description="Your submissions and completed learning sessions will appear here."
            action={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onNavigate("problems")}
              >
                Explore Problems
              </Button>
            }
          />
        ) : (
          <ul className="free-home-timeline">
            {activityEvents.map((ev) => (
              <li key={ev.key}>
                <span className="free-home-timeline-dot" aria-hidden />
                <div>
                  <p className="free-home-timeline-date">{ev.dateLabel}</p>
                  <p className="free-home-timeline-label">{ev.label}</p>
                  <p className="free-home-timeline-detail">{ev.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        </section>
      </div>
    </div>
  );
};
