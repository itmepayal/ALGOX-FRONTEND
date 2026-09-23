import { useState, useEffect, useCallback, useMemo, useRef, type FC } from "react";
import { useAuth } from "../context/AuthContext";
import { usePlatformSettings } from "../context/PlatformSettingsContext";
import type { JudgeLanguage } from "../api/adminSettingsApi";
import { authApi } from "../api/authApi";
import { problemApi, type Problem, type Testcase } from "../api/problemApi";
import {
  submissionApi,
  type ProgrammingLanguage,
  type Submission,
  type SubmissionStatus,
} from "../api/submissionApi";
import { evaluationApi } from "../api/evaluationApi";
import { engagementApi } from "../api/engagementApi";
import { ProblemsSheet } from "./ProblemsSheet";
import { ProblemWorkspace } from "./ProblemWorkspace";
import { ProfilePanel } from "./ProfilePanel";
import { LearningCalendarRoadmap } from "./LearningCalendarRoadmap";
import { StudySessionsPanel } from "./StudySessionsPanel";
import { DailyPlannerPanel } from "./DailyPlannerPanel";
import { ActiveStudySessionBar } from "./ActiveStudySessionBar";
import { FavouritesPage } from "./FavouritesPage";
import { BrandMark } from "./BrandLogo";
import { DiscussionsPanel } from "./DiscussionsPanel";
import { ContestsPanel } from "./ContestsPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { ContentLibraryPanel } from "./ContentLibraryPanel";
import { NotificationBell } from "./NotificationBell";
import { SystemBroadcastListener } from "./SystemBroadcastListener";
import { AnnouncementBanner } from "./AnnouncementBanner";
import {
  formatJudgeInput,
  getTestCaseExpectedOutput,
  outputsMatch,
} from "../utils/problemUtils";
import {
  clearSavedCode,
  getProblemId,
  getStarterTemplate,
  loadSavedCode,
  saveCode,
} from "../utils/workspacePersistence";
import {
  consumePendingProblemSlug,
  readProblemSlugFromLocation,
  setProblemInLocation,
} from "../utils/problemShare";
import {
  loadAllSessions,
  recordSessionProblemActivity,
  startStudySession,
  syncPlannerWithAccepted,
  toDateKey,
  type StudySession,
} from "../utils/learningPersistence";
import {
  buildDayActivityMap,
  computeStreaks,
  everAcceptedProblemIds,
} from "../utils/learningStats";
import { normalizeProblemId, updateIdSet } from "../utils/engagementIds";
import type { RunCaseResult, RunResult } from "../types/judge";
import { hasAccessToken } from "../api/accessToken";
import { Flame, Search, ShieldCheck, Swords } from "lucide-react";
import { FreeHomeDashboard } from "./home/FreeHomeDashboard";
import { CompaniesPage } from "./companies/CompaniesPage";
import {
  MockInterviewPanel,
  type ActiveMockInterviewMeta,
} from "./MockInterviewPanel";
import { mockInterviewApi } from "../api/mockInterviewApi";
import { InterviewTimer } from "./InterviewTimer";
import { AiAssistantPanel } from "./AiAssistantPanel";
import { SubmissionAnalyticsPanel } from "./SubmissionAnalyticsPanel";
import { SpacedRepetitionPanel } from "./SpacedRepetitionPanel";
import { canAccess } from "../access/canAccess";
import { PremiumGate } from "./access/PremiumGate";
import { PremiumNavIndicator } from "./access/PremiumNavIndicator";
import {
  PLATFORM_NAV_ITEMS,
  isPlatformNavPremium,
  platformNavPremiumTooltip,
  type PlatformNavId,
} from "../nav/platformNav";
import {
  consumePendingPremiumNav,
  peekPendingPremiumNav,
  setPendingPremiumNav,
} from "../access/pendingPremiumNav";

type PlatformTab = PlatformNavId | "profile";

interface DashboardProps {
  onOpenAdmin?: () => void;
}

