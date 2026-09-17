import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Code2,
  FileBarChart,
  FileCode2,
  Gauge,
  HeartPulse,
  Languages,
  Loader2,
  Megaphone,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Star,
  Tags,
  Target,
  Trash2,
  Trophy,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  adminAnalyticsApi,
  HEALTH_ENDPOINTS,
  pingHealthDetailed,
  type DashboardRange,
} from "../../../api/adminAnalyticsApi";
import { adminAuthApi, type AdminUser } from "../../../api/adminAuthApi";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import { adminProblemApi } from "../../../api/adminProblemApi";
import { adminRealtimeApi } from "../../../api/adminRealtimeApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";
import { DifficultyBadge } from "../shared/DifficultyBadge";
import { SubmissionVerdictBadge } from "../shared/SubmissionVerdictBadge";
import { DataTable } from "../shared/DataTable";
import { EmptyState } from "../shared/EmptyState";
import { usePermission } from "../../../rbac/usePermission";
import type { AdminTab } from "../adminNav";
import { WidgetError } from "../shared/WidgetError";
import { normalizeApiError } from "../../../lib/apiError";
import { useToast } from "../../../context/ToastContext";
import { Button } from "../../ui/button";
import "./dashboard.css";

/** Recharts legend without SVG icon glyphs that dump as "svg" in text trees. */
const ChartLegendContent: FC<{
  payload?: Array<{ value?: string; color?: string }>;
}> = ({ payload }) => (
  <ul className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 pt-1">
    {(payload || []).map((entry) => (
      <li
        key={String(entry.value)}
        className="font-primary inline-flex items-center gap-1.5 text-[0.7rem] text-muted-foreground"
      >
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: entry.color || "var(--muted-foreground)" }}
          aria-hidden
        />
        <span>{humanizeStatus(String(entry.value || ""))}</span>
      </li>
    ))}
  </ul>
);

const RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

const STATUS_COLORS: Record<string, string> = {
  ACCEPTED: "var(--chart-4)",
  WRONG_ANSWER: "var(--chart-2)",
  RUNTIME_ERROR: "var(--chart-5)",
  COMPILATION_ERROR: "var(--chart-5)",
  TIME_LIMIT_EXCEEDED: "var(--chart-3)",
  MEMORY_LIMIT_EXCEEDED: "var(--chart-3)",
  PENDING: "var(--muted-foreground)",
  RUNNING: "var(--chart-1)",
  SYSTEM_ERROR: "var(--destructive)",
};

const DIFF_COLORS = {
  easy: "var(--chart-4)",
  medium: "var(--chart-2)",
  hard: "var(--chart-5)",
};

const CHART_TOOLTIP = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

const CHART = {
  1: "var(--chart-1)",
  2: "var(--chart-2)",
  3: "var(--chart-3)",
  4: "var(--chart-4)",
  5: "var(--chart-5)",
  grid: "var(--border)",
  tick: "var(--muted-foreground)",
};

const TOP_SORTS = [
  { id: "attempts", label: "Most attempted" },
  { id: "solved", label: "Most solved" },
  { id: "accept_high", label: "Highest acceptance" },
  { id: "accept_low", label: "Lowest acceptance" },
] as const;

type TopSort = (typeof TOP_SORTS)[number]["id"];

/** Client-side Live Activity page size (Dashboard feed only). */
const LIVE_ACTIVITY_PAGE_SIZE = 5;

