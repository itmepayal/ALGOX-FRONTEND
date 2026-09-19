import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Play,
  Swords,
  FileText,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Timer,
  Building2,
  BarChart3,
  Gauge,
  ExternalLink,
  AlertCircle,
  X,
} from "lucide-react";
import {
  mockInterviewApi,
  type MockInterviewSession,
  type MockInterviewReport,
  type MockScoreCell,
  type MockInterviewPublicConfig,
  type PastInterviewRow,
} from "../api/mockInterviewApi";
import { problemApi, type Problem } from "../api/problemApi";
import { companyApi, type CompanyCard } from "../api/companyApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import {
  formatHumanDuration,
  formatScoreDetailMs,
} from "../lib/formatDuration";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { PremiumBadge } from "./access/PremiumBadge";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { InterviewTimer } from "./InterviewTimer";
import "./companies/companies.css";
import "./mock-interviews.css";

export type ActiveMockInterviewMeta = {
  id: string;
  endsAt: string;
  serverNow: string;
  remainingMs: number;
  language?: string;
};

interface Props {
  onOpenProblem: (
    problem: Problem,
    mockInterviewSessionId?: string,
    interviewLanguage?: string
  ) => void;
  onActiveSessionChange?: (session: ActiveMockInterviewMeta | null) => void;
  lastSubmission?: { id: string; problemId: string } | null;
  refreshKey?: number;
  /** Prefill configure form when navigating from Company Prep. */
  preferredCompany?: string | null;
  /** Open an existing submission in the problem workspace (read-only). */
  onViewSubmission?: (args: {
    submissionId: string;
    problemId: string;
    problemSlug?: string;
  }) => void;
}

function statusLabel(status: string): string {
  const s = String(status || "").toLowerCase();
  if (s === "timed_out") return "Expired";
  if (s === "completed") return "Completed";
  if (s === "abandoned") return "Cancelled";
  if (s === "in_progress") return "In Progress";
  if (s === "failed") return "Failed";
  if (!s) return "Unavailable";
  return status;
}

function statusBadgeVariant(
  status: string
): "success" | "warning" | "danger" | "primary" | "default" {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "success";
  if (s === "in_progress") return "primary";
  if (s === "timed_out") return "warning";
  if (s === "abandoned" || s === "failed") return "danger";
  return "default";
}

/** Map judge / attempt status to display copy — never invent verdicts. */
function attemptStatusLabel(status?: string): string {
  if (!status) return "Not submitted";
  const s = status.toUpperCase();
  if (s === "PENDING" || s === "RUNNING" || s === "COMPILING") {
    return "Evaluating...";
  }
  if (s === "ACCEPTED") return "Accepted";
  if (s === "WRONG_ANSWER") return "Wrong Answer";
  if (s === "TIME_LIMIT_EXCEEDED") return "Time Limit Exceeded";
  if (s === "MEMORY_LIMIT_EXCEEDED") return "Memory Limit Exceeded";
  if (s === "RUNTIME_ERROR") return "Runtime Error";
  if (s === "COMPILATION_ERROR") return "Compilation Error";
  return status;
}

function attemptBadgeVariant(
  status?: string
): "success" | "warning" | "danger" | "default" {
  if (!status) return "default";
  const s = status.toUpperCase();
  if (s === "ACCEPTED") return "success";
  if (s === "PENDING" || s === "RUNNING" || s === "COMPILING") return "warning";
  if (
    s === "WRONG_ANSWER" ||
    s === "TIME_LIMIT_EXCEEDED" ||
    s === "MEMORY_LIMIT_EXCEEDED" ||
    s === "RUNTIME_ERROR" ||
    s === "COMPILATION_ERROR"
  ) {
    return "danger";
  }
  return "default";
}

function languageLabel(lang: string): string {
  switch (lang) {
    case "python":
      return "Python";
    case "javascript":
      return "JavaScript";
    case "cpp":
      return "C++";
    case "java":
      return "Java";
    default:
      return lang || "Unavailable";
  }
}

function interviewTypeBlurb(t: string): string {
  switch (t) {
    case "coding":
      return "Solve coding problems";
    case "dsa":
      return "Focused DSA interview";
    case "mixed":
      return "Coding + interview-style challenge";
    default:
      return "Interview type";
  }
}

function difficultyLabel(d: string): string {
  if (!d) return "Unavailable";
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function metricDisplay(value: number | null | undefined, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return `${value}${suffix}`;
}

/**
 * Cancelled sessions often persist overallScore 0 from report generation —
 * do not present that as meaningful performance.
 */
function historyScoreDisplay(
  status: string,
  score: number | null | undefined
): string {
  const s = String(status || "").toLowerCase();
  if (s === "abandoned") {
    if (score == null || score === 0) return "—";
    return `${score}/100`;
  }
  if (s === "in_progress") return "—";
  if (score == null) return "Unavailable";
  return `${score}/100`;
}

function historyAcceptedDisplay(
  status: string,
  accepted: number | null | undefined,
  total: number | null | undefined
): string {
  const s = String(status || "").toLowerCase();
  if (s === "abandoned" && (accepted == null || accepted === 0)) {
    return total != null ? `0/${total}` : "—";
  }
  if (accepted == null && total == null) return "Unavailable";
  if (accepted != null && total != null) return `${accepted}/${total}`;
  if (accepted != null) return String(accepted);
  return "Unavailable";
}

function formatHistoryDate(iso?: string): string {
  if (!iso) return "Unavailable";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function friendlyApiMessage(err: unknown, fallback: string): string {
  const ax = err as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  const status = ax?.response?.status;
  const serverMsg = ax?.response?.data?.message;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "Premium access required for Mock Interviews.";
  if (status === 429) return "Too many interview requests. Please wait a moment and try again.";
  if (status === 409) {
    return (
      (typeof serverMsg === "string" && serverMsg.trim()) ||
      "You already have an interview in progress."
    );
  }
  if (status && status >= 500) {
    return "Something went wrong while preparing your interview. Please try again.";
  }
  if (
    ax?.code === "ECONNABORTED" ||
    /timeout/i.test(String(ax?.message || ""))
  ) {
    return "We couldn't confirm whether the interview started. Refresh your history before trying again.";
  }
  if (
    ax?.code === "ERR_NETWORK" ||
    /network error/i.test(String(ax?.message || ""))
  ) {
    return "Connection unavailable. Check your network and try again.";
  }
  if (
    typeof serverMsg === "string" &&
    serverMsg.trim() &&
    !/axios|mongo|stack|internal server/i.test(serverMsg)
  ) {
    return serverMsg.trim();
  }
  return fallback;
}

function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name || "?").slice(0, 2).toUpperCase();
}

