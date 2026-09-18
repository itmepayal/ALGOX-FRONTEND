import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  Code2,
  Download,
  FileCode2,
  GraduationCap,
  HeartPulse,
  Loader2,
  Radio,
  RefreshCw,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import {
  adminAnalyticsApi,
  HEALTH_ENDPOINTS,
  pingHealthDetailed,
  type DashboardRange,
} from "../../../api/adminAnalyticsApi";
import { adminProblemApi } from "../../../api/adminProblemApi";
import { adminLearningApi } from "../../../api/adminLearningApi";
import { adminRealtimeApi } from "../../../api/adminRealtimeApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { EmptyState } from "../shared/EmptyState";
import { WidgetError } from "../shared/WidgetError";
import { StatusBadge } from "../shared/StatusBadge";
import { Button } from "../../ui/button";
import type { AdminTab } from "../adminNav";
import { AnalyticsKpiCard } from "./AnalyticsKpiCard";
import "./analytics.css";
import "../shared/admin.css";

interface AnalyticsPageProps {
  onNavigate?: (tab: AdminTab, id?: string) => void;
}

const RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "this_month", label: "This month" },
  { id: "prev_month", label: "Prev month" },
  { id: "1y", label: "1 year" },
  { id: "this_year", label: "This year" },
];

const AUTO_REFRESH: Array<{ id: number; label: string }> = [
  { id: 0, label: "Off" },
  { id: 30_000, label: "30s" },
  { id: 60_000, label: "1m" },
  { id: 300_000, label: "5m" },
];

const CHART = {
  grid: "var(--border)",
  tick: "var(--muted-foreground)",
  tooltip: {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
};

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

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ActivityMetric = "users" | "submissions" | "accepted";

function fmt(n: unknown): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString();
}

function pct(n: unknown): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `${Number(n)}%`;
}

