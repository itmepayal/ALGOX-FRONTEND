import { useCallback, useEffect, useMemo, useState, type FC } from "react";
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
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  adminAnalyticsApi,
  type DashboardRange,
} from "../../../api/adminAnalyticsApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { PageHeader } from "../shared/PageHeader";
import { StatsCard } from "../shared/StatsCard";
import { DataTable } from "../shared/DataTable";
import { EmptyState } from "../shared/EmptyState";
import { WidgetError } from "../shared/WidgetError";
import { Button } from "../../ui/button";
import type { AdminTab } from "../adminNav";
import "../shared/admin.css";

const RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "1y", label: "1 year" },
];

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#64748b",
];

interface AnalyticsPageProps {
  onNavigate?: (tab: AdminTab, id?: string) => void;
}

function fmt(n: unknown): string | number {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n);
}

function pct(n: unknown): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `${Number(n)}%`;
}

/**
 * Dedicated platform analytics workspace.
 * Data comes from AnalyticsService overview/charts (with existing fan-in fallback).
 * Not an alias of the ops Dashboard.
 */
export const AnalyticsPage: FC<AnalyticsPageProps> = ({ onNavigate }) => {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null
  );
  const [overview, setOverview] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [fallback, setFallback] = useState(false);
  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSoftWarning(null);
    try {
      const bundle = await adminAnalyticsApi.loadDashboard(range);
      setOverview(bundle.overview);
      setCharts(bundle.charts);
      setFallback(Boolean(bundle.fallback));
      setSoftWarning((bundle as any).softWarning || null);
      setUpdatedAt(new Date());
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
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = overview?.kpis || {};
  const users = overview?.users || {};
  const problems = overview?.problems || {};
  const submissions = overview?.submissions || {};

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
    const map = new Map<string, number>();
    for (const row of series) {
      const d = String(row.date || "");
      if (!d) continue;
      map.set(d, (map.get(d) || 0) + Number(row.count || 0));
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [charts, submissions]);

  const verdictRows = useMemo(() => {
    const by =
      (charts?.submissionsByStatus ||
        submissions?.byStatus ||
        {}) as Record<string, number>;
    return Object.entries(by)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [charts, submissions]);

  const languageRows = useMemo(() => {
    const by =
      (charts?.languageUsage ||
        submissions?.byLanguage ||
        {}) as Record<string, number>;
    return Object.entries(by)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [charts, submissions]);

  const difficultyRows = useMemo(() => {
    const by =
      (charts?.difficultyDistribution ||
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
    const by =
      (charts?.topicDistribution || problems?.byTopic || {}) as Record<
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
    const rows = (charts?.topProblems ||
      submissions?.topProblems ||
      []) as any[];
    return rows.slice(0, 10).map((r, i) => ({
      rank: i + 1,
      problemId: String(r.problemId || r._id || ""),
      attempts: Number(r.attempts ?? r.count ?? 0),
      accepted: Number(r.accepted ?? 0),
      acceptanceRate: Number(r.acceptanceRate ?? 0),
    }));
  }, [charts, submissions]);

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

  const hasAnyData =
    Number(kpis.totalUsers || users.totalUsers || 0) > 0 ||
    Number(kpis.totalSubmissions || submissions.total || 0) > 0 ||
    Number(kpis.totalProblems || problems.total || 0) > 0 ||
    userGrowth.length > 0 ||
    submissionVolume.length > 0 ||
    verdictRows.length > 0;

  const degraded = Boolean(overview?.degraded || charts?.degraded || fallback);

  return (
    <PermissionGuard
      permission="analytics:view"
      fallback={<div className="admin-denied">No analytics permission.</div>}
    >
      <PageHeader
        title="Platform analytics"
        description="User growth, submissions, verdicts, languages, and catalog activity from platform services for the selected range."
        meta={
          updatedAt ? (
            <span>
              Updated {updatedAt.toLocaleTimeString()}
              {degraded ? " · Partial data" : ""}
              {fallback ? " · Direct service fan-in" : ""}
            </span>
          ) : null
        }
        actions={
          <div className="admin-toolbar" style={{ margin: 0, gap: 8 }}>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as DashboardRange)}
              aria-label="Analytics range"
            >
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        }
      />

      {softWarning ? (
        <p className="admin-muted" style={{ marginBottom: 12 }}>
          {softWarning}
        </p>
      ) : null}

      {error ? (
        <WidgetError
          title={error.title}
          message={error.message}
          onRetry={() => void load()}
        />
      ) : null}

      {loading ? (
        <p className="admin-muted">Loading analytics…</p>
      ) : null}

      {!loading && !error && !hasAnyData ? (
        <EmptyState
          title="No analytics data yet"
          description="Metrics appear once users register and submissions are recorded."
          icon={<BarChart3 size={18} strokeWidth={1.75} />}
        />
      ) : null}

      {!loading && !error && hasAnyData ? (
        <>
          <div className="admin-stats-grid" style={{ marginBottom: 16 }}>
            <StatsCard
              label="Total users"
              value={fmt(kpis.totalUsers ?? users.totalUsers)}
            />
            <StatsCard label="DAU" value={fmt(kpis.dau ?? users.dau)} />
            <StatsCard label="WAU" value={fmt(kpis.wau ?? users.wau)} />
            <StatsCard label="MAU" value={fmt(kpis.mau ?? users.mau)} />
            <StatsCard
              label="Submissions"
              value={fmt(kpis.totalSubmissions ?? submissions.total)}
            />
            <StatsCard
              label="Accepted"
              value={fmt(kpis.acceptedSubmissions ?? submissions.accepted)}
            />
            <StatsCard
              label="Acceptance rate"
              value={pct(kpis.successRate ?? submissions.successRate)}
            />
            <StatsCard
              label="Problems"
              value={fmt(kpis.totalProblems ?? problems.total)}
            />
            <StatsCard
              label="Avg runtime (ms)"
              value={fmt(
                charts?.avgExecutionTime ?? submissions.avgExecutionTime
              )}
            />
            <StatsCard
              label="Avg memory"
              value={fmt(charts?.avgMemory ?? submissions.avgMemory)}
            />
          </div>

          <div className="admin-charts">
            <div className="admin-chart-card">
              <h3>
                <Users size={14} /> User registrations
              </h3>
              {userGrowth.length === 0 ? (
                <EmptyState
                  title="No registration series"
                  description="Daily registrations will show when Auth user-stats include growth data."
                  icon={<TrendingUp size={16} strokeWidth={1.75} />}
                />
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={userGrowth}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="date"
                        hide={userGrowth.length > 40}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        fill="#3b82f680"
                        name="Registrations"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="admin-chart-card">
              <h3>
                <Activity size={14} /> Submission volume
              </h3>
              {submissionVolume.length === 0 ? (
                <EmptyState
                  title="No submission series"
                  description="Daily submission counts appear when SubmissionService returns a series for this range."
                  icon={<Activity size={16} strokeWidth={1.75} />}
                />
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={submissionVolume}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="date"
                        hide={submissionVolume.length > 40}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22c55e" name="Submissions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="admin-chart-card">
              <h3>Verdict mix</h3>
              {verdictRows.length === 0 ? (
                <EmptyState
                  title="No verdicts yet"
                  description="Status breakdown populates from submissions in range."
                  icon={<BarChart3 size={16} strokeWidth={1.75} />}
                />
              ) : (
                <div style={{ height: 240 }}>
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
                        {verdictRows.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="admin-chart-card">
              <h3>
                <Code2 size={14} /> Language usage
              </h3>
              {languageRows.length === 0 ? (
                <EmptyState
                  title="No language data"
                  description="Language counts come from coded submissions."
                  icon={<Code2 size={16} strokeWidth={1.75} />}
                />
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={languageRows}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#a855f7" name="Submissions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="admin-chart-card">
              <h3>Problem difficulty</h3>
              {difficultyRows.length === 0 ? (
                <EmptyState
                  title="No difficulty breakdown"
                  description="Catalog difficulty counts appear from ProblemService stats."
                  icon={<BarChart3 size={16} strokeWidth={1.75} />}
                />
              ) : (
                <div style={{ height: 240 }}>
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
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="admin-chart-card">
              <h3>Top topics</h3>
              {topicRows.length === 0 ? (
                <EmptyState
                  title="No topic tags yet"
                  description="Topic distribution comes from problem tags in catalog stats."
                  icon={<BarChart3 size={16} strokeWidth={1.75} />}
                />
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicRows} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip />
                      <Bar dataKey="value" fill="#06b6d4" name="Problems" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
              marginTop: 16,
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 8px" }}>Most attempted problems</h3>
              <DataTable
                loading={false}
                emptyTitle="No problem activity"
                emptyDescription="Top problems appear once submissions reference problem IDs."
                emptyIcon={<Activity size={16} strokeWidth={1.75} />}
                columns={[
                  { key: "rank", header: "#", render: (r) => r.rank },
                  {
                    key: "id",
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
                          {r.problemId.slice(0, 10)}…
                        </button>
                      ) : (
                        "—"
                      ),
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
            <div>
              <h3 style={{ margin: "0 0 8px" }}>Most active users</h3>
              <DataTable
                loading={false}
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
                    header: "Submissions",
                    render: (r) => r.submissions,
                  },
                  {
                    key: "acc",
                    header: "Accepted",
                    render: (r) => r.accepted,
                  },
                ]}
                rows={mostActiveUsers}
                rowKey={(r) => r.userId || String(r.rank)}
              />
            </div>
          </div>
        </>
      ) : null}
    </PermissionGuard>
  );
};

export default AnalyticsPage;