type HistoryFilter = "all" | "completed" | "cancelled";

function ScoreMetricCard({
  label,
  cell,
}: {
  label: string;
  cell: MockScoreCell;
}) {
  const available = cell.available && cell.score != null;
  const score = available ? cell.score! : null;
  const detail = formatScoreDetailMs(cell.detail) || cell.signal;

  return (
    <article className="mock-metric-card">
      <header className="mock-metric-card-head">
        <h4>{label}</h4>
        {available ? (
          <span className="mock-metric-score">{score}/100</span>
        ) : (
          <span className="mock-metric-unavailable">Unavailable</span>
        )}
      </header>
      {available ? (
        <div
          className="mock-metric-bar"
          role="progressbar"
          aria-valuenow={score!}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} score`}
        >
          <span style={{ width: `${Math.min(100, Math.max(0, score!))}%` }} />
        </div>
      ) : null}
      {detail ? <p className="mock-metric-detail">{detail}</p> : null}
    </article>
  );
}

function InsightChip({
  label,
  score,
  positive,
}: {
  label: string;
  score?: number | null;
  positive?: boolean;
}) {
  return (
    <div
      className={
        positive ? "mock-insight-chip mock-insight-chip-ok" : "mock-insight-chip"
      }
    >
      {positive ? (
        <CheckCircle2 size={14} aria-hidden />
      ) : (
        <XCircle size={14} aria-hidden />
      )}
      <span className="mock-insight-chip-body">
        <span className="mock-insight-chip-label">{label}</span>
        {score != null && Number.isFinite(score) ? (
          <span className="mock-insight-chip-score">{score}/100</span>
        ) : null}
      </span>
    </div>
  );
}

/** Match backend strength/improve labels to score cells when possible (real data only). */
function scoreForInsightLabel(
  report: MockInterviewReport,
  label: string
): number | null {
  const key = label.toLowerCase().replace(/[^a-z]/g, "");
  const map: Array<[string, MockScoreCell | undefined]> = [
    ["problemsolving", report.scores.problemSolving],
    ["correctness", report.scores.correctness],
    ["complexity", report.scores.complexity],
    ["timemanagement", report.scores.timeManagement],
    ["codequality", report.scores.codeQuality],
    ["performance", report.scores.performance],
    ["completion", report.scores.completion],
    ["attemptefficiency", report.scores.attempts],
    ["attempts", report.scores.attempts],
  ];
  for (const [k, cell] of map) {
    if (key.includes(k) || k.includes(key)) {
      if (cell?.available && cell.score != null) return cell.score;
    }
  }
  return null;
}

function OptionCard({
  selected,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        selected ? "mock-option-card mock-option-card-active" : "mock-option-card"
      }
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="mock-option-card-title">{title}</span>
      {subtitle ? (
        <span className="mock-option-card-sub">{subtitle}</span>
      ) : null}
      {selected ? (
        <CheckCircle2 size={16} className="mock-option-check" aria-hidden />
      ) : null}
    </button>
  );
}

/** Shared compact config option — used for difficulty, duration, language, role, count. */
function InterviewConfigOption({
  selected,
  children,
  onClick,
  disabled,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        selected
          ? "mock-config-option mock-config-option-selected"
          : "mock-config-option"
      }
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="mock-config-option-label">{children}</span>
      {selected ? (
        <CheckCircle2 size={14} className="mock-config-option-check" aria-hidden />
      ) : null}
    </button>
  );
}

function toActiveMeta(s: MockInterviewSession): ActiveMockInterviewMeta {
  return {
    id: s.id,
    endsAt: s.endsAt,
    serverNow: s.serverNow,
    remainingMs: s.remainingMs,
    language: s.config?.language,
  };
}

export const MockInterviewPanel: FC<Props> = ({
  onOpenProblem,
  onActiveSessionChange,
  lastSubmission,
  refreshKey = 0,
  preferredCompany = null,
  onViewSubmission,
}) => {
  const { user } = useAuth();
  const allowed = canAccess(user, "premium.mock_interview");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState<MockInterviewSession | null>(null);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [pastSessions, setPastSessions] = useState<PastInterviewRow[]>([]);
  const [cfg, setCfg] = useState<MockInterviewPublicConfig | null>(null);
  const [companyDirectory, setCompanyDirectory] = useState<CompanyCard[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [configHint, setConfigHint] = useState("");
  const startLockRef = useRef(false);

  const onActiveSessionChangeRef = useRef(onActiveSessionChange);
  useEffect(() => {
    onActiveSessionChangeRef.current = onActiveSessionChange;
  }, [onActiveSessionChange]);

  const [company, setCompany] = useState("Amazon");
  const [role, setRole] = useState("SDE");
  const [interviewType, setInterviewType] = useState<"coding" | "dsa" | "mixed">(
    "coding"
  );
  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard" | "mixed"
  >("medium");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [language, setLanguage] = useState<
    "python" | "javascript" | "cpp" | "java"
  >("python");
  const [topicList, setTopicList] = useState<string[]>(["Arrays"]);
  const [problemCount, setProblemCount] = useState(1);

  useEffect(() => {
    if (!preferredCompany) return;
    setCompany(preferredCompany);
  }, [preferredCompany]);

  const notifyActive = useCallback((s: MockInterviewSession | null) => {
    if (s?.status === "in_progress") {
      onActiveSessionChangeRef.current?.(toActiveMeta(s));
    } else {
      onActiveSessionChangeRef.current?.(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      setHasLoadedOnce(true);
      return;
    }
    setError("");
    try {
      const [cfgRes, activeRes, mineRes, companyRes] = await Promise.allSettled([
        mockInterviewApi.getConfig(),
        mockInterviewApi.getActive(),
        mockInterviewApi.listMine(50),
        companyApi.listDirectory({ limit: 50 }),
      ]);
      if (cfgRes.status === "fulfilled" && cfgRes.value.data) {
        setCfg(cfgRes.value.data);
      }
      if (activeRes.status === "fulfilled") {
        const active = activeRes.value.data ?? null;
        setSession(active);
        notifyActive(active);
        if (active?.report) setReport(active.report);
      } else {
        throw activeRes.reason;
      }
      if (mineRes.status === "fulfilled") {
        setPastSessions(mineRes.value.data || []);
      }
      if (companyRes.status === "fulfilled" && companyRes.value.data) {
        setCompanyDirectory(companyRes.value.data);
      }
    } catch (err: unknown) {
      setError(friendlyApiMessage(err, "Unable to load mock interviews."));
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [allowed, notifyActive]);

  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!session || session.status !== "in_progress") return;
    const sessionId = session.id;
    const sync = window.setInterval(() => {
      void (async () => {
        try {
          const res = await mockInterviewApi.getById(sessionId);
          if (!res.data) return;
          setSession((prev) => {
            if (!prev || prev.id !== sessionId) return prev;
            if (
              prev.status === res.data!.status &&
              prev.endsAt === res.data!.endsAt &&
              JSON.stringify(prev.attempts) === JSON.stringify(res.data!.attempts)
            ) {
              return prev;
            }
            return res.data!;
          });
          if (res.data.status !== "in_progress") {
            if (res.data.report) setReport(res.data.report);
            notifyActive(null);
            void load();
          }
        } catch {
          /* ignore */
        }
      })();
    }, 15000);
    return () => window.clearInterval(sync);
  }, [session?.id, session?.status, notifyActive, load]);

  const handleExpireDisplay = useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    void (async () => {
      try {
        const res = await mockInterviewApi.getById(sessionId);
        if (res.data) {
          setSession(res.data);
          if (res.data.report) setReport(res.data.report);
          if (res.data.status !== "in_progress") {
            notifyActive(null);
            void load();
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [notifyActive, load]);

  const attemptByProblem = useMemo(() => {
    const m = new Map<
      string,
      NonNullable<MockInterviewSession["attempts"]>[number]
    >();
    for (const a of session?.attempts || []) m.set(a.problemId, a);
    return m;
  }, [session]);

  const companies = useMemo(() => {
    const base =
      cfg?.companies || ["Amazon", "Google", "Microsoft", "Meta", "Generic"];
    if (company && !base.includes(company)) {
      return [company, ...base];
    }
    return base;
  }, [cfg?.companies, company]);

  const companyByName = useMemo(() => {
    const m = new Map<string, CompanyCard>();
    for (const c of companyDirectory) {
      m.set(c.name.trim().toLowerCase(), c);
    }
    return m;
  }, [companyDirectory]);

  const historyStats = useMemo(() => {
    const total = pastSessions.length;
    const completed = pastSessions.filter(
      (s) => String(s.status).toLowerCase() === "completed"
    ).length;
    const scores = pastSessions
      .filter((s) => {
        const st = String(s.status).toLowerCase();
        if (st === "abandoned" || st === "in_progress") return false;
        return s.overallScore != null;
      })
      .map((s) => s.overallScore as number);
    const best = scores.length ? Math.max(...scores) : null;
    const avg = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
    return { total, completed, best, avg };
  }, [pastSessions]);

  const filteredPast = useMemo(() => {
    if (historyFilter === "completed") {
      return pastSessions.filter(
        (s) => String(s.status).toLowerCase() === "completed"
      );
    }
    if (historyFilter === "cancelled") {
      return pastSessions.filter(
        (s) => String(s.status).toLowerCase() === "abandoned"
      );
    }
    return pastSessions;
  }, [pastSessions, historyFilter]);

  const resolveCompanyMeta = (name: string) =>
    companyByName.get(name.trim().toLowerCase()) || null;

  const roles =
    cfg?.roles || [
      "SDE",
      "Backend Developer",
      "Frontend Developer",
      "Full Stack Developer",
    ];
  const durations = cfg?.durationMinutes || [30, 45, 60, 90];
  const counts = cfg?.problemCounts || [1, 2, 3, 4, 5];
  const interviewTypes = (cfg?.interviewTypes || ["coding", "dsa", "mixed"]) as Array<
    "coding" | "dsa" | "mixed"
  >;
  const difficulties = (cfg?.difficulties || [
    "easy",
    "medium",
    "hard",
    "mixed",
  ]) as Array<"easy" | "medium" | "hard" | "mixed">;
  const languages = (cfg?.languages || [
    "python",
    "javascript",
    "cpp",
    "java",
  ]) as Array<"python" | "javascript" | "cpp" | "java">;

  const addTopic = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setTopicList((prev) =>
      prev.some((x) => x.toLowerCase() === t.toLowerCase())
        ? prev
        : [...prev, t]
    );
    setTopicDraft("");
  };

  const removeTopic = (t: string) => {
    setTopicList((prev) => prev.filter((x) => x !== t));
  };

  const onTopicKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTopic(topicDraft);
    } else if (e.key === "Backspace" && !topicDraft && topicList.length > 0) {
      removeTopic(topicList[topicList.length - 1]);
    }
  };

  const applyConfigFromSession = (s: MockInterviewSession) => {
    const c = s.config;
    if (c.company) setCompany(c.company);
    if (c.role) setRole(c.role);
    if (c.interviewType) setInterviewType(c.interviewType);
    if (c.difficulty) setDifficulty(c.difficulty);
    if (c.durationMinutes) setDurationMinutes(c.durationMinutes);
    if (c.language) setLanguage(c.language);
    if (c.topics?.length) setTopicList(c.topics);
    if (c.problemCount) setProblemCount(c.problemCount);
  };

  if (!allowed) {
    return (
      <div className="co-page mock-page">
        <UpgradePrompt
          feature="premium.mock_interview"
          title="Premium Mock Interviews"
          description="Unlock realistic company-focused interview practice with server-controlled timing and judge-backed results."
        />
      </div>
    );
  }

  if (loading && !hasLoadedOnce) {
    return (
      <div className="co-page mock-page" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        <div className="mock-feature-strip">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const handleStart = async (override?: {
    company?: string;
    role?: string;
    interviewType?: "coding" | "dsa" | "mixed";
    difficulty?: "easy" | "medium" | "hard" | "mixed";
    durationMinutes?: number;
    language?: "python" | "javascript" | "cpp" | "java";
    topics?: string[];
    problemCount?: number;
  }) => {
    if (busy || startLockRef.current) return;
    if (!company.trim() || !role.trim() || topicList.length === 0) {
      setConfigHint(
        !topicList.length
          ? "Add at least one topic before starting."
          : "Complete company and role before starting."
      );
      return;
    }
    setConfigHint("");
    startLockRef.current = true;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const res = await mockInterviewApi.start({
        company: (override?.company ?? company) || undefined,
        role: (override?.role ?? role) || undefined,
        interviewType: override?.interviewType ?? interviewType,
        difficulty: override?.difficulty ?? difficulty,
        durationMinutes: override?.durationMinutes ?? durationMinutes,
        language: override?.language ?? language,
        topics: override?.topics ?? topicList,
        problemCount: override?.problemCount ?? problemCount,
      });
      if (res.data) {
        setSession(res.data);
        notifyActive(res.data);
      }
    } catch (err: unknown) {
      setError(
        friendlyApiMessage(err, "Unable to start interview. Please try again.")
      );
    } finally {
      setBusy(false);
      startLockRef.current = false;
    }
  };

  const handleAttach = async (problemId: string) => {
    if (!session || !lastSubmission || lastSubmission.problemId !== problemId) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await mockInterviewApi.attachSubmission(
        session.id,
        problemId,
        lastSubmission.id
      );
      if (res.data) setSession(res.data);
    } catch (err: unknown) {
      setError(friendlyApiMessage(err, "Couldn't attach submission."));
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const res = await mockInterviewApi.complete(session.id);
      if (res.data) {
        setSession(res.data);
        if (res.data.report) setReport(res.data.report);
        notifyActive(null);
        void load();
      }
    } catch (err: unknown) {
      setError(friendlyApiMessage(err, "Couldn't finish the interview."));
    } finally {
      setBusy(false);
    }
  };

  const handleAbandon = async () => {
    if (!session) return;
    if (
      !window.confirm(
        "Abandon this interview? You can start a new one later; this session will be cancelled."
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await mockInterviewApi.abandon(session.id);
      if (res.data) {
        setSession(res.data);
        if (res.data.report) setReport(res.data.report);
        notifyActive(null);
        void load();
      }
    } catch (err: unknown) {
      setError(friendlyApiMessage(err, "Abandon failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (problemId: string, slug?: string) => {
    setBusy(true);
    setError("");
    try {
      let problem: Problem | null = null;
      if (slug) {
        try {
          const bySlug = await problemApi.getProblemBySlug(slug);
          problem = bySlug.data || null;
        } catch {
          /* fall through */
        }
      }
      if (!problem) {
        const byId = await problemApi.getProblemById(problemId);
        problem = byId.data || null;
      }
      if (!problem) throw new Error("Problem not found");
      onOpenProblem(
        problem,
        session?.status === "in_progress" ? session.id : undefined,
        session?.config?.language
      );
    } catch (err: unknown) {
      setError(friendlyApiMessage(err, "Open problem failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleViewSubmission = (
    submissionId: string | undefined,
    problemId: string,
    problemSlug?: string
  ) => {
    if (!submissionId || !onViewSubmission) return;
    onViewSubmission({ submissionId, problemId, problemSlug });
  };

  const handleOpenPast = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await mockInterviewApi.getById(id);
      if (res.data) {
        setSession(res.data);
        if (res.data.report) {
          setReport(res.data.report);
        } else {
          try {
            const rep = await mockInterviewApi.getReport(id);
            if (rep.data?.report) setReport(rep.data.report);
            else setReport(null);
          } catch {
            setReport(null);
          }
        }
        if (res.data.status === "in_progress") {
          notifyActive(res.data);
        } else {
          notifyActive(null);
        }
      }
    } catch (err: unknown) {
      setError(
        friendlyApiMessage(
          err,
          "Unable to load interview. We couldn't retrieve this interview right now."
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const handleBackToConfigure = () => {
    setSession(null);
    setReport(null);
    setError("");
  };

  const handleRetryInterview = async () => {
    if (!session) {
      handleBackToConfigure();
      return;
    }
    const ok = window.confirm(
      "Start a new interview with the same settings? Your previous report stays in history."
    );
    if (!ok) return;
    applyConfigFromSession(session);
    const c = session.config;
    setSession(null);
    setReport(null);
    await handleStart({
      company: c.company,
      role: c.role,
      interviewType: c.interviewType,
      difficulty: c.difficulty,
      durationMinutes: c.durationMinutes,
      language: c.language,
      topics: c.topics,
      problemCount: c.problemCount,
    });
  };

  const isLive = session?.status === "in_progress";
  const showConfigure = !isLive;

  const selectedCompanyMeta = resolveCompanyMeta(company);
  const canStart =
    Boolean(company.trim()) &&
    Boolean(role.trim()) &&
    topicList.length > 0 &&
    !busy;

  return (
    <div className="co-page mock-page">
      <header className="co-header">
        <div>
          <p className="co-kicker">
            Interview 
          </p>
          <h1 className="co-title">
            <Swords size={22} strokeWidth={2} aria-hidden /> Mock Interviews
          </h1>
          <p className="co-lede">
            Practice realistic technical interviews with real problems,
            server-controlled timing, and judge-backed results.
          </p>
          <p className="mock-principle" role="note">
            Scores come only from real judge signals. No invented AI grades.
          </p>
        </div>
      </header>

      <div className="mock-feature-strip" aria-label="Interview capabilities">
        <div className="mock-feature-card">
          <Gauge size={18} aria-hidden />
          <div>
            <strong>Real Judge Signals</strong>
            <span>Submission-backed scores</span>
          </div>
        </div>
        <div className="mock-feature-card">
          <Timer size={18} aria-hidden />
          <div>
            <strong>Server Timed</strong>
            <span>Authoritative countdown</span>
          </div>
        </div>
        <div className="mock-feature-card">
          <Building2 size={18} aria-hidden />
          <div>
            <strong>Company Focused</strong>
            <span>Company-specific problem sets</span>
          </div>
        </div>
        <div className="mock-feature-card">
          <BarChart3 size={18} aria-hidden />
          <div>
            <strong>Performance Analytics</strong>
            <span>Session-based reports</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} aria-hidden />
          <div className="mock-error-block">
            <strong>Unable to load mock interviews</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {hasLoadedOnce && pastSessions.length > 0 && !isLive ? (
        <>
          <section className="mock-stats" aria-label="Interview overview">
            <div className="mock-stat">
              <strong>{historyStats.total}</strong>
              <span>Total</span>
            </div>
            <div className="mock-stat">
              <strong>{historyStats.completed}</strong>
              <span>Completed</span>
            </div>
            <div className="mock-stat">
              <strong>
                {historyStats.best != null ? `${historyStats.best}/100` : "—"}
              </strong>
              <span>Best score</span>
            </div>
            <div className="mock-stat">
              <strong>
                {historyStats.avg != null ? `${historyStats.avg}/100` : "—"}
              </strong>
              <span>Avg score</span>
            </div>
          </section>
          <p className="mock-stat-note">
            Overview from your recent interview history (up to 50 sessions).
          </p>
        </>
      ) : null}

      {isLive && session ? (
        <section className="co-panel mock-interview-live" aria-label="Active interview">
          <div className="mock-live-banner" style={{ marginBottom: 16 }}>
            <div>
              <p className="mock-live-banner-kicker">
                <span className="mock-live-dot" aria-hidden /> Live interview
              </p>
              <h2>
                {session.config.company || "Interview"} ·{" "}
                {session.config.role || "Role"}
              </h2>
              <p className="co-muted mock-interview-live-meta">
                {[
                  difficultyLabel(session.config.difficulty),
                  languageLabel(session.config.language),
                  session.config.interviewType
                    ? session.config.interviewType.toUpperCase()
                    : null,
                  `${session.config.durationMinutes} min`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <InterviewTimer
              endsAt={session.endsAt}
              serverNow={session.serverNow}
              initialRemainingMs={session.remainingMs}
              onExpireDisplay={handleExpireDisplay}
            />
          </div>
          <p className="co-muted mock-interview-timer-note">
            Timer is server-authoritative. Client countdown is display-only.
          </p>

          <div className="mock-interview-problems">
            <h3 className="mock-interview-problems-title">Problems</h3>
            <ul className="free-home-list mock-interview-problem-list">
              {(session.attempts || []).map((a) => {
                const att = attemptByProblem.get(a.problemId) || a;
                const statusText = attemptStatusLabel(att.status);
                const showAttachAction =
                  !att.status ||
                  ["PENDING", "RUNNING", "COMPILING"].includes(
                    String(att.status).toUpperCase()
                  );
                const eligibleSubmission =
                  Boolean(lastSubmission) &&
                  lastSubmission!.problemId === a.problemId;
                const wrongProblemSubmission =
                  Boolean(lastSubmission) &&
                  lastSubmission!.problemId !== a.problemId;
                const isAttached =
                  Boolean(att.status) &&
                  !["PENDING", "RUNNING", "COMPILING"].includes(
                    String(att.status).toUpperCase()
                  );

                return (
                  <li key={a.problemId}>
                    <div className="mock-interview-problem-row">
                      <div className="mock-interview-problem-main">
                        <strong>
                          {a.title || a.problemSlug || a.problemId}
                        </strong>
                        {isAttached ? (
                          <div className="mock-interview-attached">
                            <Badge variant={attemptBadgeVariant(att.status)}>
                              {statusText}
                            </Badge>
                            <dl className="mock-interview-attached-meta">
                              {att.testCasesPassed != null &&
                              att.totalTestCases != null ? (
                                <div>
                                  <dt>Tests</dt>
                                  <dd>
                                    {att.testCasesPassed}/{att.totalTestCases}
                                  </dd>
                                </div>
                              ) : null}
                              {att.attemptCount != null ? (
                                <div>
                                  <dt>Attempts</dt>
                                  <dd>{att.attemptCount}</dd>
                                </div>
                              ) : null}
                              {session.config.language ? (
                                <div>
                                  <dt>Language</dt>
                                  <dd>
                                    {languageLabel(session.config.language)}
                                  </dd>
                                </div>
                              ) : null}
                              {att.submissionId ? (
                                <div>
                                  <dt>Submission</dt>
                                  <dd className="mock-interview-mono">
                                    {att.submissionId.slice(0, 8)}…
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                          </div>
                        ) : (
                          <Badge variant={attemptBadgeVariant(att.status)}>
                            {statusText}
                          </Badge>
                        )}
                        {showAttachAction && !eligibleSubmission ? (
                          <p
                            className="mock-interview-attach-hint"
                            role="status"
                          >
                            {wrongProblemSubmission
                              ? "Your latest workspace submission is for a different problem. Open this problem, submit there, then return to attach it."
                              : "Submit your solution in the workspace first. Then return here to attach it to this interview."}
                          </p>
                        ) : null}
                      </div>
                      <div className="mock-interview-problem-actions">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void handleOpen(a.problemId, a.problemSlug)
                          }
                        >
                          Open Problem
                        </Button>
                        {isAttached && att.submissionId && onViewSubmission ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              handleViewSubmission(
                                att.submissionId,
                                a.problemId,
                                a.problemSlug
                              )
                            }
                          >
                            View Submission
                          </Button>
                        ) : null}
                        {showAttachAction ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy || !eligibleSubmission}
                            title={
                              eligibleSubmission
                                ? "Attach your latest workspace submission to this interview"
                                : "Submit in the workspace first, then attach here"
                            }
                            onClick={() => void handleAttach(a.problemId)}
                          >
                            Attach submission
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mock-interview-session-actions">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void handleComplete()}
            >
              <CheckCircle2 size={14} aria-hidden /> Finish & report
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void handleAbandon()}
            >
              <XCircle size={14} aria-hidden /> Abandon
            </Button>
          </div>
        </section>
      ) : null}

      {showConfigure ? (
        <div className="mock-config-layout">
          <section className="co-explorer mock-config-main" aria-label="Configure interview">
            <div className="co-section-head">
              <div>
                <p className="co-kicker">Mock Interview</p>
                <h2>Interview Configuration</h2>
                <p className="co-muted">
                  Customize your interview before starting.
                </p>
              </div>
              {preferredCompany ? (
                <Badge variant="primary">Preselected from Company Prep</Badge>
              ) : null}
            </div>

            <div className="mock-config-step">
              <div className="mock-config-step-label">
                <span className="mock-config-step-num">01</span>
                <span className="mock-config-step-sep" aria-hidden>
                  ·
                </span>
                <h3 className="mock-config-step-title">Company</h3>
              </div>
              <div className="mock-company-grid" role="listbox" aria-label="Company">
                {companies.map((c) => {
                  const meta = resolveCompanyMeta(c);
                  const selected = company === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={
                        selected
                          ? "mock-company-card mock-company-card-active"
                          : "mock-company-card"
                      }
                      onClick={() => setCompany(c)}
                    >
                      <span className="co-dir-logo" aria-hidden>
                        {meta?.logoUrl ? (
                          <img src={meta.logoUrl} alt="" />
                        ) : (
                          companyInitials(c)
                        )}
                      </span>
                      <span className="mock-company-meta">
                        <span className="mock-company-name">{c}</span>
                        {meta?.questionCount != null ? (
                          <span className="mock-company-sub">
                            {meta.questionCount} prep problem
                            {meta.questionCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </span>
                      {selected ? (
                        <CheckCircle2
                          size={16}
                          className="mock-company-check"
                          aria-hidden
                        />
                      ) : meta?.isPremium ? (
                        <PremiumBadge
                          feature="premium.company_questions"
                          className="mock-company-premium"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mock-config-step">
              <div className="mock-config-step-label">
                <span className="mock-config-step-num">02</span>
                <span className="mock-config-step-sep" aria-hidden>
                  ·
                </span>
                <h3 className="mock-config-step-title">Role</h3>
              </div>
              <div
                className="mock-config-options"
                role="radiogroup"
                aria-label="Role"
              >
                {roles.map((r) => (
                  <InterviewConfigOption
                    key={r}
                    selected={role === r}
                    onClick={() => setRole(r)}
                  >
                    {r}
                  </InterviewConfigOption>
                ))}
              </div>
            </div>

            <div className="mock-config-step">
              <div className="mock-config-step-label">
                <span className="mock-config-step-num">03</span>
                <span className="mock-config-step-sep" aria-hidden>
                  ·
                </span>
                <h3 className="mock-config-step-title">Interview Type</h3>
              </div>
              <div className="mock-option-grid">
                {interviewTypes.map((t) => (
                  <OptionCard
                    key={t}
                    selected={interviewType === t}
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                    subtitle={interviewTypeBlurb(t)}
                    onClick={() => setInterviewType(t)}
                  />
                ))}
              </div>
            </div>

            <div className="mock-config-step">
              <div className="mock-config-step-label">
                <span className="mock-config-step-num">04</span>
                <span className="mock-config-step-sep" aria-hidden>
                  ·
                </span>
                <h3 className="mock-config-step-title">Difficulty</h3>
              </div>
              <p className="mock-config-hint">
                Choose the difficulty level for your interview.
              </p>
              <div
                className="mock-config-options mock-config-options--quad"
                role="radiogroup"
                aria-label="Difficulty"
              >
                {difficulties.map((d) => (
                  <InterviewConfigOption
                    key={d}
                    selected={difficulty === d}
                    onClick={() => setDifficulty(d)}
                  >
                    {difficultyLabel(d)}
                  </InterviewConfigOption>
                ))}
              </div>
            </div>

            <div className="mock-config-step">
              <div className="mock-config-step-label">
                <span className="mock-config-step-num">05</span>
                <span className="mock-config-step-sep" aria-hidden>
                  ·
                </span>
                <h3 className="mock-config-step-title">Duration</h3>
              </div>
              <p className="mock-config-hint">
                Choose a duration that matches your preparation goal.
              </p>
              <div
                className="mock-config-options mock-config-options--quad"
                role="radiogroup"
                aria-label="Duration"
              >
                {durations.map((d) => (
                  <InterviewConfigOption
                    key={d}
                    selected={durationMinutes === d}
                    onClick={() => setDurationMinutes(d)}
                  >
                    {d} min
                  </InterviewConfigOption>
                ))}
              </div>
            </div>

            <div className="mock-config-step">
              <div className="mock-config-step-label">
                <span className="mock-config-step-num">06</span>
                <span className="mock-config-step-sep" aria-hidden>
                  ·
                </span>
                <h3 className="mock-config-step-title">Language</h3>
              </div>
              <p className="mock-config-hint">
                Choose the language you want to use during coding.
              </p>
              <div
                className="mock-config-options mock-config-options--langs"
                role="radiogroup"
                aria-label="Language"
              >
                {languages.map((lang) => (
                  <InterviewConfigOption
                    key={lang}
                    selected={language === lang}
                    onClick={() => setLanguage(lang)}
                  >
                    {languageLabel(lang)}
                  </InterviewConfigOption>
                ))}
              </div>
            </div>

            <div className="mock-config-step">
              <div className="mock-config-step-label">
                <span className="mock-config-step-num">07</span>
                <span className="mock-config-step-sep" aria-hidden>
                  ·
                </span>
                <h3 className="mock-config-step-title" id="mock-topics-label">
                  Topics
                </h3>
              </div>
              <div
                className="mock-topic-input"
                aria-labelledby="mock-topics-label"
              >
                {topicList.map((t) => (
                  <span key={t} className="mock-topic-token">
                    {t}
                    <button
                      type="button"
                      className="mock-topic-remove"
                      aria-label={`Remove ${t}`}
                      onClick={() => removeTopic(t)}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={topicDraft}
                  onChange={(e) => setTopicDraft(e.target.value)}
                  onKeyDown={onTopicKeyDown}
                  onBlur={() => addTopic(topicDraft)}
                  placeholder={
                    topicList.length ? "Add topic…" : "Type a topic and press Enter"
                  }
                  aria-label="Add topic"
                />
              </div>
            </div>

            <div className="mock-config-step">
              <div className="mock-config-step-label">
                <span className="mock-config-step-num">08</span>
                <span className="mock-config-step-sep" aria-hidden>
                  ·
                </span>
                <h3 className="mock-config-step-title">Problems</h3>
              </div>
              <p className="mock-config-hint">Number of problems</p>
              <div
                className="mock-config-options mock-config-options--counts"
                role="radiogroup"
                aria-label="Problem count"
              >
                {counts.map((n) => (
                  <InterviewConfigOption
                    key={n}
                    selected={problemCount === n}
                    onClick={() => setProblemCount(n)}
                  >
                    {n}
                  </InterviewConfigOption>
                ))}
              </div>
            </div>

            <div className="mock-config-footer">
              <div className="mock-config-ready">
                <p className="mock-config-ready-label">Ready to start</p>
                <p className="mock-config-ready-summary">
                  {[
                    difficultyLabel(difficulty),
                    `${durationMinutes} min`,
                    languageLabel(language),
                  ].join(" · ")}
                </p>
                {configHint ? (
                  <p className="mock-config-invalid" role="status">
                    {configHint}
                  </p>
                ) : (
                  <p className="mock-config-ready-note">
                    Your interview is ready.
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="lg"
                className="mock-config-start-btn"
                disabled={!canStart}
                onClick={() => void handleStart()}
                aria-label="Start mock interview"
              >
                <Play size={16} aria-hidden />
                {busy ? "Starting interview…" : "Start Mock Interview"}
              </Button>
            </div>
          </section>

          <section className="co-panel mock-summary-panel" aria-label="Interview summary">
            <p className="co-kicker">Interview Summary</p>
            <div className="mock-summary-company">
              <span className="co-dir-logo" aria-hidden>
                {selectedCompanyMeta?.logoUrl ? (
                  <img src={selectedCompanyMeta.logoUrl} alt="" />
                ) : (
                  companyInitials(company || "?")
                )}
              </span>
              <div>
                <strong>{company || "Company"}</strong>
                <p>
                  {role || "Role"} ·{" "}
                  {interviewType
                    ? interviewType.charAt(0).toUpperCase() + interviewType.slice(1)
                    : "Type"}
                </p>
              </div>
            </div>
            <div className="mock-summary-pills">
              <span className="mock-summary-pill">
                {difficultyLabel(difficulty)}
              </span>
              <span className="mock-summary-pill">{durationMinutes} min</span>
              <span className="mock-summary-pill">
                {languageLabel(language)}
              </span>
              <span className="mock-summary-pill">
                {problemCount} problem{problemCount === 1 ? "" : "s"}
              </span>
              {topicList.map((t) => (
                <span key={t} className="mock-summary-pill">
                  {t}
                </span>
              ))}
            </div>
            <p className="mock-summary-trust">
              Server-controlled timer — interview time is authoritative and
              continues according to the server session.
            </p>
            {configHint ? (
              <p className="mock-config-invalid" role="status">
                {configHint}
              </p>
            ) : null}
            <div className="mock-summary-actions">
              <Button
                type="button"
                size="lg"
                disabled={!canStart}
                onClick={() => void handleStart()}
                aria-label="Start interview"
              >
                <Play size={16} aria-hidden />
                {busy ? "Starting interview…" : "Start Mock Interview"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {report && session && !isLive ? (
        <section
          className="co-panel mock-report"
          aria-labelledby="interview-report"
        >
          <div className="free-home-card-head">
            <div>
              <p className="mock-breadcrumb">
                Mock Interviews / {session.config.company || "Interview"} /
                Interview Report
              </p>
              <h2 id="interview-report">
                <FileText size={16} aria-hidden /> Interview Report
              </h2>
              <p className="mock-interview-report-header">
                {session.config.company || "Interview"} ·{" "}
                {session.config.role || "Role"}
              </p>
            </div>
            <Badge variant={statusBadgeVariant(report.sessionStatus)}>
              {statusLabel(report.sessionStatus)}
            </Badge>
          </div>

          <div className="mock-score-hero">
            <div>
              <p className="mock-score-hero-label">Overall Score</p>
              {String(report.sessionStatus).toLowerCase() === "abandoned" &&
              (report.overallScore == null || report.overallScore === 0) ? (
                <p className="mock-score-hero-unavailable">Score unavailable</p>
              ) : report.overallScore != null ? (
                <p className="mock-score-hero-value">
                  <strong>{report.overallScore}</strong>
                  <span>/100</span>
                </p>
              ) : (
                <p className="mock-score-hero-unavailable">Score unavailable</p>
              )}
            </div>
            <dl className="mock-score-hero-meta">
              <div>
                <dt>Accepted</dt>
                <dd>
                  {report.problemsAccepted} / {report.problemsTotal}
                </dd>
              </div>
              <div>
                <dt>Problems</dt>
                <dd>{report.problemsTotal}</dd>
              </div>
              <div>
                <dt>Time used</dt>
                <dd>{formatHumanDuration(report.timeUsedMs)}</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>{formatHumanDuration(report.remainingMsAtEnd)}</dd>
              </div>
            </dl>
          </div>

          {report.strengths && report.strengths.length > 0 ? (
            <div className="mock-insights-block">
              <h3>Strengths</h3>
              <div className="mock-insight-grid">
                {report.strengths.map((s) => (
                  <InsightChip
                    key={s}
                    label={s}
                    score={scoreForInsightLabel(report, s)}
                    positive
                  />
                ))}
              </div>
            </div>
          ) : null}

          {report.areasToImprove && report.areasToImprove.length > 0 ? (
            <div className="mock-insights-block">
              <h3>Areas to Improve</h3>
              <div className="mock-insight-grid">
                {report.areasToImprove.map((s) => (
                  <InsightChip
                    key={s}
                    label={s}
                    score={scoreForInsightLabel(report, s)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <h3 className="mock-interview-subhead">Score breakdown</h3>
          <div className="mock-metric-grid">
            <ScoreMetricCard
              label="Problem Solving"
              cell={report.scores.problemSolving}
            />
            <ScoreMetricCard
              label="Correctness"
              cell={report.scores.correctness}
            />
            <ScoreMetricCard
              label="Complexity"
              cell={report.scores.complexity}
            />
            <ScoreMetricCard
              label="Time Management"
              cell={report.scores.timeManagement}
            />
            <ScoreMetricCard
              label="Code Quality"
              cell={report.scores.codeQuality}
            />
            <ScoreMetricCard
              label="Performance"
              cell={report.scores.performance}
            />
            <ScoreMetricCard
              label="Completion"
              cell={report.scores.completion}
            />
            {report.scores.attempts ? (
              <ScoreMetricCard
                label="Attempt Efficiency"
                cell={report.scores.attempts}
              />
            ) : null}
          </div>

          <h3 className="mock-interview-subhead">Problem performance</h3>
          <ul className="mock-problem-result-list">
            {(report.attempts || []).map((a) => (
              <li key={a.problemId} className="mock-problem-result-card">
                <div className="mock-problem-result-head">
                  <strong>{a.title || a.problemSlug || a.problemId}</strong>
                  <Badge variant={attemptBadgeVariant(a.status)}>
                    {attemptStatusLabel(a.status)}
                  </Badge>
                </div>
                <dl className="mock-interview-attached-meta">
                  <div>
                    <dt>Tests</dt>
                    <dd>
                      {a.testCasesPassed != null && a.totalTestCases != null
                        ? `${a.testCasesPassed} / ${a.totalTestCases}`
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt>Attempts</dt>
                    <dd>{metricDisplay(a.attemptCount)}</dd>
                  </div>
                  <div>
                    <dt>Runtime</dt>
                    <dd>
                      {a.executionTimeMs != null
                        ? `${a.executionTimeMs} ms`
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt>Memory</dt>
                    <dd>
                      {a.memoryMb != null ? `${a.memoryMb} MB` : "Unavailable"}
                    </dd>
                  </div>
                </dl>
                <div className="mock-interview-problem-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void handleOpen(a.problemId, a.problemSlug)}
                  >
                    <ExternalLink size={12} aria-hidden /> Open Problem
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void handleOpen(a.problemId, a.problemSlug)}
                  >
                    Practice Again
                  </Button>
                  {a.submissionId && onViewSubmission ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        handleViewSubmission(
                          a.submissionId,
                          a.problemId,
                          a.problemSlug
                        )
                      }
                    >
                      View Submission
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <div className="mock-report-actions">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void handleRetryInterview()}
            >
              <RotateCcw size={14} aria-hidden /> Retry Interview
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleBackToConfigure}
            >
              Configure new
            </Button>
          </div>
        </section>
      ) : null}

      <section className="co-panel mock-interview-past" aria-label="Past interviews">
        <div className="co-section-head mock-history-head">
          <div>
            <p className="co-kicker">History</p>
            <h2>Past Interviews</h2>
            <p className="co-muted">
              Review previous interview attempts and performance.
            </p>
          </div>
          {pastSessions.length > 0 ? (
            <span className="co-muted">
              {pastSessions.length} session{pastSessions.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {pastSessions.length > 0 ? (
          <div className="mock-history-tools">
            <div
              className="mock-history-filters"
              role="tablist"
              aria-label="History filter"
            >
              {(
                [
                  ["all", "All"],
                  ["completed", "Completed"],
                  ["cancelled", "Cancelled"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={historyFilter === id}
                  className={
                    historyFilter === id
                      ? "mock-hist-chip mock-hist-chip-active"
                      : "mock-hist-chip"
                  }
                  onClick={() => setHistoryFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {pastSessions.length === 0 ? (
          <EmptyState
            compact
            title="No mock interviews yet"
            description="Start your first interview to see your performance history here."
            action={
              showConfigure ? (
                <Button
                  type="button"
                  disabled={!canStart}
                  onClick={() => void handleStart()}
                >
                  <Play size={14} aria-hidden /> Configure Interview
                </Button>
              ) : undefined
            }
          />
        ) : filteredPast.length === 0 ? (
          <EmptyState
            compact
            title={
              historyFilter === "completed"
                ? "No completed interviews"
                : historyFilter === "cancelled"
                  ? "No cancelled interviews"
                  : "No interviews"
            }
            description="Try another filter or start a new interview."
          />
        ) : (
          <>
            <div className="mock-history-table-wrap">
              <table className="mock-history-table">
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Score</th>
                    <th scope="col">Accepted</th>
                    <th scope="col">Language</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Date</th>
                    <th scope="col">
                      <span className="co-sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPast.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.config?.company || "Interview"}</strong>
                      </td>
                      <td>{s.config?.role || "—"}</td>
                      <td>
                        <Badge
                          variant={statusBadgeVariant(String(s.status))}
                          className="mock-history-tag"
                        >
                          {statusLabel(String(s.status))}
                        </Badge>
                      </td>
                      <td
                        className="mock-history-mono"
                        title={
                          historyScoreDisplay(
                            String(s.status),
                            s.overallScore
                          ) === "Unavailable"
                            ? "Score unavailable because no valid judge result was recorded."
                            : undefined
                        }
                      >
                        {historyScoreDisplay(String(s.status), s.overallScore)}
                      </td>
                      <td className="mock-history-mono">
                        {historyAcceptedDisplay(
                          String(s.status),
                          s.problemsAccepted,
                          s.problemsTotal
                        )}
                      </td>
                      <td>
                        {s.config?.language
                          ? languageLabel(s.config.language)
                          : "—"}
                      </td>
                      <td>
                        {s.config?.durationMinutes != null
                          ? `${s.config.durationMinutes}m`
                          : "—"}
                      </td>
                      <td>{formatHistoryDate(s.startedAt)}</td>
                      <td>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void handleOpenPast(s.id)}
                        >
                          {s.hasReport === false
                            ? "Report Unavailable"
                            : "View Report"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mock-history-cards">
              {filteredPast.map((s) => (
                <li key={`${s.id}-card`} className="mock-past-card">
                  <div className="mock-past-card-top">
                    <div>
                      <strong>{s.config?.company || "Interview"}</strong>
                      <p className="co-muted">{s.config?.role || "Role"}</p>
                    </div>
                    <Badge
                      variant={statusBadgeVariant(String(s.status))}
                      className="mock-history-tag"
                    >
                      {statusLabel(String(s.status))}
                    </Badge>
                  </div>
                  <dl className="mock-past-metrics">
                    <div>
                      <dt>Score</dt>
                      <dd>
                        {historyScoreDisplay(String(s.status), s.overallScore)}
                      </dd>
                    </div>
                    <div>
                      <dt>Accepted</dt>
                      <dd>
                        {historyAcceptedDisplay(
                          String(s.status),
                          s.problemsAccepted,
                          s.problemsTotal
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Language</dt>
                      <dd>
                        {s.config?.language
                          ? languageLabel(s.config.language)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd>
                        {s.config?.durationMinutes != null
                          ? `${s.config.durationMinutes}m`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>{formatHistoryDate(s.startedAt)}</dd>
                    </div>
                  </dl>
                  <div className="mock-past-card-actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void handleOpenPast(s.id)}
                    >
                      {s.hasReport === false
                        ? "Report Unavailable"
                        : "View Report"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};