function humanizeStatus(raw: string): string {
  return String(raw || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
  return Number(v);
}

function sparkFromSeries(
  rows: Array<{ date: string; count: number }>,
  take = 14
): number[] {
  return rows.slice(-take).map((r) => Number(r.count) || 0);
}

/**
 * Enterprise analytics command center.
 * All metrics come from AnalyticsService fan-in + sibling admin APIs.
 * Missing signals render Unavailable / empty — never invented.
 */
export const AnalyticsPage: FC<AnalyticsPageProps> = ({ onNavigate }) => {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [compareOn, setCompareOn] = useState(true);
  const [autoMs, setAutoMs] = useState(0);
  const [activityMetric, setActivityMetric] =
    useState<ActivityMetric>("submissions");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null
  );
  const [overview, setOverview] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [fallback, setFallback] = useState(false);
  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const [favouriteAnalytics, setFavouriteAnalytics] = useState<any>(null);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [learningSheets, setLearningSheets] = useState<any[]>([]);
  const [topicEngagement, setTopicEngagement] = useState<any[]>([]);
  const [weakTopics, setWeakTopics] = useState<any[]>([]);
  const [realtime, setRealtime] = useState<any>(null);
  const [execHealth, setExecHealth] = useState<any>(null);
  const [serviceHealth, setServiceHealth] = useState<
    Array<{ name: string; status: string; ms: number | null }>
  >([]);
  const [enrichNotes, setEnrichNotes] = useState<string[]>([]);
  const [problemMap, setProblemMap] = useState<Record<string, any>>({});

  const lock = useRef(false);

  const loadCore = useCallback(async (soft = false) => {
    if (lock.current) return;
    lock.current = true;
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setSoftWarning(null);
    try {
      const bundle = await adminAnalyticsApi.loadDashboard(range);
      setOverview(bundle.overview);
      setCharts(bundle.charts);
      setFallback(Boolean(bundle.fallback));
      setSoftWarning((bundle as any).softWarning || null);
      setUpdatedAt(new Date());

      const topIds = (bundle.charts?.topProblems || [])
        .map((r: any) => String(r.problemId || r._id || "").trim())
        .filter(Boolean);
      if (topIds.length) {
        try {
          const titles = await adminProblemApi.lookupTitles(topIds);
          const map: Record<string, any> = {};
          for (const p of titles.data || []) map[String(p.id)] = p;
          setProblemMap((prev) => ({ ...prev, ...map }));
        } catch {
          /* titles optional */
        }
      }
    } catch (err: any) {
      setOverview(null);
      setCharts(null);
      setError({
        title: "Unable to load analytics",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Platform analytics services did not respond.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      lock.current = false;
    }
  }, [range]);

  const loadEnrichment = useCallback(async () => {
    const notes: string[] = [];
    const settled = await Promise.allSettled([
      adminProblemApi.favouriteAnalytics(),
      adminAnalyticsApi.topUsers("global"),
      adminLearningApi.sheetProgress(),
      adminLearningApi.topicEngagement(),
      adminLearningApi.weakTopics(),
      adminRealtimeApi.overview(),
      adminAnalyticsApi.executionHealth(),
      Promise.all(
        HEALTH_ENDPOINTS.map(async (e) => {
          const r = await pingHealthDetailed(e.url);
          return { name: e.name, status: r.status, ms: r.ms };
        })
      ),
    ]);

    if (settled[0].status === "fulfilled") {
      setFavouriteAnalytics(settled[0].value.data || null);
    } else {
      setFavouriteAnalytics(null);
      notes.push("favourites");
    }
    if (settled[1].status === "fulfilled") {
      setTopUsers(
        Array.isArray(settled[1].value.data) ? settled[1].value.data : []
      );
    } else {
      setTopUsers([]);
      notes.push("leaderboard");
    }
    if (settled[2].status === "fulfilled") {
      const raw = settled[2].value.data;
      setLearningSheets(Array.isArray(raw) ? raw : []);
    } else {
      setLearningSheets([]);
      notes.push("learning sheets");
    }
    if (settled[3].status === "fulfilled") {
      const raw = settled[3].value.data;
      setTopicEngagement(Array.isArray(raw) ? raw : []);
    } else {
      setTopicEngagement([]);
      notes.push("topic engagement");
    }
    if (settled[4].status === "fulfilled") {
      const raw = settled[4].value.data;
      setWeakTopics(Array.isArray(raw) ? raw : []);
    } else {
      setWeakTopics([]);
    }
    if (settled[5].status === "fulfilled") {
      setRealtime(settled[5].value.data || settled[5].value || null);
    } else {
      setRealtime(null);
      notes.push("realtime");
    }
    if (settled[6].status === "fulfilled") {
      const raw = settled[6].value;
      setExecHealth(raw?.data || raw || null);
    } else {
      setExecHealth(null);
      notes.push("execution health");
    }
    if (settled[7].status === "fulfilled") {
      setServiceHealth(settled[7].value);
    } else {
      setServiceHealth([]);
      notes.push("service health");
    }
    setEnrichNotes(notes);
  }, []);

  useEffect(() => {
    void loadCore(false);
  }, [loadCore]);

  useEffect(() => {
    void loadEnrichment();
  }, [loadEnrichment]);

  useEffect(() => {
    if (!autoMs) return;
    const id = window.setInterval(() => {
      void loadCore(true);
      void loadEnrichment();
    }, autoMs);
    return () => window.clearInterval(id);
  }, [autoMs, loadCore, loadEnrichment]);

  const kpis = overview?.kpis || {};
  const users = overview?.users || {};
  const problems = overview?.problems || {};
  const submissions = overview?.submissions || {};
  const compare = overview?.compare || {};

  const userGrowth = useMemo(() => {
    const rows = charts?.userGrowth || users?.growth || [];
    return Array.isArray(rows)
      ? rows.map((r: any) => ({
          date: String(r.date || r._id || ""),
          count: Number(r.count || 0),
        }))
      : [];
  }, [charts, users]);

  const submissionVolume = useMemo(() => {
    const series = (charts?.submissionSeries ||
      submissions?.series ||
      []) as Array<{ date: string; status?: string; count: number }>;
    const map = new Map<string, { date: string; count: number; accepted: number }>();
    for (const row of series) {
      const d = String(row.date || "");
      if (!d) continue;
      const cur = map.get(d) || { date: d, count: 0, accepted: 0 };
      const c = Number(row.count || 0);
      cur.count += c;
      if (String(row.status || "").toUpperCase() === "ACCEPTED") {
        cur.accepted += c;
      }
      map.set(d, cur);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [charts, submissions]);

  const activitySeries = useMemo(() => {
    if (activityMetric === "users") {
      return userGrowth.map((r) => ({ date: r.date, value: r.count }));
    }
    if (activityMetric === "accepted") {
      return submissionVolume.map((r) => ({ date: r.date, value: r.accepted }));
    }
    return submissionVolume.map((r) => ({ date: r.date, value: r.count }));
  }, [activityMetric, userGrowth, submissionVolume]);

  const verdictRows = useMemo(() => {
    const by = (charts?.submissionsByStatus ||
      submissions?.byStatus ||
      {}) as Record<string, number>;
    return Object.entries(by)
      .map(([name, value]) => ({
        name: humanizeStatus(name),
        raw: name,
        value: Number(value) || 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [charts, submissions]);

  const languageRows = useMemo(() => {
    const by = (charts?.languageUsage ||
      submissions?.byLanguage ||
      {}) as Record<string, number>;
    const total = Object.values(by).reduce((a, b) => a + Number(b || 0), 0);
    return Object.entries(by)
      .map(([name, value]) => ({
        name,
        value: Number(value) || 0,
        share: total > 0 ? Math.round((Number(value) / total) * 1000) / 10 : 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [charts, submissions]);

  const difficultyRows = useMemo(() => {
    const by = (charts?.difficultyDistribution ||
      problems?.byDifficulty ||
      {}) as Record<string, number>;
    return Object.entries(by)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: Number(value) || 0,
      }))
      .filter((r) => r.value > 0);
  }, [charts, problems]);

  const topicRows = useMemo(() => {
    const by = (charts?.topicDistribution || problems?.byTopic || {}) as Record<
      string,
      number
    >;
    return Object.entries(by)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [charts, problems]);

  const topProblems = useMemo(() => {
    const rows = (charts?.topProblems || submissions?.topProblems || []) as any[];
    return rows.slice(0, 10).map((r, i) => {
      const id = String(r.problemId || r._id || "");
      const meta = problemMap[id];
      return {
        rank: i + 1,
        problemId: id,
        title: meta?.title || id.slice(0, 10) + (id ? "…" : "—"),
        difficulty: meta?.difficulty || "—",
        attempts: Number(r.attempts ?? r.count ?? 0),
        accepted: Number(r.accepted ?? 0),
        acceptanceRate: Number(r.acceptanceRate ?? 0),
      };
    });
  }, [charts, submissions, problemMap]);

  const mostActiveUsers = useMemo(() => {
    const rows = (charts?.mostActiveUsers ||
      submissions?.mostActiveUsers ||
      []) as any[];
    return rows.slice(0, 10).map((r, i) => ({
      rank: i + 1,
      userId: String(r.userId || r._id || ""),
      submissions: Number(r.submissions ?? r.count ?? 0),
      accepted: Number(r.accepted ?? 0),
    }));
  }, [charts, submissions]);

  const favouriteRows = useMemo(() => {
    const rows = (favouriteAnalytics?.mostFavourited || []) as any[];
    return rows.slice(0, 8).map((r: any, i: number) => ({
      rank: i + 1,
      id: String(r.id || ""),
      title: String(r.title || r.slug || "—"),
      difficulty: String(r.difficulty || "—"),
      favouriteCount: Number(r.favouriteCount || 0),
      isPremium: Boolean(r.isPremium),
    }));
  }, [favouriteAnalytics]);

  const leaderboardTop = useMemo(
    () =>
      topUsers.slice(0, 10).map((r: any, i: number) => ({
        rank: Number(r.rank ?? i + 1),
        userId: String(r.userId || r._id || ""),
        userName: String(r.userName || r.username || r.name || ""),
        totalSolved: Number(r.totalSolved ?? 0),
        rating: Number(r.rating ?? r.score ?? 0),
      })),
    [topUsers]
  );

  const roleRows = useMemo(() => {
    const by = (users?.byRole || {}) as Record<string, number>;
    return Object.entries(by)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [users]);

  const insights = useMemo(() => {
    const out: string[] = [];
    if (!compareOn) return out;
    const nu = compare?.newUsers?.trendPct;
    const su = compare?.submissions?.trendPct;
    const ar = compare?.acceptanceRate?.trendPct;
    if (typeof nu === "number") {
      out.push(
        `New users ${nu >= 0 ? "increased" : "decreased"} ${Math.abs(nu)}% versus the previous period.`
      );
    }
    if (typeof su === "number") {
      out.push(
        `Submission volume ${su >= 0 ? "increased" : "decreased"} ${Math.abs(su)}% versus the previous period.`
      );
    }
    if (typeof ar === "number") {
      out.push(
        `Acceptance rate changed by ${ar > 0 ? "+" : ""}${ar} percentage points versus the previous period.`
      );
    }
    if (languageRows[0] && languageRows[0].share >= 40) {
      out.push(
        `${languageRows[0].name} accounts for ${languageRows[0].share}% of coded submissions.`
      );
    }
    if (weakTopics[0]) {
      out.push(
        `${weakTopics[0].topic} is a weak topic (${weakTopics[0].solveRate}% solve rate across ${weakTopics[0].attempted} attempts).`
      );
    }
    return out.slice(0, 5);
  }, [compareOn, compare, languageRows, weakTopics]);

  const learningActive = useMemo(() => {
    if (!learningSheets.length) return null;
    return learningSheets.reduce(
      (acc, s) => acc + Number(s.usersWithProgress || 0),
      0
    );
  }, [learningSheets]);

  const hasAnyData =
    Number(kpis.totalUsers || users.totalUsers || 0) > 0 ||
    Number(kpis.totalSubmissions || submissions.total || 0) > 0 ||
    Number(kpis.totalProblems || problems.total || 0) > 0 ||
    userGrowth.length > 0 ||
    submissionVolume.length > 0 ||
    verdictRows.length > 0;

  const degraded = Boolean(overview?.degraded || charts?.degraded || fallback);
  const trend = (v: unknown) => (compareOn ? numOrNull(v) : null);

  const onExport = async (format: "json" | "csv") => {
    try {
      setExporting(true);
      const res = await adminAnalyticsApi.exportDashboard(range, format);
      if (format === "csv") {
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `algopath-analytics-${range}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(res.data?.data ?? res.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `algopath-analytics-${range}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setSoftWarning(
        err?.response?.data?.message ||
          "Export failed — AnalyticsService export endpoint unavailable."
      );
    } finally {
      setExporting(false);
    }
  };

  const queue = execHealth?.queue || {};

  return (
    <PermissionGuard
      permission="analytics:view"
      fallback={<div className="admin-denied">No analytics permission.</div>}
    >
      <div className="ax-root">
        <header className="ax-header">
          <div className="ax-header-text">
            <h1>Analytics</h1>
            <p>
              Platform command center for users, submissions, problems, learning,
              and live system signals — sourced from AnalyticsService and sibling
              microservices.
            </p>
          </div>
          <div className="ax-controls" role="toolbar" aria-label="Analytics controls">
            <label className="sr-only" htmlFor="ax-range">
              Date range
            </label>
            <select
              id="ax-range"
              value={range}
              onChange={(e) => setRange(e.target.value as DashboardRange)}
              aria-label="Date range"
            >
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant={compareOn ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCompareOn((v) => !v)}
              aria-pressed={compareOn}
            >
              Compare
            </Button>
            <label className="sr-only" htmlFor="ax-auto">
              Auto refresh
            </label>
            <select
              id="ax-auto"
              value={autoMs}
              onChange={(e) => setAutoMs(Number(e.target.value))}
              aria-label="Auto refresh interval"
            >
              {AUTO_REFRESH.map((o) => (
                <option key={o.id} value={o.id}>
                  Auto {o.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={exporting}
              onClick={() => void onExport("csv")}
            >
              <Download size={14} />
              CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={exporting}
              onClick={() => void onExport("json")}
            >
              JSON
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => {
                void loadCore(true);
                void loadEnrichment();
              }}
            >
              {refreshing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh
            </Button>
          </div>
        </header>

        <div className="ax-filter-bar">
          <span className="ax-meta">
            Range: <strong>{RANGES.find((r) => r.id === range)?.label}</strong>
            {compareOn ? " · Comparing to previous equal window" : ""}
            {updatedAt
              ? ` · Updated ${updatedAt.toLocaleTimeString()}`
              : ""}
            {degraded ? " · Partial data" : ""}
            {fallback ? " · Direct service fan-in" : ""}
          </span>
        </div>

        {softWarning ? <div className="ax-banner warn">{softWarning}</div> : null}
        {enrichNotes.length ? (
          <div className="ax-banner">
            Partial enrichment unavailable: {enrichNotes.join(", ")}.
          </div>
        ) : null}

        {error ? (
          <WidgetError
            title={error.title}
            message={error.message}
            onRetry={() => void loadCore(false)}
          />
        ) : null}

        {!error && !loading && !hasAnyData ? (
          <EmptyState
            title="No analytics data yet"
            description="There isn't enough activity for this period. Try selecting a larger date range."
            icon={<BarChart3 size={18} strokeWidth={1.75} />}
          />
        ) : null}

        {/* KPI grid */}
        <section className="ax-section" aria-label="Key performance indicators">
          <div className="ax-section-head">
            <h2>Platform KPIs</h2>
            <p>Real aggregates from Auth, Problem, and Submission services</p>
          </div>
          <div className="ax-grid">
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Total users"
                value={fmt(kpis.totalUsers ?? users.totalUsers)}
                icon={<Users size={16} strokeWidth={1.75} />}
                trendPct={trend(kpis.newUsersTrendPct)}
                sparkline={sparkFromSeries(userGrowth)}
                loading={loading}
                unavailable={
                  !loading &&
                  numOrNull(kpis.totalUsers ?? users.totalUsers) === null
                }
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="New users"
                value={fmt(kpis.newUsersInRange ?? users.newUsersInRange)}
                icon={<Users size={16} strokeWidth={1.75} />}
                trendPct={trend(kpis.newUsersTrendPct)}
                loading={loading}
                unavailable={
                  !loading &&
                  numOrNull(kpis.newUsersInRange ?? users.newUsersInRange) ===
                    null
                }
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="DAU"
                value={fmt(kpis.dau ?? users.dau)}
                loading={loading}
                unavailable={!loading && numOrNull(kpis.dau ?? users.dau) === null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="WAU / MAU"
                value={`${fmt(kpis.wau ?? users.wau)} / ${fmt(kpis.mau ?? users.mau)}`}
                loading={loading}
              />
            </div>

            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Problems"
                value={fmt(kpis.totalProblems ?? problems.total)}
                icon={<FileCode2 size={16} strokeWidth={1.75} />}
                loading={loading}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Published / Draft"
                value={`${fmt(kpis.publishedProblems ?? problems.published)} / ${fmt(kpis.draftProblems ?? problems.draft)}`}
                loading={loading}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Problems solved"
                value={fmt(kpis.solvedProblems ?? submissions.solvedProblems)}
                loading={loading}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Favourites"
                value={
                  favouriteAnalytics
                    ? fmt(
                        Number(favouriteAnalytics.freeFavourites || 0) +
                          Number(favouriteAnalytics.premiumFavourites || 0)
                      )
                    : "—"
                }
                icon={<Star size={16} strokeWidth={1.75} />}
                loading={loading && !favouriteAnalytics}
                unavailable={!favouriteAnalytics && !loading}
              />
            </div>

            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Submissions (range)"
                value={fmt(kpis.rangeSubmissions ?? submissions.rangeTotal)}
                icon={<Activity size={16} strokeWidth={1.75} />}
                trendPct={trend(kpis.submissionsTrendPct)}
                sparkline={sparkFromSeries(
                  submissionVolume.map((r) => ({
                    date: r.date,
                    count: r.count,
                  }))
                )}
                loading={loading}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Accepted (range)"
                value={fmt(kpis.rangeAccepted ?? submissions.rangeAccepted)}
                trendPct={trend(kpis.acceptedTrendPct)}
                loading={loading}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Acceptance rate"
                value={pct(
                  kpis.rangeSuccessRate ??
                    submissions.rangeSuccessRate ??
                    kpis.successRate
                )}
                trendPct={trend(kpis.acceptanceTrendPct)}
                loading={loading}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Avg runtime / memory"
                value={`${fmt(charts?.avgExecutionTime ?? submissions.avgExecutionTime)} ms · ${fmt(charts?.avgMemory ?? submissions.avgMemory)}`}
                loading={loading}
              />
            </div>
          </div>
        </section>

        {/* Insights */}
        {insights.length > 0 ? (
          <section className="ax-section" aria-label="Insights">
            <div className="ax-section-head">
              <h2>Insights</h2>
              <p>Derived only from measured period deltas and aggregates</p>
            </div>
            <div className="ax-grid">
              {insights.map((text) => (
                <div key={text} className="ax-span-6">
                  <div className="ax-insight">{text}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Platform activity */}
        <section className="ax-section" aria-label="Platform activity">
          <div className="ax-section-head">
            <h2>Platform activity overview</h2>
            <div className="ax-seg" role="tablist" aria-label="Activity metric">
              {(
                [
                  ["users", "Users"],
                  ["submissions", "Submissions"],
                  ["accepted", "Accepted"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activityMetric === id}
                  className={activityMetric === id ? "active" : ""}
                  onClick={() => setActivityMetric(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="ax-grid">
            <div className="ax-span-8">
              <div className="ax-panel">
                <h3>
                  <Activity size={14} /> Time series
                </h3>
                <div className="ax-panel-body">
                  {loading ? (
                    <p className="admin-muted">Loading series…</p>
                  ) : activitySeries.length === 0 ? (
                    <EmptyState
                      title="No activity for this range"
                      description="Try a wider date range once submissions or registrations exist."
                      icon={<Activity size={16} strokeWidth={1.75} />}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activitySeries}>
                        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: CHART.tick, fontSize: 11 }}
                          minTickGap={24}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: CHART.tick, fontSize: 11 }}
                          width={40}
                        />
                        <Tooltip contentStyle={CHART.tooltip} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          name={
                            activityMetric === "users"
                              ? "New users"
                              : activityMetric === "accepted"
                                ? "Accepted"
                                : "Submissions"
                          }
                          stroke="var(--chart-1)"
                          fill="color-mix(in srgb, var(--chart-1) 28%, transparent)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
            <div className="ax-span-4">
              <div className="ax-panel">
                <h3>
                  <Users size={14} /> User growth
                </h3>
                <div className="ax-panel-body">
                  {loading ? (
                    <p className="admin-muted">Loading…</p>
                  ) : userGrowth.length === 0 ? (
                    <EmptyState
                      title="No registrations"
                      description="User growth appears when Auth signup events exist for the range."
                      icon={<Users size={16} strokeWidth={1.75} />}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={userGrowth}>
                        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: CHART.tick, fontSize: 10 }}
                          minTickGap={28}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: CHART.tick, fontSize: 11 }}
                          width={32}
                        />
                        <Tooltip contentStyle={CHART.tooltip} />
                        <Bar dataKey="count" name="New users" fill="var(--chart-3)" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Submission + difficulty */}
        <section className="ax-section" aria-label="Submission intelligence">
          <div className="ax-section-head">
            <h2>Submission intelligence</h2>
            <p>Verdict mix, languages, and catalog difficulty</p>
          </div>
          <div className="ax-grid">
            <div className="ax-span-4">
              <div className="ax-panel">
                <h3>Verdict mix</h3>
                <div className="ax-panel-body">
                  {verdictRows.length === 0 ? (
                    <EmptyState
                      title="No verdicts yet"
                      description="Status breakdown populates from submissions."
                      icon={<BarChart3 size={16} strokeWidth={1.75} />}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={verdictRows}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={78}
                          label={({ name, percent }) =>
                            `${name} ${Math.round((percent || 0) * 100)}%`
                          }
                        >
                          {verdictRows.map((r, i) => (
                            <Cell
                              key={r.raw}
                              fill={
                                STATUS_COLORS[r.raw] ||
                                PIE_COLORS[i % PIE_COLORS.length]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART.tooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
            <div className="ax-span-4">
              <div className="ax-panel">
                <h3>
                  <Code2 size={14} /> Language usage
                </h3>
                <div className="ax-panel-body">
                  {languageRows.length === 0 ? (
                    <EmptyState
                      title="No language data"
                      description="Language counts come from coded submissions."
                      icon={<Code2 size={16} strokeWidth={1.75} />}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={languageRows.slice(0, 8)}>
                        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: CHART.tick, fontSize: 11 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: CHART.tick, fontSize: 11 }}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={CHART.tooltip}
                          formatter={(value: any, _n, item: any) => [
                            `${Number(value).toLocaleString()} (${item?.payload?.share ?? 0}%)`,
                            "Submissions",
                          ]}
                        />
                        <Bar dataKey="value" fill="var(--chart-5)" name="Submissions" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
            <div className="ax-span-4">
              <div className="ax-panel">
                <h3>Difficulty distribution</h3>
                <div className="ax-panel-body">
                  {difficultyRows.length === 0 ? (
                    <EmptyState
                      title="No difficulty breakdown"
                      description="Catalog difficulty counts come from ProblemService."
                      icon={<BarChart3 size={16} strokeWidth={1.75} />}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={difficultyRows}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={78}
                          label
                        >
                          {difficultyRows.map((_, i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART.tooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problems + topics */}
        <section className="ax-section" aria-label="Problem intelligence">
          <div className="ax-section-head">
            <h2>Problem intelligence</h2>
            <p>Most attempted problems and catalog topics</p>
          </div>
          <div className="ax-grid">
            <div className="ax-span-8">
              <div className="ax-panel" style={{ minHeight: 320 }}>
                <h3>Most attempted problems</h3>
                <div className="ax-table-scroll">
                  <DataTable
                    loading={loading}
                    emptyTitle="No problem activity"
                    emptyDescription="Top problems appear once submissions reference problem IDs."
                    emptyIcon={<FileCode2 size={16} strokeWidth={1.75} />}
                    columns={[
                      { key: "rank", header: "#", render: (r) => r.rank },
                      {
                        key: "title",
                        header: "Problem",
                        render: (r) =>
                          r.problemId ? (
                            <button
                              type="button"
                              className="admin-link"
                              onClick={() =>
                                onNavigate?.("problem-editor", r.problemId)
                              }
                            >
                              {r.title}
                            </button>
                          ) : (
                            "—"
                          ),
                      },
                      {
                        key: "diff",
                        header: "Difficulty",
                        render: (r) => r.difficulty,
                      },
                      {
                        key: "attempts",
                        header: "Attempts",
                        render: (r) => r.attempts,
                      },
                      {
                        key: "accepted",
                        header: "Accepted",
                        render: (r) => r.accepted,
                      },
                      {
                        key: "rate",
                        header: "Accept %",
                        render: (r) => pct(r.acceptanceRate),
                      },
                    ]}
                    rows={topProblems}
                    rowKey={(r) => r.problemId || String(r.rank)}
                  />
                </div>
              </div>
            </div>
            <div className="ax-span-4">
              <div className="ax-panel">
                <h3>Top topics</h3>
                <div className="ax-panel-body">
                  {topicRows.length === 0 ? (
                    <EmptyState
                      title="No topic tags yet"
                      description="Topic distribution comes from problem tags."
                      icon={<BarChart3 size={16} strokeWidth={1.75} />}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topicRows}
                        layout="vertical"
                        margin={{ left: 8 }}
                      >
                        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fill: CHART.tick, fontSize: 11 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={90}
                          tick={{ fill: CHART.tick, fontSize: 10 }}
                        />
                        <Tooltip contentStyle={CHART.tooltip} />
                        <Bar dataKey="value" fill="var(--chart-1)" name="Problems" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Users + leaders */}
        <section className="ax-section" aria-label="User analytics">
          <div className="ax-section-head">
            <h2>User analytics</h2>
            <p>Active solvers, roles, and leaderboard</p>
          </div>
          <div className="ax-grid">
            <div className="ax-span-4">
              <div className="ax-panel" style={{ minHeight: 300 }}>
                <h3>Most active users</h3>
                <div className="ax-table-scroll">
                  <DataTable
                    loading={loading}
                    emptyTitle="No user activity"
                    emptyDescription="Active solvers appear when submission aggregates include user IDs."
                    emptyIcon={<Users size={16} strokeWidth={1.75} />}
                    columns={[
                      { key: "rank", header: "#", render: (r) => r.rank },
                      {
                        key: "user",
                        header: "User",
                        render: (r) =>
                          r.userId ? (
                            <button
                              type="button"
                              className="admin-link"
                              onClick={() =>
                                onNavigate?.("user-detail", r.userId)
                              }
                            >
                              {r.userId.slice(0, 10)}…
                            </button>
                          ) : (
                            "—"
                          ),
                      },
                      {
                        key: "subs",
                        header: "Subs",
                        render: (r) => r.submissions,
                      },
                    ]}
                    rows={mostActiveUsers}
                    rowKey={(r) => r.userId || String(r.rank)}
                  />
                </div>
              </div>
            </div>
            <div className="ax-span-4">
              <div className="ax-panel" style={{ minHeight: 300 }}>
                <h3>Users by role</h3>
                <div className="ax-table-scroll">
                  <DataTable
                    loading={loading}
                    emptyTitle="No role breakdown"
                    emptyDescription="Role counts come from Auth user-stats."
                    emptyIcon={<Users size={16} strokeWidth={1.75} />}
                    columns={[
                      { key: "name", header: "Role", render: (r) => r.name },
                      { key: "value", header: "Users", render: (r) => r.value },
                    ]}
                    rows={roleRows}
                    rowKey={(r) => r.name}
                  />
                </div>
              </div>
            </div>
            <div className="ax-span-4">
              <div className="ax-panel" style={{ minHeight: 300 }}>
                <h3>
                  <Trophy size={14} /> Platform leaders
                </h3>
                <div className="ax-table-scroll">
                  <DataTable
                    loading={false}
                    emptyTitle="No rankings yet"
                    emptyDescription="Global rankings come from LeaderboardService."
                    emptyIcon={<Trophy size={16} strokeWidth={1.75} />}
                    columns={[
                      { key: "rank", header: "#", render: (r) => r.rank },
                      {
                        key: "user",
                        header: "User",
                        render: (r) =>
                          r.userId ? (
                            <button
                              type="button"
                              className="admin-link"
                              onClick={() =>
                                onNavigate?.("user-detail", r.userId)
                              }
                            >
                              {r.userName || `${r.userId.slice(0, 10)}…`}
                            </button>
                          ) : (
                            "—"
                          ),
                      },
                      {
                        key: "solved",
                        header: "Solved",
                        render: (r) => r.totalSolved,
                      },
                      {
                        key: "rating",
                        header: "Rating",
                        render: (r) => r.rating,
                      },
                    ]}
                    rows={leaderboardTop}
                    rowKey={(r) => r.userId || String(r.rank)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Learning */}
        <section className="ax-section" aria-label="Learning intelligence">
          <div className="ax-section-head">
            <h2>
              <GraduationCap size={16} style={{ display: "inline" }} /> Learning
              intelligence
            </h2>
            <p>Sheet progress and topic engagement from ProblemService</p>
          </div>
          <div className="ax-grid">
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Active learners"
                value={fmt(learningActive)}
                unavailable={learningActive === null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Tracked sheets"
                value={fmt(learningSheets.length || null)}
                unavailable={!learningSheets.length}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Topics tracked"
                value={fmt(topicEngagement.length || null)}
                unavailable={!topicEngagement.length}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Weak topics"
                value={fmt(weakTopics.length || null)}
                unavailable={weakTopics.length === 0 && enrichNotes.includes("topic engagement")}
              />
            </div>
            <div className="ax-span-6">
              <div className="ax-panel" style={{ minHeight: 280 }}>
                <h3>Sheet performance</h3>
                <div className="ax-table-scroll">
                  <DataTable
                    loading={false}
                    emptyTitle="No sheet progress"
                    emptyDescription="Sheet analytics appear when learners start tracked sheets."
                    emptyIcon={<GraduationCap size={16} strokeWidth={1.75} />}
                    columns={[
                      {
                        key: "title",
                        header: "Sheet",
                        render: (r) => r.title || r.sheetId,
                      },
                      {
                        key: "users",
                        header: "Learners",
                        render: (r) => r.usersWithProgress,
                      },
                      {
                        key: "avg",
                        header: "Avg done",
                        render: (r) => r.avgCompleted,
                      },
                      {
                        key: "pct",
                        header: "Completion",
                        render: (r) => pct(r.completionPct),
                      },
                    ]}
                    rows={learningSheets.slice(0, 8)}
                    rowKey={(r) => String(r.sheetId || r.title)}
                  />
                </div>
              </div>
            </div>
            <div className="ax-span-6">
              <div className="ax-panel" style={{ minHeight: 280 }}>
                <h3>Topic engagement</h3>
                <div className="ax-table-scroll">
                  <DataTable
                    loading={false}
                    emptyTitle="No topic engagement"
                    emptyDescription="Topic solve rates populate from learning progress joins."
                    emptyIcon={<BarChart3 size={16} strokeWidth={1.75} />}
                    columns={[
                      { key: "topic", header: "Topic", render: (r) => r.topic },
                      {
                        key: "attempted",
                        header: "Attempted",
                        render: (r) => r.attempted,
                      },
                      {
                        key: "solved",
                        header: "Solved",
                        render: (r) => r.solved,
                      },
                      {
                        key: "rate",
                        header: "Solve %",
                        render: (r) => pct(r.solveRate),
                      },
                    ]}
                    rows={topicEngagement.slice(0, 10)}
                    rowKey={(r) => r.topic}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Favourites */}
        <section className="ax-section" aria-label="Engagement">
          <div className="ax-section-head">
            <h2>Engagement</h2>
            <p>Most favourited problems from ProblemService</p>
          </div>
          <div className="ax-grid">
            <div className="ax-span-12">
              <div className="ax-panel" style={{ minHeight: 260 }}>
                <h3>
                  <Star size={14} /> Most favourited
                </h3>
                <div className="ax-table-scroll">
                  <DataTable
                    loading={false}
                    emptyTitle="No favourites yet"
                    emptyDescription="Favourites populate from engagement collections."
                    emptyIcon={<Star size={16} strokeWidth={1.75} />}
                    columns={[
                      { key: "rank", header: "#", render: (r) => r.rank },
                      {
                        key: "title",
                        header: "Problem",
                        render: (r) =>
                          r.id ? (
                            <button
                              type="button"
                              className="admin-link"
                              onClick={() =>
                                onNavigate?.("problem-editor", r.id)
                              }
                            >
                              {r.title}
                            </button>
                          ) : (
                            r.title
                          ),
                      },
                      {
                        key: "diff",
                        header: "Difficulty",
                        render: (r) => r.difficulty,
                      },
                      {
                        key: "count",
                        header: "Favourites",
                        render: (r) => r.favouriteCount,
                      },
                      {
                        key: "tier",
                        header: "Tier",
                        render: (r) => (r.isPremium ? "Premium" : "Free"),
                      },
                    ]}
                    rows={favouriteRows}
                    rowKey={(r) => r.id || String(r.rank)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live + system */}
        <section className="ax-section" aria-label="Live and system">
          <div className="ax-section-head">
            <h2>
              <span className="ax-live">Live</span> Platform health
            </h2>
            <p>Realtime gateway and evaluation queue — no simulated metrics</p>
          </div>
          <div className="ax-grid">
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Online users"
                value={fmt(realtime?.onlineUsers)}
                icon={<Radio size={16} strokeWidth={1.75} />}
                unavailable={realtime?.onlineUsers == null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Active connections"
                value={fmt(realtime?.activeConnections)}
                unavailable={realtime?.activeConnections == null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Active rooms"
                value={fmt(realtime?.activeRooms)}
                unavailable={realtime?.activeRooms == null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Events / sec"
                value={fmt(realtime?.eventsPerSecond)}
                unavailable={realtime?.eventsPerSecond == null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Queue waiting"
                value={fmt(queue.waiting)}
                icon={<HeartPulse size={16} strokeWidth={1.75} />}
                unavailable={queue.waiting == null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Queue active"
                value={fmt(queue.active)}
                unavailable={queue.active == null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Queue failed"
                value={fmt(queue.failed)}
                unavailable={queue.failed == null}
              />
            </div>
            <div className="ax-span-3">
              <AnalyticsKpiCard
                label="Eval Redis"
                value={String(execHealth?.redis || "Unavailable")}
                unavailable={!execHealth?.redis}
              />
            </div>
            <div className="ax-span-12">
              <div className="ax-panel" style={{ minHeight: 0 }}>
                <h3>Service status</h3>
                <div className="ax-table-scroll">
                  <DataTable
                    loading={false}
                    emptyTitle="Health probes unavailable"
                    emptyDescription="Service health endpoints did not respond."
                    emptyIcon={<HeartPulse size={16} strokeWidth={1.75} />}
                    columns={[
                      {
                        key: "name",
                        header: "Service",
                        render: (r) => r.name,
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (r) => <StatusBadge status={r.status} />,
                      },
                      {
                        key: "ms",
                        header: "Latency",
                        render: (r) =>
                          r.ms != null ? `${r.ms} ms` : "Unavailable",
                      },
                    ]}
                    rows={serviceHealth}
                    rowKey={(r) => r.name}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PermissionGuard>
  );
};

export default AnalyticsPage;
