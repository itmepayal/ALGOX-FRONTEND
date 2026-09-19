import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  FileCode2,
  HeartPulse,
  Loader2,
  Radio,
  RefreshCw,
  Users,
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
import {
  adminLearningApi,
  type ProductUsageOverview,
} from "../../../api/adminLearningApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";
import { SubmissionVerdictBadge } from "../shared/SubmissionVerdictBadge";
import { DataTable } from "../shared/DataTable";
import { EmptyState } from "../shared/EmptyState";
import { usePermission } from "../../../rbac/usePermission";
import type { AdminTab } from "../adminNav";
import { WidgetError } from "../shared/WidgetError";
import { normalizeApiError } from "../../../lib/apiError";
import { useToast } from "../../../context/ToastContext";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { StatsCard } from "../shared/StatsCard";
import "./dashboard.css";

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
  4: "var(--chart-4)",
  grid: "var(--border)",
  tick: "var(--muted-foreground)",
};

function formatNumber(n: unknown): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString();
}

function formatRate(n: unknown): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return `${num}%`;
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

function humanizeStatus(raw: string): string {
  return String(raw || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTrend(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return null;
  const n = Number(pct);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}% vs prior period`;
}

function healthLabel(status: string): string {
  if (status === "healthy") return "Healthy";
  if (status === "warning") return "Degraded";
  if (status === "offline") return "Unavailable";
  return humanizeStatus(status);
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const refreshLock = useRef(false);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subsMeta, setSubsMeta] = useState({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  });
  const [subsPage, setSubsPage] = useState(1);
  const [subsError, setSubsError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [subsLoading, setSubsLoading] = useState(true);

  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);

  const [problemMap, setProblemMap] = useState<Record<string, any>>({});
  const problemMapRef = useRef(problemMap);

  const [execHealth, setExecHealth] = useState<any>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

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
  const [productUsage, setProductUsage] = useState<ProductUsageOverview | null>(
    null,
  );
  const [productUsageError, setProductUsageError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    problemMapRef.current = problemMap;
  }, [problemMap]);

  const enrichProblemTitles = useCallback(async (ids: string[]) => {
    const missing = [...new Set(ids.map(String).filter(Boolean))].filter(
      (id) => !problemMapRef.current[id]?.title,
    );
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
      /* display-only enrichment */
    }
  }, []);

  const loadCore = useCallback(
    async (opts?: { soft?: boolean }) => {
      const soft = Boolean(opts?.soft);
      if (!soft) setInitialLoading(true);
      setCoreError(null);
      try {
        const result = await adminAnalyticsApi.loadDashboard(range);
        setOverview(result.overview);
        setCharts(result.charts);
        setFallbackMode(Boolean(result.fallback));
        setUpdatedAt(new Date());

        if ((result as any).softWarning) {
          toast.warning("Partial analytics", (result as any).softWarning);
        }

        const topIds = (result.charts?.topProblems || [])
          .map((r: any) => String(r.problemId || r._id || "").trim())
          .filter(Boolean);
        await enrichProblemTitles(topIds);

        try {
          const pu = await adminLearningApi.productUsage();
          setProductUsage(pu.data || null);
          setProductUsageError(null);
        } catch (err: unknown) {
          setProductUsage(null);
          setProductUsageError(normalizeApiError(err).message);
        }
      } catch (err: unknown) {
        const n = normalizeApiError(err);
        setCoreError({ title: n.title, message: n.message });
        if (!soft) {
          toast.apiError(err, "Unable to load platform analytics");
        }
      } finally {
        setInitialLoading(false);
      }
    },
    [range, toast, enrichProblemTitles],
  );

  const loadSubmissions = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!opts?.soft) setSubsLoading(true);
      setSubsError(null);
      try {
        const res = await adminSubmissionApi.list({
          page: subsPage,
          limit: 8,
        });
        setSubmissions(res.data || []);
        setSubsMeta({
          page: res.meta?.page || subsPage,
          limit: res.meta?.limit || 8,
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
        if (!opts?.soft) setSubmissions([]);
      } finally {
        setSubsLoading(false);
      }
    },
    [subsPage, enrichProblemTitles],
  );

  const loadSide = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!opts?.soft) setHealthLoading(true);
      const [healthRows, rtRes, exec, usersRes] = await Promise.all([
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
          }),
        ),
        adminRealtimeApi.overview().then(
          (res) => ({ ok: true as const, data: res.data || res }),
          (err: unknown) => ({
            ok: false as const,
            error: normalizeApiError(err).message,
          }),
        ),
        adminAnalyticsApi.executionHealth().then(
          (res) => ({ ok: true as const, data: res.data }),
          (err: unknown) => ({
            ok: false as const,
            error: normalizeApiError(err).message,
          }),
        ),
        can("users:view")
          ? adminAuthApi.listUsers({ page: 1, limit: 8 }).then(
              (res) => ({ ok: true as const, data: res.data || [] }),
              (err: unknown) => ({
                ok: false as const,
                error: normalizeApiError(err).message,
              }),
            )
          : Promise.resolve({ ok: true as const, data: [] as AdminUser[] }),
      ]);

      setHealth(healthRows);
      setRt(rtRes);
      setHealthLoading(false);

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
        if (!opts?.soft) setRecentUsers([]);
        setUsersError(usersRes.error || "Unable to load users");
      }
    },
    [can],
  );

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
    const id = window.setInterval(() => setTick((t) => t + 1), 45000);
    return () => window.clearInterval(id);
  }, []);

  const refreshAll = async () => {
    if (refreshLock.current || refreshing) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        loadCore({ soft: true }),
        loadSubmissions({ soft: true }),
        loadSide({ soft: true }),
      ]);
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      toast.apiError(err, "Unable to refresh dashboard data.");
    } finally {
      setRefreshing(false);
      refreshLock.current = false;
    }
  };

  const kpis = overview?.kpis || {};
  const usersBlock = overview?.users || {};
  const problemsBlock = overview?.problems || {};
  const submissionsBlock = overview?.submissions || {};
  const byStatus: Record<string, number> = useMemo(
    () => charts?.submissionsByStatus || submissionsBlock.byStatus || {},
    [charts?.submissionsByStatus, submissionsBlock.byStatus],
  );

  const statusData = useMemo(
    () =>
      Object.entries(byStatus)
        .map(([name, value]) => ({ name, value: Number(value) }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [byStatus],
  );

  const activitySeries = useMemo(() => {
    const series = charts?.submissionSeries || [];
    if (!Array.isArray(series) || series.length === 0) return [];
    const byDate = new Map<
      string,
      { date: string; submissions: number; accepted: number }
    >();
    for (const row of series) {
      const date = row.date || row._id?.date;
      if (!date) continue;
      const cur = byDate.get(date) || {
        date,
        submissions: 0,
        accepted: 0,
      };
      const count = Number(row.count || 0);
      cur.submissions += count;
      if (row.status === "ACCEPTED") cur.accepted += count;
      byDate.set(date, cur);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [charts]);

  const userGrowth = useMemo(() => {
    const rows = charts?.userGrowth || usersBlock.growth || [];
    return Array.isArray(rows)
      ? rows.map((r: any) => ({
          date: r.date || r._id,
          count: Number(r.count ?? r.value ?? 0),
        }))
      : [];
  }, [charts?.userGrowth, usersBlock.growth]);

  const successRateRaw =
    kpis.successRate ?? submissionsBlock.successRate ?? null;
  const successRateAvailable =
    successRateRaw !== null &&
    successRateRaw !== undefined &&
    !Number.isNaN(Number(successRateRaw));

  const offlineServices = health.filter((h) => h.status === "offline");
  const warningServices = health.filter((h) => h.status === "warning");
  const systemHealthLabel =
    health.length === 0
      ? "unknown"
      : offlineServices.length > 0 || warningServices.length > 0
        ? "Degraded"
        : "Healthy";

  const queue = execHealth?.queue || {};
  const workers =
    queue.configuredWorkers ?? queue.workers ?? queue.concurrency ?? null;
  const redisStatus =
    execHealth?.redis?.status ||
    execHealth?.redis ||
    (execError ? null : undefined);

  const go = (tab: AdminTab, id?: string) => onNavigate?.(tab, id);
  const kpiSkeleton = initialLoading && !overview;

  return (
    <PermissionGuard permission="analytics:view">
      <div className="admin-dash">
        <header className="admin-dash-header">
          <div>
            <h2 className="font-primary">Dashboard</h2>
            <p className="admin-dash-sub">
              Platform overview and operational metrics
            </p>
          </div>
          <div className="admin-dash-actions">
            <div className="admin-seg" role="group" aria-label="Date range">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={range === r.id ? "active" : ""}
                  aria-pressed={range === r.id}
                  onClick={() => setRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {updatedAt ? (
              <span className="admin-dash-updated">
                Updated {relativeTime(updatedAt.toISOString())}
              </span>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Refresh dashboard"
              disabled={refreshing}
              onClick={() => void refreshAll()}
            >
              {refreshing ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw size={16} aria-hidden />
              )}
              Refresh
            </Button>
          </div>
        </header>

        {fallbackMode ? (
          <div className="admin-dash-banner" role="status">
            Analytics service unavailable — showing direct service stats.
          </div>
        ) : null}

        {coreError && !overview ? (
          <WidgetError
            title={coreError.title}
            message={coreError.message}
            onRetry={() => void loadCore()}
          />
        ) : null}

        <section className="admin-dash-kpis" aria-label="Key metrics">
          {kpiSkeleton ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="admin-dash-kpi-skel admin-skel" />
            ))
          ) : (
            <>
              <StatsCard
                label="Users"
                value={formatNumber(kpis.totalUsers ?? usersBlock.totalUsers)}
                hint={
                  formatTrend(kpis.newUsersTrendPct) ||
                  (usersBlock.newUsersInRange != null
                    ? `${formatNumber(usersBlock.newUsersInRange)} new in range`
                    : undefined)
                }
                icon={<Users size={20} strokeWidth={1.75} />}
              />
              <StatsCard
                label="Free Users"
                value={
                  kpis.freeUsers != null
                    ? formatNumber(kpis.freeUsers)
                    : usersBlock.freeUsers != null
                      ? formatNumber(usersBlock.freeUsers)
                      : "—"
                }
                hint={
                  kpis.freeUsers == null && usersBlock.freeUsers == null
                    ? "Data unavailable"
                    : kpis.freeDau != null
                      ? `${formatNumber(kpis.freeDau)} free DAU`
                      : undefined
                }
                icon={<Users size={20} strokeWidth={1.75} />}
              />
              <StatsCard
                label="Premium Users"
                value={
                  kpis.premiumUsers != null
                    ? formatNumber(kpis.premiumUsers)
                    : usersBlock.premiumUsers != null
                      ? formatNumber(usersBlock.premiumUsers)
                      : "—"
                }
                hint={
                  kpis.conversionRatePct != null
                    ? `${kpis.conversionRatePct}% conversion`
                    : kpis.premiumUsers == null
                      ? "Data unavailable"
                      : undefined
                }
                icon={<Users size={20} strokeWidth={1.75} />}
              />
              <StatsCard
                label="Problems"
                value={formatNumber(
                  kpis.totalProblems ?? problemsBlock.totalProblems,
                )}
                hint={
                  problemsBlock.publishedProblems != null
                    ? `${formatNumber(problemsBlock.publishedProblems)} published`
                    : undefined
                }
                icon={<FileCode2 size={20} strokeWidth={1.75} />}
              />
              <StatsCard
                label="Submissions"
                value={formatNumber(
                  kpis.totalSubmissions ?? submissionsBlock.totalSubmissions,
                )}
                hint={
                  kpis.todaySubmissions != null
                    ? `${formatNumber(kpis.todaySubmissions)} today`
                    : undefined
                }
                icon={<Activity size={20} strokeWidth={1.75} />}
              />
              <StatsCard
                label="Acceptance Rate"
                value={successRateAvailable ? formatRate(successRateRaw) : "—"}
                hint={successRateAvailable ? undefined : "Metric unavailable"}
                icon={<BarChart3 size={20} strokeWidth={1.75} />}
              />
            </>
          )}
        </section>

        <section className="admin-dash-panel" aria-label="Product usage">
          <div className="admin-dash-panel-head">
            <h2 className="admin-dash-panel-title">Product / Premium usage</h2>
            <p className="admin-dash-muted">
              Unique users from real Mongo collections (UTC windows). Missing
              features show Data unavailable — no invented metrics.
            </p>
          </div>
          {productUsageError ? (
            <WidgetError
              title="Product usage unavailable"
              message={productUsageError}
              onRetry={() => void loadCore()}
            />
          ) : !productUsage ? (
            <p className="admin-dash-muted">Loading product usage…</p>
          ) : (
            <div className="admin-dash-table-wrap">
              <table className="admin-dash-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Users</th>
                    <th>Today</th>
                    <th>7 Days</th>
                    <th>30 Days</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Daily Planner", productUsage.features.planner],
                      ["Sessions", productUsage.features.sessions],
                      ["Calendar", productUsage.features.calendar],
                      ["Companies", productUsage.features.companies],
                      ["AI", productUsage.features.ai],
                      ["Analytics page", productUsage.features.analyticsPage],
                      ["Revision Queue", productUsage.features.revisionQueue],
                      ["Mock Interview", productUsage.features.mockInterview],
                    ] as const
                  ).map(([label, row]) => {
                    if (!row) {
                      return (
                        <tr key={label}>
                          <td>{label}</td>
                          <td>—</td>
                          <td>—</td>
                          <td>—</td>
                          <td>—</td>
                          <td className="admin-dash-muted">Not available</td>
                        </tr>
                      );
                    }
                    const unavailable = row.available === false;
                    const fmt = (v: number | null | undefined) =>
                      unavailable || v == null ? "—" : formatNumber(v);
                    return (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{fmt(row.uniqueUsers as number | null)}</td>
                        <td>{fmt(row.today as number | null)}</td>
                        <td>{fmt(row.week as number | null)}</td>
                        <td>{fmt(row.month as number | null)}</td>
                        <td className="admin-dash-muted">
                          {unavailable
                            ? String(row.note || "Data unavailable")
                            : String(row.note || "")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {productUsage.features.revisionQueue ? (
                <p className="admin-dash-muted" style={{ marginTop: 8 }}>
                  SRS due today:{" "}
                  {formatNumber(
                    Number(productUsage.features.revisionQueue.dueToday || 0),
                  )}{" "}
                  · overdue:{" "}
                  {formatNumber(
                    Number(productUsage.features.revisionQueue.overdue || 0),
                  )}{" "}
                  · upcoming:{" "}
                  {formatNumber(
                    Number(productUsage.features.revisionQueue.upcoming || 0),
                  )}{" "}
                  · completed today:{" "}
                  {formatNumber(
                    Number(
                      productUsage.features.revisionQueue.completedToday || 0,
                    ),
                  )}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="admin-dash-row" aria-label="System status">
          <Card className="admin-dash-panel">
            <CardHeader className="admin-dash-panel-head">
              <div className="admin-dash-panel-title-row">
                <CardTitle>Service Health</CardTitle>
                <StatusBadge status={systemHealthLabel} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => go("health")}
              >
                View details
              </Button>
            </CardHeader>
            <CardContent className="admin-dash-panel-body">
              {healthLoading && health.length === 0 ? (
                <div className="admin-skel admin-skel-list" />
              ) : health.length === 0 ? (
                <EmptyState
                  title="Health checks pending"
                  description="Service status will appear after the first health poll."
                  compact
                />
              ) : (
                <ul className="admin-dash-health-list">
                  {health.map((h) => (
                    <li key={h.name}>
                      <span className="admin-dash-health-name">{h.name}</span>
                      <StatusBadge status={healthLabel(h.status)} />
                      <span className="admin-dash-health-meta">
                        {h.ms != null ? `${h.ms}ms` : "—"}
                      </span>
                    </li>
                  ))}
                  <li>
                    <span className="admin-dash-health-name">Workers</span>
                    {workers == null ? (
                      <span className="admin-dash-unavailable">
                        Metric unavailable
                      </span>
                    ) : (
                      <StatusBadge
                        status={Number(workers) > 0 ? "Healthy" : "Degraded"}
                      />
                    )}
                    <span className="admin-dash-health-meta">
                      {workers == null ? "—" : formatNumber(workers)}
                    </span>
                  </li>
                  <li>
                    <span className="admin-dash-health-name">Redis</span>
                    {redisStatus == null && execError ? (
                      <span className="admin-dash-unavailable">
                        Metric unavailable
                      </span>
                    ) : (
                      <StatusBadge
                        status={
                          String(redisStatus || "unknown")
                            .toLowerCase()
                            .includes("ok") ||
                          String(redisStatus).toLowerCase() === "connected" ||
                          String(redisStatus).toLowerCase() === "healthy"
                            ? "Healthy"
                            : redisStatus == null
                              ? "unknown"
                              : String(redisStatus)
                        }
                      />
                    )}
                    <span className="admin-dash-health-meta">
                      {queue.waiting != null
                        ? `${formatNumber(queue.waiting)} queued`
                        : "—"}
                    </span>
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="admin-dash-panel">
            <CardHeader className="admin-dash-panel-head">
              <div className="admin-dash-panel-title-row">
                <CardTitle>Realtime</CardTitle>
                <Radio size={16} className="text-muted-foreground" aria-hidden />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => go("realtime")}
              >
                Open center
              </Button>
            </CardHeader>
            <CardContent className="admin-dash-panel-body">
              {!rt.ok ? (
                <EmptyState
                  title="Realtime unavailable"
                  description={rt.error || "Realtime gateway did not respond."}
                  compact
                  action={
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void loadSide()}
                    >
                      Retry
                    </Button>
                  }
                />
              ) : (
                <div className="admin-dash-rt-grid">
                  <RtMetric
                    label="Connections"
                    value={adminRealtimeApi.metricOrUnavailable(
                      rt.data?.activeConnections ?? rt.data?.connections,
                    )}
                  />
                  <RtMetric
                    label="Online users"
                    value={adminRealtimeApi.metricOrUnavailable(
                      rt.data?.onlineUsers,
                    )}
                  />
                  <RtMetric
                    label="Events / sec"
                    value={adminRealtimeApi.metricOrUnavailable(
                      rt.data?.eventsPerSecond,
                    )}
                  />
                  <RtMetric
                    label="Avg latency"
                    value={
                      rt.data?.avgLatencyMs == null ||
                      Number.isNaN(rt.data?.avgLatencyMs)
                        ? "Metric unavailable"
                        : `${rt.data.avgLatencyMs}ms`
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="admin-dash-row" aria-label="Activity analytics">
          <Card className="admin-dash-panel admin-dash-panel-wide">
            <CardHeader className="admin-dash-panel-head">
              <CardTitle>Submission Activity</CardTitle>
            </CardHeader>
            <CardContent className="admin-dash-panel-body">
              {kpiSkeleton ? (
                <div className="admin-skel admin-skel-chart" />
              ) : activitySeries.length === 0 ? (
                <EmptyState
                  title="No submission activity"
                  description="There is no submission series for this range yet."
                  compact
                />
              ) : (
                <div className="admin-dash-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={activitySeries}>
                      <CartesianGrid
                        stroke={CHART.grid}
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: CHART.tick, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tick={{ fill: CHART.tick, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <Tooltip contentStyle={CHART_TOOLTIP} />
                      <Legend content={<ChartLegendContent />} />
                      <Area
                        type="monotone"
                        dataKey="submissions"
                        name="Submissions"
                        stroke={CHART[1]}
                        fill={CHART[1]}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="accepted"
                        name="Accepted"
                        stroke={CHART[4]}
                        fill={CHART[4]}
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="admin-dash-panel">
            <CardHeader className="admin-dash-panel-head">
              <CardTitle>Verdict Distribution</CardTitle>
            </CardHeader>
            <CardContent className="admin-dash-panel-body">
              {kpiSkeleton ? (
                <div className="admin-skel admin-skel-chart" />
              ) : statusData.length === 0 ? (
                <EmptyState
                  title="No verdict data"
                  description="Submission verdicts will appear once traffic exists."
                  compact
                />
              ) : (
                <>
                  <div className="admin-dash-chart admin-dash-chart-sm">
                    <ResponsiveContainer width="100%" height={220}>
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
                              fill={
                                STATUS_COLORS[d.name] ||
                                "var(--muted-foreground)"
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART_TOOLTIP} />
                        <Legend content={<ChartLegendContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="admin-dash-verdict-grid">
                    {(
                      [
                        "ACCEPTED",
                        "WRONG_ANSWER",
                        "RUNTIME_ERROR",
                        "COMPILATION_ERROR",
                      ] as const
                    ).map((key) => (
                      <div key={key} className="admin-dash-verdict-cell">
                        <span>{humanizeStatus(key)}</span>
                        <strong>{formatNumber(byStatus[key] ?? 0)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="User activity">
          <Card className="admin-dash-panel">
            <CardHeader className="admin-dash-panel-head">
              <CardTitle>User Activity</CardTitle>
            </CardHeader>
            <CardContent className="admin-dash-panel-body">
              {kpiSkeleton ? (
                <div className="admin-skel admin-skel-chart" />
              ) : userGrowth.length === 0 ? (
                <EmptyState
                  title="No registration trend"
                  description="User growth data is not available for this range."
                  compact
                />
              ) : (
                <div className="admin-dash-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={userGrowth}>
                      <CartesianGrid
                        stroke={CHART.grid}
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: CHART.tick, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tick={{ fill: CHART.tick, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <Tooltip contentStyle={CHART_TOOLTIP} />
                      <Bar
                        dataKey="count"
                        name="Registrations"
                        fill={CHART[2]}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="admin-dash-row" aria-label="Recent activity">
          <Card className="admin-dash-panel">
            <CardHeader className="admin-dash-panel-head">
              <CardTitle>Recent Submissions</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => go("submissions")}
              >
                View all
              </Button>
            </CardHeader>
            <CardContent className="admin-dash-panel-body admin-dash-panel-flush">
              {subsError ? (
                <WidgetError
                  title={subsError.title}
                  message={subsError.message}
                  onRetry={() => void loadSubmissions()}
                  compact
                />
              ) : (
                <DataTable
                  columns={[
                    {
                      key: "problem",
                      header: "Problem",
                      render: (s) => {
                        const id = String(s.problemId || "");
                        const title =
                          s.problemTitle ||
                          problemMap[id]?.title ||
                          (id ? `Problem ${id.slice(0, 8)}` : "—");
                        return (
                          <span className="admin-dash-ellipsis" title={title}>
                            {title}
                          </span>
                        );
                      },
                    },
                    {
                      key: "user",
                      header: "User",
                      render: (s) =>
                        s.username || s.userEmail || s.userId || "—",
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (s) => (
                        <SubmissionVerdictBadge status={s.status} />
                      ),
                    },
                    {
                      key: "when",
                      header: "When",
                      align: "right",
                      render: (s) =>
                        relativeTime(s.createdAt || s.submittedAt),
                    },
                  ]}
                  rows={submissions}
                  rowKey={(s) => String(s.id || s._id)}
                  loading={subsLoading && submissions.length === 0}
                  emptyTitle="No recent submissions"
                  emptyDescription="There are no submissions to display yet."
                  emptyAction={
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => go("submissions")}
                    >
                      View Submissions
                    </Button>
                  }
                  page={subsMeta.page}
                  totalPages={subsMeta.totalPages}
                  total={subsMeta.total}
                  onPageChange={setSubsPage}
                  skeletonRows={5}
                  minWidth="520px"
                />
              )}
            </CardContent>
          </Card>

          <Card className="admin-dash-panel">
            <CardHeader className="admin-dash-panel-head">
              <CardTitle>Recent Users</CardTitle>
              {can("users:view") ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => go("users")}
                >
                  Manage
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="admin-dash-panel-body">
              {!can("users:view") ? (
                <EmptyState
                  title="Permission required"
                  description="You need users:view to see recent accounts."
                  compact
                />
              ) : usersError ? (
                <WidgetError
                  title="Unable to load users"
                  message={usersError}
                  onRetry={() => void loadSide()}
                  compact
                />
              ) : usersLoading && recentUsers.length === 0 ? (
                <div className="admin-skel admin-skel-list" />
              ) : recentUsers.length === 0 ? (
                <EmptyState
                  title="No users found"
                  description="There are no recent user accounts to display."
                  compact
                />
              ) : (
                <ul className="admin-dash-user-list">
                  {recentUsers.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="admin-dash-user-row"
                        onClick={() => go("user-detail", u.id)}
                      >
                        <span className="admin-dash-user-avatar" aria-hidden>
                          {(u.name || u.email || "?").charAt(0).toUpperCase()}
                        </span>
                        <span className="admin-dash-user-meta">
                          <strong>{u.name || "Unnamed"}</strong>
                          <span>{u.email}</span>
                        </span>
                        <span className="admin-dash-user-when">
                          {relativeTime(u.createdAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Quick access">
          <Card className="admin-dash-panel">
            <CardHeader>
              <CardTitle>Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="admin-dash-qa">
              {(
                [
                  { tab: "problems" as const, label: "Problems", icon: FileCode2 },
                  { tab: "users" as const, label: "Users", icon: Users },
                  {
                    tab: "submissions" as const,
                    label: "Submissions",
                    icon: Activity,
                  },
                  {
                    tab: "analytics" as const,
                    label: "Analytics",
                    icon: BarChart3,
                  },
                  {
                    tab: "health" as const,
                    label: "System Health",
                    icon: HeartPulse,
                  },
                ] as const
              ).map(({ tab, label, icon: Icon }) => (
                <Button
                  key={tab}
                  type="button"
                  variant="secondary"
                  className="admin-dash-qa-btn"
                  onClick={() => go(tab)}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  {label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
};

const RtMetric: FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => {
  const unavailable =
    value === "Metric unavailable" || value === null || value === undefined;
  return (
    <div className="admin-dash-rt-metric">
      <span className="admin-dash-rt-label">{label}</span>
      <strong
        className={
          unavailable ? "admin-dash-unavailable" : "admin-dash-rt-value"
        }
      >
        {unavailable ? "Metric unavailable" : formatNumber(value)}
      </strong>
    </div>
  );
};

export default AdminDashboardHome;
