import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
  ArrowRight,
  AlertTriangle,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Target,
  Trophy,
  AlertCircle,
  Snowflake,
  Medal,
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
import { learningApi } from "../../api/learningApi";
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
import type { DailyPlan, StudySession } from "../../utils/learningPersistence";
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
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
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
  const [challengeAction, setChallengeAction] = useState("");
  const [challengeActionTone, setChallengeActionTone] = useState<
    "ok" | "err" | "incomplete" | ""
  >("");
  const [challengeRetryKind, setChallengeRetryKind] = useState<
    "complete" | "open" | "refresh" | null
  >(null);
  const [challengeRetryTarget, setChallengeRetryTarget] =
    useState<DailyChallengePublic | null>(null);
  const [challengeStatusRefreshing, setChallengeStatusRefreshing] =
    useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [openChallengeBusy, setOpenChallengeBusy] = useState(false);
  const [goalsBusy, setGoalsBusy] = useState(false);
  const [syncTzBusy, setSyncTzBusy] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [historyItems, setHistoryItems] = useState<DailyChallengePublic[]>([]);
  const [historyLocked, setHistoryLocked] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<{
    dateKey: string;
    completed: boolean;
    challenge: DailyChallengePublic;
  } | null>(null);
  const [weeklyTarget, setWeeklyTarget] = useState(5);
  const [monthlyTarget, setMonthlyTarget] = useState(20);
  const [goalsMsg, setGoalsMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [goalFieldErrors, setGoalFieldErrors] = useState<{
    weekly?: string;
    monthly?: string;
  }>({});
  const todayKey = toDateKey(new Date());
  const canFreeze = canAccess(user, "premium.streak_freeze");
  const canHistory = canAccess(user, "premium.challenge_history");
  const canPlanner = canAccess(user, "premium.daily_planner");

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
        planRes,
        favRes,
        lbRes,
        todayRes,
        streakRes,
        calRes,
        histRes,
      ] = await Promise.allSettled([
        sheetProgressApi.getProgress(STRIVER_A2Z_SHEET_ID),
        progressApi.getStatus(),
        canPlanner
          ? learningApi.getPlan(todayKey)
          : Promise.resolve({ data: null }),
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
      if (planRes.status === "fulfilled") {
        setTodayPlan(planRes.value?.data ?? null);
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
          setChallengeRetryKind((prev) =>
            prev === "refresh" ? null : prev
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
        setHistoryLocked(Boolean(histRes.value?.data?.historyLocked));
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
  }, [userId, todayKey, canHistory, canPlanner]);

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
    setChallengeAction("");
    setChallengeActionTone("");
    setChallengeRetryKind(null);
    setChallengeRetryTarget(challenge ?? null);
    setOpenChallengeBusy(true);
    try {
      const result = await resolveChallengeProblem(problems, challenge, {
        getById: (id) => problemApi.getProblemById(id),
        getBySlug: (slug) => problemApi.getProblemBySlug(slug),
      });
      if (!result.ok) {
        setChallengeActionTone("err");
        setChallengeAction(result.message);
        setChallengeRetryKind(
          result.reason === "missing_identifier" ||
            result.reason === "invalid_identifier"
            ? "refresh"
            : "open"
        );
        return;
      }
      onSelectProblem(result.problem);
    } finally {
      setOpenChallengeBusy(false);
    }
  };

  const handleCompleteChallenge = async () => {
    if (completeBusy || todayChallenge?.completed) return;
    setChallengeAction("");
    setChallengeActionTone("");
    setChallengeRetryKind(null);
    setChallengeRetryTarget(null);
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
        setChallengeAction(
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
        setChallengeAction("");
        setChallengeRetryKind("refresh");
      } else {
        setChallengeActionTone("err");
        setChallengeRetryKind("complete");
        setChallengeAction(
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

  const handleChallengeRetry = async () => {
    if (challengeRetryKind === "open") {
      void handleOpenChallengeProblem(
        challengeRetryTarget || todayChallenge?.challenge
      );
      return;
    }
    if (challengeRetryKind === "complete") {
      void handleCompleteChallenge();
      return;
    }
    await refreshChallengeStatus();
  };

  const handleFreeze = async () => {
    if (!canFreeze) return;
    setFreezeBusy(true);
    setChallengeAction("");
    setChallengeActionTone("");
    try {
      const res = await challengeApi.useFreeze();
      if (res.data) {
        setStreakView(res.data);
        setChallengeActionTone("ok");
        setChallengeAction("Streak freeze applied for yesterday.");
        await loadRemote();
      }
    } catch (err) {
      const n = normalizeApiError(err);
      setChallengeActionTone("err");
      setChallengeRetryKind("refresh");
      setChallengeAction(
        n.message && !/AxiosError|ERR_/i.test(n.message)
          ? n.message
          : "Could not apply streak freeze. Please try again."
      );
    } finally {
      setFreezeBusy(false);
    }
  };

  const handleSelectChallengeDay = async (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setChallengeAction("");
    setChallengeActionTone("");
    try {
      const res = await challengeApi.getByDate(dateKey);
      if (res.data) setSelectedDay(res.data);
    } catch (err) {
      const n = normalizeApiError(err);
      setSelectedDay(null);
      setChallengeActionTone("err");
      setChallengeRetryKind("refresh");
      setChallengeAction(
        n.message && !/AxiosError|ERR_/i.test(n.message)
          ? n.message
          : "Could not load that challenge date. Please try again."
      );
    }
  };

  const handleSaveGoals = async () => {
    const errors: { weekly?: string; monthly?: string } = {};
    if (!Number.isFinite(weeklyTarget) || weeklyTarget < 1 || weeklyTarget > 30) {
      errors.weekly = "Enter a weekly goal between 1 and 30.";
    }
    if (
      !Number.isFinite(monthlyTarget) ||
      monthlyTarget < 1 ||
      monthlyTarget > 90
    ) {
      errors.monthly = "Enter a monthly goal between 1 and 90.";
    }
    setGoalFieldErrors(errors);
    if (Object.keys(errors).length) {
      setGoalsMsg(null);
      return;
    }

    setGoalsBusy(true);
    setGoalsMsg(null);
    setChallengeAction("");
    setChallengeActionTone("");
    try {
      const res = await challengeApi.setGoals({
        weeklyGoalTarget: weeklyTarget,
        monthlyGoalTarget: monthlyTarget,
      });
      if (res.data) {
        setStreakView(res.data);
        setGoalsMsg({ type: "ok", text: "Goals saved successfully." });
      }
    } catch (err) {
      const n = normalizeApiError(err);
      setGoalsMsg({
        type: "err",
        text: `Unable to save goals. ${n.message || "Please try again."}`,
      });
    } finally {
      setGoalsBusy(false);
    }
  };

  const handleSyncTimezone = async () => {
    if (syncTzBusy) return;
    const detectedTz =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "";
    if (!detectedTz) {
      setChallengeActionTone("err");
      setChallengeAction("Could not detect browser timezone.");
      return;
    }

    const normDetected =
      detectedTz === "Asia/Calcutta" ? "Asia/Kolkata" : detectedTz;
    const currentSaved = streakView?.timezone || "";
    const normSaved =
      currentSaved === "Asia/Calcutta" ? "Asia/Kolkata" : currentSaved;

    if (normSaved && normSaved === normDetected) {
      setChallengeActionTone("ok");
      setChallengeAction(`Timezone is already synchronized (${normDetected}).`);
      return;
    }

    setSyncTzBusy(true);
    setChallengeAction("");
    setChallengeActionTone("");
    try {
      const res = await challengeApi.setTimezone(normDetected);
      if (res.data) {
        setStreakView(res.data);
        setChallengeActionTone("ok");
        setChallengeAction(
          `Challenge timezone set to ${res.data.timezone || normDetected}.`
        );
        await loadRemote();
      }
    } catch (err) {
      const n = normalizeApiError(err);
      setChallengeActionTone("err");
      setChallengeRetryKind("refresh");
      setChallengeAction(
        n.message && !/AxiosError|ERR_/i.test(n.message)
          ? n.message
          : "Could not update challenge timezone. Please try again."
      );
    } finally {
      setSyncTzBusy(false);
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

  const planTasks = todayPlan?.tasks || [];
  const planDone = planTasks.filter((t) => t.completed).length;

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
      <header className="co-header free-home-welcome">
        <div>
          <p className="co-kicker">DASHBOARD</p>
          <h1 className="co-title">
            <LayoutDashboard size={22} strokeWidth={2} aria-hidden />
            {getGreeting(firstName)} 👋
          </h1>
          <p className="co-lede">
            Your practice snapshot from real submissions and learning data.
          </p>
        </div>
        <div className="free-home-header-actions">
          {justUpdated && !refreshing ? (
            <p className="free-home-updated" role="status">
              Updated just now
            </p>
          ) : null}
          <Badge variant={premiumUser ? "warning" : "default"}>
            {premiumUser ? "PREMIUM" : "FREE"}
          </Badge>
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

      {/* Today's Focus */}
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
                  <p className="free-home-muted">
                    {todayChallenge?.completed
                      ? "Great work. Today's challenge is complete."
                      : challengeActionTone === "incomplete"
                        ? "Your challenge is ready — an Accepted submission is still required."
                        : "Solve today's challenge and mark it complete on the server."}
                  </p>
                  {planTasks.length > 0 ? (
                    <p className="free-home-muted" style={{ marginTop: 8 }}>
                      Planner today: {planDone}/{planTasks.length} tasks done
                    </p>
                  ) : null}
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
                        : "Open today's Daily Challenge problem"
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
                        Open Problem <ArrowRight size={14} aria-hidden />
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
                      Challenge problem unavailable
                    </p>
                    <p className="free-home-chal-callout-desc">
                      Today&apos;s challenge is temporarily unavailable.
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
                            Checking…
                          </>
                        ) : (
                          "Retry"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {challengeActionTone === "incomplete" &&
                !todayChallenge?.completed ? (
                <div
                  className="free-home-chal-callout is-incomplete"
                  role="status"
                  aria-live="polite"
                >
                  <AlertTriangle
                    size={18}
                    strokeWidth={1.75}
                    className="free-home-chal-callout-icon"
                    aria-hidden
                  />
                  <div className="free-home-chal-callout-body">
                    <p className="free-home-chal-callout-title">
                      Challenge not completed yet
                    </p>
                    <p className="free-home-chal-callout-desc">
                      Submit an accepted solution for today&apos;s challenge
                      before marking it complete.
                    </p>
                    <p className="free-home-chal-callout-hint">
                      Open the problem, submit your solution, and wait for an
                      Accepted verdict. Then retry Mark complete — the server
                      verifies your submission.
                    </p>
                    <div className="free-home-chal-callout-actions">
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          openChallengeBusy ||
                          remoteLoading ||
                          !challengeHasProblemRef
                        }
                        aria-label="Open today's Daily Challenge problem"
                        aria-busy={openChallengeBusy}
                        onClick={() =>
                          void handleOpenChallengeProblem(
                            todayChallenge?.challenge
                          )
                        }
                      >
                        {openChallengeBusy ? (
                          <>
                            <Loader2
                              size={14}
                              className="animate-spin"
                              aria-hidden
                            />
                            Opening…
                          </>
                        ) : (
                          <>
                            Open Problem{" "}
                            <ArrowRight size={14} aria-hidden />
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={challengeStatusRefreshing}
                        aria-label="Refresh Daily Challenge status from server"
                        aria-busy={challengeStatusRefreshing}
                        onClick={() => void handleChallengeRetry()}
                      >
                        {challengeStatusRefreshing ? (
                          <>
                            <Loader2
                              size={14}
                              className="animate-spin"
                              aria-hidden
                            />
                            Checking…
                          </>
                        ) : (
                          "Retry"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {challengeActionTone === "err" && challengeAction ? (
                <div className="free-home-chal-callout is-error" role="alert">
                  <AlertCircle size={16} aria-hidden />
                  <div className="free-home-chal-callout-body">
                    <p className="free-home-chal-callout-title">
                      Unable to update challenge
                    </p>
                    <p className="free-home-chal-callout-desc">
                      {challengeAction}
                    </p>
                    <div className="free-home-chal-callout-actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={
                          challengeStatusRefreshing ||
                          completeBusy ||
                          openChallengeBusy
                        }
                        aria-label="Retry Daily Challenge action"
                        onClick={() => void handleChallengeRetry()}
                      >
                        {challengeStatusRefreshing ||
                          completeBusy ||
                          openChallengeBusy ? (
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

              {challengeActionTone === "ok" && challengeAction ? (
                <p className="free-home-msg-ok" role="status">
                  {challengeAction}
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              compact
              title="No challenge available yet"
              description="The server assigns one canonical problem per date."
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

          {selectedDay ? (
            <div className="free-home-daily" style={{ marginTop: 10 }}>
              <div>
                <p className="free-home-daily-title">
                  {selectedDay.challenge?.title || selectedDay.dateKey}
                </p>
                <p className="free-home-muted">
                  {selectedDay.dateKey}
                  {selectedDay.completed ? " · Completed" : " · Not completed"}
                </p>
              </div>
              {selectedDay.challenge?.problemId ||
                selectedDay.challenge?.problemSlug ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={openChallengeBusy}
                  aria-label="Open challenge problem for selected day"
                  onClick={() =>
                    void handleOpenChallengeProblem(selectedDay.challenge)
                  }
                >
                  {openChallengeBusy ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      Opening…
                    </>
                  ) : (
                    "Open day"
                  )}
                </Button>
              ) : null}
            </div>
          ) : null}

        </section>

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
              style={{ marginTop: 10 }}
            >
              <span style={{ width: `${dayDone * 100}%` }} />
            </div>
          </div>

          <div>
            <div className="free-home-goal-meta">
              <span>Weekly</span>
              <span>
                {weekDone} / {weekTarget}
              </span>
            </div>
            <div
              className="free-home-bar thin"
              role="progressbar"
              aria-valuenow={weekDone}
              aria-valuemin={0}
              aria-valuemax={weekTarget || 1}
              aria-label="Weekly challenge goal"
              style={{ marginTop: 6 }}
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
              className="free-home-bar thin"
              role="progressbar"
              aria-valuenow={monthDone}
              aria-valuemin={0}
              aria-valuemax={monthTarget || 1}
              aria-label="Monthly challenge goal"
              style={{ marginTop: 6 }}
            >
              <span style={{ width: `${pct(monthDone, monthTarget)}%` }} />
            </div>
          </div>

          <div className="free-home-streak-row">
            <div>
              <p className="free-home-muted" style={{ marginBottom: 4 }}>
                <CalendarDays size={14} aria-hidden style={{ verticalAlign: "middle" }} />{" "}
                Current streak
              </p>
              {remoteLoading && !streakView ? (
                <div style={{ padding: "4px 0" }}>
                  <Skeleton className="h-6 w-20" />
                </div>
              ) : (
                <p className="free-home-progress-value">
                  {streakCurrent} day{streakCurrent === 1 ? "" : "s"}
                </p>
              )}
              <p className="free-home-muted">
                {remoteLoading && !streakView ? (
                  <Skeleton className="h-3 w-32 inline-block" />
                ) : (
                  `Longest ${streakLongest}d · server-authoritative`
                )}
              </p>
            </div>
            {canFreeze ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={freezeBusy}
                onClick={() => void handleFreeze()}
              >
                <Snowflake size={14} aria-hidden /> Freeze
                {streakView ? ` (${streakView.freezeBalance})` : ""}
              </Button>
            ) : (
              <span className="free-home-muted">Freeze: Premium</span>
            )}
          </div>

          <div className="free-home-goals-container">
            <p className="free-home-goals-subhead">Goals</p>
            <div className="free-home-goals-form">
              <label htmlFor="daily-weekly-goal-input">
                Weekly goal
                <input
                  id="daily-weekly-goal-input"
                  type="number"
                  min={1}
                  max={30}
                  value={weeklyTarget}
                  className={goalFieldErrors.weekly ? "is-invalid" : undefined}
                  onChange={(e) => {
                    setWeeklyTarget(Number(e.target.value) || 1);
                    setGoalFieldErrors((p) => ({ ...p, weekly: undefined }));
                  }}
                  aria-invalid={Boolean(goalFieldErrors.weekly)}
                  aria-describedby={
                    goalFieldErrors.weekly ? "weekly-goal-error-msg" : undefined
                  }
                  aria-label="Weekly challenge goal target"
                />
                {goalFieldErrors.weekly ? (
                  <span
                    id="weekly-goal-error-msg"
                    className="free-home-field-error"
                    role="alert"
                  >
                    {goalFieldErrors.weekly}
                  </span>
                ) : null}
              </label>

              <label htmlFor="daily-monthly-goal-input">
                Monthly goal
                <input
                  id="daily-monthly-goal-input"
                  type="number"
                  min={1}
                  max={90}
                  value={monthlyTarget}
                  className={goalFieldErrors.monthly ? "is-invalid" : undefined}
                  onChange={(e) => {
                    setMonthlyTarget(Number(e.target.value) || 1);
                    setGoalFieldErrors((p) => ({ ...p, monthly: undefined }));
                  }}
                  aria-invalid={Boolean(goalFieldErrors.monthly)}
                  aria-describedby={
                    goalFieldErrors.monthly ? "monthly-goal-error-msg" : undefined
                  }
                  aria-label="Monthly challenge goal target"
                />
                {goalFieldErrors.monthly ? (
                  <span
                    id="monthly-goal-error-msg"
                    className="free-home-field-error"
                    role="alert"
                  >
                    {goalFieldErrors.monthly}
                  </span>
                ) : null}
              </label>

              <div className="free-home-goals-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={goalsBusy}
                  onClick={() => void handleSaveGoals()}
                >
                  {goalsBusy ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : goalsMsg?.type === "ok" ? (
                    <>
                      <CheckCircle2 size={14} aria-hidden /> Saved
                    </>
                  ) : (
                    "Save goals"
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={syncTzBusy}
                  onClick={() => void handleSyncTimezone()}
                  aria-label="Synchronize timezone with browser"
                >
                  {syncTzBusy ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      Syncing…
                    </>
                  ) : (
                    "Sync TZ"
                  )}
                </Button>
              </div>
            </div>

            {!goalFieldErrors.weekly && !goalFieldErrors.monthly && goalsMsg ? (
              <p
                className={
                  goalsMsg.type === "ok" ? "free-home-msg-ok" : "free-home-msg-err"
                }
                role="status"
              >
                {goalsMsg.text}
              </p>
            ) : null}
          </div>

          <p className="free-home-muted">
            {canHistory
              ? "Full history"
              : historyLocked
                ? "History limited (upgrade for 90 days)"
                : "History: last 7 days (free)"}
          </p>

          {streakView?.badges?.length ? (
            <ul className="free-home-badges">
              {streakView.badges.slice(0, 6).map((b) => (
                <li key={b.id}>
                  <Medal size={12} aria-hidden /> {b.label}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section aria-labelledby="progress-overview-heading">
        <h2 id="progress-overview-heading" className="free-home-section-title">
          Progress Overview
        </h2>
        <div className="free-home-metrics">
          <MetricCard
            label="Problems solved"
            value={solvedTotal}
            hint={
              progressStatus
                ? `${attemptedCount} attempted · ${progressStatus.totalSubmissions} submissions`
                : `${attemptedCount} attempted`
            }
            icon={<Trophy size={16} />}
          />
          <MetricCard
            label="Current streak"
            value={`${streakCurrent} days`}
            hint={`Longest ${streakLongest}d · server`}
            icon={<CalendarDays size={16} />}
          />
          <MetricCard
            label="Contest rating"
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
                  ? "No rating yet"
                  : lbStats?.globalRank
                    ? `Global rank #${lbStats.globalRank}`
                    : "From leaderboard"
            }
            icon={<Trophy size={16} />}
          />
          <MetricCard
            label="Easy / Medium / Hard"
            value={
              solvedTotal === 0 && easyCount + mediumCount + hardCount === 0
                ? "—"
                : `${easyCount} / ${mediumCount} / ${hardCount}`
            }
            hint={
              solvedTotal === 0 && easyCount + mediumCount + hardCount === 0
                ? "Submit an accepted solution to start"
                : "From accepted submissions"
            }
          />
        </div>
      </section>

      <div className="free-home-split">
        <section className="free-home-card" aria-labelledby="continue-learning-heading">
          <div className="free-home-card-head">
            <h2 id="continue-learning-heading">Continue Learning</h2>
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
                onClick={() => onNavigate("problems")}
              >
                Continue Learning <ArrowRight size={14} aria-hidden />
              </Button>
            </div>
          ) : (
            <EmptyState
              compact
              title="No study progress yet"
              description="Solve a problem or open the sheet to start tracking."
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onNavigate("problems")}
                >
                  Start practicing
                </Button>
              }
            />
          )}
        </section>

        <section className="free-home-card" aria-labelledby="weak-topics-heading">
          <div className="free-home-card-head">
            <h2 id="weak-topics-heading">Weak Topics</h2>
            <button
              type="button"
              className="free-home-link"
              onClick={() => onNavigate(premiumUser ? "analytics" : "calendar")}
            >
              View analysis →
            </button>
          </div>
          <p className="free-home-muted" style={{ marginBottom: 12 }}>
            Based on your actual learning activity.
          </p>
          {weak.length === 0 ? (
            <EmptyState
              compact
              title={
                solvedIds.size === 0
                  ? "Not enough activity to calculate meaningful weakness"
                  : "No weak topics detected"
              }
              description={
                solvedIds.size === 0
                  ? "Solve a few problems across topics to surface gaps."
                  : "Keep going — topic coverage looks solid from your accepts."
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

      <PremiumPreparationSection
        userId={userId}
        problems={problems}
        submissions={submissions}
        refreshKey={refreshKey + entitlementTick}
        onSelectProblem={onSelectProblem}
        onNavigate={onNavigate}
      />

      <div className="free-home-split">
        <section className="free-home-card" aria-labelledby="recent-subs-heading">
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

        <section className="free-home-card" aria-labelledby="recommended-heading">
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
              description="Solve a few problems so we can suggest related practice from your weak topics."
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
                    </span>
                    <span className="free-home-link" aria-hidden>
                      Solve →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Secondary grid: Saved + Activity */}
      <div className="free-home-split">
        <section className="free-home-card" aria-labelledby="saved-heading">
          <div className="free-home-card-head">
            <h2 id="saved-heading">
              <Bookmark size={16} aria-hidden /> Saved Problems
            </h2>
            <button
              type="button"
              className="free-home-link"
              onClick={() => onNavigate("favourites")}
            >
              View all →
            </button>
          </div>
          {favourites.length === 0 ? (
            sectionErrors.favourites ? (
              <SectionError
                message={sectionErrors.favourites}
                onRetry={() => void loadRemote()}
              />
            ) : (
              <EmptyState
                compact
                title="No saved problems yet"
                description="Bookmark problems from the workspace to build your personal list."
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
            )
          ) : (
            <>
              {favStats ? (
                <p className="free-home-muted" style={{ marginBottom: 10 }}>
                  {favStats.total} saved · {favStats.solved} solved
                </p>
              ) : null}
              <ul className="free-home-list">
                {favourites.map((p) => (
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
                          {p.progressStatus
                            ? ` · ${p.progressStatus.replace(/_/g, " ")}`
                            : ""}
                        </span>
                      </span>
                      <ArrowRight size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="free-home-card" aria-labelledby="activity-heading">
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
