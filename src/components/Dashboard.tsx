import { useState, useEffect, useCallback, useMemo, type FC } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/authApi";
import { problemApi, type Problem, type Testcase } from "../api/problemApi";
import { submissionApi, type ProgrammingLanguage, type Submission } from "../api/submissionApi";
import { evaluationApi } from "../api/evaluationApi";
import { engagementApi } from "../api/engagementApi";
import { ProblemsSheet } from "./ProblemsSheet";
import { ProblemWorkspace } from "./ProblemWorkspace";
import { ProfilePanel } from "./ProfilePanel";
import { LearningCalendarRoadmap } from "./LearningCalendarRoadmap";
import { StudySessionsPanel } from "./StudySessionsPanel";
import { DailyPlannerPanel } from "./DailyPlannerPanel";
import { ActiveStudySessionBar } from "./ActiveStudySessionBar";
import {
  formatJudgeInput,
  getTestCaseExpectedOutput,
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
  rememberPendingProblemSlug,
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
import type { RunCaseResult, RunResult } from "../types/judge";
import {
  CalendarDays,
  Flame,
  Home,
  ListTodo,
  MessageSquare,
  ShieldCheck,
  Timer,
  Trophy,
  User as UserIcon,
} from "lucide-react";

type PlatformTab =
  | "problems"
  | "calendar"
  | "sessions"
  | "planner"
  | "contests"
  | "discuss"
  | "profile";

interface DashboardProps {
  onOpenAdmin?: () => void;
}

export const Dashboard: FC<DashboardProps> = ({ onOpenAdmin }) => {
  const { user, signout, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<PlatformTab>("problems");
  const [learningRefreshKey, setLearningRefreshKey] = useState(0);
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
      const res = await problemApi.getProblems({ limit: 50 });
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
        (res?.data || []).map((p) => (p.id || p._id || "").toString()).filter(Boolean)
      );
      setBookmarkedIds(ids);
      if (res?.data?.length) {
        setProblems((prev) =>
          prev.map((p) => {
            const pid = (p.id || p._id || "").toString();
            const bm = res.data.find(
              (b) => (b.id || b._id || "").toString() === pid
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
      }
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
      setRevisionIds(new Set(res?.data?.problemIds || []));
    } catch (err) {
      console.warn("Fetch revisions failed:", err);
    }
  };

  const handleBookmarkChange = (problemId: string, isBookmarked: boolean) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) next.add(problemId);
      else next.delete(problemId);
      return next;
    });
    setProblems((prev) =>
      prev.map((p) =>
        (p.id || p._id || "").toString() === problemId
          ? { ...p, isBookmarked }
          : p
      )
    );
  };

  const handleRevisionChange = (problemId: string, isRevision: boolean) => {
    setRevisionIds((prev) => {
      const next = new Set(prev);
      if (isRevision) next.add(problemId);
      else next.delete(problemId);
      return next;
    });
  };

  const handleRemoveBookmark = async (problemId: string) => {
    try {
      await engagementApi.removeBookmark(problemId);
      handleBookmarkChange(problemId, false);
    } catch (err) {
      console.warn("Remove bookmark failed:", err);
      window.alert("Failed to remove bookmark. Please try again.");
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
    if (!window.confirm("Reset code to the default starter template?")) return;
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
    // Keep submissionResult; Run must not wipe Submit history panel state

    try {
      const caseResults: RunCaseResult[] = [];
      let overall: RunResult["status"] = "ACCEPTED";
      let totalTime = 0;
      let maxMemory = 0;
      let passed = 0;

      const normalize = (s: string) =>
        s
          .replace(/\r\n/g, "\n")
          .trim()
          .split("\n")
          .map((l) => l.trimEnd())
          .join("\n");

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

        if (expected && normalize(stdout) !== normalize(expected)) {
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
      setRunError(fieldErrors || data?.message || err.message || "Code execution failed.");
    } finally {
      setIsRunning(false);
    }
  };

  const onSelectedCaseIndexSafe = (idx: number) => {
    setSelectedCaseIndex(idx);
  };

  const handleRunCode = async () => {
    if (!selectedProblem || busy) return;
    setSelectedSubmission(null);
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
  };

  const handleSubmitCode = async () => {
    if (!selectedProblem || !user || busy) return;
    setSelectedSubmission(null);
    setIsSubmitting(true);
    // Keep runResult intact — Run and Submit use separate state
    setSubmissionResult(null);
    setSubmissionError("");
    try {
      const uid = user.id || (user as any)._id;
      const problemId = selectedProblem.id || selectedProblem._id;
      if (!uid || !problemId) {
        setSubmissionError("Missing user or problem id.");
        return;
      }

      // Submit sends ONLY problemId + code + language.
      // Hidden/public suite is loaded server-side from ProblemService.
      const res = await submissionApi.createSubmission({
        userId: uid,
        problemId,
        code: userCode,
        language: selectedLanguage as ProgrammingLanguage,
      });

      if (res?.data) {
        const totalHint =
          selectedProblem.totalTestcaseCount ??
          (selectedProblem.publicTestcaseCount ?? 0) +
            (selectedProblem.hiddenTestcaseCount ?? 0);
        setSubmissionResult({
          ...res.data,
          totalTestCases: res.data.totalTestCases ?? (totalHint > 0 ? totalHint : undefined),
          testCasesPassed: res.data.testCasesPassed ?? 0,
        });
        const sid = res.data.id || res.data._id;
        if (sid) await pollSubmissionStatus(sid);
        const pid = selectedProblem.id || selectedProblem._id;
        if (pid) fetchProblemSubmissions(pid);
      } else {
        setSubmissionError("Empty response from submission service.");
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
    } finally {
      setIsSubmitting(false);
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

  const navItems = [
    { id: "problems" as const, icon: Home, label: "Sheet" },
    { id: "calendar" as const, icon: CalendarDays, label: "Calendar" },
    { id: "sessions" as const, icon: Timer, label: "Sessions" },
    { id: "planner" as const, icon: ListTodo, label: "Planner" },
    { id: "contests" as const, icon: Trophy, label: "Contest" },
    { id: "discuss" as const, icon: MessageSquare, label: "Discuss" },
    { id: "profile" as const, icon: UserIcon, label: "Profile" },
  ];

  return (
    <div className="platform-root">
      <aside className="platform-sidebar platform-sidebar-labeled">
        <div className="platform-sidebar-logo">aX</div>
        <nav className="platform-sidebar-nav">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`platform-nav-item ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <span className="platform-nav-icon"><Icon size={20} /></span>
              <span className="platform-nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="platform-sidebar-bottom">
          {onOpenAdmin && (
            <button type="button" className="platform-nav-item" onClick={onOpenAdmin}>
              <span className="platform-nav-icon"><ShieldCheck size={20} /></span>
              <span className="platform-nav-label">Admin</span>
            </button>
          )}
          <button type="button" className="platform-nav-item" onClick={() => setActiveTab("profile")}>
            <span className="platform-nav-icon platform-nav-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                user?.name?.charAt(0) || "U"
              )}
            </span>
            <span className="platform-nav-label">{user?.name?.split(" ")[0] || "You"}</span>
          </button>
        </div>
      </aside>

      <div className="platform-main">
        {activeTab !== "problems" && (
          <header className="platform-topbar">
            <span className="platform-topbar-title">
              {activeTab === "calendar" && "Calendar + Roadmap"}
              {activeTab === "sessions" && "Study Sessions"}
              {activeTab === "planner" && "Daily Planner"}
              {activeTab === "contests" && "Contests"}
              {activeTab === "discuss" && "Discuss"}
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
              learningRefreshKey={learningRefreshKey}
              onSearchChange={setSearchQuery}
              onDifficultyChange={setSelectedDifficulty}
              onStatusFilterChange={setStatusFilter}
              onSelectProblem={setSelectedProblem}
              onRemoveBookmark={handleRemoveBookmark}
              onRevisionChange={handleRevisionChange}
              onOpenAdmin={onOpenAdmin}
              onNavigateLearning={(tab) => setActiveTab(tab)}
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
            <div className="placeholder-tab">
              <Trophy size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
              <h2>Contests Coming Soon</h2>
              <p>Weekly coding contests will appear here.</p>
            </div>
          )}

          {activeTab === "discuss" && (
            <div className="placeholder-tab">
              <MessageSquare size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
              <h2>Discussion Forum</h2>
              <p>Share solutions and ask questions with the community.</p>
            </div>
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
            />
          )}
        </main>
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
        />
      )}
    </div>
  );
};
