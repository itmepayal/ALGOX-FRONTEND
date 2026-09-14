import { useState, useEffect, useRef, useMemo, useCallback, type FC, type MouseEvent as ReactMouseEvent, type CSSProperties } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  BookOpen,
  Lightbulb,
  StickyNote,
  History,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  RotateCcw,
  Maximize2,
  Minimize2,
  Settings,
  Terminal,
  Check,
  Minus,
  Plus,
  XCircle,
  Code,
  CheckSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TimeTracker } from "./TimeTracker";
import { ProblemShare } from "./ProblemShare";
import { ConfirmDialog } from "./ConfirmDialog";
import { BrandMark } from "./BrandLogo";
import { EditorShortcutBar, shortcutModLabel } from "./EditorShortcutBar";
import type { Problem, Testcase } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import type { RunResult } from "../types/judge";
import {
  engagementApi,
  formatEngagementCount,
  type UserReaction,
} from "../api/engagementApi";
import {
  formatTestCaseInputSummary,
  getTestCaseExpectedOutput,
  getTestCaseInputEntries,
  formatJudgeValue,
  normalizeDifficulty,
  isSolved,
  hasAttempted,
} from "../utils/problemUtils";
import {
  extractHints,
  getProblemId,
  loadNotes,
  saveNotes,
  loadEditorFontSize,
  saveEditorFontSize,
} from "../utils/workspacePersistence";

interface ProblemWorkspaceProps {
  problem: Problem;
  userCode: string;
  selectedLanguage: string;
  isRunning: boolean;
  isSubmitting: boolean;
  runResult: RunResult | null;
  submissionResult: Submission | null;
  selectedSubmission: Submission | null;
  runError: string;
  submissionError: string;
  problemSubmissions: Submission[];
  customTestCases: Testcase[];
  selectedCaseIndex: number;
  runMode: "all" | "selected";
  hasPrev: boolean;
  hasNext: boolean;
  userId?: string;
  onBack: () => void;
  onCodeChange: (code: string) => void;
  onLanguageChange: (lang: string) => void;
  onSubmit: () => void;
  onRun?: () => void;
  onResetCode: () => void;
  onPrevProblem: () => void;
  onNextProblem: () => void;
  onCustomTestCasesChange: (cases: Testcase[]) => void;
  onSelectedCaseIndexChange: (idx: number) => void;
  onRunModeChange: (mode: "all" | "selected") => void;
  onLoadSubmission: (sub: Submission) => void;
  onCloseSubmissionView: () => void;
  /** Called when an engagement action needs auth (token missing). */
  onRequireAuth?: () => void;
  /** Notify parent when bookmark state changes (for My Bookmarks list). */
  onBookmarkChange?: (problemId: string, isBookmarked: boolean) => void;
}

type LeftTab = "description" | "editorial" | "hints" | "notes" | "submissions";
type EditorTab = "code" | "testcase" | "result";