function formatNumber(n: unknown): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString();
}

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 45) return "just now";
  if (sec < 60) return "1 min ago";
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    return m === 1 ? "1 min ago" : `${m} min ago`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  if (sec < 86400 * 7) {
    const d = Math.floor(sec / 86400);
    return d === 1 ? "1 day ago" : `${d} days ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanizeStatus(raw: string): string {
  return String(raw || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function languageLabel(raw?: string | null): string {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return "—";
  const map: Record<string, string> = {
    cpp: "C++",
    "c++": "C++",
    c: "C",
    javascript: "JavaScript",
    js: "JavaScript",
    typescript: "TypeScript",
    ts: "TypeScript",
    python: "Python",
    python3: "Python",
    java: "Java",
    go: "Go",
    golang: "Go",
    rust: "Rust",
    csharp: "C#",
    "c#": "C#",
  };
  return map[s] || humanizeStatus(s);
}

/** Readable Live Activity titles for audit/contest actions (never raw dotted keys). */
const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  "contest.start": "Contest Started",
  "contest.publish": "Contest Published",
  "contest.problem.add": "Problem Added",
  "contest.create": "Contest Created",
  "contest.update": "Contest Updated",
  "contest.end": "Contest Ended",
  "contest.delete": "Contest Deleted",
  "contest.unpublish": "Contest Unpublished",
};

function humanizeActivityAction(action?: string | null): string {
  const raw = String(action || "").trim();
  if (!raw) return "Admin action";
  const key = raw.toLowerCase();
  if (ACTIVITY_ACTION_LABELS[key]) return ACTIVITY_ACTION_LABELS[key];

  const parts = key.split(/[._]+/).filter(Boolean);
  if (parts.length >= 2) {
    const verb = parts[parts.length - 1];
    const subjectParts = parts.slice(0, -1);
    // Prefer the most specific noun: contest.problem.add → Problem
    const subject =
      subjectParts[subjectParts.length - 1] === "problem"
        ? "Problem"
        : subjectParts
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" ");
    const verbLabel: Record<string, string> = {
      start: "Started",
      publish: "Published",
      unpublish: "Unpublished",
      create: "Created",
      add: "Added",
      update: "Updated",
      delete: "Deleted",
      remove: "Removed",
      end: "Ended",
      finish: "Finished",
    };
    if (verbLabel[verb]) return `${subject} ${verbLabel[verb]}`;
  }

  return humanizeStatus(raw.replace(/[._]+/g, " "));
}

function humanizeActivityResource(resource?: string | null): string {
  const raw = String(resource || "").trim();
  if (!raw) return "—";
  if (/^contest$/i.test(raw)) return "Contest";
  if (/^problem$/i.test(raw)) return "Problem";
  if (/^submission$/i.test(raw)) return "Submission";
  if (/^user$/i.test(raw)) return "User";
  return humanizeStatus(raw.replace(/[._]+/g, " "));
}

function isLikelyObjectId(value?: string | null): boolean {
  return /^[a-f0-9]{24}$/i.test(String(value || "").trim());
}

function formatActivityEntity(
  resource?: string | null,
  resourceId?: string | null,
): string {
  const label = humanizeActivityResource(resource);
  const id = String(resourceId || "").trim();
  if (!id || isLikelyObjectId(id)) return label;
  return `${label} · ${id}`;
}

function submissionActivityIcon(status: string): ReactNode {
  const st = status.toUpperCase();
  if (st === "ACCEPTED") {
    return (
      <CheckCircle2
        size={14}
        strokeWidth={2}
        className="size-3.5 text-success"
        aria-hidden
      />
    );
  }
  if (st === "WRONG_ANSWER") {
    return (
      <XCircle
        size={14}
        strokeWidth={2}
        className="size-3.5 text-destructive"
        aria-hidden
      />
    );
  }
  if (st === "COMPILATION_ERROR") {
    return (
      <Code2
        size={14}
        strokeWidth={2}
        className="size-3.5 text-destructive"
        aria-hidden
      />
    );
  }
  if (st === "RUNTIME_ERROR" || st === "SYSTEM_ERROR" || st === "FAILED") {
    return (
      <AlertTriangle
        size={14}
        strokeWidth={2}
        className="size-3.5 text-destructive"
        aria-hidden
      />
    );
  }
  if (st.includes("EXCEEDED") || st === "PENDING" || st === "RUNNING") {
    return (
      <Gauge
        size={14}
        strokeWidth={2}
        className="size-3.5 text-chart-3"
        aria-hidden
      />
    );
  }
  return (
    <FileCode2
      size={14}
      strokeWidth={2}
      className="size-3.5 text-chart-1"
      aria-hidden
    />
  );
}

function auditActivityIcon(action: string): ReactNode {
  const key = action.toLowerCase();
  const cls = "size-3.5 text-chart-2";
  if (key.includes("delete") || key.includes("remove")) {
    return (
      <Trash2 size={14} strokeWidth={2} className="size-3.5 text-destructive" aria-hidden />
    );
  }
  if (key === "contest.start" || key.endsWith(".start")) {
    return <Play size={14} strokeWidth={2} className={cls} aria-hidden />;
  }
  if (key === "contest.publish" || key.endsWith(".publish")) {
    return <Send size={14} strokeWidth={2} className={cls} aria-hidden />;
  }
  if (key.includes("problem.add") || key.endsWith(".add")) {
    return <Plus size={14} strokeWidth={2} className={cls} aria-hidden />;
  }
  if (key === "contest.create" || key.endsWith(".create")) {
    return <Trophy size={14} strokeWidth={2} className={cls} aria-hidden />;
  }
  if (key.includes("update") || key.includes("edit")) {
    return <Pencil size={14} strokeWidth={2} className={cls} aria-hidden />;
  }
  return <ShieldAlert size={14} strokeWidth={2} className={cls} aria-hidden />;
}

function initialsFrom(name?: string | null, email?: string | null): string {
  const base = String(name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] || ""}${parts[1]![0] || ""}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || "?";
}

function problemDisplayTitle(
  title: unknown,
  id: string,
): { primary: string; secondary?: string } {
  const t = typeof title === "string" ? title.trim() : "";
  if (t) return { primary: t, secondary: id || undefined };
  if (id) return { primary: `Problem ${id.slice(0, 10)}`, secondary: id };
  return { primary: "Untitled problem" };
}

function formatTrend(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return null;
  const n = Number(pct);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}% vs prior period`;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

interface AdminDashboardHomeProps {
  onNavigate?: (tab: AdminTab, id?: string) => void;
}

export const AdminDashboardHome: FC<AdminDashboardHomeProps> = ({
  onNavigate,
}) => {
  const { can } = usePermission();
  const toast = useToast();
  const [range, setRange] = useState<DashboardRange>("30d");
  const [overview, setOverview] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [coreError, setCoreError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "ok">(
    "idle"
  );
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [liveActivityPage, setLiveActivityPage] = useState(1);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subsMeta, setSubsMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [subsPage, setSubsPage] = useState(1);
  const [subsStatus, setSubsStatus] = useState("");
  const [subsSearch, setSubsSearch] = useState("");
  const [subsSearchQ, setSubsSearchQ] = useState("");
  const [subsError, setSubsError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [subsLoading, setSubsLoading] = useState(true);

  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [userSearchQ, setUserSearchQ] = useState("");

  const [problemMap, setProblemMap] = useState<Record<string, any>>({});
  const problemMapRef = useRef(problemMap);
  problemMapRef.current = problemMap;
  const [topSort, setTopSort] = useState<TopSort>("attempts");

  /** Fetch titles only for IDs not already in the map (single batch request). */
  const enrichProblemTitles = useCallback(async (ids: string[]) => {
    const missing = [
      ...new Set(ids.map(String).filter(Boolean)),
    ].filter((id) => !problemMapRef.current[id]?.title);
    if (!missing.length) return;
    try {
      const titles = await adminProblemApi.lookupTitles(missing);
      const map: Record<string, any> = {};
      for (const p of titles.data || []) {
        map[String(p.id)] = p;
      }
      if (Object.keys(map).length) {
        setProblemMap((prev) => ({ ...prev, ...map }));
      }
    } catch {
      // Display-only enrichment; metrics remain from analytics/submissions APIs
    }
  }, []);

  const [execHealth, setExecHealth] = useState<any>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbPeriod, setLbPeriod] = useState<"global" | "weekly" | "monthly">(
    "global"
  );
  const [lbError, setLbError] = useState<string | null>(null);
  const [lbLoading, setLbLoading] = useState(true);

  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [health, setHealth] = useState<
    Array<{
      name: string;
      status: "healthy" | "offline" | "warning";
      url: string;
      ms: number | null;
      error?: string;
      checkedAt: string;
    }>
  >([]);
  const [rt, setRt] = useState<{ ok: boolean; data?: any; error?: string }>({
    ok: false,
  });
  const [favouriteAnalytics, setFavouriteAnalytics] = useState<{
    mostFavourited: Array<{
      id: string;
      title: string;
      difficulty?: string;
      favouriteCount: number;
      isPremium?: boolean;
    }>;
    trends: Array<{ date: string; count: number }>;
    freeFavourites: number;
    premiumFavourites: number;
  } | null>(null);

  const applySubsSearch = useMemo(
    () => debounce((v: string) => setSubsSearchQ(v), 350),
    []
  );
  const applyUserSearch = useMemo(
    () => debounce((v: string) => setUserSearchQ(v), 350),
    []
  );

  const loadCore = useCallback(async () => {
    setLoading(true);
    setCoreError(null);
    setRefreshState("loading");
    try {
      const result = await adminAnalyticsApi.loadDashboard(range);
      setOverview(result.overview);
      setCharts(result.charts);
      setFallbackMode(Boolean(result.fallback));
      setUpdatedAt(new Date());
      setRefreshState("ok");
      window.setTimeout(() => setRefreshState("idle"), 900);

      if ((result as any).softWarning) {
        toast.warning("Partial analytics", (result as any).softWarning);
      }

      // Enrich only the problem IDs present in dashboard chart data (not first-N catalog page)
      const topIds = (result.charts?.topProblems || [])
        .map((r: any) => String(r.problemId || r._id || "").trim())
        .filter(Boolean);
      await enrichProblemTitles(topIds);

      try {
        const fav = await adminProblemApi.favouriteAnalytics();
        if (fav?.data) {
          setFavouriteAnalytics({
            mostFavourited: fav.data.mostFavourited || [],
            trends: fav.data.trends || [],
            freeFavourites: fav.data.freeFavourites || 0,
            premiumFavourites: fav.data.premiumFavourites || 0,
          });
        }
      } catch {
        setFavouriteAnalytics(null);
      }
    } catch (err: unknown) {
      const n = normalizeApiError(err);
      setCoreError({ title: n.title, message: n.message });
      toast.apiError(err, "Unable to load platform analytics");
      setRefreshState("idle");
    } finally {
      setLoading(false);
    }
  }, [range, toast, enrichProblemTitles]);

  const loadSubmissions = useCallback(async () => {
    setSubsLoading(true);
    setSubsError(null);
    try {
      const params: Record<string, string | number | undefined> = {
        page: subsPage,
        limit: 10,
      };
      if (subsStatus) params.status = subsStatus;
      if (subsSearchQ.trim()) params.search = subsSearchQ.trim();
      const res = await adminSubmissionApi.list(params);
      setSubmissions(res.data || []);
      setSubsMeta({
        page: res.meta?.page || subsPage,
        limit: res.meta?.limit || 10,
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });

      const subIds = (res.data || [])
        .map((s: any) => String(s.problemId || "").trim())
        .filter(Boolean);
      await enrichProblemTitles(subIds);
    } catch (err: unknown) {
      const n = normalizeApiError(err);
      setSubsError({ title: n.title, message: n.message });
      setSubmissions([]);
    } finally {
      setSubsLoading(false);
    }
  }, [subsPage, subsStatus, subsSearchQ, enrichProblemTitles]);

  const loadSide = useCallback(async () => {
    const [healthRows, rtRes, audit, exec, usersRes] = await Promise.all([
      Promise.all(
        HEALTH_ENDPOINTS.map(async (e) => {
          const detail = await pingHealthDetailed(e.url);
          return {
            name: e.name,
            url: e.url,
            status: detail.status,
            ms: detail.ms,
            error: detail.error,
            checkedAt: new Date().toISOString(),
          };
        })
      ),
      adminRealtimeApi.overview().then(
        (res) => ({ ok: true as const, data: res.data || res }),
        (err: unknown) => ({
          ok: false as const,
          error: normalizeApiError(err).message,
        })
      ),
      can("audit:view")
        ? adminAuthApi.listAuditLogs({ page: 1, limit: 12 }).catch(() => ({
          data: [] as any[],
        }))
        : Promise.resolve({ data: [] as any[] }),
      adminAnalyticsApi.executionHealth().then(
        (res) => ({ ok: true as const, data: res.data }),
        (err: unknown) => ({
          ok: false as const,
          error: normalizeApiError(err).message,
        })
      ),
      can("users:view")
        ? adminAuthApi
          .listUsers({
            page: 1,
            limit: 8,
            search: userSearchQ || undefined,
          })
          .then(
            (res) => ({ ok: true as const, data: res.data || [] }),
            (err: unknown) => ({
              ok: false as const,
              error: normalizeApiError(err).message,
            })
          )
        : Promise.resolve({ ok: true as const, data: [] as AdminUser[] }),
    ]);

    setHealth(healthRows);
    setRt(rtRes);
    setAuditRows(audit.data || []);

    if (exec.ok) {
      setExecHealth(exec.data);
      setExecError(null);
    } else {
      setExecHealth(null);
      setExecError(exec.error || "Evaluation health unavailable");
    }

    setUsersLoading(false);
    if (usersRes.ok) {
      setRecentUsers(usersRes.data);
      setUsersError(null);
    } else {
      setRecentUsers([]);
      setUsersError(usersRes.error || "Unable to load users");
    }
  }, [can, userSearchQ]);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    setLbError(null);
    try {
      const res = await adminAnalyticsApi.topUsers(lbPeriod);
      setLeaderboard(Array.isArray(res.data) ? res.data.slice(0, 10) : []);
    } catch (err: unknown) {
      setLeaderboard([]);
      setLbError(normalizeApiError(err).message);
    } finally {
      setLbLoading(false);
    }
  }, [lbPeriod]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions, tick]);

  useEffect(() => {
    void loadSide();
  }, [loadSide, tick]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 45000);
    return () => window.clearInterval(id);
  }, []);

  const refreshAll = async () => {
    await Promise.all([
      loadCore(),
      loadSubmissions(),
      loadSide(),
      loadLeaderboard(),
    ]);
  };

  const kpis = overview?.kpis || {};
  const usersBlock = overview?.users || {};
  const problemsBlock = overview?.problems || {};
  const submissionsBlock = overview?.submissions || {};
  const byStatus: Record<string, number> =
    charts?.submissionsByStatus || submissionsBlock.byStatus || {};
  const byLang: Record<string, number> =
    charts?.languageUsage || submissionsBlock.byLanguage || {};
  const byDiff: Record<string, number> =
    charts?.difficultyDistribution || problemsBlock.byDifficulty || {};
  const byTopic: Record<string, number> =
    charts?.topicDistribution || problemsBlock.byTopic || {};

  const statusData = useMemo(
    () =>
      Object.entries(byStatus)
        .map(([name, value]) => ({ name, value: Number(value) }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [byStatus]
  );

  const langData = useMemo(
    () =>
      Object.entries(byLang)
        .map(([name, value]) => ({
          name: languageLabel(name),
          value: Number(value),
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [byLang]
  );

  const diffData = useMemo(
    () =>
      ["easy", "medium", "hard"]
        .map((name) => ({
          name,
          value: Number(byDiff[name] || 0),
        }))
        .filter((d) => d.value > 0),
    [byDiff]
  );

  const topicData = useMemo(
    () =>
      Object.entries(byTopic)
        .map(([name, value]) => ({ name, value: Number(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [byTopic]
  );

  const activitySeries = useMemo(() => {
    const series = charts?.submissionSeries || [];
    if (!Array.isArray(series) || series.length === 0) return [];
    const byDate = new Map<
      string,
      {
        date: string;
        submissions: number;
        accepted: number;
        failed: number;
      }
    >();
    for (const row of series) {
      const date = row.date || row._id?.date;
      if (!date) continue;
      const cur = byDate.get(date) || {
        date,
        submissions: 0,
        accepted: 0,
        failed: 0,
      };
      const count = Number(row.count || 0);
      cur.submissions += count;
      if (row.status === "ACCEPTED") cur.accepted += count;
      if (
        [
          "WRONG_ANSWER",
          "RUNTIME_ERROR",
          "COMPILATION_ERROR",
          "TIME_LIMIT_EXCEEDED",
          "MEMORY_LIMIT_EXCEEDED",
        ].includes(row.status)
      ) {
        cur.failed += count;
      }
      byDate.set(date, cur);
    }

    // Overlay active-user growth when available (registration proxy only if no activity series)
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [charts]);

  const userGrowth = useMemo(() => {
    const rows = charts?.userGrowth || usersBlock.growth || [];
    return Array.isArray(rows) ? rows : [];
  }, [charts, usersBlock]);

  const sortedTopProblems = useMemo(() => {
    const rows = (charts?.topProblems || []).map((r: any) => {
      const id = String(r.problemId || r._id || "");
      const p = problemMap[id];
      return {
        ...r,
        title:
          r.title ||
          r.problemTitle ||
          p?.title ||
          (id ? `Problem ${id.slice(0, 10)}` : "Untitled problem"),
        difficulty: r.difficulty || p?.difficulty,
        attempts: Number(r.attempts ?? r.count ?? 0),
        accepted: Number(r.accepted ?? 0),
        acceptanceRate: Number(
          r.acceptanceRate ??
          (r.attempts
            ? Math.round((Number(r.accepted || 0) / Number(r.attempts)) * 1000) /
            10
            : 0)
        ),
      };
    });
    const sorted = [...rows];
    switch (topSort) {
      case "solved":
        sorted.sort((a, b) => b.accepted - a.accepted);
        break;
      case "accept_high":
        sorted.sort((a, b) => b.acceptanceRate - a.acceptanceRate);
        break;
      case "accept_low":
        sorted.sort((a, b) => a.acceptanceRate - b.acceptanceRate);
        break;
      default:
        sorted.sort((a, b) => b.attempts - a.attempts);
    }
    return sorted.slice(0, 8);
  }, [charts, problemMap, topSort]);

  const pending = Number(byStatus.PENDING || 0);
  const running = Number(byStatus.RUNNING || 0);
  const accepted = Number(
    submissionsBlock.accepted ?? byStatus.ACCEPTED ?? kpis.acceptedSubmissions ?? 0
  );
  const failedExec =
    Number(byStatus.RUNTIME_ERROR || 0) +
    Number(byStatus.COMPILATION_ERROR || 0) +
    Number(byStatus.TIME_LIMIT_EXCEEDED || 0) +
    Number(byStatus.MEMORY_LIMIT_EXCEEDED || 0) +
    Number(byStatus.WRONG_ANSWER || 0);

  const avgRuntime =
    charts?.avgExecutionTime ?? submissionsBlock.avgExecutionTime ?? null;
  const avgMemory =
    charts?.avgMemory ?? submissionsBlock.avgMemory ?? null;

  const queue = execHealth?.queue || {};
  const queueStatus = String(
    queue.status || (execError ? "unavailable" : "unknown"),
  );

  const offlineServices = health.filter((h) => h.status === "offline");
  const warningServices = health.filter((h) => h.status === "warning");
  const healthyCount = health.filter((h) => h.status === "healthy").length;
  const systemHealthLabel =
    health.length === 0
      ? "unknown"
      : offlineServices.length > 0
        ? "Degraded"
        : warningServices.length > 0
          ? "Degraded"
          : "Healthy";

  const alerts = useMemo(() => {
    const items: Array<{
      severity: "INFO" | "WARNING" | "CRITICAL";
      title: string;
      description: string;
      at: string;
    }> = [];
    for (const s of offlineServices) {
      items.push({
        severity: "CRITICAL",
        title: `${s.name} offline`,
        description: s.error || `Health check failed for ${s.url}`,
        at: s.checkedAt,
      });
    }
    if (fallbackMode) {
      items.push({
        severity: "WARNING",
        title: "AnalyticsService unavailable",
        description:
          "Dashboard is using direct Auth/Problem/Submission stats fallback.",
        at: new Date().toISOString(),
      });
    }
    if (pending > 50) {
      items.push({
        severity: "WARNING",
        title: "Large pending submission queue",
        description: `${pending} submissions currently PENDING`,
        at: new Date().toISOString(),
      });
    }
    if (!rt.ok) {
      items.push({
        severity: "INFO",
        title: "Realtime gateway unreachable",
        description: rt.error || "RealtimeService did not respond",
        at: new Date().toISOString(),
      });
    }
    return items.slice(0, 8);
  }, [offlineServices, fallbackMode, pending, rt]);

  const liveActivity = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      entity: string;
      when: string;
      status?: string | null;
      icon: ReactNode;
      dedupeKey: string;
    }> = [];
    const seen = new Set<string>();

    const pushUnique = (item: (typeof items)[number]) => {
      if (seen.has(item.dedupeKey)) return;
      seen.add(item.dedupeKey);
      items.push(item);
    };

    for (const s of submissions.slice(0, 8)) {
      const id = String(s.id || s._id);
      const pid = String(s.problemId || "");
      const pTitle =
        problemMap[pid]?.title || `Problem ${pid.slice(0, 8) || "—"}`;
      const st = String(s.status || "").toUpperCase();
      const when = String(s.createdAt || s.updatedAt || "");
      pushUnique({
        id: `sub-${id}`,
        dedupeKey: `sub-${id}-${st}-${when}`,
        title: "Submission",
        entity: `${pTitle} · ${languageLabel(s.language)}`,
        when,
        status: st || null,
        icon: submissionActivityIcon(st),
      });
    }

    for (const a of auditRows.slice(0, 4)) {
      const action = String(a.action || "Admin action");
      const when = String(a.createdAt || "");
      const resourceId = a.resourceId ? String(a.resourceId) : "";
      pushUnique({
        id: `audit-${a.id || action}-${when}`,
        dedupeKey: `audit-${action}-${a.resource || ""}-${resourceId}-${when}`,
        title: humanizeActivityAction(action),
        entity: formatActivityEntity(a.resource, resourceId),
        when,
        icon: auditActivityIcon(action),
      });
    }

    return items
      .sort(
        (a, b) =>
          new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime(),
      )
      .slice(0, 12);
  }, [submissions, auditRows, problemMap]);

  const liveActivityTotalPages = Math.max(
    1,
    Math.ceil(liveActivity.length / LIVE_ACTIVITY_PAGE_SIZE),
  );

  // Keep current page when data refreshes; only clamp if it becomes out of range.
  useEffect(() => {
    setLiveActivityPage((p) =>
      Math.min(Math.max(1, p), liveActivityTotalPages),
    );
  }, [liveActivityTotalPages]);

  const pagedLiveActivity = useMemo(() => {
    const start = (liveActivityPage - 1) * LIVE_ACTIVITY_PAGE_SIZE;
    return liveActivity.slice(start, start + LIVE_ACTIVITY_PAGE_SIZE);
  }, [liveActivity, liveActivityPage]);

  const newUsersTrend = formatTrend(kpis.newUsersTrendPct);

  return (
    <PermissionGuard
      permission="analytics:view"
      fallback={<div className="admin-denied">No analytics permission.</div>}
    >
      <div className="admin-dash">
        <header className="admin-dash-header">
          <div>
            <h2>Analytics</h2>
            <p className="admin-dash-kicker">Platform performance &amp; activity</p>
            <p className="admin-dash-sub">
              Monitor users, problems, submissions, execution health, and
              real-time platform activity from one place.
            </p>
          </div>
          <div className="admin-dash-actions">
            <div className="admin-seg" role="group" aria-label="Date range">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={range === r.id ? "active" : ""}
                  onClick={() => setRange(r.id)}
                  aria-pressed={range === r.id}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void refreshAll()}
              aria-label="Refresh dashboard"
              disabled={refreshState === "loading"}
            >
              {refreshState === "loading" ? (
                <Loader2
                  size={14}
                  strokeWidth={2}
                  className="size-3.5 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <RefreshCw
                  size={14}
                  strokeWidth={2}
                  className="size-3.5 shrink-0"
                  aria-hidden
                />
              )}
              {refreshState === "loading"
                ? "Refreshing…"
                : refreshState === "ok"
                  ? "Updated"
                  : "Refresh"}
            </Button>
            <span className="admin-dash-updated">
              Last updated:{" "}
              {updatedAt ? relativeTime(updatedAt.toISOString()) : "—"}
            </span>
          </div>
        </header>

        {(fallbackMode || overview?.degraded) && !coreError ? (
          <div className="admin-alert admin-alert-warn" role="status">
            <div className="admin-alert-icon" aria-hidden>
              <AlertTriangle size={18} strokeWidth={2} className="size-[18px]" />
            </div>
            <div className="admin-alert-body">
              <strong>
                {fallbackMode
                  ? "Analytics service unavailable"
                  : "Partial analytics data"}
              </strong>
              <p>
                {fallbackMode
                  ? "Dashboard is running in degraded mode. KPIs and charts are being loaded from fallback Auth, Problem, and Submission services."
                  : "Some metrics may be incomplete or unavailable."}
                {Array.isArray(overview?.unavailableSources) &&
                overview.unavailableSources.length > 0
                  ? ` Missing: ${overview.unavailableSources.join(", ")}.`
                  : null}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="admin-alert-action"
              onClick={() => void loadCore()}
            >
              <RefreshCw
                size={14}
                strokeWidth={2}
                className="size-3.5 shrink-0"
                aria-hidden
              />
              Retry Analytics
            </Button>
          </div>
        ) : null}

        {coreError ? (
          <div className="admin-alert admin-alert-error" role="alert">
            <div className="admin-alert-icon" aria-hidden>
              <AlertTriangle size={18} strokeWidth={2} className="size-[18px]" />
            </div>
            <div className="admin-alert-body">
              <strong>{coreError.title || "Unable to load analytics"}</strong>
              <p>{coreError.message}</p>
              <p className="admin-alert-hint">
                System health, recent submissions, and live panels below still use
                independent checks.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="admin-alert-action"
              onClick={() => void loadCore()}
            >
              <RefreshCw
                size={14}
                strokeWidth={2}
                className="size-3.5 shrink-0"
                aria-hidden
              />
              Retry
            </Button>
          </div>
        ) : null}

        {/* KPI cards */}
        <section className="admin-kpi-grid" aria-label="Key metrics">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="admin-kpi" aria-hidden>
                <div className="admin-skel" style={{ height: 14, width: "40%" }} />
                <div className="admin-skel" style={{ height: 28, width: "55%" }} />
                <div className="admin-skel" style={{ height: 10, width: "70%" }} />
              </div>
            ))
            : (
              <>
                <Kpi
                  icon={<Users size={15} strokeWidth={2} className="size-[15px]" aria-hidden />}
                  label="Total Users"
                  value={formatNumber(kpis.totalUsers)}
                  meta={
                    newUsersTrend ||
                    `New: ${formatNumber(usersBlock.newUsersInRange)}`
                  }
                />
                <Kpi
                  icon={<UserCheck size={15} strokeWidth={2} className="size-[15px]" aria-hidden />}
                  label="Active Users"
                  value={formatNumber(kpis.dau ?? kpis.activeUsers)}
                  meta={`DAU: ${formatNumber(kpis.dau ?? kpis.activeUsers)} · WAU ${formatNumber(kpis.wau)} · MAU ${formatNumber(kpis.mau)}`}
                />
                <Kpi
                  icon={<Code2 size={15} strokeWidth={2} className="size-[15px]" aria-hidden />}
                  label="Total Problems"
                  value={formatNumber(
                    kpis.totalProblems ??
                    Number(kpis.publishedProblems || 0) +
                    Number(kpis.draftProblems || 0)
                  )}
                  meta={`Published ${formatNumber(kpis.publishedProblems)} · Drafts ${formatNumber(kpis.draftProblems)}`}
                />
                <Kpi
                  icon={<Send size={15} strokeWidth={2} className="size-[15px]" aria-hidden />}
                  label="Total Submissions"
                  value={formatNumber(kpis.totalSubmissions)}
                  meta={`Today ${formatNumber(kpis.todaySubmissions)}`}
                />
                <Kpi
                  icon={<Target size={15} strokeWidth={2} className="size-[15px]" aria-hidden />}
                  label="Acceptance Rate"
                  value={`${kpis.successRate ?? 0}%`}
                  meta="Accepted / total submissions"
                />
                <Kpi
                  icon={<Trophy size={15} strokeWidth={2} className="size-[15px]" aria-hidden />}
                  label="Solved Problems"
                  value={formatNumber(kpis.solvedProblems ?? accepted)}
                  meta="Distinct problems with ≥1 accepted submit"
                />
              </>
            )}
        </section>

        {/* Primary monitoring */}
        <div className="admin-dash-row admin-dash-row-monitor">
          <section className="admin-panel" aria-label="Code execution health">
            <div className="admin-panel-head">
              <div>
                <h3>Code Execution</h3>
                <p className="admin-panel-desc">Evaluation Service</p>
              </div>
              <StatusBadge
                status={
                  queueStatus === "healthy"
                    ? "healthy"
                    : queueStatus === "degraded"
                      ? "degraded"
                      : queueStatus === "timeout"
                        ? "timeout"
                        : execError
                          ? "offline"
                          : "unknown"
                }
              />
            </div>
            <div className="admin-panel-body">
              {execError && !execHealth ? (
                <WidgetError
                  title="Evaluation service is currently unavailable"
                  message={execError}
                  onRetry={() => void loadSide()}
                  compact
                />
              ) : (
                <div className="admin-engage-grid">
                  <MetricCell label="Queued" value={formatNumber(queue.waiting ?? pending)} />
                  <MetricCell label="Active jobs" value={formatNumber(queue.active ?? running)} />
                  <MetricCell label="Failed jobs" value={formatNumber(queue.failed ?? failedExec)} />
                  <MetricCell
                    label="Workers"
                    value={formatNumber(queue.configuredWorkers)}
                  />
                  <MetricCell
                    label="Avg runtime"
                    value={avgRuntime != null ? `${avgRuntime} ms` : "N/A"}
                  />
                  <MetricCell
                    label="Avg memory"
                    value={avgMemory != null ? `${avgMemory} MB` : "N/A"}
                  />
                  <MetricCell label="Redis" value={String(execHealth?.redis ?? "N/A")} />
                  <MetricCell label="Compile fails" value={formatNumber(byStatus.COMPILATION_ERROR)} />
                </div>
              )}
              <p className="admin-panel-foot">
                Queue metrics from EvaluationService BullMQ health. Verdict averages
                from Submission records.
              </p>
            </div>
          </section>

          <section className="admin-panel" aria-label="Live activity">
            <div className="admin-panel-head">
              <h3>Live Activity</h3>
              <span className="hint">Auto-refresh 45s</span>
            </div>
            <div className="admin-panel-body admin-panel-scroll">
              {liveActivity.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Activity size={18} strokeWidth={1.75} aria-hidden />}
                  title="No recent activity"
                  description="There are no live platform events available right now."
                />
              ) : (
                <>
                  <ul className="admin-activity-timeline">
                    {pagedLiveActivity.map((item) => (
                      <li key={item.id} className="admin-activity-tl-item">
                        <span className="admin-activity-tl-dot" aria-hidden>
                          {item.icon}
                        </span>
                        <div className="admin-activity-tl-body">
                          <div className="admin-activity-tl-top">
                            <span className="title">{item.title}</span>
                            {item.status ? (
                              <SubmissionVerdictBadge
                                status={item.status}
                                className="admin-activity-verdict"
                              />
                            ) : null}
                          </div>
                          <div className="entity" title={item.entity}>
                            {item.entity}
                          </div>
                          <time className="when" dateTime={item.when}>
                            {relativeTime(item.when)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {liveActivityTotalPages > 1 ? (
                    <nav
                      className="admin-activity-pager"
                      aria-label="Live activity pages"
                    >
                      <button
                        type="button"
                        className="admin-activity-pager-btn"
                        disabled={liveActivityPage <= 1}
                        onClick={() =>
                          setLiveActivityPage((p) => Math.max(1, p - 1))
                        }
                      >
                        Previous
                      </button>
                      <div className="admin-activity-pager-pages" role="list">
                        {Array.from(
                          { length: liveActivityTotalPages },
                          (_, i) => i + 1,
                        ).map((page) => (
                          <button
                            key={page}
                            type="button"
                            role="listitem"
                            className={
                              page === liveActivityPage
                                ? "admin-activity-pager-page active"
                                : "admin-activity-pager-page"
                            }
                            aria-current={
                              page === liveActivityPage ? "page" : undefined
                            }
                            onClick={() => setLiveActivityPage(page)}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="admin-activity-pager-btn"
                        disabled={liveActivityPage >= liveActivityTotalPages}
                        onClick={() =>
                          setLiveActivityPage((p) =>
                            Math.min(liveActivityTotalPages, p + 1),
                          )
                        }
                      >
                        Next
                      </button>
                    </nav>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>

        {/* Infrastructure */}
        <div className="admin-dash-row admin-dash-row-infra">
          <section className="admin-panel" aria-label="System health">
            <div className="admin-panel-head">
              <div>
                <h3>System Health</h3>
                <p className="admin-panel-desc">
                  {healthyCount}/{health.length || 0} services healthy
                </p>
              </div>
              <StatusBadge status={systemHealthLabel || "unknown"} />
            </div>
            <div className="admin-panel-body">
              <div className="admin-svc-list">
                {health.map((h) => (
                  <div key={h.name} className="admin-svc-row">
                    <div className="admin-svc-left">
                      <span className={`admin-status-dot ${h.status}`} aria-hidden />
                      <span>{h.name}</span>
                    </div>
                    <div className="admin-svc-right">
                      <StatusBadge status={String(h.status || "unknown")} showIcon={false} />
                      <span className="admin-svc-latency">
                        {h.ms != null ? `${h.ms}ms` : h.error || "N/A"}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="admin-svc-row">
                  <div className="admin-svc-left">
                    <span
                      className={`admin-status-dot ${rt.ok ? "healthy" : "offline"}`}
                      aria-hidden
                    />
                    <span>Realtime</span>
                  </div>
                  <div className="admin-svc-right">
                    <StatusBadge status={rt.ok ? "healthy" : "timeout"} showIcon={false} />
                    <span className="admin-svc-latency">
                      {rt.ok ? "OK" : rt.error || "Timeout"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="admin-panel" aria-label="Realtime ops">
            <div className="admin-panel-head">
              <div>
                <h3>Realtime</h3>
                <p className="admin-panel-desc">Live gateway metrics</p>
              </div>
              {rt.ok ? (
                <StatusBadge status="live" />
              ) : (
                <StatusBadge status="offline" />
              )}
            </div>
            <div className="admin-panel-body">
              {!rt.ok ? (
                <EmptyState
                  compact
                  icon={<Radio size={18} strokeWidth={1.75} aria-hidden />}
                  title={rt.error ? "Realtime unavailable" : "Offline"}
                  description={rt.error || "Connect the realtime gateway to see live metrics."}
                />
              ) : (
                <>
                  <div className="admin-engage-grid admin-engage-grid-3">
                    <MetricCell
                      label="Connections"
                      value={formatNumber(
                        rt.data?.activeConnections ?? rt.data?.connections
                      )}
                    />
                    <MetricCell
                      label="Online users"
                      value={formatNumber(rt.data?.onlineUsers)}
                    />
                    <MetricCell
                      label="Events/sec"
                      value={adminRealtimeApi.metricOrUnavailable(
                        rt.data?.eventsPerSecond
                      )}
                    />
                  </div>
                  <div className="admin-metric-cell admin-metric-cell-wide">
                    <span className="admin-metric-label">Latency</span>
                    <span
                      className={`admin-metric-value${
                        rt.data?.avgLatencyMs == null ? " unavailable" : ""
                      }`}
                    >
                      {rt.data?.avgLatencyMs == null
                        ? "Unavailable"
                        : adminRealtimeApi.metricOrUnavailable(rt.data?.avgLatencyMs)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <div className="admin-dash-grid">
          {/* Platform activity */}
          <section className="admin-panel span-8" aria-label="Platform activity">
            <div className="admin-panel-head">
              <div>
                <h3>Platform Activity</h3>
                <p className="admin-panel-desc">Submission activity over time</p>
              </div>
              <span className="hint">{range.toUpperCase()}</span>
            </div>
            {loading ? (
              <div className="admin-skel admin-skel-chart" aria-hidden />
            ) : activitySeries.length === 0 ? (
              <EmptyState
                compact
                icon={<Activity size={18} strokeWidth={1.75} aria-hidden />}
                title="No submission activity"
                description="There is no submission activity for the selected time range."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={activitySeries}>
                  <defs>
                    <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: CHART.tick, fontSize: 11 }}
                    minTickGap={28}
                  />
                  <YAxis tick={{ fill: CHART.tick, fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Legend content={<ChartLegendContent />} />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    name="Submissions"
                    stroke={CHART[1]}
                    fill="url(#gSub)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="accepted"
                    name="Accepted"
                    stroke={CHART[4]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    name="Failed"
                    stroke="var(--destructive)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="admin-panel span-4" aria-label="Verdict distribution">
            <div className="admin-panel-head">
              <div>
                <h3>Verdict Distribution</h3>
                <p className="admin-panel-desc">Outcomes across submissions</p>
              </div>
            </div>
            {loading ? (
              <div className="admin-skel admin-skel-chart" style={{ height: 220 }} aria-hidden />
            ) : statusData.length === 0 ? (
              <EmptyState
                compact
                icon={<BarChart3 size={18} strokeWidth={1.75} aria-hidden />}
                title="No verdict data"
                description="Submission outcomes will appear once users submit solutions."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {statusData.map((d) => (
                      <Cell
                        key={d.name}
                        fill={STATUS_COLORS[d.name] || CHART.tick}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    formatter={(value, name) => [
                      formatNumber(value),
                      humanizeStatus(String(name)),
                    ]}
                  />
                  <Legend content={<ChartLegendContent />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="admin-panel span-6" aria-label="User analytics">
            <div className="admin-panel-head">
              <h3>User Analytics</h3>
              <button
                type="button"
                className="admin-link admin-link-action"
                onClick={() => onNavigate?.("users")}
              >
                Manage users
                <ArrowUpRight size={14} strokeWidth={2} className="size-3.5" aria-hidden />
              </button>
            </div>
            <div className="admin-engage-grid">
              <MetricCell label="Total" value={formatNumber(usersBlock.totalUsers ?? kpis.totalUsers)} />
              <MetricCell label="New" value={formatNumber(usersBlock.newUsersInRange)} />
              <MetricCell label="Active" value={formatNumber(usersBlock.activeUsers)} />
              <MetricCell label="Inactive" value={formatNumber(usersBlock.inactiveUsers)} />
              <MetricCell label="Verified" value={formatNumber(usersBlock.verifiedUsers)} />
              <MetricCell label="Unverified" value={formatNumber(usersBlock.unverifiedUsers)} />
              <MetricCell label="Admins" value={formatNumber(usersBlock.adminUsers)} />
              <MetricCell label="Blocked" value={formatNumber(usersBlock.blockedUsers)} />
            </div>
          </section>

          <section className="admin-panel span-6" aria-label="Registration trend">
            <div className="admin-panel-head">
              <div>
                <h3>Registration Trend</h3>
                <p className="admin-panel-desc">
                  New user registrations over the selected range.
                </p>
              </div>
            </div>
            {loading ? (
              <div className="admin-skel admin-skel-chart" style={{ height: 160 }} aria-hidden />
            ) : userGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={userGrowth}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: CHART.tick, fontSize: 10 }}
                    minTickGap={24}
                  />
                  <YAxis width={28} tick={{ fill: CHART.tick, fontSize: 10 }} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Registrations"
                    stroke={CHART[3]}
                    fill="rgba(56,189,248,0.15)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                compact
                icon={<Users size={18} strokeWidth={1.75} aria-hidden />}
                title="No registration data"
                description="No registration activity was recorded for this selected range."
              />
            )}
          </section>

          {/* Problem analytics */}
          <section className="admin-panel span-6" aria-label="Problem analytics">
            <div className="admin-panel-head">
              <h3>Problem Analytics</h3>
              <button
                type="button"
                className="admin-link admin-link-action"
                onClick={() => onNavigate?.("problems")}
              >
                All problems
                <ArrowUpRight size={14} strokeWidth={2} className="size-3.5" aria-hidden />
              </button>
            </div>
            <div className="admin-engage-grid">
              <MetricCell label="Total" value={formatNumber(problemsBlock.total ?? kpis.totalProblems)} />
              <MetricCell label="Easy" value={formatNumber(byDiff.easy)} />
              <MetricCell label="Medium" value={formatNumber(byDiff.medium)} />
              <MetricCell label="Hard" value={formatNumber(byDiff.hard)} />
              <MetricCell label="Published" value={formatNumber(problemsBlock.published ?? kpis.publishedProblems)} />
              <MetricCell label="Draft" value={formatNumber(problemsBlock.draft ?? kpis.draftProblems)} />
            </div>
            <div className="admin-dual-charts">
              {diffData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={diffData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={46}
                    >
                      {diffData.map((d) => (
                        <Cell
                          key={d.name}
                          fill={
                            DIFF_COLORS[d.name as keyof typeof DIFF_COLORS] ||
                            CHART.tick
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Legend content={<ChartLegendContent />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  compact
                  icon={<Gauge size={18} strokeWidth={1.75} aria-hidden />}
                  title="No difficulty data"
                  description="Publish problems to see easy / medium / hard distribution."
                />
              )}
              {topicData.length > 0 ? (
                <div className="admin-category-list" aria-label="Problem categories">
                  <div className="admin-category-head">Problem Categories</div>
                  {topicData.slice(0, 6).map((t) => {
                    const max = Math.max(...topicData.map((x) => Number(x.value) || 0), 1);
                    const pct = Math.round((Number(t.value) / max) * 100);
                    return (
                      <div key={t.name} className="admin-category-row">
                        <span className="admin-category-name" title={String(t.name)}>
                          {t.name}
                        </span>
                        <span className="admin-category-bar" aria-hidden>
                          <i style={{ width: `${pct}%` }} />
                        </span>
                        <span className="admin-category-val">{formatNumber(t.value)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<Tags size={18} strokeWidth={1.75} aria-hidden />}
                  title="No topic tags yet"
                  description="Add tags on problems to unlock topic insights."
                />
              )}
            </div>
          </section>

          {/* Submission analytics */}
          <section className="admin-panel span-6" aria-label="Submission analytics">
            <div className="admin-panel-head">
              <h3>Submission Analytics</h3>
              <div className="admin-stat-chips" aria-label="Submission summary">
                <span className="admin-stat-chip">
                  Acceptance {kpis.successRate ?? 0}%
                </span>
                <span className="admin-stat-chip">
                  Avg runtime {avgRuntime != null ? `${avgRuntime} ms` : "N/A"}
                </span>
                <span className="admin-stat-chip">
                  Avg memory {avgMemory != null ? `${avgMemory} MB` : "N/A"}
                </span>
              </div>
            </div>
            <div className="admin-engage-grid admin-engage-grid-dense">
              <MetricCell label="Total" value={formatNumber(kpis.totalSubmissions)} />
              <MetricCell label="Accepted" value={formatNumber(byStatus.ACCEPTED ?? accepted)} />
              <MetricCell label="Wrong Answer" value={formatNumber(byStatus.WRONG_ANSWER)} />
              <MetricCell label="Runtime Error" value={formatNumber(byStatus.RUNTIME_ERROR)} />
              <MetricCell label="Compile Error" value={formatNumber(byStatus.COMPILATION_ERROR)} />
              <MetricCell label="TLE" value={formatNumber(byStatus.TIME_LIMIT_EXCEEDED)} />
              <MetricCell label="MLE" value={formatNumber(byStatus.MEMORY_LIMIT_EXCEEDED)} />
              <MetricCell label="Pending" value={formatNumber(pending)} />
              <MetricCell label="Running" value={formatNumber(running)} />
              <MetricCell label="Failed" value={formatNumber(failedExec)} />
            </div>
            <div className="admin-panel-subhead">
              <h4>Language Distribution</h4>
            </div>
            {langData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={langData} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fill: CHART.tick, fontSize: 11 }}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Bar dataKey="value" name="Submissions" fill={CHART[3]} radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                compact
                icon={<Languages size={18} strokeWidth={1.75} aria-hidden />}
                title="No language distribution yet"
                description="Language share appears after submissions are recorded."
              />
            )}
          </section>

          {/* Top problems */}
          <section className="admin-panel span-7" aria-label="Top problems">
            <div className="admin-panel-head">
              <h3>Top Problems</h3>
              <select
                className="admin-select-sm"
                value={topSort}
                onChange={(e) => setTopSort(e.target.value as TopSort)}
                aria-label="Sort top problems"
              >
                {TOP_SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {sortedTopProblems.length === 0 ? (
              <EmptyState
                compact
                icon={<BookOpen size={18} strokeWidth={1.75} aria-hidden />}
                title="No ranked problems yet"
                description="Not enough submission volume to rank problems in this range."
              />
            ) : (
              <DataTable
                emptyTitle="No problems found"
                emptyDescription="Problems with enough attempts will appear here."
                emptyIcon={<BookOpen size={18} strokeWidth={1.75} aria-hidden />}
                columns={[
                  {
                    key: "rank",
                    header: "#",
                    render: (r) => (
                      <span
                        className={`admin-rank ${Number(r.__rank) <= 3 ? "top" : ""}`}
                      >
                        {r.__rank}
                      </span>
                    ),
                  },
                  {
                    key: "problem",
                    header: "Problem",
                    render: (r) => {
                      const id = String(r.problemId || "");
                      const { primary, secondary } = problemDisplayTitle(
                        r.title,
                        id,
                      );
                      return (
                        <button
                          type="button"
                          className="admin-link admin-problem-cell"
                          onClick={() =>
                            onNavigate?.(
                              "problem-editor",
                              id
                            )
                          }
                        >
                          <span className="admin-problem-title">{primary}</span>
                          {secondary ? (
                            <span className="admin-problem-id" title={secondary}>
                              {secondary}
                            </span>
                          ) : null}
                        </button>
                      );
                    },
                  },
                  {
                    key: "diff",
                    header: "Difficulty",
                    render: (r) =>
                      r.difficulty ? (
                        <DifficultyBadge difficulty={String(r.difficulty)} />
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "attempts",
                    header: "Attempts",
                    render: (r) => formatNumber(r.attempts),
                  },
                  {
                    key: "ac",
                    header: "Solved",
                    render: (r) => formatNumber(r.accepted),
                  },
                  {
                    key: "rate",
                    header: "Acceptance",
                    render: (r) => `${r.acceptanceRate}%`,
                  },
                ]}
                rows={sortedTopProblems.map((r: any, i: number) => ({
                  ...r,
                  __rank: i + 1,
                }))}
                rowKey={(r) => String(r.problemId || r.__rank)}
              />
            )}
          </section>

          {/* Most favourited questions */}
          <section className="admin-panel span-7" aria-label="Most favourited">
            <div className="admin-panel-head">
              <h3>Most Favourited</h3>
              <span className="admin-muted" style={{ fontSize: 12 }}>
                Free {favouriteAnalytics?.freeFavourites ?? 0} · Premium{" "}
                {favouriteAnalytics?.premiumFavourites ?? 0}
              </span>
            </div>
            {!favouriteAnalytics || favouriteAnalytics.mostFavourited.length === 0 ? (
              <EmptyState
                compact
                icon={<Star size={18} strokeWidth={1.75} aria-hidden />}
                title="No favourites yet"
                description="Favourite counts appear when users save questions."
              />
            ) : (
              <DataTable
                emptyTitle="No favourites"
                emptyDescription="Favourite counts will appear here."
                emptyIcon={<Star size={18} strokeWidth={1.75} aria-hidden />}
                columns={[
                  {
                    key: "rank",
                    header: "#",
                    render: (r) => (
                      <span
                        className={`admin-rank ${Number(r.__rank) <= 3 ? "top" : ""}`}
                      >
                        {r.__rank}
                      </span>
                    ),
                  },
                  {
                    key: "problem",
                    header: "Problem",
                    render: (r) => (
                      <button
                        type="button"
                        className="admin-link"
                        onClick={() => onNavigate?.("problems", String(r.id))}
                      >
                        {r.title}
                      </button>
                    ),
                  },
                  {
                    key: "diff",
                    header: "Difficulty",
                    render: (r) =>
                      r.difficulty ? (
                        <DifficultyBadge difficulty={String(r.difficulty)} />
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "access",
                    header: "Access",
                    render: (r) => (r.isPremium ? "Premium" : "Free"),
                  },
                  {
                    key: "count",
                    header: "Favourites",
                    render: (r) => formatNumber(r.favouriteCount),
                  },
                ]}
                rows={favouriteAnalytics.mostFavourited
                  .slice(0, 8)
                  .map((r, i) => ({ ...r, __rank: i + 1 }))}
                rowKey={(r) => String(r.id || r.__rank)}
              />
            )}
          </section>

          {favouriteAnalytics && favouriteAnalytics.trends.some((t) => t.count > 0) && (
            <section className="admin-panel span-5" aria-label="Favourite trends">
              <div className="admin-panel-head">
                <h3>Favourite Trends</h3>
                <span className="admin-muted" style={{ fontSize: 12 }}>
                  Last 30 days
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={favouriteAnalytics.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: CHART.tick, fontSize: 10 }}
                    tickFormatter={(v) => String(v).slice(5)}
                  />
                  <YAxis tick={{ fill: CHART.tick, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Favourites"
                    stroke={CHART[1]}
                    fill={CHART[1]}
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Top users / leaderboard */}
          <section className="admin-panel span-5" aria-label="Top users">
            <div className="admin-panel-head">
              <h3>Top Users</h3>
              <div className="admin-seg admin-seg-sm" role="group" aria-label="Leaderboard period">
                {(
                  [
                    ["global", "All Time"],
                    ["weekly", "This Week"],
                    ["monthly", "This Month"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={lbPeriod === id ? "active" : ""}
                    onClick={() => setLbPeriod(id)}
                    aria-pressed={lbPeriod === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {lbLoading ? (
              <div className="admin-skel" style={{ height: 180 }} />
            ) : lbError ? (
              <WidgetError
                title="Leaderboard unavailable"
                message={lbError}
                onRetry={() => void loadLeaderboard()}
                compact
              />
            ) : leaderboard.length === 0 ? (
              <EmptyState
                compact
                icon={<Trophy size={18} strokeWidth={1.75} />}
                title="No leaderboard rows yet"
                description="Rankings will populate as users earn points."
              />
            ) : (
              <DataTable
                emptyTitle="No users found"
                emptyDescription="Top solvers will appear once rankings are available."
                emptyIcon={<Users size={18} strokeWidth={1.75} />}
                columns={[
                  {
                    key: "rank",
                    header: "#",
                    render: (r) => r.__rank ?? r.rank ?? "—",
                  },
                  {
                    key: "user",
                    header: "User",
                    render: (r) =>
                      r.username ||
                      r.name ||
                      r.userId ||
                      String(r._id || "—").slice(0, 10),
                  },
                  {
                    key: "solved",
                    header: "Solved",
                    render: (r) =>
                      formatNumber(r.solved ?? r.score ?? r.problemsSolved),
                  },
                  {
                    key: "score",
                    header: "Score",
                    render: (r) => formatNumber(r.score ?? r.points),
                  },
                ]}
                rows={leaderboard.map((r, i) => ({
                  ...r,
                  __rank: r.rank ?? i + 1,
                }))}
                rowKey={(r) => String(r.userId || r._id || r.__rank)}
              />
            )}
          </section>

          {/* Recent submissions */}
          <section className="admin-panel span-8" aria-label="Recent submissions">
            <div className="admin-panel-head">
              <h3>Recent Submissions</h3>
              <div className="admin-inline-filters">
                <label className="admin-search-sm">
                  <Search size={13} />
                  <input
                    value={subsSearch}
                    onChange={(e) => {
                      setSubsSearch(e.target.value);
                      applySubsSearch(e.target.value);
                      setSubsPage(1);
                    }}
                    placeholder="Search…"
                    aria-label="Search submissions"
                  />
                </label>
                <select
                  className="admin-select-sm"
                  value={subsStatus}
                  onChange={(e) => {
                    setSubsStatus(e.target.value);
                    setSubsPage(1);
                  }}
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  {[
                    "ACCEPTED",
                    "WRONG_ANSWER",
                    "RUNTIME_ERROR",
                    "COMPILATION_ERROR",
                    "TIME_LIMIT_EXCEEDED",
                    "MEMORY_LIMIT_EXCEEDED",
                    "PENDING",
                    "RUNNING",
                    "SYSTEM_ERROR",
                    "FAILED",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {humanizeStatus(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {subsError ? (
              <WidgetError
                title={subsError.title}
                message={subsError.message}
                onRetry={() => void loadSubmissions()}
                compact
              />
            ) : (
              <>
                <DataTable
                  loading={subsLoading}
                  emptyTitle="No submissions found"
                  emptyDescription="New submissions in this range will show up here."
                  emptyIcon={<FileCode2 size={18} strokeWidth={1.75} />}
                  columns={[
                    {
                      key: "user",
                      header: "User",
                      render: (r) => {
                        const uid = String(r.userId || "");
                        const label =
                          r.username ||
                          r.userName ||
                          (uid ? `${uid.slice(0, 8)}…` : "—");
                        return (
                          <button
                            type="button"
                            className="admin-link admin-user-cell"
                            onClick={() =>
                              onNavigate?.(
                                "user-detail",
                                uid
                              )
                            }
                          >
                            <span>{String(label)}</span>
                            {uid ? (
                              <span className="admin-problem-id" title={uid}>
                                {uid.slice(0, 10)}
                              </span>
                            ) : null}
                          </button>
                        );
                      },
                    },
                    {
                      key: "problem",
                      header: "Problem",
                      render: (r) => {
                        const pid = String(r.problemId || "");
                        const { primary } = problemDisplayTitle(
                          problemMap[pid]?.title,
                          pid,
                        );
                        return (
                          <button
                            type="button"
                            className="admin-link"
                            onClick={() =>
                              onNavigate?.("problem-editor", pid)
                            }
                          >
                            {primary}
                          </button>
                        );
                      },
                    },
                    {
                      key: "lang",
                      header: "Language",
                      render: (r) => languageLabel(r.language),
                    },
                    {
                      key: "verdict",
                      header: "Verdict",
                      render: (r) =>
                        r.status ? (
                          <SubmissionVerdictBadge status={String(r.status)} />
                        ) : (
                          "—"
                        ),
                    },
                    {
                      key: "runtime",
                      header: "Runtime",
                      render: (r) =>
                        r.executionTime != null ? `${r.executionTime} ms` : "—",
                    },
                    {
                      key: "mem",
                      header: "Memory",
                      render: (r) =>
                        r.memory != null ? `${r.memory} MB` : "—",
                    },
                    {
                      key: "at",
                      header: "Submitted",
                      render: (r) => formatDateTime(r.createdAt),
                    },
                  ]}
                  rows={submissions}
                  rowKey={(r) => String(r.id || r._id)}
                />
                <div className="admin-pager">
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={subsPage <= 1}
                    onClick={() => setSubsPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span className="admin-muted">
                    Page {subsMeta.page} / {subsMeta.totalPages} ·{" "}
                    {formatNumber(subsMeta.total)} total
                  </span>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={subsPage >= subsMeta.totalPages}
                    onClick={() =>
                      setSubsPage((p) => Math.min(subsMeta.totalPages, p + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Recent users */}
          <section className="admin-panel span-4" aria-label="Recent users">
            <div className="admin-panel-head">
              <h3>Recent Users</h3>
              <label className="admin-search-sm">
                <Search size={13} />
                <input
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    applyUserSearch(e.target.value);
                  }}
                  placeholder="Search users…"
                  aria-label="Search users"
                />
              </label>
            </div>
            {usersLoading ? (
              <div className="admin-skel" style={{ height: 160 }} />
            ) : usersError ? (
              <WidgetError
                title="Users unavailable"
                message={usersError}
                onRetry={() => void loadSide()}
                compact
              />
            ) : recentUsers.length === 0 ? (
              <EmptyState
                compact
                icon={<Users size={18} strokeWidth={1.75} />}
                title="No users found"
                description="Try a different search or invite your first users."
              />
            ) : (
              <ul className="admin-user-list">
                {recentUsers.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="admin-user-row"
                      onClick={() => onNavigate?.("user-detail", u.id)}
                    >
                      <span className="admin-avatar" aria-hidden>
                        {u.avatar ? (
                          <img src={u.avatar} alt="" />
                        ) : (
                          initialsFrom(u.name, u.email)
                        )}
                      </span>
                      <span className="admin-user-meta">
                        <strong>{u.name || "—"}</strong>
                        <span>{u.email}</span>
                      </span>
                      <span className="admin-user-side">
                        <StatusBadge status={u.status} />
                        <time dateTime={u.createdAt}>
                          {relativeTime(u.createdAt)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Quick actions + alerts */}
          <section className="admin-panel span-4" aria-label="Quick actions">
            <div className="admin-panel-head">
              <h3>Quick Actions</h3>
            </div>
            <div className="admin-qa-grid">
              <Qa
                icon={<Plus size={14} strokeWidth={2} className="size-3.5" aria-hidden />}
                label="New Problem"
                description="Create a new challenge"
                onClick={() => onNavigate?.("problem-editor")}
              />
              <Qa
                icon={<Users size={14} strokeWidth={2} className="size-3.5" aria-hidden />}
                label="Users"
                description="Manage accounts"
                onClick={() => onNavigate?.("users")}
              />
              <Qa
                icon={<FileBarChart size={14} strokeWidth={2} className="size-3.5" aria-hidden />}
                label="Reports"
                description="Review flagged content"
                onClick={() => onNavigate?.("reports")}
              />
              <Qa
                icon={<Megaphone size={14} strokeWidth={2} className="size-3.5" aria-hidden />}
                label="Announcements"
                description="Broadcast updates"
                onClick={() => onNavigate?.("announcements")}
              />
              <Qa
                icon={<Radio size={14} strokeWidth={2} className="size-3.5" aria-hidden />}
                label="Realtime"
                description="Live connections"
                onClick={() => onNavigate?.("realtime")}
              />
              <Qa
                icon={<Trophy size={14} strokeWidth={2} className="size-3.5" aria-hidden />}
                label="Leaderboards"
                description="Rankings & scores"
                onClick={() => onNavigate?.("leaderboards")}
              />
              <Qa
                icon={<HeartPulse size={14} strokeWidth={2} className="size-3.5" aria-hidden />}
                label="Health"
                description="Service status"
                onClick={() => onNavigate?.("health")}
              />
              <Qa
                icon={<Code2 size={14} strokeWidth={2} className="size-3.5" aria-hidden />}
                label="Executions"
                description="Queue & workers"
                onClick={() => onNavigate?.("code-execution")}
              />
            </div>
          </section>

          <section className="admin-panel span-4" aria-label="System alerts">
            <div className="admin-panel-head">
              <h3>System Alerts</h3>
            </div>
            {alerts.length === 0 ? (
              <EmptyState
                compact
                icon={<CheckCircle2 size={18} strokeWidth={1.75} aria-hidden />}
                title="No active alerts"
                description="System looks healthy — no alerts right now."
              />
            ) : (
              <ul className="admin-alert-list">
                {alerts.map((a, i) => (
                  <li
                    key={`${a.title}-${i}`}
                    className={`admin-alert-item sev-${a.severity.toLowerCase()}`}
                  >
                    <div className="admin-alert-top">
                      <AlertTriangle
                        size={14}
                        strokeWidth={2}
                        className="size-3.5 shrink-0"
                        aria-hidden
                      />
                      <strong>{a.title}</strong>
                      <time dateTime={a.at}>{relativeTime(a.at)}</time>
                    </div>
                    <p>{a.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-panel span-4" aria-label="Running executions">
            <div className="admin-panel-head">
              <h3>Execution Snapshot</h3>
            </div>
            <div className="admin-engage-grid">
              <MetricCell label="Pending" value={formatNumber(pending)} />
              <MetricCell label="Running" value={formatNumber(running)} />
              <MetricCell label="Accepted" value={formatNumber(accepted)} />
              <MetricCell label="System" value={systemHealthLabel} />
            </div>
          </section>
        </div>
      </div>
    </PermissionGuard>
  );
};

const Kpi: FC<{
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
}> = ({ icon, label, value, meta }) => (
  <article className="admin-kpi">
    <div className="admin-kpi-top">
      <span className="admin-kpi-label">{label}</span>
      <span className="admin-kpi-icon" aria-hidden>
        {icon}
      </span>
    </div>
    <div className="admin-kpi-value">{value}</div>
    <div className="admin-kpi-meta">{meta}</div>
  </article>
);

const MetricCell: FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="admin-metric-cell">
    <span className="admin-metric-label">{label}</span>
    <span
      className={`admin-metric-value${typeof value === "string" && String(value).includes("unavailable")
        ? " unavailable"
        : ""
        }`}
    >
      {value}
    </span>
  </div>
);

const Qa: FC<{
  icon: ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
}> = ({ icon, label, description, onClick }) => (
  <button type="button" className="admin-qa-btn" onClick={onClick}>
    <span className="admin-qa-icon" aria-hidden>
      {icon}
    </span>
    <span className="admin-qa-copy">
      <span className="admin-qa-label">{label}</span>
      {description ? (
        <span className="admin-qa-desc">{description}</span>
      ) : null}
    </span>
    <ArrowUpRight
      size={14}
      strokeWidth={2}
      className="admin-qa-arrow size-3.5 shrink-0"
      aria-hidden
    />
  </button>
);

export default AdminDashboardHome;
