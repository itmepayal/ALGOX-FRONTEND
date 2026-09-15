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
} from "../utils/learningPersistence";
import {
  buildDayActivityMap,
  computeStreaks,
  everAcceptedProblemIds,
} from "../utils/learningStats";
import { normalizeProblemId, updateIdSet } from "../utils/engagementIds";
import type { RunCaseResult, RunResult } from "../types/judge";
import {
  CalendarDays,
  Flame,
  Home,
  ListTodo,
  Search,
  ShieldCheck,
  Star,
  Timer,
  User as UserIcon,
} from "lucide-react";

type PlatformTab =
  | "problems"
  | "favourites"
  | "calendar"
  | "sessions"
  | "planner"
  | "contests"
  | "discuss"
  | "learn"
  | "ranks"
  | "profile";

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
  const [activeTab, setActiveTab] = useState<PlatformTab>("problems");
  const [learningRefreshKey, setLearningRefreshKey] = useState(0);
  const [favouritesRefreshKey, setFavouritesRefreshKey] = useState(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "solved" | "attempted" | "unsolved">("all");
  const [customTestCases, setCustomTestCases] = useState<Testcase[]>([]);
  const [runMode, setRunMode] = useState<"all" | "selected">("all");
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
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

  const [dashTab, setDashTab] = useState<"overview" | "submissions" | "sessions" | "security">("overview");
  const [sessions, setSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
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

  const fetchProblems = async () => {
    try {
      setLoadingProblems(true);
      const res = await problemApi.getProblems({ limit: 500 });
      if (res?.data) setProblems(res.data);
    } catch (err) {
      console.warn("Fetch problems failed:", err);
    } finally {
      setLoadingProblems(false);
    }
  };

  const fetchUserSubmissions = async () => {
    if (!user) return;
    const userId = user.id || (user as any)._id;
    if (!userId) return;
    try {
      const res = await submissionApi.getByUserId(userId);
      if (res?.data) setUserSubmissions(res.data);
    } catch (err) {
      console.warn("Fetch user submissions failed:", err);
    }
  };

  const fetchBookmarks = async () => {
    if (!user || !localStorage.getItem("accessToken")) {
      setBookmarkedIds(new Set());
      return;
    }
    try {
      const res = await engagementApi.listMyBookmarks();
      const ids = new Set(
        (res?.data || [])
          .map((p) => normalizeProblemId(p.id || p._id))
          .filter(Boolean)
      );
      setBookmarkedIds(ids);
      // Always sync bookmark flags — including when the list is empty.
      // Never touch revisionIds here.
      setProblems((prev) =>
        prev.map((p) => {
          const pid = normalizeProblemId(p.id || p._id);
          const bm = res?.data?.find(
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
    if (!user || !localStorage.getItem("accessToken")) {
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
      window.alert("Unable to update favourites. Please try again.");
    }
  };

  const loadSubmissionsList = async () => {
    try {
      setLoadingSubmissions(true);
      let res;
      if (submissionSearch.trim()) {
        res = await submissionApi.searchSubmissions(submissionSearch.trim());
      } else if (submissionStatusFilter !== "mine" && submissionStatusFilter !== "all") {
        res = await submissionApi.getByStatus(submissionStatusFilter);
      } else if (submissionLangFilter !== "all") {
        res = await submissionApi.getByLanguage(submissionLangFilter);
      } else if (submissionStatusFilter === "all") {
        res = await submissionApi.getAllSubmissions({ page: 1, limit: 50 });
      } else {
        const userId = user?.id || (user as any)?._id;
        if (!userId) return;
        res = await submissionApi.getByUserId(userId);
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
              recordSessionProblemActivity(userId, pid, accepted);
              if (accepted) {
                const ids = everAcceptedProblemIds([
                  ...userSubmissions,
                  latest.data,
                ]);
                ids.add(pid);
                syncPlannerWithAccepted(userId, toDateKey(), ids);
              }
              setLearningRefreshKey((k) => k + 1);
            }
            fetchUserSubmissions();
            if (pid) fetchProblemSubmissions(pid);
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
    fetchProblems().then(() => {
      void fetchBookmarks();
      void fetchRevisions();
    });
    fetchUserSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    casesToRun: Array<Pick<Testcase, "input" | "output" | "expectedOutput">>
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
        recordSessionProblemActivity(userId, problemId.toString(), false);
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
      const allVisible = [...official, ...customTestCases];
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

      // Submit sends ONLY problemId + code + language (+ source=submit).
      // Hidden/public suite is loaded server-side from ProblemService.
      const res = await submissionApi.createSubmission({
        userId: uid,
        problemId,
        code: userCode,
        language: selectedLanguage as ProgrammingLanguage,
        source: "submit",
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
        if (sid) await pollSubmissionStatus(sid);
        const pid = selectedProblem.id || selectedProblem._id;
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
    if (tab === "sessions") authApi.getActiveSessions().then((r) => r.data && setSessions(r.data as any[])).catch(() => {});
    if (tab === "security") authApi.getSecurityLogs().then((r) => r.data && setSecurityLogs(r.data as any[])).catch(() => {});
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
    if (!userId || !userSubmissions.length) return;
    syncPlannerWithAccepted(
      userId,
      toDateKey(),
      everAcceptedProblemIds(userSubmissions)
    );
    setLearningRefreshKey((k) => k + 1);
    // Only when submissions list identity changes meaningfully
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userSubmissions.length]);

  const streakInfo = useMemo(() => {
    void learningRefreshKey;
    const sessions = loadAllSessions(userId);
    const activity = buildDayActivityMap(userSubmissions, sessions);
    return computeStreaks(activity);
  }, [userId, userSubmissions, learningRefreshKey]);

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
      if (topic) {
        // Session is created by panel/planner; just navigate
      }
      setActiveTab("sessions");
      bumpLearning();
    },
    [bumpLearning]
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

  const topNavItems = [
    { id: "problems" as const, label: "Sheets" },
    { id: "favourites" as const, label: "My Favourites" },
    { id: "calendar" as const, label: "Roadmap" },
    { id: "sessions" as const, label: "Sessions" },
    { id: "planner" as const, label: "Planner" },
    ...(contestsEnabled
      ? [{ id: "contests" as const, label: "Contest" }]
      : []),
    ...(discussionsEnabled
      ? [{ id: "discuss" as const, label: "Discuss" }]
      : []),
    { id: "learn" as const, label: "Learn" },
    ...(submissionsEnabled ? [{ id: "ranks" as const, label: "Ranks" }] : []),
  ];

  const railItems = [
    { id: "problems" as const, icon: Home, label: "Sheet" },
    { id: "favourites" as const, icon: Star, label: "My Favourites" },
    { id: "calendar" as const, icon: CalendarDays, label: "Calendar" },
    { id: "sessions" as const, icon: Timer, label: "Sessions" },
    { id: "planner" as const, icon: ListTodo, label: "Planner" },
    { id: "profile" as const, icon: UserIcon, label: "Profile" },
  ];

  return (
    <div className="platform-root">
      <header className="platform-navbar">
        <button
          type="button"
          className="platform-brand"
          onClick={() => setActiveTab("problems")}
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
          {topNavItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`platform-navbar-link ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="platform-navbar-right">
          <div className="platform-navbar-search" aria-hidden>
            <Search size={14} />
            <span>Search problems…</span>
            <kbd>⌘K</kbd>
          </div>
          <span className="platform-chip platform-chip-streak" title="Current streak">
            <Flame size={14} fill="currentColor" /> {streakInfo.current}d
          </span>
          <NotificationBell enabled={notificationsEnabled} />
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
        <aside className="platform-sidebar platform-sidebar-labeled" aria-label="Quick navigation">
          <nav className="platform-sidebar-nav">
            {railItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                className={`platform-nav-item ${activeTab === id ? "active" : ""}`}
                onClick={() => setActiveTab(id)}
              >
                <span className="platform-nav-icon"><Icon size={18} /></span>
              </button>
            ))}
          </nav>
          <div className="platform-sidebar-bottom">
            <button
              type="button"
              className="platform-nav-item"
              title="Profile"
              aria-label="Profile"
              onClick={() => setActiveTab("profile")}
            >
              <span className="platform-nav-icon platform-nav-avatar">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" />
                ) : (
                  user?.name?.charAt(0) || "U"
                )}
              </span>
            </button>
          </div>
        </aside>

        <div className="platform-main">
          <AnnouncementBanner />
          {activeTab !== "problems" && activeTab !== "favourites" && (
            <header className="platform-topbar">
              <span className="platform-topbar-title">
                {activeTab === "calendar" && "Calendar + Roadmap"}
                {activeTab === "sessions" && "Study Sessions"}
                {activeTab === "planner" && "Daily Planner"}
                {activeTab === "contests" && "Contests"}
                {activeTab === "discuss" && "Discuss"}
                {activeTab === "learn" && "Learn"}
                {activeTab === "ranks" && "Leaderboard"}
                {activeTab === "profile" && "Profile & Settings"}
              </span>
              <div className="platform-topbar-actions">
                <span className="platform-chip platform-chip-streak">
                  <Flame size={14} fill="currentColor" /> {streakInfo.current} Day Streak
                </span>
              </div>
            </header>
          )}

          <main className={`platform-content ${activeTab === "problems" ? "platform-content-sheet" : ""}`}>
            {activeTab === "problems" && (
              <ProblemsSheet
                problems={problems}
                loading={loadingProblems}
                submissions={userSubmissions}
                searchQuery={searchQuery}
                selectedDifficulty={selectedDifficulty}
                statusFilter={statusFilter}
                bookmarkedIds={bookmarkedIds}
                revisionIds={revisionIds}
                userId={userId}
                userName={user?.name}
                learningRefreshKey={learningRefreshKey}
                onSearchChange={setSearchQuery}
                onDifficultyChange={setSelectedDifficulty}
                onStatusFilterChange={setStatusFilter}
                onSelectProblem={setSelectedProblem}
                onRemoveBookmark={handleRemoveBookmark}
                onBookmarkChange={handleBookmarkChange}
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
                onBookmarkChange={handleBookmarkChange}
                onExploreQuestions={() => setActiveTab("problems")}
              />
            )}

            {activeTab === "calendar" && (
              <LearningCalendarRoadmap
                problems={problems}
                submissions={userSubmissions}
                userId={userId}
                refreshKey={learningRefreshKey}
                onSelectProblem={setSelectedProblem}
                onStartSession={(topic) => {
                  startStudySession(userId, topic);
                  handleStartSessionNav(topic);
                }}
              />
            )}

            {activeTab === "sessions" && (
              <StudySessionsPanel
                userId={userId}
                problems={problems}
                topics={roadmapTopics}
                refreshKey={learningRefreshKey}
                onSessionChange={bumpLearning}
                onSelectProblem={setSelectedProblem}
              />
            )}

            {activeTab === "planner" && (
              <DailyPlannerPanel
                userId={userId}
                problems={problems}
                submissions={userSubmissions}
                refreshKey={learningRefreshKey}
                onSelectProblem={setSelectedProblem}
                onStartSession={handleStartSessionNav}
                onPlanChange={bumpLearning}
              />
            )}

            {activeTab === "contests" && (
              <ContestsPanel authenticated={Boolean(user && localStorage.getItem("accessToken"))} />
            )}

            {activeTab === "discuss" && (
              <DiscussionsPanel authenticated={Boolean(user && localStorage.getItem("accessToken"))} />
            )}

            {activeTab === "learn" && <ContentLibraryPanel />}

            {activeTab === "ranks" && <LeaderboardPanel />}

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
                  setSessions((p) => p.filter((s) => s.id !== id));
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

      <ActiveStudySessionBar
        userId={userId}
        refreshKey={learningRefreshKey}
        onChange={bumpLearning}
        onOpenSessions={() => setActiveTab("sessions")}
      />

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
          submissionsEnabled={submissionsEnabled}
          advancedEditorEnabled={newEditorEnabled}
          supportedLanguages={supportedLanguages}
        />
      )}
    </div>
  );
};