const FormattedDescription: FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const unescapedText = text.replace(/\\\[/g, "[").replace(/\\\]/g, "]");
  const lines = unescapedText.split("\n");

  const renderedElements: React.ReactNode[] = [];
  let inExampleBlock = false;
  let exampleLines: string[] = [];
  let exampleCount = 0;

  const flushExampleBlock = () => {
    if (exampleLines.length > 0) {
      exampleCount++;
      const blockContent = exampleLines.join("\n");
      const inputMatch = blockContent.match(/Input:\s*([^\n]+)/i);
      const outputMatch = blockContent.match(/Output:\s*([^\n]+)/i);
      const explMatch = blockContent.match(/Explanation:\s*([\s\S]+)/i);

      renderedElements.push(
        <div key={`example-${renderedElements.length}`} className="lc-example-box">
          <div className="lc-example-title">Example {exampleCount}:</div>
          <div className="lc-example-body">
            {inputMatch ? (
              <div className="lc-example-row">
                <span className="lc-label">Input:</span>{" "}
                <code className="lc-code-val">{inputMatch[1].trim()}</code>
              </div>
            ) : null}
            {outputMatch ? (
              <div className="lc-example-row">
                <span className="lc-label">Output:</span>{" "}
                <code className="lc-code-val">{outputMatch[1].trim()}</code>
              </div>
            ) : null}
            {explMatch ? (
              <div className="lc-example-row">
                <span className="lc-label">Explanation:</span>{" "}
                <span className="lc-expl-val">{explMatch[1].trim()}</span>
              </div>
            ) : (
              !inputMatch && !outputMatch && <pre className="lc-raw-example">{blockContent}</pre>
            )}
          </div>
        </div>
      );
      exampleLines = [];
    }
    inExampleBlock = false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("Example") || trimmed.match(/^Example \d+:/i)) {
      flushExampleBlock();
      inExampleBlock = true;
      return;
    }

    if (inExampleBlock) {
      if (trimmed.startsWith("Hint:") || trimmed.startsWith("Constraints:")) {
        flushExampleBlock();
      } else {
        if (trimmed) exampleLines.push(trimmed);
        return;
      }
    }

    if (trimmed.startsWith("Hint:")) {
      renderedElements.push(
        <div key={`hint-${index}`} className="lc-hint-box">
          <span className="lc-hint-title">Hint:</span>
          <span>{trimmed.replace(/^Hint:\s*/i, "")}</span>
        </div>
      );
      return;
    }

    if (trimmed.startsWith("Constraints:")) {
      renderedElements.push(
        <div key={`constraints-title-${index}`} className="lc-section-title">
          Constraints:
        </div>
      );
      return;
    }

    if (trimmed) {
      const parts = line.split(/(`[^`]+`)/g);
      renderedElements.push(
        <p key={`p-${index}`} className="lc-paragraph">
          {parts.map((part, pIdx) => {
            if (part.startsWith("`") && part.endsWith("`")) {
              return (
                <code key={pIdx} className="lc-inline-code">
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
        </p>
      );
    }
  });

  flushExampleBlock();

  return <div className="lc-description-container">{renderedElements}</div>;
};

function caseStatusClass(
  status: string | undefined
): "passed" | "failed" | "running" | "pending" | "" {
  if (!status) return "";
  if (status === "PASSED") return "passed";
  if (status === "RUNNING") return "running";
  if (status === "PENDING") return "pending";
  return "failed";
}

/** Semantic badge tone for run/submit verdicts. */
function resultStatusTone(status: string | undefined): string {
  if (!status) return "pending";
  const s = status.toUpperCase();
  if (s === "ACCEPTED" || s === "PASSED") return "acc";
  if (
    s.includes("TIME_LIMIT") ||
    s.includes("TLE") ||
    s.includes("MEMORY_LIMIT") ||
    s.includes("MLE")
  ) {
    return "warn";
  }
  if (
    s.includes("PENDING") ||
    s.includes("RUNNING") ||
    s.includes("COMPILING")
  ) {
    return "pending";
  }
  return "error";
}

/** Safe: only show I/O blocks that were stored for public failures. */
function isPublicFailureDetail(output?: string): boolean {
  if (!output) return false;
  return /Input:/i.test(output) && /Expected:/i.test(output);
}

type SubmitPillStatus = "PASSED" | "RUNNING" | "PENDING" | "FAILED";

function buildSubmitPills(
  total: number,
  passed: number,
  status: string | undefined,
  judging: boolean
): SubmitPillStatus[] {
  if (total <= 0) return [];
  const pills: SubmitPillStatus[] = Array.from({ length: total }, () => "PENDING");
  const done =
    status &&
    status !== "PENDING" &&
    status !== "RUNNING" &&
    status !== "COMPILING";

  for (let i = 0; i < Math.min(passed, total); i++) {
    pills[i] = "PASSED";
  }

  if (!done && judging) {
    if (passed < total) pills[passed] = "RUNNING";
  } else if (done && status !== "ACCEPTED" && passed < total) {
    pills[passed] = "FAILED";
  }

  return pills;
}

export const ProblemWorkspace: FC<ProblemWorkspaceProps> = ({
  problem,
  userCode,
  selectedLanguage,
  isRunning,
  isSubmitting,
  runResult,
  submissionResult,
  selectedSubmission,
  runError,
  submissionError,
  problemSubmissions,
  customTestCases,
  selectedCaseIndex,
  runMode,
  hasPrev,
  hasNext,
  userId,
  onBack,
  onCodeChange,
  onLanguageChange,
  onSubmit,
  onRun,
  onResetCode,
  onPrevProblem,
  onNextProblem,
  onCustomTestCasesChange,
  onSelectedCaseIndexChange,
  onRunModeChange,
  onLoadSubmission,
  onCloseSubmissionView,
  onRequireAuth,
  onBookmarkChange,
}) => {
  const problemId = getProblemId(problem);
  const [leftTab, setLeftTab] = useState<LeftTab>("description");
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>("code");
  const [revealedHints, setRevealedHints] = useState(0);
  const [notes, setNotes] = useState("");
  const [fontSize, setFontSize] = useState(() => loadEditorFontSize());
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [leftPct, setLeftPct] = useState(42);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [compilerOpen, setCompilerOpen] = useState(false);
  const resizingRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [likeCount, setLikeCount] = useState(problem.likeCount ?? 0);
  const [dislikeCount, setDislikeCount] = useState(problem.dislikeCount ?? 0);
  const [userReaction, setUserReaction] = useState<UserReaction>(null);
  const [bookmarked, setBookmarked] = useState(Boolean(problem.isBookmarked));
  const [engagementBusy, setEngagementBusy] = useState(false);
  const [engagementError, setEngagementError] = useState("");
  const engagementReqRef = useRef(0);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const resetLockRef = useRef(false);

  // Auto-open Test Result when Run / Submit starts
  useEffect(() => {
    if (isRunning || isSubmitting) {
      setActiveEditorTab("result");
    }
  }, [isRunning, isSubmitting]);

  useEffect(() => {
    setCompilerOpen(false);
  }, [runResult, submissionResult, runError, submissionError]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const onResizeStart = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    const root = e.currentTarget.closest(".lc-workspace");
    root?.classList.add("lc-resizing");

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(60, Math.max(30, pct)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = "";
      root?.classList.remove("lc-resizing");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const topicTags = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of [problem.category, ...(problem.tags || [])]) {
      if (!t) continue;
      const key = t.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(t.trim());
    }
    return out;
  }, [problem.category, problem.tags]);

  const busy = isRunning || isSubmitting;
  const viewingHistory = selectedSubmission !== null;
  const modKey = useMemo(() => shortcutModLabel(), []);

  const handleRunClick = () => {
    setActiveEditorTab("result");
    (onRun || onSubmit)();
  };

  const openResetConfirm = () => {
    if (busy || viewingHistory || resetConfirming) return;
    setResetConfirmOpen(true);
  };

  const closeResetConfirm = () => {
    if (resetConfirming) return;
    setResetConfirmOpen(false);
  };

  const confirmResetCode = () => {
    if (resetLockRef.current || resetConfirming) return;
    resetLockRef.current = true;
    setResetConfirming(true);
    try {
      onResetCode();
      setResetConfirmOpen(false);
    } finally {
      setResetConfirming(false);
      resetLockRef.current = false;
    }
  };

  const handleSubmitClick = () => {
    setActiveEditorTab("result");
    onSubmit();
  };

  const diff = normalizeDifficulty(problem.difficulty);
  const hints = useMemo(() => extractHints(problem), [problem]);
  const solved = isSolved(problemId, problemSubmissions);
  const attempted = !solved && hasAttempted(problemId, problemSubmissions);

  const officialCases = useMemo(
    () => (problem.testcases || []).filter((tc) => !tc.isHidden),
    [problem.testcases]
  );

  const allCases = useMemo(
    () => [...officialCases, ...customTestCases],
    [officialCases, customTestCases]
  );

  const selectedCase = allCases[selectedCaseIndex] ?? null;
  const isCustomSelected =
    selectedCaseIndex >= officialCases.length && selectedCaseIndex < allCases.length;
  const customIndex = selectedCaseIndex - officialCases.length;

  const exampleCases =
    (problem.examples?.length ?? 0) > 0 ? problem.examples! : officialCases;

  const constraintsText = problem.constraints;
  const editorialText = problem.editorial;

  const activeRunCase = useMemo(() => {
    if (!runResult?.cases?.length) return null;
    const byIndex = runResult.cases.find((c) => c.index === selectedCaseIndex);
    if (byIndex) return byIndex;
    if (runResult.cases.length === 1 && runMode === "selected") {
      return runResult.cases[0];
    }
    return runResult.cases[selectedCaseIndex] ?? null;
  }, [runResult, selectedCaseIndex, runMode]);

  const getPillResult = (idx: number) => {
    if (!runResult?.cases?.length) return null;
    return runResult.cases.find((c) => c.index === idx) ?? null;
  };

  // Reset local UI state when problem changes + load engagement from backend
  useEffect(() => {
    setLeftTab("description");
    setActiveEditorTab("code");
    setRevealedHints(0);
    setNotes(loadNotes(userId, problemId));
    setLikeCount(problem.likeCount ?? 0);
    setDislikeCount(problem.dislikeCount ?? 0);
    setUserReaction(null);
    setBookmarked(Boolean(problem.isBookmarked));
    setEngagementError("");
    setResetConfirmOpen(false);
    setResetConfirming(false);
    resetLockRef.current = false;

    let cancelled = false;
    const load = async () => {
      if (!problemId) return;
      try {
        const res = await engagementApi.getEngagement(problemId);
        if (cancelled || !res?.data) return;
        setLikeCount(res.data.likeCount);
        setDislikeCount(res.data.dislikeCount);
        setUserReaction(res.data.currentUserReaction);
        setBookmarked(res.data.isBookmarked);
      } catch {
        // keep problem-level counters
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [problemId, userId, problem.likeCount, problem.dislikeCount, problem.isBookmarked]);

  // Clamp selected case index when cases shrink
  useEffect(() => {
    if (allCases.length === 0) {
      if (selectedCaseIndex !== 0) onSelectedCaseIndexChange(0);
      return;
    }
    if (selectedCaseIndex >= allCases.length) {
      onSelectedCaseIndexChange(allCases.length - 1);
    }
  }, [allCases.length, selectedCaseIndex, onSelectedCaseIndexChange]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      saveNotes(userId, problemId, value);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    };
  }, []);

  const requireAuthOrContinue = (): boolean => {
    if (!localStorage.getItem("accessToken") || !userId) {
      setEngagementError("Please sign in to like, dislike, or bookmark.");
      onRequireAuth?.();
      return false;
    }
    return true;
  };

  const applyEngagement = (data: {
    likeCount: number;
    dislikeCount: number;
    currentUserReaction: UserReaction;
    isBookmarked: boolean;
  }) => {
    setLikeCount(data.likeCount);
    setDislikeCount(data.dislikeCount);
    setUserReaction(data.currentUserReaction);
    setBookmarked(data.isBookmarked);
    // Bookmark only — never notify parent about revision from workspace actions.
    onBookmarkChange?.(problemId, data.isBookmarked);
  };

  const handleReaction = async (reaction: "like" | "dislike") => {
    if (!requireAuthOrContinue() || engagementBusy || !problemId) return;

    const prev = {
      likeCount,
      dislikeCount,
      userReaction,
      bookmarked,
    };

    let nextLike = likeCount;
    let nextDislike = dislikeCount;
    let nextReaction: UserReaction = reaction;

    if (userReaction === reaction) {
      nextReaction = null;
      if (reaction === "like") nextLike = Math.max(0, likeCount - 1);
      else nextDislike = Math.max(0, dislikeCount - 1);
    } else if (userReaction === "like" && reaction === "dislike") {
      nextLike = Math.max(0, likeCount - 1);
      nextDislike = dislikeCount + 1;
    } else if (userReaction === "dislike" && reaction === "like") {
      nextDislike = Math.max(0, dislikeCount - 1);
      nextLike = likeCount + 1;
    } else if (reaction === "like") {
      nextLike = likeCount + 1;
    } else {
      nextDislike = dislikeCount + 1;
    }

    setLikeCount(nextLike);
    setDislikeCount(nextDislike);
    setUserReaction(nextReaction);
    setEngagementError("");
    setEngagementBusy(true);
    const reqId = ++engagementReqRef.current;

    try {
      const res = await engagementApi.setReaction(problemId, reaction);
      if (reqId !== engagementReqRef.current) return;
      if (res?.data) applyEngagement(res.data);
    } catch (err: any) {
      if (reqId !== engagementReqRef.current) return;
      setLikeCount(prev.likeCount);
      setDislikeCount(prev.dislikeCount);
      setUserReaction(prev.userReaction);
      setBookmarked(prev.bookmarked);
      setEngagementError(
        err.response?.data?.message || err.message || "Failed to update reaction."
      );
    } finally {
      if (reqId === engagementReqRef.current) setEngagementBusy(false);
    }
  };

  const handleBookmark = async () => {
    if (!requireAuthOrContinue() || engagementBusy || !problemId) return;

    const prev = {
      likeCount,
      dislikeCount,
      userReaction,
      bookmarked,
    };
    const next = !bookmarked;
    setBookmarked(next);
    setEngagementError("");
    setEngagementBusy(true);
    const reqId = ++engagementReqRef.current;

    try {
      const res = next
        ? await engagementApi.addBookmark(problemId)
        : await engagementApi.removeBookmark(problemId);
      if (reqId !== engagementReqRef.current) return;
      if (res?.data) applyEngagement(res.data);
    } catch (err: any) {
      if (reqId !== engagementReqRef.current) return;
      setLikeCount(prev.likeCount);
      setDislikeCount(prev.dislikeCount);
      setUserReaction(prev.userReaction);
      setBookmarked(prev.bookmarked);
      setEngagementError(
        err.response?.data?.message || err.message || "Failed to update bookmark."
      );
    } finally {
      if (reqId === engagementReqRef.current) setEngagementBusy(false);
    }
  };

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(22, Math.max(12, prev + delta));
      saveEditorFontSize(next);
      return next;
    });
  };

  const handleAddCase = () => {
    const empty: Testcase = { input: {}, output: "", expectedOutput: "" };
    const next = [...customTestCases, empty];
    onCustomTestCasesChange(next);
    onSelectedCaseIndexChange(officialCases.length + next.length - 1);
  };

  const handleDeleteCase = () => {
    if (!isCustomSelected) return;
    const next = customTestCases.filter((_, i) => i !== customIndex);
    onCustomTestCasesChange(next);
    const newIdx = Math.max(0, selectedCaseIndex - 1);
    onSelectedCaseIndexChange(Math.min(newIdx, officialCases.length + next.length - 1));
  };

  const handleResetCases = () => {
    onCustomTestCasesChange([]);
    onSelectedCaseIndexChange(0);
  };

  const updateCustomCase = (patch: Partial<Testcase>) => {
    if (!isCustomSelected) return;
    const next = customTestCases.map((tc, i) =>
      i === customIndex ? { ...tc, ...patch } : tc
    );
    onCustomTestCasesChange(next);
  };

  const handleCustomInputEdit = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      updateCustomCase({ input: parsed });
    } catch {
      updateCustomCase({ input: raw });
    }
  };

  const handleLoadSubmissionClick = (sub: Submission) => {
    setLeftTab("submissions");
    onLoadSubmission(sub);
  };

  const customInputText = (() => {
    if (!isCustomSelected || !selectedCase) return "{}";
    const inp = selectedCase.input;
    if (typeof inp === "string") return inp;
    try {
      return JSON.stringify(inp ?? {}, null, 2);
    } catch {
      return "{}";
    }
  })();

  const editorCode = viewingHistory ? selectedSubmission!.code : userCode;
  const lineCount = Math.max(15, editorCode.split("\n").length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const submitStatus = submissionResult?.status;
  const submitPending =
    isSubmitting ||
    submitStatus === "PENDING" ||
    submitStatus === "RUNNING" ||
    submitStatus === "COMPILING";
  const submitAccepted = submitStatus === "ACCEPTED";

  const publicCount =
    problem.publicTestcaseCount ?? officialCases.length;
  const hiddenCount = problem.hiddenTestcaseCount ?? 0;
  const submitTotal =
    submissionResult?.totalTestCases ??
    problem.totalTestcaseCount ??
    publicCount + hiddenCount;
  const submitPassed = submissionResult?.testCasesPassed ?? 0;
  const submitPills = buildSubmitPills(
    submitTotal,
    submitPassed,
    submitStatus,
    submitPending
  );

  const historyStatus = selectedSubmission?.status;
  const historyAccepted = historyStatus === "ACCEPTED";
  const historyShowOutput = isPublicFailureDetail(selectedSubmission?.output);

  return (
    <div className={`lc-workspace${isFullscreen ? " lc-workspace-fs" : ""}`}>
      <header className="lc-topbar">
        <div className="lc-topbar-left">
          <button type="button" className="lc-icon-btn" onClick={onBack} title="Back to Problems" aria-label="Back to Problems">
            <ArrowLeft size={16} strokeWidth={1.75} />
          </button>
          <div className="lc-brand-mark" aria-label="AlgoPath">
            <BrandMark size={22} />
            <span className="lc-brand-word">
              Algo<span>Path</span>
            </span>
          </div>
          <div className="lc-nav-divider" />
          <nav className="lc-breadcrumb" aria-label="Breadcrumb">
            <button type="button" onClick={onBack}>
              Problems
            </button>
            <span className="lc-breadcrumb-sep">/</span>
            <span className="lc-breadcrumb-title" title={problem.title}>
              {problem.title}
            </span>
          </nav>
          <div className="lc-problem-selector">
            <button
              type="button"
              className="lc-nav-arrow"
              title="Previous problem"
              aria-label="Previous problem"
              onClick={onPrevProblem}
              disabled={!hasPrev}
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="lc-nav-arrow"
              title="Next problem"
              aria-label="Next problem"
              onClick={onNextProblem}
              disabled={!hasNext}
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="lc-topbar-center">
          <button
            type="button"
            className="lc-action-btn lc-run-btn"
            onClick={handleRunClick}
            disabled={busy || viewingHistory}
            title={`Run (${modKey}+Enter)`}
          >
            {isRunning ? (
              <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
            ) : (
              <Play size={14} fill="currentColor" strokeWidth={1.75} />
            )}
            <span>{isRunning ? "Running..." : "Run"}</span>
          </button>
          <button
            type="button"
            className="lc-action-btn lc-submit-btn"
            onClick={handleSubmitClick}
            disabled={busy || viewingHistory}
            title={`Submit (${modKey}+Shift+Enter)`}
          >
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
            ) : (
              <Check size={14} strokeWidth={2} />
            )}
            <span>{isSubmitting ? "Submitting..." : "Submit"}</span>
          </button>
        </div>

        <div className="lc-topbar-right">
          <TimeTracker userId={userId} problemId={problemId} />
          <button
            type="button"
            className="lc-icon-btn"
            title="Reset Code"
            aria-label="Reset Code"
            onClick={openResetConfirm}
            disabled={busy || viewingHistory}
          >
            <RotateCcw size={15} strokeWidth={1.75} />
          </button>
          <button type="button" className="lc-icon-btn" title="Settings" aria-label="Settings">
            <Settings size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="lc-icon-btn"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen editor"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen editor"}
            onClick={() => setIsFullscreen((v) => !v)}
          >
            {isFullscreen ? (
              <Minimize2 size={15} strokeWidth={1.75} />
            ) : (
              <Maximize2 size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </header>

      <div
        ref={bodyRef}
        className={`lc-body${isFullscreen ? " lc-body-fullscreen" : ""}`}
        style={
          isFullscreen
            ? undefined
            : ({ ["--lc-left" as string]: `${leftPct}%` } as CSSProperties)
        }
      >
        <section className="lc-panel lc-left-panel">
          <div className="lc-tabs-header">
            <button
              type="button"
              className={`lc-tab-btn ${leftTab === "description" ? "active" : ""}`}
              onClick={() => setLeftTab("description")}
            >
              <FileText size={14} />
              <span>Description</span>
            </button>
            <button
              type="button"
              className={`lc-tab-btn ${leftTab === "editorial" ? "active" : ""}`}
              onClick={() => setLeftTab("editorial")}
            >
              <BookOpen size={14} />
              <span>Editorial</span>
            </button>
            <button
              type="button"
              className={`lc-tab-btn ${leftTab === "hints" ? "active" : ""}`}
              onClick={() => setLeftTab("hints")}
            >
              <Lightbulb size={14} />
              <span>Hints</span>
            </button>
            <button
              type="button"
              className={`lc-tab-btn ${leftTab === "notes" ? "active" : ""}`}
              onClick={() => setLeftTab("notes")}
            >
              <StickyNote size={14} />
              <span>Notes</span>
            </button>
            <button
              type="button"
              className={`lc-tab-btn ${leftTab === "submissions" ? "active" : ""}`}
              onClick={() => setLeftTab("submissions")}
            >
              <History size={14} strokeWidth={1.75} />
              <span>Submissions</span>
              <span className="lc-tab-count">{problemSubmissions.length}</span>
            </button>
          </div>

          <div className="lc-panel-content">
            {viewingHistory ? (
              <div className="lc-description-wrapper">
                <button
                  type="button"
                  className="lc-back-editor-btn"
                  onClick={onCloseSubmissionView}
                >
                  <ArrowLeft size={14} />
                  <span>Back to editor</span>
                </button>

                <h3 className="lc-sub-title" style={{ marginTop: 12 }}>
                  Submission Details
                </h3>

                <div
                  className={`lc-submit-banner ${historyAccepted ? "acc" : "err"}`}
                >
                  <div className="lc-result-header">
                    {historyAccepted ? (
                      <CheckCircle size={20} className="lc-acc-icon" />
                    ) : (
                      <AlertCircle size={20} className="lc-acc-icon" />
                    )}
                    <div className="lc-result-status-text">
                      <h4>{formatJudgeValue(selectedSubmission!.status)}</h4>
                      <div className="lc-result-stats">
                        {typeof selectedSubmission!.testCasesPassed === "number" && (
                          <span>
                            Passed: {selectedSubmission!.testCasesPassed}/
                            {selectedSubmission!.totalTestCases ?? "?"}
                          </span>
                        )}
                        <span>
                          Runtime: {selectedSubmission!.executionTime ?? 0} ms
                        </span>
                        <span>Memory: {selectedSubmission!.memory ?? 0} MB</span>
                        <span>Language: {formatJudgeValue(selectedSubmission!.language)}</span>
                        {selectedSubmission!.createdAt && (
                          <span>
                            {new Date(selectedSubmission!.createdAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedSubmission!.error && (
                    <div className="lc-result-alert error" style={{ marginTop: 10 }}>
                      <AlertCircle size={16} />
                      <pre
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.78rem",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {formatJudgeValue(selectedSubmission!.error)}
                      </pre>
                    </div>
                  )}

                  {selectedSubmission!.output != null &&
                    selectedSubmission!.output !== "" &&
                    historyShowOutput && (
                      <div className="lc-result-output" style={{ marginTop: 10 }}>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            marginBottom: 4,
                          }}
                        >
                          Output:
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.78rem",
                            whiteSpace: "pre-wrap",
                            background: "rgba(0,0,0,0.2)",
                            padding: 8,
                            borderRadius: 4,
                          }}
                        >
                          {formatJudgeValue(selectedSubmission!.output)}
                        </pre>
                      </div>
                    )}

                  {!historyAccepted &&
                    !historyShowOutput &&
                    selectedSubmission!.status === "WRONG_ANSWER" && (
                      <p className="lc-hidden-fail-note">
                        One or more hidden test cases failed. Hidden inputs and
                        outputs are not shown.
                      </p>
                    )}
                </div>
              </div>
            ) : (
              <>
                {leftTab === "description" && (
                  <div className="lc-description-wrapper">
                    <div className="lc-title-row">
                      <h1 className="lc-problem-title">{problem.title}</h1>
                      {solved ? (
                        <span className="lc-status-tag solved" aria-label="Solved">
                          <span>Solved</span>
                          <CheckCircle size={16} strokeWidth={2} aria-hidden />
                        </span>
                      ) : attempted ? (
                        <span className="lc-status-tag attempted" aria-label="Attempted">
                          <span>Attempted</span>
                          <AlertCircle size={16} strokeWidth={2} aria-hidden />
                        </span>
                      ) : null}
                    </div>

                    <div className="lc-meta-row">
                      <span className={`lc-diff-badge ${diff}`}>{diff}</span>
                      {topicTags.map((t) => (
                        <span key={t} className="lc-tag-chip">
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="lc-action-row">
                      <div className="lc-social-actions">
                        <button
                          type="button"
                          className={`lc-social-btn ${userReaction === "like" ? "lc-reaction-active like" : ""}`}
                          aria-label="Like problem"
                          aria-pressed={userReaction === "like"}
                          title={userReaction === "like" ? "Remove like" : "Like"}
                          disabled={engagementBusy}
                          onClick={() => void handleReaction("like")}
                        >
                          <ThumbsUp
                            size={14}
                            strokeWidth={1.75}
                            fill={userReaction === "like" ? "currentColor" : "none"}
                          />
                          <span>{formatEngagementCount(likeCount)}</span>
                        </button>
                        <button
                          type="button"
                          className={`lc-social-btn ${userReaction === "dislike" ? "lc-reaction-active dislike" : ""}`}
                          aria-label="Dislike problem"
                          aria-pressed={userReaction === "dislike"}
                          title={userReaction === "dislike" ? "Remove dislike" : "Dislike"}
                          disabled={engagementBusy}
                          onClick={() => void handleReaction("dislike")}
                        >
                          <ThumbsDown
                            size={14}
                            strokeWidth={1.75}
                            fill={userReaction === "dislike" ? "currentColor" : "none"}
                          />
                          {dislikeCount > 0 && (
                            <span>{formatEngagementCount(dislikeCount)}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`lc-social-btn ${bookmarked ? "lc-bookmark-active" : ""}`}
                          aria-label={bookmarked ? "Remove bookmark" : "Bookmark problem"}
                          aria-pressed={bookmarked}
                          title={bookmarked ? "Remove bookmark" : "Bookmark"}
                          disabled={engagementBusy}
                          onClick={() => void handleBookmark()}
                        >
                          <Bookmark size={14} strokeWidth={1.75} fill={bookmarked ? "currentColor" : "none"} />
                        </button>
                        <ProblemShare problem={problem} variant="icon" className="lc-share-inline" />
                      </div>
                    </div>

                    {engagementError && (
                      <div className="lc-result-alert error" style={{ marginBottom: 12 }}>
                        <AlertCircle size={14} />
                        <span>{engagementError}</span>
                      </div>
                    )}

                    <FormattedDescription text={problem.description} />

                    {exampleCases.length > 0 && !problem.description.includes("Example") && (
                      <div className="lc-examples-container">
                        {exampleCases.map((tc: Testcase, idx: number) => (
                          <div key={idx} className="lc-example-box">
                            <div className="lc-example-title">Example {idx + 1}</div>
                            <div className="lc-example-body">
                              <div className="lc-example-row">
                                <span className="lc-label">Input</span>{" "}
                                <code className="lc-code-val">
                                  {formatTestCaseInputSummary(tc.input)}
                                </code>
                              </div>
                              <div className="lc-example-row">
                                <span className="lc-label">Output</span>{" "}
                                <code className="lc-code-val">
                                  {getTestCaseExpectedOutput(tc)}
                                </code>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {constraintsText && (
                      <div className="lc-constraints-section">
                        <div className="lc-section-title">Constraints</div>
                        <FormattedDescription text={constraintsText} />
                      </div>
                    )}
                  </div>
                )}

                {leftTab === "editorial" && (
                  <div className="lc-description-wrapper">
                    <h3 className="lc-sub-title">Editorial</h3>
                    {editorialText ? (
                      <FormattedDescription text={editorialText} />
                    ) : (
                      <div className="lc-empty-state">
                        <h4>No editorial yet</h4>
                        <p>An editorial has not been published for this problem.</p>
                      </div>
                    )}
                  </div>
                )}

                {leftTab === "hints" && (
                  <div className="lc-description-wrapper">
                    <h3 className="lc-sub-title">Hints</h3>
                    {hints.length === 0 ? (
                      <div className="lc-empty-state">
                        <h4>No hints available</h4>
                        <p>No hints available for this problem.</p>
                      </div>
                    ) : (
                      <>
                        <p
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            marginBottom: 12,
                          }}
                        >
                          Revealed {revealedHints} of {hints.length}
                        </p>
                        {hints.slice(0, revealedHints).map((hint, i) => (
                          <div key={i} className="lc-hint-box">
                            <span className="lc-hint-title">Hint {i + 1}:</span>
                            <span>{hint}</span>
                          </div>
                        ))}
                        {revealedHints < hints.length && (
                          <button
                            type="button"
                            className="lc-hint-reveal-btn"
                            onClick={() => setRevealedHints((n) => n + 1)}
                          >
                            Reveal next hint
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {leftTab === "notes" && (
                  <div className="lc-description-wrapper">
                    <h3 className="lc-sub-title">Private Notes</h3>
                    <textarea
                      className="lc-notes-area"
                      value={notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      placeholder="Write notes for this problem… autosaved locally."
                      spellCheck={false}
                    />
                  </div>
                )}

                {leftTab === "submissions" && (
                  <div className="lc-submissions-wrapper">
                    <h3 className="lc-sub-title">Your Recent Submissions</h3>
                    {problemSubmissions.filter((s) => s.source !== "run").length === 0 ? (
                      <div className="lc-empty-state">
                        <h4>No submissions yet</h4>
                        <p>Submit your solution to see your submission history.</p>
                      </div>
                    ) : (
                      <div className="lc-submissions-list">
                        {problemSubmissions
                          .filter((s) => s.source !== "run")
                          .map((sub, idx) => (
                          <button
                            key={sub._id || sub.id || idx}
                            type="button"
                            className="lc-sub-item"
                            onClick={() => handleLoadSubmissionClick(sub)}
                          >
                            <div className="lc-sub-left">
                              <span
                                className={`lc-sub-status ${
                                  sub.status === "ACCEPTED" ? "acc" : "err"
                                }`}
                              >
                                {formatJudgeValue(sub.status)}
                              </span>
                              <span className="lc-sub-lang">
                                {formatJudgeValue(sub.language)}
                              </span>
                            </div>
                            <div className="lc-sub-right">
                              <span className="lc-sub-time">
                                {sub.executionTime ?? 0} ms
                              </span>
                              <span className="lc-sub-date">
                                {sub.createdAt
                                  ? new Date(sub.createdAt).toLocaleString([], {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Just now"}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <div
          className="lc-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          onMouseDown={onResizeStart}
        />

        <section
          className={`lc-panel lc-right-panel${viewingHistory ? " lc-right-panel-history" : ""}`}
        >
          {!viewingHistory && (
            <div className="lc-editor-tabs" role="tablist" aria-label="Editor panels">
              <button
                type="button"
                role="tab"
                aria-selected={activeEditorTab === "code"}
                className={`lc-editor-tab ${activeEditorTab === "code" ? "active" : ""}`}
                onClick={() => setActiveEditorTab("code")}
              >
                <Code size={14} strokeWidth={1.75} />
                <span>Code</span>
              </button>
              <span className="lc-editor-tab-sep" aria-hidden>
                |
              </span>
              <button
                type="button"
                role="tab"
                aria-selected={activeEditorTab === "testcase"}
                className={`lc-editor-tab ${activeEditorTab === "testcase" ? "active" : ""}`}
                onClick={() => setActiveEditorTab("testcase")}
              >
                <CheckSquare size={14} strokeWidth={1.75} />
                <span>Testcase</span>
              </button>
              <span className="lc-editor-tab-sep" aria-hidden>
                |
              </span>
              <button
                type="button"
                role="tab"
                aria-selected={activeEditorTab === "result"}
                className={`lc-editor-tab ${activeEditorTab === "result" ? "active" : ""}`}
                onClick={() => setActiveEditorTab("result")}
              >
                <Terminal size={14} strokeWidth={1.75} />
                <span>Test Result</span>
                {(isRunning || isSubmitting) && (
                  <Loader2 size={12} className="animate-spin" />
                )}
              </button>
            </div>
          )}

          <div
            className="lc-code-pane"
            role="tabpanel"
            hidden={!viewingHistory && activeEditorTab !== "code"}
          >
              <div className="lc-editor-header">
                <div className="lc-editor-header-left">
                  <span className="lc-editor-title">
                    {viewingHistory ? "Submission Code" : "Code"}
                  </span>
                  {viewingHistory ? (
                    <span className="lc-lang-dropdown" style={{ cursor: "default" }}>
                      {formatJudgeValue(selectedSubmission!.language)}
                    </span>
                  ) : (
                    <select
                      className="lc-lang-dropdown"
                      value={selectedLanguage}
                      onChange={(e) => onLanguageChange(e.target.value)}
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="cpp">C++</option>
                      <option value="java">Java</option>
                    </select>
                  )}
                </div>
                <div className="lc-editor-header-right">
                  <button
                    type="button"
                    className="lc-icon-btn"
                    title="Decrease font size"
                    aria-label="Decrease font size"
                    onClick={() => changeFontSize(-1)}
                  >
                    <Minus size={14} strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="lc-icon-btn"
                    title="Increase font size"
                    aria-label="Increase font size"
                    onClick={() => changeFontSize(1)}
                  >
                    <Plus size={14} strokeWidth={2} aria-hidden />
                  </button>
                  {!viewingHistory && (
                    <button
                      type="button"
                      className="lc-icon-btn"
                      title="Reset Code"
                      aria-label="Reset Code"
                      onClick={openResetConfirm}
                      disabled={busy}
                    >
                      <RotateCcw size={14} strokeWidth={2} aria-hidden />
                    </button>
                  )}
                </div>
              </div>

              <div className="lc-editor-container">
                <div className="lc-editor-gutter" style={{ fontSize }}>
                  {lineNumbers.map((num) => (
                    <div key={num} className="lc-line-num">
                      {num}
                    </div>
                  ))}
                </div>
                <textarea
                  className={`lc-code-textarea${viewingHistory ? " lc-readonly-code" : ""}`}
                  value={editorCode}
                  onChange={(e) => {
                    if (!viewingHistory) onCodeChange(e.target.value);
                  }}
                  readOnly={viewingHistory}
                  spellCheck={false}
                  wrap="off"
                  style={{ fontSize }}
                />
              </div>
              {!viewingHistory && <EditorShortcutBar />}
          </div>

          {!viewingHistory && (
            <div
              className="lc-tab-pane lc-testcase-pane"
              role="tabpanel"
              hidden={activeEditorTab !== "testcase"}
            >
              <div className="lc-tc">
                <div className="lc-tc-cases" role="tablist" aria-label="Test cases">
                  {allCases.map((_, idx) => {
                    const pill = getPillResult(idx);
                    const statusCls = caseStatusClass(pill?.status);
                    const isActive = selectedCaseIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`lc-tc-case ${isActive ? "active" : ""} ${statusCls}`}
                        onClick={() => onSelectedCaseIndexChange(idx)}
                      >
                        {pill?.status === "PASSED" ? (
                          <CheckCircle size={12} strokeWidth={2} />
                        ) : pill ? (
                          <XCircle size={12} strokeWidth={2} />
                        ) : null}
                        <span>
                          Case {idx + 1}
                          {idx >= officialCases.length ? " *" : ""}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="lc-tc-add"
                    onClick={handleAddCase}
                    disabled={busy}
                    title="Add testcase"
                    aria-label="Add testcase"
                  >
                    <Plus size={16} strokeWidth={2} />
                  </button>
                  {isCustomSelected && (
                    <button
                      type="button"
                      className="lc-tc-delete"
                      onClick={handleDeleteCase}
                      disabled={busy}
                      title="Delete custom testcase"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    className="lc-tc-reset"
                    onClick={handleResetCases}
                    disabled={busy}
                    title="Reset cases"
                  >
                    Reset
                  </button>
                </div>

                <div className="lc-tc-mode">
                  <button
                    type="button"
                    className={runMode === "all" ? "active" : ""}
                    onClick={() => onRunModeChange("all")}
                    disabled={busy}
                  >
                    Run all
                  </button>
                  <button
                    type="button"
                    className={runMode === "selected" ? "active" : ""}
                    onClick={() => onRunModeChange("selected")}
                    disabled={busy}
                  >
                    Run selected
                  </button>
                </div>

                {selectedCase && (
                  <div className="lc-tc-body">
                    {isCustomSelected ? (
                      <>
                        <div className="lc-tc-field">
                          <div className="lc-tc-label">input =</div>
                          <textarea
                            className="lc-tc-value lc-tc-value-edit"
                            value={customInputText}
                            onChange={(e) => handleCustomInputEdit(e.target.value)}
                            spellCheck={false}
                            rows={4}
                          />
                        </div>
                        <div className="lc-tc-field">
                          <div className="lc-tc-label">expected =</div>
                          <input
                            className="lc-tc-value lc-tc-value-edit"
                            value={getTestCaseExpectedOutput(selectedCase)}
                            onChange={(e) =>
                              updateCustomCase({
                                output: e.target.value,
                                expectedOutput: e.target.value,
                              })
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {getTestCaseInputEntries(selectedCase.input).map((entry) => (
                          <div key={entry.name} className="lc-tc-field">
                            <div className="lc-tc-label">{entry.name} =</div>
                            <div className="lc-tc-value">{entry.value}</div>
                          </div>
                        ))}
                        <div className="lc-tc-field">
                          <div className="lc-tc-label">expected =</div>
                          <div className="lc-tc-value">
                            {getTestCaseExpectedOutput(selectedCase) || "[]"}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {allCases.length === 0 && (
                  <div className="lc-empty-state">
                    <h4>No test cases</h4>
                    <p>Add a custom case to run against.</p>
                    <button
                      type="button"
                      className="lc-action-btn lc-run-btn"
                      onClick={handleAddCase}
                    >
                      <Plus size={14} /> Add Testcase
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!viewingHistory && (
            <div
              className="lc-tab-pane lc-result-pane"
              role="tabpanel"
              hidden={activeEditorTab !== "result"}
            >
              <div className="lc-result-container">
                {runError && (
                  <div className="lc-result-alert error">
                    <AlertCircle size={16} />
                    <div className="lc-result-alert-body">
                      <strong>{runError}</strong>
                      {(runError.toLowerCase().includes("network") ||
                        runError.toLowerCase().includes("timeout")) && (
                        <span className="lc-result-alert-hint">
                          Evaluation service may be offline. Ensure it is running on
                          port 3006, then try Run again.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {submissionError && (
                  <div className="lc-result-alert error">
                    <AlertCircle size={16} />
                    <div className="lc-result-alert-body">
                      <strong>{submissionError}</strong>
                      {(submissionError.toLowerCase().includes("network") ||
                        submissionError.toLowerCase().includes("timeout")) && (
                        <span className="lc-result-alert-hint">
                          Submission or judge service unreachable. Check Submission
                          (3004) and Evaluation (3006), then retry Submit.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Single loading card — only when no result object yet */}
                {((isRunning && !runResult) || (isSubmitting && !submissionResult)) &&
                  !runError &&
                  !submissionError && (
                  <div className="lc-result-card pending">
                    <div className="lc-result-header">
                      <Loader2 size={20} className="animate-spin lc-pending-icon" />
                      <div className="lc-result-status-text">
                        <h4>{isSubmitting ? "Submitting..." : "Running..."}</h4>
                        <div className="lc-result-stats">
                          <span>Compiling</span>
                          <span>Executing test cases</span>
                          <span>Evaluating output</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit result — never together with Run result or the generic loader */}
                {submissionResult && !isRunning && !runResult && (
                  <div
                    className={`lc-submit-banner ${
                      submitAccepted
                        ? "acc"
                        : submitPending
                          ? "pending"
                          : resultStatusTone(submissionResult?.status)
                    }`}
                  >
                    <div className="lc-result-header">
                      {submitAccepted ? (
                        <CheckCircle size={20} className="lc-acc-icon" />
                      ) : submitPending ? (
                        <Loader2 size={20} className="animate-spin lc-pending-icon" />
                      ) : (
                        <AlertCircle size={20} className="lc-acc-icon" />
                      )}
                      <div className="lc-result-status-text">
                        <h4>
                          {submitPending
                            ? "Judging all test cases..."
                            : formatJudgeValue(submissionResult?.status || "SUBMIT")}
                        </h4>
                        <div className="lc-result-stats">
                          <span>
                            {submitPassed} / {submitTotal || "?"} test cases
                            {submitPending ? " passed so far" : " passed"}
                          </span>
                          {!submitPending && submissionResult && (
                            <>
                              <span>
                                Runtime: {submissionResult.executionTime ?? 0} ms
                              </span>
                              <span>
                                Memory: {submissionResult.memory ?? 0} MB
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {submitTotal > 0 && (
                      <div className="lc-submit-progress">
                        <div className="lc-progress-meta">
                          <span>
                            Progress: {submitPassed} / {submitTotal}
                          </span>
                          {hiddenCount > 0 && (
                            <span className="lc-hidden-hint">
                              {publicCount} public · {hiddenCount} hidden
                            </span>
                          )}
                        </div>
                        <div className="lc-case-selector lc-submit-pills">
                          {submitPills.map((st, idx) => (
                            <span
                              key={idx}
                              className={`lc-case-btn lc-pill-static ${caseStatusClass(st)}`}
                              title={
                                idx < publicCount
                                  ? `Case ${idx + 1} (public)`
                                  : `Case ${idx + 1} (hidden)`
                              }
                            >
                              {st === "PASSED" ? (
                                <CheckCircle size={11} />
                              ) : st === "FAILED" ? (
                                <XCircle size={11} />
                              ) : st === "RUNNING" ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <span className="lc-pending-dot" />
                              )}
                              <span>
                                {idx < publicCount
                                  ? `Case ${idx + 1}`
                                  : `#${idx + 1}`}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {!submitPending &&
                      submissionResult?.output != null &&
                      submissionResult.output !== "" &&
                      isPublicFailureDetail(submissionResult.output) && (
                        <div className="lc-result-output" style={{ marginTop: 10 }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              marginBottom: 4,
                            }}
                          >
                            Failed public testcase:
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.78rem",
                              whiteSpace: "pre-wrap",
                              background: "rgba(0,0,0,0.2)",
                              padding: 8,
                              borderRadius: 4,
                            }}
                          >
                            {formatJudgeValue(submissionResult.output)}
                          </pre>
                        </div>
                      )}

                    {!submitPending &&
                      submissionResult?.status === "WRONG_ANSWER" &&
                      !isPublicFailureDetail(submissionResult.output) && (
                        <p className="lc-hidden-fail-note">
                          One or more hidden test cases failed. Hidden
                          inputs and outputs are not shown.
                        </p>
                      )}

                    {!submitPending && submissionResult?.error && (
                      <div className="lc-result-alert error" style={{ marginTop: 10 }}>
                        <AlertCircle size={16} />
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.78rem",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {formatJudgeValue(submissionResult.error)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {runResult && !isSubmitting && !submissionResult && (
                  <div
                    className={`lc-result-card ${resultStatusTone(runResult.status)}`}
                  >
                    <div className="lc-result-header">
                      {runResult.status === "ACCEPTED" ? (
                        <CheckCircle size={20} className="lc-acc-icon" />
                      ) : (
                        <AlertCircle size={20} className="lc-acc-icon" />
                      )}
                      <div className="lc-result-status-text">
                        <h4>{formatJudgeValue(runResult.status)}</h4>
                      </div>
                    </div>

                    <div className="lc-result-stats-row">
                      <div className="lc-stat">
                        <span className="lc-stat-label">Test Cases</span>
                        <span className="lc-stat-value">
                          {runResult.passed} / {runResult.total} Passed
                        </span>
                      </div>
                      {runResult.executionTime != null && (
                        <div className="lc-stat">
                          <span className="lc-stat-label">Runtime</span>
                          <span className="lc-stat-value">{runResult.executionTime} ms</span>
                        </div>
                      )}
                      {runResult.memory != null && (
                        <div className="lc-stat">
                          <span className="lc-stat-label">Memory</span>
                          <span className="lc-stat-value">{runResult.memory} MB</span>
                        </div>
                      )}
                    </div>

                    {runResult.status === "COMPILATION_ERROR" && (runResult.error || runError) && (
                      <div style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="lc-compiler-toggle"
                          onClick={() => setCompilerOpen((v) => !v)}
                        >
                          Compiler Output{" "}
                          {compilerOpen ? (
                            <ChevronUp size={14} strokeWidth={1.75} />
                          ) : (
                            <ChevronDown size={14} strokeWidth={1.75} />
                          )}
                        </button>
                        {compilerOpen && (
                          <pre className="lc-compiler-body">
                            {formatJudgeValue(runResult.error || runError)}
                          </pre>
                        )}
                      </div>
                    )}

                    {activeRunCase && (
                      <div style={{ marginTop: 14 }}>
                        <div className="lc-input-group">
                          <label>Input</label>
                          <div className="lc-input-box">
                            {formatJudgeValue(activeRunCase.input)}
                          </div>
                        </div>
                        <div className="lc-input-group">
                          <label>Expected</label>
                          <div className="lc-input-box">
                            {formatJudgeValue(activeRunCase.expected)}
                          </div>
                        </div>
                        <div className="lc-input-group">
                          <label>Output</label>
                          <div className="lc-input-box">
                            {formatJudgeValue(activeRunCase.actual)}
                          </div>
                        </div>
                        {activeRunCase.error && (
                          <div className="lc-result-alert error" style={{ marginTop: 8 }}>
                            <AlertCircle size={16} />
                            <pre
                              style={{
                                margin: 0,
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.78rem",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {formatJudgeValue(activeRunCase.error)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {runResult.error &&
                      runResult.status !== "COMPILATION_ERROR" &&
                      !activeRunCase?.error && (
                      <div className="lc-result-alert error" style={{ marginTop: 10 }}>
                        <AlertCircle size={16} />
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.78rem",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {formatJudgeValue(runResult.error)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {!isRunning &&
                  !isSubmitting &&
                  !runResult &&
                  !submissionResult &&
                  !runError &&
                  !submissionError && (
                    <div className="lc-empty-state">
                      <h4>Test Result</h4>
                      <p>Run your code to see the execution result.</p>
                      <button
                        type="button"
                        className="lc-action-btn lc-run-btn"
                        onClick={handleRunClick}
                        disabled={busy || viewingHistory}
                      >
                        <Play size={14} fill="currentColor" strokeWidth={1.75} />
                        <span>Run Code</span>
                      </button>
                    </div>
                  )}
              </div>
            </div>
          )}
        </section>

      </div>

      <div className="lc-mobile-actions">
        <button
          type="button"
          className="lc-action-btn lc-run-btn"
          onClick={handleRunClick}
          disabled={busy || viewingHistory}
        >
          {isRunning ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
          <span>{isRunning ? "Running..." : "Run"}</span>
        </button>
        <button
          type="button"
          className="lc-action-btn lc-submit-btn"
          onClick={handleSubmitClick}
          disabled={busy || viewingHistory}
        >
          {isSubmitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          <span>{isSubmitting ? "Submitting..." : "Submit"}</span>
        </button>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset code?"
        description="Are you sure you want to reset your code to the default starter template? Your current changes will be lost."
        cancelLabel="Cancel"
        confirmLabel="Reset Code"
        confirmVariant="danger"
        confirming={resetConfirming}
        onCancel={closeResetConfirm}
        onConfirm={confirmResetCode}
      />
    </div>
  );
};