export const Dashboard: FC<DashboardProps> = ({ onOpenAdmin }) => {
  const { user, signout, setUser } = useAuth();
  const { settings, isEnabled } = usePlatformSettings();
  const contestsEnabled = isEnabled("contests");
  const discussionsEnabled = isEnabled("discussions");
  const submissionsEnabled = isEnabled("submissions");
  const notificationsEnabled = isEnabled("notifications");
  const newEditorEnabled = isEnabled("newEditor");
  const platformName = settings?.platformName || "AlgoPath";
  const logoUrl = settings?.logoUrl;
  const supportedLanguages = settings?.supportedLanguages;
  const [activeTab, setActiveTab] = useState<PlatformTab>("home");
  const [learningRefreshKey, setLearningRefreshKey] = useState(0);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [favouritesRefreshKey, setFavouritesRefreshKey] = useState(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [accessFilter, setAccessFilter] = useState<"all" | "free" | "premium">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "solved" | "attempted" | "unsolved">("all");
  const [customTestCases, setCustomTestCases] = useState<Testcase[]>([]);
  const [runMode, setRunMode] = useState<"all" | "selected">("all");
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [problemPage, setProblemPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeContestId, setActiveContestId] = useState<string | null>(null);
  const [activeVirtualContestSessionId, setActiveVirtualContestSessionId] =
    useState<string | null>(null);
  const [activeMockInterviewSessionId, setActiveMockInterviewSessionId] =
    useState<string | null>(null);
  const [activeMockInterviewMeta, setActiveMockInterviewMeta] =
    useState<ActiveMockInterviewMeta | null>(null);
  const [mockInterviewSyncKey, setMockInterviewSyncKey] = useState(0);
  const [preferredMockCompany, setPreferredMockCompany] = useState<string | null>(
    null
  );
  const activeMockInterviewSessionIdRef = useRef<string | null>(null);
  activeMockInterviewSessionIdRef.current = activeMockInterviewSessionId;
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [importantIds, setImportantIds] = useState<Set<string>>(new Set());
  const [revisionIds, setRevisionIds] = useState<Set<string>>(new Set());

  const [userCode, setUserCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submissionResult, setSubmissionResult] = useState<Submission | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [runError, setRunError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const busy = isRunning || isSubmitting;
  /** Sync locks — React busy state alone can miss rapid double-clicks. */
  const runLockRef = useRef(false);
  const submitLockRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [dashTab, setDashTab] = useState<
    "profile" | "account" | "security" | "progress" | "sessions" | "submissions" | "audit"
  >("profile");
  const [sessions, setSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSecurityLogs, setLoadingSecurityLogs] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("mine");
  const [submissionLangFilter, setSubmissionLangFilter] = useState("all");
  const [profileSelectedSubmission, setProfileSelectedSubmission] = useState<Submission | null>(null);
  const [problemSubmissions, setProblemSubmissions] = useState<Submission[]>([]);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);

  const [editName, setEditName] = useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
  const [avatarBase64, setAvatarBase64] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [problemsError, setProblemsError] = useState<unknown>(null);

  const PROBLEM_PAGE_SIZE = 50;

  const fetchProblems = useCallback(async () => {
    try {
      setLoadingProblems(true);
      setProblemsError(null);
      const difficultyParam =
        selectedDifficulty !== "All"
          ? selectedDifficulty.toLowerCase()
          : undefined;
      const res = await problemApi.getProblems({
        page: problemPage,
        limit: PROBLEM_PAGE_SIZE,
        search: debouncedSearch || undefined,
        difficulty: difficultyParam,
        access: accessFilter === "all" ? undefined : accessFilter,
      });
      if (res?.data) setProblems(res.data);
      setTotalPages(Math.max(1, res?.meta?.totalPages ?? 1));
    } catch (err) {
      console.warn("Fetch problems failed:", err);
      setProblemsError(err);
    } finally {
      setLoadingProblems(false);
    }
  }, [problemPage, debouncedSearch, selectedDifficulty, accessFilter]);

  useEffect(() => {
    if (!activeMockInterviewSessionId) {
      setActiveMockInterviewMeta(null);
      return;
    }
    let cancelled = false;
    const sync = async () => {
      try {
        const res = await mockInterviewApi.getById(activeMockInterviewSessionId);
        if (cancelled || !res.data) return;
        if (res.data.status !== "in_progress") {
          setActiveMockInterviewSessionId(null);
          setActiveMockInterviewMeta(null);
          return;
        }
        setActiveMockInterviewMeta((prev) => {
          if (
            prev &&
            prev.id === res.data!.id &&
            prev.endsAt === res.data!.endsAt
          ) {
            return prev;
          }
          return {
            id: res.data!.id,
            endsAt: res.data!.endsAt,
            serverNow: res.data!.serverNow,
            remainingMs: res.data!.remainingMs,
          };
        });
      } catch {
        /* ignore */
      }
    };
    void sync();
    const poll = window.setInterval(() => void sync(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [activeMockInterviewSessionId]);

  const prevInterviewTabRef = useRef(false);
  useEffect(() => {
    const onInterview = activeTab === "interview";
    const entered = onInterview && !prevInterviewTabRef.current;
    prevInterviewTabRef.current = onInterview;
    if (entered && activeMockInterviewSessionId) {
      setMockInterviewSyncKey((k) => k + 1);
    }
  }, [activeTab, activeMockInterviewSessionId]);

  const handleActiveMockSessionChange = useCallback(
    (meta: ActiveMockInterviewMeta | null) => {
      if (meta) {
        setActiveMockInterviewSessionId(meta.id);
        setActiveMockInterviewMeta((prev) => {
          if (
            prev &&
            prev.id === meta.id &&
            prev.endsAt === meta.endsAt
          ) {
            return prev;
          }
          return meta;
        });
        setActiveContestId(null);
        setActiveVirtualContestSessionId(null);
      } else {
        setActiveMockInterviewSessionId(null);
        setActiveMockInterviewMeta(null);
      }
    },
    []
  );

  const handleOpenProblemFromContest = useCallback(
    async (
      ref: { id?: string; slug?: string; title?: string },
      contestId?: string,
      virtualSessionId?: string
    ) => {
      // Live contest and virtual session are mutually exclusive on submit.
      if (virtualSessionId) {
        setActiveVirtualContestSessionId(virtualSessionId);
        setActiveContestId(null);
        setActiveMockInterviewSessionId(null);
      } else {
        setActiveContestId(contestId ?? null);
        if (contestId) {
          setActiveVirtualContestSessionId(null);
          setActiveMockInterviewSessionId(null);
        }
      }
      try {
        let problem: Problem | null = null;
        if (ref.slug) {
          const res = await problemApi.getProblemBySlug(ref.slug);
          if (res?.data) problem = res.data;
        } else if (ref.id) {
          const res = await problemApi.getProblemById(ref.id);
          if (res?.data) problem = res.data;
        }
        if (problem) {
          setSelectedProblem(problem);
          setProblemInLocation(problem.slug);
          setActiveTab("problems");
        }
      } catch (err) {
        console.warn("Open contest problem failed:", err);
      }
    },
    []
  );

  const fetchUserSubmissions = async () => {
    if (!user) return;
    try {
      setLoadingSubmissions(true);
      const res = await submissionApi.getMySubmissions();
      if (res?.data) setUserSubmissions(res.data);
    } catch (err) {
      console.warn("Fetch user submissions failed:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const fetchBookmarks = async () => {
    if (!user || !hasAccessToken()) {
      setBookmarkedIds(new Set());
      return;
    }
    try {
      const res = await engagementApi.listMyBookmarks();
      const rows = Array.isArray(res?.data) ? res.data : [];
      const ids = new Set(
        rows
          .map((p) => normalizeProblemId(p.id || p._id))
          .filter(Boolean)
      );
      setBookmarkedIds(ids);
      // Always sync bookmark flags — including when the list is empty.
      // Never touch revisionIds here.
      setProblems((prev) =>
        prev.map((p) => {
          const pid = normalizeProblemId(p.id || p._id);
          const bm = rows.find(
            (b) => normalizeProblemId(b.id || b._id) === pid
          );
          return bm
            ? {
              ...p,
              isBookmarked: true,
              likeCount: bm.likeCount ?? p.likeCount,
              dislikeCount: bm.dislikeCount ?? p.dislikeCount,
            }
            : { ...p, isBookmarked: ids.has(pid) };
        })
      );
    } catch (err) {
      console.warn("Fetch bookmarks failed:", err);
    }
  };

  const fetchRevisions = async () => {
    if (!user || !hasAccessToken()) {
      setRevisionIds(new Set());
      return;
    }
    try {
      const res = await engagementApi.listMyRevisions();
      // Never touch bookmarkedIds here.
      setRevisionIds(
        new Set(
          (res?.data?.problemIds || [])
            .map((id) => normalizeProblemId(id))
            .filter(Boolean)
        )
      );
    } catch (err) {
      console.warn("Fetch revisions failed:", err);
    }
  };

  const fetchFavourites = async () => {
    if (!user || !hasAccessToken()) {
      setFavouriteIds(new Set());
      return;
    }
    try {
      const res = await engagementApi.listMyFavoriteIds();
      setFavouriteIds(
        new Set(
          (res?.data?.problemIds || [])
            .map((id) => normalizeProblemId(id))
            .filter(Boolean)
        )
      );
    } catch (err) {
      console.warn("Fetch favourites failed:", err);
    }
  };

  const fetchImportant = async () => {
    if (!user || !hasAccessToken()) {
      setImportantIds(new Set());
      return;
    }
    try {
      const res = await engagementApi.listMyImportantIds();
      setImportantIds(
        new Set(
          (res?.data?.problemIds || [])
            .map((id) => normalizeProblemId(id))
            .filter(Boolean)
        )
      );
    } catch (err) {
      console.warn("Fetch important failed:", err);
    }
  };

  /** Bookmark-only state update — must never modify revisionIds. */
  const handleBookmarkChange = (problemId: string, isBookmarked: boolean) => {
    const id = normalizeProblemId(problemId);
    if (!id) return;
    setBookmarkedIds((prev) => updateIdSet(prev, id, isBookmarked));
    setProblems((prev) =>
      prev.map((p) =>
        normalizeProblemId(p.id || p._id) === id ? { ...p, isBookmarked } : p
      )
    );
    setFavouritesRefreshKey((k) => k + 1);
  };

  const handleFavoriteChange = (problemId: string, isFavourite: boolean) => {
    const id = normalizeProblemId(problemId);
    if (!id) return;
    setFavouriteIds((prev) => updateIdSet(prev, id, isFavourite));
    setFavouritesRefreshKey((k) => k + 1);
  };

  const handleImportantChange = (problemId: string, isImportant: boolean) => {
    const id = normalizeProblemId(problemId);
    if (!id) return;
    setImportantIds((prev) => updateIdSet(prev, id, isImportant));
  };

  /** Revision-only state update — must never modify bookmarkedIds. */
  const handleRevisionChange = (problemId: string, isRevision: boolean) => {
    const id = normalizeProblemId(problemId);
    if (!id) return;
    setRevisionIds((prev) => updateIdSet(prev, id, isRevision));
  };

  const handleRemoveBookmark = async (problemId: string) => {
    const id = normalizeProblemId(problemId);
    if (!id) return;
    try {
      await engagementApi.removeBookmark(id);
      handleBookmarkChange(id, false);
      // Do not call fetchRevisions / handleRevisionChange.
    } catch (err) {
      console.warn("Remove bookmark failed:", err);
      window.alert("Unable to update bookmark. Please try again.");
    }
  };

  const loadSubmissionsList = async () => {
    try {
      setLoadingSubmissions(true);
      let res;
      if (submissionSearch.trim()) {
        res = await submissionApi.searchSubmissions(submissionSearch.trim());
      } else if (submissionStatusFilter === "all") {
        res = await submissionApi.getAllSubmissions({ page: 1, limit: 50 });
      } else if (
        submissionStatusFilter !== "mine" &&
        submissionStatusFilter !== "all"
      ) {
        res = await submissionApi.getMySubmissions({
          status: submissionStatusFilter,
          language:
            submissionLangFilter !== "all" ? submissionLangFilter : undefined,
          limit: 50,
          page: 1,
        });
      } else if (submissionLangFilter !== "all") {
        res = await submissionApi.getMySubmissions({
          language: submissionLangFilter,
          limit: 50,
          page: 1,
        });
      } else {
        res = await submissionApi.getMySubmissions();
      }
      if (res?.data) setUserSubmissions(res.data);
    } catch (err) {
      console.warn("Load submissions failed:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const fetchProblemSubmissions = async (problemId: string) => {
    try {
      const res = await submissionApi.getByProblemId(problemId);
      if (res?.data) setProblemSubmissions(res.data);
    } catch {
      setProblemSubmissions([]);
    }
  };

  const syncMockInterviewSubmission = useCallback(
    async (submissionId: string, problemId: string) => {
      const sessionId = activeMockInterviewSessionIdRef.current;
      if (!sessionId || !submissionId || !problemId) return;
      try {
        // Authoritative: ProblemService reads judge fields from SubmissionService.
        await mockInterviewApi.attachSubmission(
          sessionId,
          String(problemId),
          String(submissionId)
        );
      } catch (err) {
        // Evaluation fan-out may already have recorded; soft-refresh still helps.
        console.warn("Mock interview attach sync failed:", err);
      }
      setMockInterviewSyncKey((k) => k + 1);
      setLearningRefreshKey((k) => k + 1);
    },
    []
  );

  const pollSubmissionStatus = async (id: string) => {
    // Faster polling so Submit progress (X / N) updates while judging
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        const latest = await submissionApi.getSubmissionById(id);
        if (latest?.data) {
          setSubmissionResult(latest.data);
          if (
            latest.data.status !== "PENDING" &&
            latest.data.status !== "RUNNING" &&
            latest.data.status !== "COMPILING"
          ) {
            const pid =
              latest.data.problemId?.toString() ||
              (selectedProblem ? getProblemId(selectedProblem) : "");
            const accepted = latest.data.status === "ACCEPTED";
            if (pid) {
              if (canAccess(user, "premium.study_sessions")) {
                void recordSessionProblemActivity(userId, pid, accepted).catch(
                  () => undefined
                );
              }
              if (accepted && canAccess(user, "premium.daily_planner")) {
                const ids = everAcceptedProblemIds([
                  ...userSubmissions,
                  latest.data,
                ]);
                ids.add(pid);
                void syncPlannerWithAccepted(userId, toDateKey(), ids).catch(
                  () => undefined
                );
              }
              setLearningRefreshKey((k) => k + 1);
            }
            fetchUserSubmissions();
            if (pid) fetchProblemSubmissions(pid);
            const subId = String(
              (latest.data as any).id || (latest.data as any)._id || id
            );
            if (activeMockInterviewSessionIdRef.current && pid && subId) {
              await syncMockInterviewSubmission(subId, pid);
            }
            return;
          }
        }
      } catch (err) {
        console.warn("poll error", err);
      }
    }
    setSubmissionError("Evaluation is taking longer than expected. Check Submissions tab for status.");
  };

  const userId = user?.id || (user as any)?._id;

  const problemIndex = useMemo(() => {
    if (!selectedProblem) return -1;
    const pid = getProblemId(selectedProblem);
    return problems.findIndex((p) => getProblemId(p) === pid);
  }, [problems, selectedProblem]);

  const loadCodeForContext = useCallback(
    (problem: Problem, language: string) => {
      const pid = getProblemId(problem);
      const saved = loadSavedCode(userId, pid, language);
      return saved ?? getStarterTemplate(problem, language);
    },
    [userId]
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setProblemPage(1);
  }, [debouncedSearch, selectedDifficulty, accessFilter]);

  useEffect(() => {
    void fetchProblems();
  }, [fetchProblems]);

  useEffect(() => {
    void fetchBookmarks();
    void fetchFavourites();
    void fetchImportant();
    void fetchRevisions();
    fetchUserSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSearchSubmit = () => {
    setActiveTab("problems");
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const match = problems.find(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
    if (match) {
      setSelectedProblem(match);
      setProblemInLocation(match.slug);
    }
  };

  // Deep-link: ?problem=slug (or pending slug after login)
  useEffect(() => {
    if (!problems.length || selectedProblem) return;
    const slug =
      readProblemSlugFromLocation() || consumePendingProblemSlug();
    if (!slug) return;

    const fromList = problems.find(
      (p) =>
        p.slug === slug ||
        (p.id || p._id || "").toString() === slug
    );
    if (fromList) {
      setSelectedProblem(fromList);
      setProblemInLocation(fromList.slug || slug);
      return;
    }

    void problemApi
      .getProblemBySlug(slug)
      .then((res) => {
        if (res?.data) {
          setSelectedProblem(res.data);
          setProblemInLocation(res.data.slug || slug);
        }
      })
      .catch(() => {
        // Invalid shared link — leave sheet open
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems]);

  // Keep URL in sync with open problem (shareable deep link)
  useEffect(() => {
    if (!selectedProblem || !userId) return;
    const pid = getProblemId(selectedProblem);
    if (!pid) return;
    // Opening a problem during an active session marks it attempted (not solved).
    void recordSessionProblemActivity(userId, pid, false)
      .then((session) => {
        if (session) setLearningRefreshKey((k) => k + 1);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProblem?.slug, userId]);

  useEffect(() => {
    if (selectedProblem?.slug) {
      setProblemInLocation(selectedProblem.slug);
    } else if (!selectedProblem) {
      // Only clear if URL currently has a problem param
      if (readProblemSlugFromLocation()) setProblemInLocation(null);
    }
  }, [selectedProblem]);

  useEffect(() => {
    if (user) {
      void fetchBookmarks();
      void fetchFavourites();
      void fetchImportant();
      void fetchRevisions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, (user as any)?._id]);

  useEffect(() => {
    if (!selectedProblem) return;
    setUserCode(loadCodeForContext(selectedProblem, selectedLanguage));
    setRunResult(null);
    setSubmissionResult(null);
    setSelectedSubmission(null);
    setRunError("");
    setSubmissionError("");
    const pid = getProblemId(selectedProblem);
    if (pid) fetchProblemSubmissions(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage, loadCodeForContext]);

  useEffect(() => {
    if (!selectedProblem) return;
    setUserCode(loadCodeForContext(selectedProblem, selectedLanguage));
    setRunResult(null);
    setSubmissionResult(null);
    setSelectedSubmission(null);
    setRunError("");
    setSubmissionError("");
    setCustomTestCases([]);
    setSelectedCaseIndex(0);
    setRunMode("all");
    const pid = getProblemId(selectedProblem);
    if (pid) fetchProblemSubmissions(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProblem]);

  // Persist code (debounced)
  useEffect(() => {
    if (!selectedProblem || !userCode) return;
    const pid = getProblemId(selectedProblem);
    const t = window.setTimeout(() => {
      saveCode(userId, pid, selectedLanguage, userCode);
    }, 400);
    return () => window.clearTimeout(t);
  }, [userCode, selectedProblem, selectedLanguage, userId]);

  const handleResetCode = () => {
    if (!selectedProblem) return;
    const pid = getProblemId(selectedProblem);
    clearSavedCode(userId, pid, selectedLanguage);
    setUserCode(getStarterTemplate(selectedProblem, selectedLanguage));
  };

  const handlePrevProblem = () => {
    if (problemIndex <= 0) return;
    setSelectedProblem(problems[problemIndex - 1]);
  };

  const handleNextProblem = () => {
    if (problemIndex < 0 || problemIndex >= problems.length - 1) return;
    setSelectedProblem(problems[problemIndex + 1]);
  };

  const handleLoadSubmission = (sub: Submission) => {
    // Never overwrite the live editor — open read-only submission view
    setSelectedSubmission(sub);
  };

  const handleCloseSubmissionView = () => {
    setSelectedSubmission(null);
  };

  const executeCases = async (
    casesToRun: Array<
      Pick<Testcase, "input" | "output" | "expectedOutput"> & {
        isCustomCase?: boolean;
      }
    >
  ) => {
    if (!selectedProblem) return;
    setIsRunning(true);
    setRunResult(null);
    setRunError("");
    // Run and Submit results are mutually exclusive in the Test Result tab
    setSubmissionResult(null);
    setSubmissionError("");

    let overall: RunResult["status"] = "ACCEPTED";
    let totalTime = 0;
    let maxMemory = 0;
    let passed = 0;
    let caseResults: RunCaseResult[] = [];
    let persistError = "";

    try {
      for (let i = 0; i < casesToRun.length; i++) {
        const tc = casesToRun[i];
        const stdin = formatJudgeInput(tc.input);
        const expected = getTestCaseExpectedOutput(tc);

        const res = await evaluationApi.runCode({
          code: userCode,
          language: selectedLanguage,
          input: stdin,
          timeLimitMs: selectedProblem.timeLimitMs,
          memoryLimitMb: selectedProblem.memoryLimitMb,
          functionName: selectedProblem.functionName,
          className: selectedProblem.className || "Solution",
          problemId: selectedProblem._id || (selectedProblem as { id?: string }).id,
          isCustomCase: Boolean(tc.isCustomCase),
        });

        if (!res?.data) {
          overall = "RUNTIME_ERROR";
          caseResults.push({
            index: i,
            input: stdin,
            expected,
            actual: "",
            status: "ERROR",
            error: "Empty response from evaluation service",
          });
          break;
        }

        const { stdout, stderr, exitCode, executionTimeMs, memoryMb, timedOut } = res.data;
        totalTime = Math.max(totalTime, executionTimeMs || 0);
        maxMemory = Math.max(maxMemory, memoryMb || 0);

        if (timedOut) {
          overall = "TIME_LIMIT_EXCEEDED";
          caseResults.push({
            index: i,
            input: stdin,
            expected,
            actual: "",
            status: "TIME_LIMIT_EXCEEDED",
            error: "Time Limit Exceeded",
            executionTime: executionTimeMs,
            memory: memoryMb,
          });
          break;
        }

        if (exitCode !== 0) {
          const isCompile =
            /COMPILATION_ERROR|error:|SyntaxError|g\+\+|javac/i.test(stderr || "");
          overall = isCompile ? "COMPILATION_ERROR" : "RUNTIME_ERROR";
          caseResults.push({
            index: i,
            input: stdin,
            expected,
            actual: stdout || "",
            status: isCompile ? "COMPILATION_ERROR" : "RUNTIME_ERROR",
            error: stderr || stdout || `exit ${exitCode}`,
            executionTime: executionTimeMs,
            memory: memoryMb,
          });
          break;
        }

        if (expected && !outputsMatch(stdout, expected)) {
          overall = "WRONG_ANSWER";
          caseResults.push({
            index: i,
            input: stdin,
            expected,
            actual: stdout,
            status: "FAILED",
            executionTime: executionTimeMs,
            memory: memoryMb,
          });
          break;
        }

        passed++;
        caseResults.push({
          index: i,
          input: stdin,
          expected,
          actual: stdout,
          status: "PASSED",
          executionTime: executionTimeMs,
          memory: memoryMb,
        });
      }

      setRunResult({
        mode: "run",
        status: overall,
        cases: caseResults,
        passed,
        total: casesToRun.length,
        executionTime: totalTime,
        memory: maxMemory,
        error: caseResults.find((c) => c.status !== "PASSED")?.error,
      });
      if (caseResults.length > 0) {
        onSelectedCaseIndexSafe(caseResults[caseResults.length - 1].index);
      }
    } catch (err: any) {
      const data = err.response?.data;
      const fieldErrors = Array.isArray(data?.errors)
        ? data.errors
          .map((e: { path?: string; message?: string }) =>
            e.path ? `${e.path}: ${e.message}` : e.message
          )
          .filter(Boolean)
          .join("; ")
        : "";
      persistError =
        fieldErrors ||
        (typeof data?.message === "string" ? data.message : "") ||
        (typeof err?.message === "string" ? err.message : "") ||
        "Code execution failed.";
      setRunError(persistError);
      overall = "RUNTIME_ERROR";
    } finally {
      // Persist Run as Attempted (never Solved) — even on compile/runtime/WA/TLE/API error
      await persistRunAttempt({
        status: overall as SubmissionStatus,
        passed,
        total: casesToRun.length,
        executionTime: totalTime,
        memory: maxMemory,
        error: persistError || caseResults.find((c) => c.status !== "PASSED")?.error,
      });
      setIsRunning(false);
    }
  };

  const persistRunAttempt = async (meta: {
    status: SubmissionStatus;
    passed: number;
    total: number;
    executionTime: number;
    memory: number;
    error?: string;
  }) => {
    if (!selectedProblem || !user) return;
    const uid = user.id || (user as { _id?: string })._id;
    const problemId = selectedProblem.id || selectedProblem._id;
    if (!uid || !problemId) return;

    try {
      const res = await submissionApi.createSubmission({
        userId: uid,
        problemId,
        code: userCode,
        language: selectedLanguage as ProgrammingLanguage,
        source: "run",
        status: meta.status,
        error: meta.error,
        executionTime: meta.executionTime,
        memory: meta.memory,
        testCasesPassed: meta.passed,
        totalTestCases: meta.total,
      });
      if (res?.data) {
        setProblemSubmissions((prev) => [res.data, ...prev]);
        setUserSubmissions((prev) => [res.data, ...prev]);
        recordSessionProblemActivity(userId, problemId.toString(), false).catch(
          () => undefined
        );
        setLearningRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.warn("Failed to persist run attempt", err);
    }
  };

  const onSelectedCaseIndexSafe = (idx: number) => {
    setSelectedCaseIndex(idx);
  };

  const handleRunCode = async () => {
    if (!submissionsEnabled) {
      setRunError("Code runs are currently disabled.");
      return;
    }
    if (!selectedProblem || busy || runLockRef.current || submitLockRef.current) return;
    runLockRef.current = true;
    setSelectedSubmission(null);
    try {
      const official = selectedProblem.testcases?.filter((tc) => !tc.isHidden) || [];
      const customs = customTestCases.map((tc) => ({
        ...tc,
        isCustomCase: true as const,
      }));
      const allVisible = [
        ...official.map((tc) => ({ ...tc, isCustomCase: false as const })),
        ...customs,
      ];
      if (allVisible.length === 0) {
        setRunError("No test cases available to run.");
        return;
      }
      const casesToRun =
        runMode === "selected"
          ? [allVisible[Math.min(selectedCaseIndex, allVisible.length - 1)]]
          : allVisible;
      await executeCases(casesToRun);
    } finally {
      runLockRef.current = false;
    }
  };

  const handleSubmitCode = async () => {
    if (!submissionsEnabled) {
      setSubmissionError("Submissions are currently disabled.");
      return;
    }
    if (!selectedProblem || !user || busy || submitLockRef.current || runLockRef.current) return;
    submitLockRef.current = true;
    setSelectedSubmission(null);
    setIsSubmitting(true);
    // Clear previous Run so Test Result shows only Submit
    setRunResult(null);
    setRunError("");
    setSubmissionError("");

    const totalHint =
      selectedProblem.totalTestcaseCount ??
      (selectedProblem.publicTestcaseCount ?? 0) +
      (selectedProblem.hiddenTestcaseCount ?? 0);

    // Optimistic pending card — avoids stacking "Submitting..." + "Judging..."
    setSubmissionResult({
      status: "PENDING",
      language: selectedLanguage as ProgrammingLanguage,
      code: userCode,
      source: "submit",
      testCasesPassed: 0,
      totalTestCases: totalHint > 0 ? totalHint : undefined,
    } as Submission);

    try {
      const uid = user.id || (user as any)._id;
      const problemId = selectedProblem.id || selectedProblem._id;
      if (!uid || !problemId) {
        setSubmissionError("Missing user or problem id.");
        setSubmissionResult(null);
        return;
      }

      // Submit sends problemId + code + language (+ source=submit) and optional session ids.
      // Hidden/public suite is loaded server-side from ProblemService.
      const res = await submissionApi.createSubmission({
        userId: uid,
        problemId,
        code: userCode,
        language: selectedLanguage as ProgrammingLanguage,
        source: "submit",
        ...(activeMockInterviewSessionId
          ? { mockInterviewSessionId: activeMockInterviewSessionId }
          : activeVirtualContestSessionId
            ? { virtualContestSessionId: activeVirtualContestSessionId }
            : activeContestId
              ? { contestId: activeContestId }
              : {}),
      });

      if (res?.data) {
        setSubmissionResult({
          ...res.data,
          totalTestCases:
            res.data.totalTestCases ?? (totalHint > 0 ? totalHint : undefined),
          testCasesPassed: res.data.testCasesPassed ?? 0,
        });
        // Optimistic: failed/pending submit still counts as Attempted in UI
        setProblemSubmissions((prev) => [res.data, ...prev]);
        setUserSubmissions((prev) => [res.data, ...prev]);
        const sid = res.data.id || res.data._id;
        const pid = String(selectedProblem.id || selectedProblem._id || "");
        // Sync PENDING into interview immediately (server reads SubmissionService).
        if (activeMockInterviewSessionId && sid && pid) {
          void syncMockInterviewSubmission(String(sid), pid);
        }
        if (sid) await pollSubmissionStatus(sid);
        if (pid) fetchProblemSubmissions(pid);
      } else {
        setSubmissionError("Empty response from submission service.");
        setSubmissionResult(null);
      }
    } catch (err: any) {
      const offline =
        err.code === "ECONNABORTED" ||
        err.code === "ERR_NETWORK" ||
        /timeout|network error/i.test(err.message || "");
      setSubmissionError(
        offline
          ? "Submission service is unreachable or timed out. Ensure it is running on port 3004."
          : err.response?.data?.message || err.message || "Submission failed."
      );
      setSubmissionResult(null);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  useEffect(() => {
    if (!selectedProblem) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        if (!busy) void handleSubmitCode();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!busy) void handleRunCode();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveCode(userId, getProblemId(selectedProblem), selectedLanguage, userCode);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProblem, busy, userCode, selectedLanguage, customTestCases, runMode, selectedCaseIndex]);

  const handleTabChange = (tab: typeof dashTab) => {
    setDashTab(tab);
    if (tab === "submissions") loadSubmissionsList();
    if (tab === "sessions") {
      setLoadingSessions(true);
      authApi
        .getActiveSessions()
        .then((r) => {
          const rows = Array.isArray(r.data) ? r.data : [];
          setSessions(
            rows.map((s: any) => ({
              ...s,
              id: String(s.id || s._id || ""),
            }))
          );
        })
        .catch(() => setSessions([]))
        .finally(() => setLoadingSessions(false));
    }
    if (tab === "audit") {
      setLoadingSecurityLogs(true);
      authApi
        .getSecurityLogs()
        .then((r) => {
          const rows = Array.isArray(r.data) ? r.data : [];
          setSecurityLogs(rows);
        })
        .catch(() => setSecurityLogs([]))
        .finally(() => setLoadingSecurityLogs(false));
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileMsg("");
    try {
      const res = await authApi.updateProfile({ name: editName, avatar: avatarBase64 || undefined });
      setProfileMsg("Profile updated successfully!");
      if (res.data && user) setUser({ ...user, name: res.data.name, avatar: res.data.avatar });
    } catch (err: any) {
      setProfileMsg(err.response?.data?.message || "Failed to update profile");
    } finally {
      setUpdatingProfile(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setStudySessions([]);
      return;
    }
    const allowPlanner = canAccess(user, "premium.daily_planner");
    const allowSessions = canAccess(user, "premium.study_sessions");
    if (!allowPlanner && !allowSessions) {
      setStudySessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (allowPlanner && userSubmissions.length) {
          await syncPlannerWithAccepted(
            userId,
            toDateKey(),
            everAcceptedProblemIds(userSubmissions)
          );
        }
        if (allowSessions) {
          const list = await loadAllSessions(userId);
          if (!cancelled) setStudySessions(list);
        } else if (!cancelled) {
          setStudySessions([]);
        }
      } catch {
        /* streak falls back to submissions-only activity */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, user, userSubmissions.length, learningRefreshKey]);

  const streakInfo = useMemo(() => {
    const activity = buildDayActivityMap(userSubmissions, studySessions);
    return computeStreaks(activity);
  }, [userSubmissions, studySessions]);

  const roadmapTopics = useMemo(() => {
    const cats = new Set<string>();
    for (const p of problems) {
      if (p.category) cats.add(p.category);
    }
    return cats.size
      ? [...cats]
      : [
        "Arrays",
        "Strings",
        "Binary Search",
        "Linked List",
        "Trees",
        "Graphs",
        "Dynamic Programming",
      ];
  }, [problems]);

  const bumpLearning = useCallback(() => {
    setLearningRefreshKey((k) => k + 1);
  }, []);

  const handleStartSessionNav = useCallback(
    (topic?: string) => {
      if (topic && userId) {
        void startStudySession(userId, topic)
          .then(() => {
            setActiveTab("sessions");
            bumpLearning();
          })
          .catch(() => {
            setActiveTab("sessions");
            bumpLearning();
          });
        return;
      }
      setActiveTab("sessions");
      bumpLearning();
    },
    [bumpLearning, userId]
  );

  useEffect(() => {
    if (activeTab === "contests" && !contestsEnabled) setActiveTab("problems");
    if (activeTab === "discuss" && !discussionsEnabled) setActiveTab("problems");
  }, [activeTab, contestsEnabled, discussionsEnabled]);

  useEffect(() => {
    if (!settings?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = settings.faviconUrl;
  }, [settings?.faviconUrl]);

  useEffect(() => {
    if (!settings?.defaultLanguage || !settings.supportedLanguages?.length) return;
    if (!settings.supportedLanguages.includes(selectedLanguage as JudgeLanguage)) {
      setSelectedLanguage(settings.defaultLanguage);
    }
  }, [settings?.defaultLanguage, settings?.supportedLanguages, selectedLanguage]);

  const navItems = useMemo(() => {
    return PLATFORM_NAV_ITEMS.filter((item) => {
      if (item.featureFlag === "contests") return contestsEnabled;
      if (item.featureFlag === "discussions") return discussionsEnabled;
      if (item.featureFlag === "submissions") return submissionsEnabled;
      return true;
    }).map((item) => {
      const isPremiumNav = isPlatformNavPremium(item);
      const premiumLocked = Boolean(
        item.premiumFeature && !canAccess(user, item.premiumFeature)
      );
      return {
        ...item,
        isPremiumNav,
        premiumLocked,
        tooltip: isPremiumNav
          ? platformNavPremiumTooltip(item, premiumLocked)
          : item.label,
      };
    });
  }, [contestsEnabled, discussionsEnabled, submissionsEnabled, user]);

  const handlePlatformNav = useCallback(
    (id: PlatformNavId, premiumFeature?: string, premiumLocked?: boolean) => {
      if (premiumFeature && premiumLocked) {
        setPendingPremiumNav(id, premiumFeature);
      }
      setActiveTab(id);
    },
    []
  );

  // After checkout / entitlement refresh, return to the Premium feature the user tried to open.
  useEffect(() => {
    if (!user) return;
    const pending = peekPendingPremiumNav();
    if (!pending?.tab) return;
    if (pending.feature && !canAccess(user, pending.feature)) return;
    consumePendingPremiumNav();
    setActiveTab(pending.tab as PlatformTab);
  }, [user?.features, user?.accessTier, user?.subscription]);

  return (
    <div className="platform-root">
      <header className="platform-navbar">
        <button
          type="button"
          className="platform-brand"
          onClick={() => setActiveTab("home")}
          aria-label={`${platformName} home`}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              width={30}
              height={30}
              className="platform-brand-mark algopath-brand-mark"
              draggable={false}
            />
          ) : (
            <BrandMark size={30} className="platform-brand-mark" />
          )}
          <span className="platform-brand-name">{platformName}</span>
        </button>

        <nav className="platform-navbar-nav" aria-label="Primary">
          {navItems.map(
            ({ id, label, icon: Icon, isPremiumNav, premiumLocked, premiumFeature, tooltip }) => (
              <button
                key={id}
                type="button"
                className={`platform-navbar-link ${activeTab === id ? "active" : ""}`}
                aria-label={tooltip}
                title={tooltip}
                onClick={() =>
                  handlePlatformNav(id, premiumFeature, premiumLocked)
                }
              >
                <span className="platform-navbar-link-icon" aria-hidden>
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <span className="platform-navbar-link-label">{label}</span>
                {isPremiumNav ? (
                  <PremiumNavIndicator
                    locked={premiumLocked}
                    variant="navbar"
                  />
                ) : null}
              </button>
            )
          )}
        </nav>

        <div className="platform-navbar-right">
          <label className="platform-navbar-search">
            <Search size={14} aria-hidden />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search problems…"
              value={searchQuery}
              aria-label="Search problems"
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                color: "inherit",
                font: "inherit",
                outline: "none",
              }}
            />
            <kbd>⌘K</kbd>
          </label>
          <span className="platform-chip platform-chip-streak" title="Current streak">
            <Flame size={14} fill="currentColor" /> {streakInfo.current}d
          </span>
          <NotificationBell enabled={notificationsEnabled} />
          <SystemBroadcastListener enabled={notificationsEnabled} />
          {onOpenAdmin && (
            <button
              type="button"
              className="platform-icon-btn"
              title="Admin"
              aria-label="Admin"
              onClick={onOpenAdmin}
            >
              <ShieldCheck size={18} />
            </button>
          )}
          <button
            type="button"
            className="platform-avatar-btn"
            title="Profile"
            aria-label="Open profile"
            onClick={() => setActiveTab("profile")}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              user?.name?.charAt(0) || "U"
            )}
          </button>
        </div>
      </header>

      <div className="platform-shell">
        <aside className="platform-sidebar" aria-label="Primary navigation">
          <nav className="platform-sidebar-nav">
            {navItems.map(
              ({
                id,
                icon: Icon,
                label,
                isPremiumNav,
                premiumLocked,
                premiumFeature,
                tooltip,
              }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={tooltip}
                  aria-current={activeTab === id ? "page" : undefined}
                  className={`platform-nav-item ${activeTab === id ? "active" : ""}`}
                  onClick={() =>
                    handlePlatformNav(id, premiumFeature, premiumLocked)
                  }
                  title={tooltip}
                >
                  <span className="platform-nav-icon">
                    <Icon size={20} strokeWidth={1.75} />
                    {isPremiumNav ? (
                      <PremiumNavIndicator locked={premiumLocked} />
                    ) : null}
                  </span>
                  <span className="platform-nav-tooltip" role="tooltip">
                    {tooltip}
                  </span>
                  <span className="platform-nav-label">{label}</span>
                </button>
              )
            )}
          </nav>
          <div className="platform-sidebar-bottom">
            <button
              type="button"
              className={`platform-nav-item ${activeTab === "profile" ? "active" : ""}`}
              aria-label="Profile"
              aria-current={activeTab === "profile" ? "page" : undefined}
              onClick={() => setActiveTab("profile")}
            >
              <span className="platform-nav-icon platform-nav-avatar">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" />
                ) : (
                  user?.name?.charAt(0) || "U"
                )}
              </span>
              <span className="platform-nav-tooltip" role="tooltip">
                Profile
              </span>
            </button>
          </div>
        </aside>

        <div className="platform-main">
          <AnnouncementBanner />
          {activeMockInterviewSessionId && activeMockInterviewMeta ? (
            <div
              className="mock-interview-workspace-bar"
              role="status"
              aria-live="polite"
            >
              <span className="mock-interview-workspace-bar-label">
                <Swords size={14} aria-hidden /> Mock interview
              </span>
              <InterviewTimer
                className="mock-interview-workspace-bar-timer"
                endsAt={activeMockInterviewMeta.endsAt}
                serverNow={activeMockInterviewMeta.serverNow}
                initialRemainingMs={activeMockInterviewMeta.remainingMs}
              />
              <button
                type="button"
                className="mock-interview-workspace-bar-link"
                onClick={() => setActiveTab("interview")}
              >
                Back to interview
              </button>
            </div>
          ) : null}
          {activeTab !== "problems" &&
            activeTab !== "favourites" &&
            activeTab !== "companies" &&
            activeTab !== "interview" &&
            activeTab !== "ai" &&
            activeTab !== "analytics" &&
            activeTab !== "reviews" &&
            activeTab !== "home" &&
            activeTab !== "ranks" &&
            activeTab !== "learn" &&
            activeTab !== "discuss" &&
            activeTab !== "contests" &&
            activeTab !== "planner" &&
            activeTab !== "sessions" &&
            activeTab !== "calendar" &&
            activeTab !== "profile" && (
              <header className="platform-topbar">
                <span className="platform-topbar-title">
                  {activeTab === "profile" && "Profile & Settings"}
                </span>
                <div className="platform-topbar-actions">
                  <span className="platform-chip platform-chip-streak">
                    <Flame size={14} fill="currentColor" aria-hidden />{" "}
                    {streakInfo.current} Day Streak
                  </span>
                </div>
              </header>
            )}

          <main className="platform-content">
            {activeTab === "home" && (
              <FreeHomeDashboard
                userName={user?.name || ""}
                userId={userId || ""}
                problems={problems}
                submissions={userSubmissions}
                studySessions={studySessions}
                loadingProblems={loadingProblems}
                loadingSubmissions={loadingSubmissions}
                refreshKey={learningRefreshKey}
                onSelectProblem={(p) => {
                  setActiveContestId(null);
                  setSelectedProblem(p);
                }}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === "problems" && (
              <ProblemsSheet
                problems={problems}
                loading={loadingProblems}
                fetchError={problemsError}
                onRetryFetch={fetchProblems}
                submissions={userSubmissions}
                searchQuery={searchQuery}
                selectedDifficulty={selectedDifficulty}
                accessFilter={accessFilter}
                statusFilter={statusFilter}
                bookmarkedIds={bookmarkedIds}
                favouriteIds={favouriteIds}
                importantIds={importantIds}
                revisionIds={revisionIds}
                userId={userId}
                userName={user?.name}
                learningRefreshKey={learningRefreshKey}
                problemPage={problemPage}
                totalPages={totalPages}
                onProblemPageChange={setProblemPage}
                onSearchChange={setSearchQuery}
                onDifficultyChange={setSelectedDifficulty}
                onAccessFilterChange={setAccessFilter}
                onStatusFilterChange={setStatusFilter}
                onSelectProblem={(p) => {
                  setActiveContestId(null);
                  setSelectedProblem(p);
                }}
                onRemoveBookmark={handleRemoveBookmark}
                onBookmarkChange={handleBookmarkChange}
                onFavoriteChange={handleFavoriteChange}
                onImportantChange={handleImportantChange}
                onRevisionChange={handleRevisionChange}
                onOpenAdmin={onOpenAdmin}
                onNavigateLearning={(tab) => setActiveTab(tab)}
                onProgressImported={async () => {
                  await fetchUserSubmissions();
                  setLearningRefreshKey((k) => k + 1);
                }}
              />
            )}

            {activeTab === "favourites" && (
              <FavouritesPage
                submissions={userSubmissions}
                userId={userId}
                refreshKey={favouritesRefreshKey}
                onSelectProblem={setSelectedProblem}
                onFavoriteChange={handleFavoriteChange}
                onExploreQuestions={() => setActiveTab("problems")}
              />
            )}

            {activeTab === "companies" && (
              <PremiumGate
                feature="premium.company_questions"
                title="Company Preparation"
                description="Prepare for interviews with company-specific problem sets and preparation insights."
              >
                <CompaniesPage
                  solvedProblemIds={everAcceptedProblemIds(userSubmissions)}
                  mockInterviewAvailable={canAccess(
                    user,
                    "premium.mock_interview"
                  )}
                  onStartMockInterview={(companyName) => {
                    setPreferredMockCompany(companyName);
                    setActiveTab("interview");
                  }}
                  onSelectProblem={(ref) =>
                    void handleOpenProblemFromContest(ref)
                  }
                />
              </PremiumGate>
            )}

            {(activeTab === "interview" ||
              Boolean(activeMockInterviewSessionId)) && (
                <div
                  hidden={activeTab !== "interview"}
                  aria-hidden={activeTab !== "interview"}
                >
                  <PremiumGate
                    feature="premium.mock_interview"
                    title="Mock Interview"
                    description="Timed mock interviews with real problem sets — Premium members only."
                  >
                    <MockInterviewPanel
                      refreshKey={mockInterviewSyncKey + learningRefreshKey}
                      preferredCompany={preferredMockCompany}
                      lastSubmission={(() => {
                        const official = [...userSubmissions]
                          .filter((s) => s.source !== "run")
                          .sort((a, b) => {
                            const ta = new Date(
                              a.createdAt || a.updatedAt || 0
                            ).getTime();
                            const tb = new Date(
                              b.createdAt || b.updatedAt || 0
                            ).getTime();
                            return tb - ta;
                          })[0];
                        if (!official) return null;
                        const id = String(
                          (official as any).id || (official as any)._id || ""
                        );
                        const problemId = String(official.problemId || "");
                        return id && problemId ? { id, problemId } : null;
                      })()}
                      onActiveSessionChange={handleActiveMockSessionChange}
                      onOpenProblem={(p, mockSid, interviewLanguage) => {
                        setSelectedProblem(p);
                        setProblemInLocation(p.slug);
                        if (interviewLanguage) {
                          setSelectedLanguage(interviewLanguage);
                        } else if (activeMockInterviewMeta?.language) {
                          setSelectedLanguage(activeMockInterviewMeta.language);
                        }
                        setActiveTab("problems");
                        if (mockSid) {
                          setActiveMockInterviewSessionId(mockSid);
                          setActiveContestId(null);
                          setActiveVirtualContestSessionId(null);
                        }
                      }}
                      onViewSubmission={async ({
                        submissionId,
                        problemId,
                        problemSlug,
                      }) => {
                        try {
                          let problem: Problem | null = null;
                          if (problemSlug) {
                            try {
                              const bySlug =
                                await problemApi.getProblemBySlug(problemSlug);
                              problem = bySlug.data || null;
                            } catch {
                              /* fall through */
                            }
                          }
                          if (!problem) {
                            const byId =
                              await problemApi.getProblemById(problemId);
                            problem = byId.data || null;
                          }
                          if (!problem) return;
                          const subRes =
                            await submissionApi.getSubmissionById(submissionId);
                          setSelectedProblem(problem);
                          setProblemInLocation(problem.slug);
                          setActiveTab("problems");
                          if (subRes?.data) {
                            setSelectedSubmission(subRes.data);
                          }
                        } catch (err) {
                          console.warn("View mock interview submission failed:", err);
                        }
                      }}
                    />
                  </PremiumGate>
                </div>
              )}

            {activeTab === "ai" && (
              <PremiumGate
                feature="premium.ai"
                title="AlgoPath AI"
                description="Get intelligent support throughout your DSA learning journey."
              >
                <AiAssistantPanel
                  refreshKey={learningRefreshKey}
                  problemId={
                    selectedProblem
                      ? String(
                        (selectedProblem as any).id ||
                        (selectedProblem as any)._id ||
                        ""
                      ) || null
                      : null
                  }
                  problemTitle={selectedProblem?.title || null}
                />
              </PremiumGate>
            )}

            {activeTab === "analytics" && (
              <PremiumGate
                feature="premium.analytics"
                title="Analytics"
                description="Understand your solving progress and learning performance with detailed insights."
              >
                <SubmissionAnalyticsPanel
                  refreshKey={learningRefreshKey}
                  onOpenRevisionQueue={() => setActiveTab("reviews")}
                  onPracticeProblems={() => setActiveTab("problems")}
                  onOpenProblem={async (pid) => {
                    const local = problems.find(
                      (x: any) =>
                        String(x.id || x._id) === String(pid)
                    );
                    if (local) {
                      setSelectedProblem(local);
                      setActiveTab("problems");
                      return;
                    }
                    try {
                      const res = await problemApi.getProblemById(pid);
                      if (res.data) {
                        setSelectedProblem(res.data);
                        setActiveTab("problems");
                      }
                    } catch {
                      /* stay on analytics */
                    }
                  }}
                />
              </PremiumGate>
            )}

            {activeTab === "reviews" && (
              <PremiumGate
                feature="premium.spaced_repetition"
                title="Revision Queue"
                description="Keep important problems organized and maintain a consistent revision routine."
              >
                <SpacedRepetitionPanel
                  refreshKey={learningRefreshKey}
                  onOpenProblem={async (pid) => {
                    const local = problems.find(
                      (x: any) =>
                        String(x.id || x._id) === String(pid)
                    );
                    if (local) {
                      setSelectedProblem(local);
                      setActiveTab("problems");
                      return;
                    }
                    try {
                      const res = await problemApi.getProblemById(pid);
                      if (res.data) {
                        setSelectedProblem(res.data);
                        setActiveTab("problems");
                      }
                    } catch {
                      /* leave user on reviews if problem cannot open */
                    }
                  }}
                />
              </PremiumGate>
            )}

            {activeTab === "calendar" && (
              <PremiumGate
                feature="premium.learning_calendar"
                title="Your Learning Calendar"
                description="Organize your entire DSA journey in one place — planned problems, revisions, and sessions."
              >
                <LearningCalendarRoadmap
                  problems={problems}
                  submissions={userSubmissions}
                  userId={userId}
                  refreshKey={learningRefreshKey}
                  onSelectProblem={setSelectedProblem}
                  onStartSession={(topic) => {
                    handleStartSessionNav(topic);
                  }}
                />
              </PremiumGate>
            )}

            {activeTab === "sessions" && (
              <PremiumGate
                feature="premium.study_sessions"
                title="Sessions"
                description="Track focused coding and study sessions, analyze your productivity, and improve consistency."
              >
                <StudySessionsPanel
                  userId={userId}
                  problems={problems}
                  topics={roadmapTopics}
                  refreshKey={learningRefreshKey}
                  onSessionChange={bumpLearning}
                  onSelectProblem={setSelectedProblem}
                />
              </PremiumGate>
            )}

            {activeTab === "planner" && (
              <PremiumGate
                feature="premium.daily_planner"
                title="Daily Planner"
                description="Plan your DSA journey with an intelligent daily schedule."
              >
                <DailyPlannerPanel
                  userId={userId}
                  problems={problems}
                  submissions={userSubmissions}
                  refreshKey={learningRefreshKey}
                  onSelectProblem={setSelectedProblem}
                  onStartSession={handleStartSessionNav}
                  onPlanChange={bumpLearning}
                />
              </PremiumGate>
            )}

            {activeTab === "contests" && (
              <ContestsPanel
                authenticated={Boolean(user && hasAccessToken())}
                onOpenProblem={handleOpenProblemFromContest}
                onVirtualSessionChange={(sessionId) => {
                  setActiveVirtualContestSessionId(sessionId);
                  if (sessionId) setActiveContestId(null);
                }}
              />
            )}

            {activeTab === "discuss" && (
              <DiscussionsPanel
                authenticated={Boolean(user && hasAccessToken())}
              />
            )}

            {activeTab === "learn" && (
              <ContentLibraryPanel
                onOpenProblem={(ref) => void handleOpenProblemFromContest(ref)}
                onRequireAuth={() =>
                  window.alert("Sign in required to enroll in study plans.")
                }
              />
            )}

            {activeTab === "ranks" && (
              <LeaderboardPanel
                onExploreProblems={() => setActiveTab("problems")}
              />
            )}

            {activeTab === "profile" && (
              <ProfilePanel
                user={user}
                dashTab={dashTab}
                onTabChange={handleTabChange}
                editName={editName}
                avatarPreview={avatarPreview}
                profileMsg={profileMsg}
                updatingProfile={updatingProfile}
                userSubmissions={userSubmissions}
                loadingSubmissions={loadingSubmissions}
                submissionSearch={submissionSearch}
                submissionStatusFilter={submissionStatusFilter}
                submissionLangFilter={submissionLangFilter}
                selectedSubmission={profileSelectedSubmission}
                deletingSubmissionId={deletingSubmissionId}
                sessions={sessions}
                securityLogs={securityLogs}
                loadingSessions={loadingSessions}
                loadingSecurityLogs={loadingSecurityLogs}
                currentStreak={streakInfo.current}
                onNameChange={setEditName}
                onAvatarChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    setAvatarPreview(result);
                    setAvatarBase64(result);
                  };
                  reader.readAsDataURL(file);
                }}
                onUpdateProfile={handleUpdateProfile}
                onLoadSubmissions={loadSubmissionsList}
                onSubmissionSearchChange={setSubmissionSearch}
                onStatusFilterChange={setSubmissionStatusFilter}
                onLangFilterChange={setSubmissionLangFilter}
                onViewSubmission={async (id) => {
                  if (!id) return;
                  try {
                    const res = await submissionApi.getSubmissionById(id);
                    if (res?.data) setProfileSelectedSubmission(res.data);
                  } catch { /* ignore */ }
                }}
                onDeleteSubmission={async (id) => {
                  if (!id || !window.confirm("Delete submission?")) return;
                  setDeletingSubmissionId(id);
                  try {
                    await submissionApi.deleteSubmission(id);
                    setUserSubmissions((p) => p.filter((s) => (s.id || s._id) !== id));
                  } finally {
                    setDeletingSubmissionId(null);
                  }
                }}
                onClearSelectedSubmission={() => setProfileSelectedSubmission(null)}
                onRevokeSession={async (id) => {
                  await authApi.revokeSession(id);
                  setSessions((p) => p.filter((s) => String(s.id || s._id) !== id));
                }}
                onLogoutAllSessions={async () => {
                  await authApi.logoutAllSessions();
                  setSessions([]);
                  signout();
                }}
                onToggle2FA={async (enable) => {
                  const res = await authApi.toggle2FA(enable);
                  if (user) setUser({ ...user, twoFactorEnabled: enable });
                  setProfileMsg(res.message);
                }}
                onChangePassword={async (curr, next) => {
                  await authApi.changePassword({ currentPassword: curr, newPassword: next });
                }}
                onSignout={signout}
                onProgressImported={async () => {
                  await fetchUserSubmissions();
                  setLearningRefreshKey((k) => k + 1);
                }}
              />
            )}
          </main>
        </div>
      </div>

      {canAccess(user, "premium.study_sessions") ? (
        <ActiveStudySessionBar
          userId={userId}
          refreshKey={learningRefreshKey}
          onChange={bumpLearning}
          onOpenSessions={() => setActiveTab("sessions")}
        />
      ) : null}

      {selectedProblem && (
        <ProblemWorkspace
          problem={selectedProblem}
          userCode={userCode}
          selectedLanguage={selectedLanguage}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
          runResult={runResult}
          submissionResult={submissionResult}
          selectedSubmission={selectedSubmission}
          runError={runError}
          submissionError={submissionError}
          problemSubmissions={problemSubmissions}
          customTestCases={customTestCases}
          selectedCaseIndex={selectedCaseIndex}
          runMode={runMode}
          hasPrev={problemIndex > 0}
          hasNext={problemIndex >= 0 && problemIndex < problems.length - 1}
          userId={userId}
          onBack={() => {
            setSelectedProblem(null);
            setActiveContestId(null);
            setProblemInLocation(null);
          }}
          onCodeChange={setUserCode}
          onLanguageChange={setSelectedLanguage}
          onSubmit={handleSubmitCode}
          onRun={handleRunCode}
          onResetCode={handleResetCode}
          onPrevProblem={handlePrevProblem}
          onNextProblem={handleNextProblem}
          onCustomTestCasesChange={setCustomTestCases}
          onSelectedCaseIndexChange={setSelectedCaseIndex}
          onRunModeChange={setRunMode}
          onLoadSubmission={handleLoadSubmission}
          onCloseSubmissionView={handleCloseSubmissionView}
          onBookmarkChange={handleBookmarkChange}
          onFavoriteChange={handleFavoriteChange}
          onImportantChange={handleImportantChange}
          onRevisionChange={handleRevisionChange}
          submissionsEnabled={submissionsEnabled}
          advancedEditorEnabled={newEditorEnabled}
          supportedLanguages={supportedLanguages}
        />
      )}
    </div>
  );
};
