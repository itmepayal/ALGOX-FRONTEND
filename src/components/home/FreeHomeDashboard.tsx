import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
  ArrowRight,
  Bookmark,
  Flame,
  Loader2,
  RefreshCw,
  Target,
  Trophy,
  AlertCircle,
  Snowflake,
  Medal,
} from "lucide-react";
import type { Problem } from "../../api/problemApi";
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
import { EmptyState } from "../ui/empty-state";
import { MetricCard } from "../ui/metric-card";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { useAuth } from "../../context/AuthContext";
import { isPremium } from "../../access/accessModel";
import { canAccess } from "../../access/canAccess";
import { authApi } from "../../api/authApi";
import { SubscriptionStatusBar } from "./SubscriptionStatusBar";
import { PremiumPreparationSection } from "./PremiumPreparationSection";
import { UpgradePrompt } from "../access/UpgradePrompt";
import type { FreeHomeNavTab } from "./types";

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
  /** Bump to refetch remote dashboard slices */
  refreshKey?: number;
}

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

/** Deterministic daily pick removed — server DailyChallenge is canonical. */
function findProblemByIdOrSlug(
  problems: Problem[],
  id: string | null,
  slug: string | null
): Problem | null {
  if (!id && !slug) return null;
  return (
    problems.find((p) => {
      const pid = getProblemId(p);
      return (id && pid === id) || (slug && p.slug === slug);
    }) || null
  );
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

export const FreeHomeDashboard: FC<FreeHomeDashboardProps> = ({
  userName,
  userId,
  problems,
  submissions,
  studySessions,
  loadingProblems = false,
  loadingSubmissions = false,
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
  const [remoteError, setRemoteError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [todayChallenge, setTodayChallenge] =
    useState<TodayChallengeResponse | null>(null);
  const [streakView, setStreakView] = useState<StreakView | null>(null);
  const [challengeDays, setChallengeDays] = useState<ChallengeCalendarDay[]>(
    []
  );
  const [challengeAction, setChallengeAction] = useState("");
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
  const [goalsBusy, setGoalsBusy] = useState(false);

  const todayKey = toDateKey(new Date());
  const canFreeze = canAccess(user, "premium.streak_freeze");
  const canHistory = canAccess(user, "premium.challenge_history");

  const loadRemote = useCallback(async () => {
    if (!userId) {
      setRemoteLoading(false);
      return;
    }
    setRemoteError("");
    try {
      const calFrom = toDateKey(
        new Date(Date.now() - 27 * 86400000)
      );
      const histFrom = toDateKey(
        new Date(Date.now() - (canHistory ? 89 : 6) * 86400000)
      );
      const [sheetRes, statusRes, planRes, favRes, lbRes, todayRes, streakRes, calRes, histRes] =
        await Promise.allSettled([
          sheetProgressApi.getProgress(STRIVER_A2Z_SHEET_ID),
          progressApi.getStatus(),
          learningApi.getPlan(todayKey),
          engagementApi.listMyFavourites({ limit: 6, page: 1, sort: "recent" }),
          leaderboardApi.getUserStats(userId),
          challengeApi.getToday(),
          challengeApi.getStreak(),
          challengeApi.getCalendar(calFrom, todayKey),
          challengeApi.getHistory(histFrom, todayKey),
        ]);

      if (sheetRes.status === "fulfilled") {
        setSheetProgress(sheetRes.value?.data ?? null);
      }
      if (statusRes.status === "fulfilled") {
        setProgressStatus(statusRes.value?.data ?? null);
      }
      if (planRes.status === "fulfilled") {
        setTodayPlan(planRes.value?.data ?? null);
      }
      if (favRes.status === "fulfilled") {
        const data = favRes.value?.data;
        setFavourites(data?.items || []);
        setFavStats(data?.stats || null);
      }
      if (lbRes.status === "fulfilled") {
        setLbStats(lbRes.value?.data ?? null);
        setLbMissing(false);
      } else {
        setLbStats(null);
        setLbMissing(true);
      }
      if (todayRes.status === "fulfilled") {
        setTodayChallenge(todayRes.value?.data ?? null);
      }
      if (streakRes.status === "fulfilled") {
        const streak = streakRes.value?.data ?? null;
        setStreakView(streak);
        if (streak?.weeklyGoal?.target) setWeeklyTarget(streak.weeklyGoal.target);
        if (streak?.monthlyGoal?.target) setMonthlyTarget(streak.monthlyGoal.target);
      }
      if (calRes.status === "fulfilled") {
        setChallengeDays(calRes.value?.data?.days || []);
      }
      if (histRes.status === "fulfilled") {
        setHistoryItems(histRes.value?.data?.items || []);
        setHistoryLocked(Boolean(histRes.value?.data?.historyLocked));
      }

      const hardFail =
        sheetRes.status === "rejected" &&
        statusRes.status === "rejected" &&
        favRes.status === "rejected";
      if (hardFail) {
        setRemoteError("Some dashboard data could not be loaded. Try refresh.");
      }
    } catch (err: any) {
      setRemoteError(err?.message || "Failed to load dashboard");
    } finally {
      setRemoteLoading(false);
      setRefreshing(false);
    }
  }, [userId, todayKey, canHistory]);

  useEffect(() => {
    setRemoteLoading(true);
    void loadRemote();
  }, [loadRemote, refreshKey]);

  const solvedIds = useMemo(
    () => everAcceptedProblemIds(submissions),
    [submissions]
  );

  const byDiff = useMemo(
    () => difficultyBreakdown(problems, solvedIds),
    [problems, solvedIds]
  );

  const roadmap = useMemo(
    () => buildRoadmap(problems, submissions),
    [problems, submissions]
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

  const handleCompleteChallenge = async () => {
    setChallengeAction("");
    try {
      const challengePid =
        todayChallenge?.challenge?.problemId ||
        (dailyProblem ? getProblemId(dailyProblem) : null);
      const accepted = [...submissions]
        .filter((s) => {
          const st = String(s.status || "").toUpperCase();
          if (st !== "ACCEPTED") return false;
          if (!challengePid) return false;
          return String(s.problemId) === String(challengePid);
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        )[0];
      const submissionId = accepted?.id || accepted?._id;
      const res = await challengeApi.complete(submissionId);
      if (res.data) {
        setStreakView(res.data.streak);
        setTodayChallenge((prev) =>
          prev
            ? { ...prev, completed: true, dateKey: res.data!.dateKey }
            : prev
        );
        setChallengeAction(
          res.data.duplicate
            ? "Already completed today (server)."
            : submissionId
              ? "Challenge completed via accepted submission."
              : "Challenge completed — streak updated on server."
        );
        await loadRemote();
      }
    } catch (err: any) {
      setChallengeAction(
        err?.response?.data?.message ||
          err?.message ||
          "Could not complete challenge"
      );
    }
  };

  const handleFreeze = async () => {
    if (!canFreeze) return;
    setFreezeBusy(true);
    setChallengeAction("");
    try {
      const res = await challengeApi.useFreeze();
      if (res.data) {
        setStreakView(res.data);
        setChallengeAction("Streak freeze applied for yesterday.");
        await loadRemote();
      }
    } catch (err: any) {
      setChallengeAction(
        err?.response?.data?.message ||
          err?.message ||
          "Could not apply freeze"
      );
    } finally {
      setFreezeBusy(false);
    }
  };

  const handleSelectChallengeDay = async (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setChallengeAction("");
    try {
      const res = await challengeApi.getByDate(dateKey);
      if (res.data) {
        setSelectedDay(res.data);
      }
    } catch (err: any) {
      setSelectedDay(null);
      setChallengeAction(
        err?.response?.data?.message ||
          err?.message ||
          "Could not load that date"
      );
    }
  };

  const handleSaveGoals = async () => {
    setGoalsBusy(true);
    setChallengeAction("");
    try {
      const res = await challengeApi.setGoals({
        weeklyGoalTarget: weeklyTarget,
        monthlyGoalTarget: monthlyTarget,
      });
      if (res.data) {
        setStreakView(res.data);
        setChallengeAction("Challenge goals updated on server.");
      }
    } catch (err: any) {
      setChallengeAction(
        err?.response?.data?.message ||
          err?.message ||
          "Could not update goals"
      );
    } finally {
      setGoalsBusy(false);
    }
  };

  const handleSyncTimezone = async () => {
    const tz =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "";
    if (!tz) {
      setChallengeAction("Could not detect browser timezone.");
      return;
    }
    setChallengeAction("");
    try {
      const res = await challengeApi.setTimezone(tz);
      if (res.data) {
        setStreakView(res.data);
        setChallengeAction(`Challenge timezone set to ${tz}.`);
        await loadRemote();
      }
    } catch (err: any) {
      setChallengeAction(
        err?.response?.data?.message ||
          err?.message ||
          "Could not update timezone"
      );
    }
  };

  const continueTopic = weak[0] || roadmap.find((t) => t.total > 0) || null;

  const solvedTotal =
    progressStatus?.problemsSolved ??
    lbStats?.totalSolved ??
    byDiff.total;

  const easyCount = lbStats?.solvedEasy ?? byDiff.easy;
  const mediumCount = lbStats?.solvedMedium ?? byDiff.medium;
  const hardCount = lbStats?.solvedHard ?? byDiff.hard;

  const planTasks = todayPlan?.tasks || [];
  const planDone = planTasks.filter((t) => t.completed).length;

  const bootLoading =
    remoteLoading || loadingProblems || loadingSubmissions;

  const handleRefresh = () => {
    setRefreshing(true);
    void (async () => {
      try {
        const res = await authApi.getProfile();
        if (res.data) {
          setUser(res.data as any);
          localStorage.setItem("user", JSON.stringify(res.data));
          setEntitlementTick((n) => n + 1);
        }
      } catch {
        /* keep prior entitlement */
      }
      await loadRemote();
    })();
  };

  if (bootLoading && !refreshing) {
    return (
      <div className="free-home" aria-busy="true" aria-live="polite">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-28 w-full" />
        <div className="free-home-metrics">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="free-home">
      <header className="free-home-welcome">
        <div>
          <p className="free-home-kicker">Dashboard</p>
          <h1 className="free-home-title">
            Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}
          </h1>
          <p className="free-home-lede">
            Your practice snapshot from real submissions and learning data — nothing
            invented.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh dashboard"
        >
          {refreshing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh
        </Button>
      </header>

      <SubscriptionStatusBar
        onUpgraded={() => setEntitlementTick((n) => n + 1)}
      />

      {remoteError ? (
        <div className="free-home-alert" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{remoteError}</span>
          <button type="button" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      ) : null}

      {/* Daily Challenge — server canonical + streak engine */}
      <section className="free-home-card" aria-labelledby="daily-challenge-heading">
        <div className="free-home-card-head">
          <h2 id="daily-challenge-heading">
            <Target size={16} aria-hidden /> Daily Challenge
          </h2>
          <span className="free-home-muted">
            {todayChallenge?.dateKey || todayKey}
            {todayChallenge?.timezone ? ` · ${todayChallenge.timezone}` : ""}
          </span>
        </div>
        {todayChallenge?.challenge?.accessLocked ? (
          <UpgradePrompt
            feature="premium.daily_challenge_advanced"
            title="Advanced daily challenge"
          />
        ) : todayChallenge?.challenge || dailyProblem ? (
          <div className="free-home-daily">
            <div>
              <p className="free-home-daily-title">
                {todayChallenge?.challenge?.title ||
                  dailyProblem?.title ||
                  "Today's challenge"}
              </p>
              <p className="free-home-muted">
                {normalizeDifficulty(
                  todayChallenge?.challenge?.difficulty ||
                    dailyProblem?.difficulty
                )}
                {todayChallenge?.challenge?.category
                  ? ` · ${todayChallenge.challenge.category}`
                  : dailyProblem?.category
                    ? ` · ${dailyProblem.category}`
                    : ""}
                {todayChallenge?.completed
                  ? " · Completed"
                  : " · Solve & mark complete on server"}
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
                disabled={!dailyProblem}
                onClick={() => dailyProblem && onSelectProblem(dailyProblem)}
              >
                Open <ArrowRight size={14} />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={Boolean(todayChallenge?.completed)}
                onClick={() => void handleCompleteChallenge()}
              >
                {todayChallenge?.completed ? "Done" : "Mark complete"}
              </Button>
            </div>
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
                Browse sheets
              </Button>
            }
          />
        )}

        <div className="free-home-challenge-strip" aria-label="Challenge calendar">
          {calendarStrip.map((key) => {
            const day = challengeDaySet.get(key);
            const isToday = key === (todayChallenge?.dateKey || todayKey);
            const isSelected = key === selectedDateKey;
            return (
              <button
                key={key}
                type="button"
                className={`free-home-chal-day${day ? ` is-${day.kind}` : ""}${
                  isToday ? " is-today" : ""
                }${isSelected ? " is-selected" : ""}`}
                title={
                  day
                    ? `${key}: ${day.kind}`
                    : `${key}: not started`
                }
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
                {selectedDay.challenge?.difficulty
                  ? ` · ${normalizeDifficulty(selectedDay.challenge.difficulty)}`
                  : ""}
              </p>
            </div>
            {selectedDay.challenge?.problemId || selectedDay.challenge?.problemSlug ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const p = findProblemByIdOrSlug(
                    problems,
                    selectedDay.challenge.problemId,
                    selectedDay.challenge.problemSlug
                  );
                  if (p) onSelectProblem(p);
                  else setChallengeAction("Problem not in local catalog cache.");
                }}
              >
                Open day
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="free-home-streak-row">
          <p className="free-home-muted">
            Week {streakView?.weeklyGoal.completed ?? 0}/
            {streakView?.weeklyGoal.target ?? weeklyTarget}
            {" · "}
            Month {streakView?.monthlyGoal.completed ?? 0}/
            {streakView?.monthlyGoal.target ?? monthlyTarget}
            {canHistory
              ? " · Full history"
              : historyLocked
                ? " · History limited (upgrade for 90 days)"
                : " · History: last 7 days (free)"}
          </p>
          {canFreeze ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={freezeBusy}
              onClick={() => void handleFreeze()}
            >
              <Snowflake size={14} /> Freeze
              {streakView ? ` (${streakView.freezeBalance})` : ""}
            </Button>
          ) : (
            <span className="free-home-muted">Freeze: Premium</span>
          )}
        </div>

        <div
          className="mock-interview-form"
          style={{ marginTop: 10, display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto auto" }}
        >
          <label className="free-home-muted">
            Weekly goal
            <input
              type="number"
              min={1}
              max={30}
              value={weeklyTarget}
              onChange={(e) => setWeeklyTarget(Number(e.target.value) || 1)}
            />
          </label>
          <label className="free-home-muted">
            Monthly goal
            <input
              type="number"
              min={1}
              max={90}
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(Number(e.target.value) || 1)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={goalsBusy}
            onClick={() => void handleSaveGoals()}
          >
            Save goals
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleSyncTimezone()}
          >
            Sync TZ
          </Button>
        </div>

        {historyItems.length > 0 ? (
          <ul className="free-home-activity" style={{ marginTop: 12 }}>
            {historyItems.slice(0, canHistory ? 14 : 7).map((item) => (
              <li key={`${item.dateKey}-${item.tier}`}>
                <button
                  type="button"
                  className="free-home-list-row"
                  style={{ width: "100%", textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}
                  onClick={() => void handleSelectChallengeDay(item.dateKey)}
                >
                  <span className="free-home-list-main">
                    <strong>{item.dateKey}</strong>
                    <span className="free-home-muted">
                      {item.title || "Challenge"}
                      {item.completed ? " · done" : ""}
                      {item.accessLocked ? " · locked" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {streakView?.badges?.length ? (
          <ul className="free-home-badges">
            {streakView.badges.slice(0, 6).map((b) => (
              <li key={b.id}>
                <Medal size={12} aria-hidden /> {b.label}
              </li>
            ))}
          </ul>
        ) : null}

        {challengeAction ? (
          <p className="free-home-muted" role="status" style={{ marginTop: 8 }}>
            {challengeAction}
          </p>
        ) : null}
      </section>

      {/* Progress Overview */}
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
                ? `${progressStatus.problemsAttempted} attempted · ${progressStatus.totalSubmissions} submissions`
                : `${submissions.filter((s) => s.source !== "run").length} submissions loaded`
            }
            icon={<Trophy size={16} />}
          />
          <MetricCard
            label="Easy / Medium / Hard"
            value={`${easyCount} / ${mediumCount} / ${hardCount}`}
            hint="From accepted submissions"
          />
          <MetricCard
            label="Current streak"
            value={`${streakCurrent}d`}
            hint={`Longest ${streakLongest}d · server`}
            icon={<Flame size={16} />}
          />
          <MetricCard
            label="Contest rating"
            value={
              lbMissing || lbStats?.rating == null
                ? "—"
                : Math.round(Number(lbStats.rating))
            }
            hint={
              lbMissing
                ? "No leaderboard record yet"
                : lbStats?.globalRank
                  ? `Global rank #${lbStats.globalRank}`
                  : "From LeaderboardService"
            }
            icon={<Trophy size={16} />}
          />
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

      {/* Continue Learning */}
      <section className="free-home-card" aria-labelledby="continue-learning-heading">
        <div className="free-home-card-head">
          <h2 id="continue-learning-heading">Continue Learning</h2>
          <button
            type="button"
            className="free-home-link"
            onClick={() => onNavigate("calendar")}
          >
            Roadmap
          </button>
        </div>
        {sheetProgress || continueTopic ? (
          <div className="free-home-continue">
            {sheetProgress ? (
              <div className="free-home-continue-block">
                <p className="free-home-daily-title">
                  {sheetProgress.sheetName || "DSA Sheet"}
                </p>
                <p className="free-home-muted">
                  {sheetProgress.completed}/{sheetProgress.total} complete (
                  {Math.round(Number(sheetProgress.progress) || 0)}%)
                </p>
                <div
                  className="free-home-bar"
                  role="progressbar"
                  aria-valuenow={Math.round(Number(sheetProgress.progress) || 0)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Sheet progress"
                >
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(sheetProgress.progress) || 0))}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            {continueTopic ? (
              <div className="free-home-continue-block">
                <p className="free-home-daily-title">{continueTopic.name}</p>
                <p className="free-home-muted">
                  {continueTopic.solved}/{continueTopic.total} ·{" "}
                  {continueTopic.status.replace("_", " ")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate("problems")}
                >
                  Continue sheet
                </Button>
              </div>
            ) : null}
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

      <div className="free-home-split">
        {/* Recent Submissions */}
        <section className="free-home-card" aria-labelledby="recent-subs-heading">
          <div className="free-home-card-head">
            <h2 id="recent-subs-heading">Recent Submissions</h2>
            <button
              type="button"
              className="free-home-link"
              onClick={() => onNavigate("profile")}
            >
              All
            </button>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              compact
              title="No submissions yet"
              description="Run and submit a solution to see activity here."
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onNavigate("problems")}
                >
                  Open problems
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
                const when = s.createdAt
                  ? new Date(s.createdAt).toLocaleString()
                  : "—";
                return (
                  <li key={s.id || s._id || `${pid}-${when}`}>
                    <button
                      type="button"
                      className="free-home-list-row"
                      disabled={!problem}
                      onClick={() => problem && onSelectProblem(problem)}
                    >
                      <span className="free-home-list-main">
                        <strong>
                          {problem?.title || "Problem"}
                        </strong>
                        <span className="free-home-muted">
                          {s.language || "—"} · {when}
                        </span>
                      </span>
                      <span
                        className={`free-home-verdict ${
                          s.status === "ACCEPTED" ? "ok" : "bad"
                        }`}
                      >
                        {s.status || "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Saved problems */}
        <section className="free-home-card" aria-labelledby="saved-heading">
          <div className="free-home-card-head">
            <h2 id="saved-heading">
              <Bookmark size={16} aria-hidden /> Saved problems
            </h2>
            <button
              type="button"
              className="free-home-link"
              onClick={() => onNavigate("favourites")}
            >
              Favourites
            </button>
          </div>
          {favourites.length === 0 ? (
            <EmptyState
              compact
              title="No saved problems"
              description={
                favStats
                  ? "Bookmark a problem from the workspace to see it here."
                  : "Bookmark problems while browsing."
              }
            />
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
                          {p.progressStatus
                            ? ` · ${p.progressStatus.replace("_", " ")}`
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
      </div>

      {/* Free-tier weak topics / recommendations — Premium uses Your Preparation instead */}
      {!premiumUser ? (
        <>
      {/* Weak Topics */}
      <section className="free-home-card" aria-labelledby="weak-topics-heading">
        <div className="free-home-card-head">
          <h2 id="weak-topics-heading">Weak Topics</h2>
        </div>
        {weak.length === 0 ? (
          <EmptyState
            compact
            title={
              solvedIds.size === 0
                ? "Not enough activity yet"
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

      {/* Recommended */}
      <section className="free-home-card" aria-labelledby="recommended-heading">
        <div className="free-home-card-head">
          <h2 id="recommended-heading">Recommended Problems</h2>
        </div>
        {recommended.length === 0 ? (
          <EmptyState
            compact
            title="No recommendations yet"
            description="Load the problem catalog or clear filters by solving fewer of them."
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
                  <ArrowRight size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      ) : null}

      {/* Recent activity summary */}
      <section className="free-home-card" aria-labelledby="activity-heading">
        <div className="free-home-card-head">
          <h2 id="activity-heading">Recent Activity</h2>
        </div>
        {streakCurrent === 0 && recent.length === 0 && studySessions.length === 0 ? (
          <EmptyState
            compact
            title="No recent activity"
            description="Submissions and completed study sessions will show up here."
          />
        ) : (
          <ul className="free-home-activity">
            <li>
              Challenge streak: <strong>{streakCurrent}</strong> day
              {streakCurrent === 1 ? "" : "s"} (best {streakLongest})
            </li>
            <li>
              Official submissions loaded:{" "}
              <strong>
                {submissions.filter((s) => s.source !== "run").length}
              </strong>
            </li>
            <li>
              Study sessions on device/server:{" "}
              <strong>{studySessions.length}</strong>
            </li>
            {progressStatus?.lastSubmissionDate ? (
              <li>
                Last submission:{" "}
                <strong>
                  {new Date(progressStatus.lastSubmissionDate).toLocaleString()}
                </strong>
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
};
