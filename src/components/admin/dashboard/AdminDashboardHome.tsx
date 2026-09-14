import { useCallback, useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import {
  Area,
  AreaChart,
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
  Bell,
  CheckCircle2,
  Cpu,
  FileCode2,
  Gauge,
  Plus,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  Trophy,
  Users,
  BookOpen,
  Megaphone,
  Flag,
  AlertTriangle,
} from "lucide-react";
import {
  adminAnalyticsApi,
  HEALTH_ENDPOINTS,
  pingHealth,
} from "../../../api/adminAnalyticsApi";
import { adminAuthApi } from "../../../api/adminAuthApi";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import { adminRealtimeApi } from "../../../api/adminRealtimeApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";
import { DataTable } from "../shared/DataTable";
import { hasPermission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";
import type { AdminTab } from "../adminNav";
import { WidgetError } from "../shared/WidgetError";
import { normalizeApiError } from "../../../lib/apiError";
import { useToast } from "../../../context/ToastContext";
import "./dashboard.css";

const RANGES = [
  { id: "today", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const STATUS_COLORS: Record<string, string> = {
  ACCEPTED: "#34d399",
  WRONG_ANSWER: "#fbbf24",
  RUNTIME_ERROR: "#f87171",
  COMPILATION_ERROR: "#fb7185",
  TIME_LIMIT_EXCEEDED: "#38bdf8",
  MEMORY_LIMIT_EXCEEDED: "#a78bfa",
  PENDING: "#94a3b8",
  RUNNING: "#818cf8",
  SYSTEM_ERROR: "#ef4444",
};

const CHART_TOOLTIP = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  fontSize: 12,
};

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
  if (sec < 5) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

interface AdminDashboardHomeProps {
  onNavigate?: (tab: AdminTab, id?: string) => void;
}

export const AdminDashboardHome: FC<AdminDashboardHomeProps> = ({
  onNavigate,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const [range, setRange] = useState<RangeId>("30d");
  const [overview, setOverview] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "ok">(
    "idle"
  );
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subsError, setSubsError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [subsLoading, setSubsLoading] = useState(true);

  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [health, setHealth] = useState<
    Array<{ name: string; status: "healthy" | "offline" | "warning"; url: string }>
  >([]);
  const [rt, setRt] = useState<{ ok: boolean; data?: any; error?: string }>({
    ok: false,
  });

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRefreshState("loading");
    try {
      const [o, c] = await Promise.all([
        adminAnalyticsApi.overview(range),
        adminAnalyticsApi.charts(range),
      ]);
      setOverview(o.data);
      setCharts(c.data);
      setUpdatedAt(new Date());
      setRefreshState("ok");
      window.setTimeout(() => setRefreshState("idle"), 900);
    } catch (err: unknown) {
      const n = normalizeApiError(err);
      setError({ title: n.title, message: n.message });
      toast.apiError(err, "Unable to load platform analytics");
      setRefreshState("idle");
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  const loadSide = useCallback(async () => {
    setSubsLoading(true);
    setSubsError(null);
    try {
      const [subsRes, healthRows, rtRes, audit] = await Promise.all([
        adminSubmissionApi.list({ page: 1, limit: 12 }).catch((e) => {
          throw e;
        }),
        Promise.all(
          HEALTH_ENDPOINTS.map(async (e) => ({
            name: e.name,
            url: e.url,
            status: await pingHealth(e.url),
          }))
        ),
        adminRealtimeApi.overview().then(
          (res) => ({ ok: true as const, data: res.data || res }),
          (err: unknown) => {
            const n = normalizeApiError(err);
            return {
              ok: false as const,
              error: n.message,
            };
          }
        ),
        hasPermission(user?.role, "audit:view")
          ? adminAuthApi.listAuditLogs({ page: 1, limit: 12 }).catch(() => ({
              data: [],
            }))
          : Promise.resolve({ data: [] as any[] }),
      ]);
      setSubmissions(subsRes.data || []);
      setHealth(healthRows);
      setRt(rtRes);
      setAuditRows(audit.data || []);
    } catch (err: unknown) {
      const n = normalizeApiError(err);
      setSubsError({ title: n.title, message: n.message });
      setSubmissions([]);
    } finally {
      setSubsLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadSide();
  }, [loadSide, tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 45000);
    return () => window.clearInterval(id);
  }, []);

  const refreshAll = async () => {
    await Promise.all([loadCore(), loadSide()]);
  };

  const kpis = overview?.kpis || {};
  const submissionsBlock = overview?.submissions || {};
  const byStatus: Record<string, number> = charts?.submissionsByStatus || {};
  const statusTotal = Object.values(byStatus).reduce(
    (a, b) => a + Number(b || 0),
    0
  );

  const statusData = useMemo(
    () =>
      Object.entries(byStatus)
        .map(([name, value]) => ({ name, value: Number(value) }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [byStatus]
  );

  const activitySeries = useMemo(() => {
    const series = charts?.submissionSeries || [];
    if (!Array.isArray(series) || series.length === 0) return [];
    const byDate = new Map<
      string,
      { date: string; submissions: number; accepted: number; users?: number }
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

  const topProblems = useMemo(() => {
    const rows = charts?.topProblems || [];
    return Array.isArray(rows) ? rows.slice(0, 8) : [];
  }, [charts]);

  const pending = Number(byStatus.PENDING || 0);
  const running = Number(byStatus.RUNNING || 0);
  const accepted = Number(
    submissionsBlock.accepted ?? byStatus.ACCEPTED ?? kpis.acceptedSubmissions ?? 0
  );
  const failedExec =
    Number(byStatus.RUNTIME_ERROR || 0) +
    Number(byStatus.COMPILATION_ERROR || 0) +
    Number(byStatus.TIME_LIMIT_EXCEEDED || 0) +
    Number(byStatus.MEMORY_LIMIT_EXCEEDED || 0);

  const offlineServices = health.filter((h) => h.status === "offline");
  const warningServices = health.filter((h) => h.status === "warning");
  const healthyCount = health.filter((h) => h.status === "healthy").length;
  const systemHealthLabel =
    health.length === 0
      ? "—"
      : offlineServices.length > 0
        ? "Degraded"
        : warningServices.length > 0
          ? "Warning"
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
        description: `Health check failed for ${s.url}`,
        at: new Date().toISOString(),
      });
    }
    for (const s of warningServices) {
      items.push({
        severity: "WARNING",
        title: `${s.name} degraded`,
        description: `Non-OK response from ${s.url}`,
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
  }, [offlineServices, warningServices, pending, rt]);

  const liveActivity = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      entity: string;
      when: string;
      icon: ReactNode;
    }> = [];
    for (const s of submissions.slice(0, 8)) {
      const id = String(s.id || s._id);
      items.push({
        id: `sub-${id}`,
        title: `Submission ${s.status || "updated"}`,
        entity: `Problem ${s.problemId || "—"} · ${s.language || "—"}`,
        when: s.createdAt || s.updatedAt,
        icon: <FileCode2 size={14} color="#a5b4fc" />,
      });
    }
    for (const a of auditRows.slice(0, 4)) {
      items.push({
        id: `audit-${a.id || a.action}-${a.createdAt}`,
        title: a.action || "Admin action",
        entity: `${a.resource || "—"}${a.resourceId ? ` · ${a.resourceId}` : ""}`,
        when: a.createdAt,
        icon: <ShieldAlert size={14} color="#fbbf24" />,
      });
    }
    return items
      .sort(
        (a, b) =>
          new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime()
      )
      .slice(0, 12);
  }, [submissions, auditRows]);

  const execCritical = offlineServices.some((s) =>
    ["Submission", "Evaluation"].includes(s.name)
  );

  return (
    <PermissionGuard
      permission="analytics:view"
      fallback={<div className="admin-denied">No analytics permission.</div>}
    >
      <div className="admin-dash">
        <header className="admin-dash-header">
          <div>
            <h2>Dashboard</h2>
            <p className="admin-dash-sub">
              Monitor AlgoPath platform activity, performance, and infrastructure.
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
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="admin-btn"
              onClick={() => void refreshAll()}
              aria-label="Refresh dashboard"
              disabled={refreshState === "loading"}
            >
              <RefreshCw size={14} />
              {refreshState === "loading"
                ? "Refreshing"
                : refreshState === "ok"
                  ? "Updated"
                  : "Refresh"}
            </button>
            <button
              type="button"
              className="admin-icon-btn"
              aria-label="Announcements"
              title="Announcements"
              onClick={() => onNavigate?.("announcements")}
            >
              <Bell size={16} />
            </button>
            <span className="admin-dash-updated">
              Last updated:{" "}
              {updatedAt ? relativeTime(updatedAt.toISOString()) : "—"}
            </span>
          </div>
        </header>

        {error ? (
          <div className="admin-alert admin-alert-error" role="alert">
            <div className="admin-alert-icon" aria-hidden>
              <AlertTriangle size={18} />
            </div>
            <div className="admin-alert-body">
              <strong>Unable to load platform analytics</strong>
              <p>{error.message}</p>
              <p className="admin-alert-hint">
                KPI cards and charts may be incomplete. System health and live
                panels below still use independent checks.
              </p>
            </div>
            <button
              type="button"
              className="admin-btn admin-alert-action"
              onClick={() => void loadCore()}
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : null}

        <section className="admin-kpi-grid" aria-label="Key metrics">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="admin-kpi">
                  <div className="admin-skel" style={{ height: 14, width: "40%" }} />
                  <div className="admin-skel" style={{ height: 28, width: "55%" }} />
                  <div className="admin-skel" style={{ height: 10, width: "70%" }} />
                </div>
              ))
            : (
              <>
                <Kpi
                  icon={<Users size={15} />}
                  label="Total Users"
                  value={formatNumber(kpis.totalUsers)}
                  meta={`Last updated · ${updatedAt ? relativeTime(updatedAt.toISOString()) : "—"}`}
                />
                <Kpi
                  icon={<Activity size={15} />}
                  label="Active Users"
                  value={formatNumber(kpis.dau)}
                  meta={`DAU · WAU ${formatNumber(kpis.wau)} · MAU ${formatNumber(kpis.mau)}`}
                />
                <Kpi
                  icon={<BookOpen size={15} />}
                  label="Problems"
                  value={formatNumber(
                    kpis.totalProblems ??
                      Number(kpis.publishedProblems || 0) +
                        Number(kpis.draftProblems || 0)
                  )}
                  meta={`Published ${formatNumber(kpis.publishedProblems)} · Drafts ${formatNumber(kpis.draftProblems)}`}
                />
                <Kpi
                  icon={<FileCode2 size={15} />}
                  label="Submissions"
                  value={formatNumber(kpis.totalSubmissions)}
                  meta={`Today ${formatNumber(kpis.todaySubmissions)}`}
                />
                <Kpi
                  icon={<Gauge size={15} />}
                  label="Acceptance Rate"
                  value={`${kpis.successRate ?? 0}%`}
                  meta="Official submit ACCEPTED / total"
                />
                <Kpi
                  icon={<CheckCircle2 size={15} />}
                  label="Solved Problems"
                  value={formatNumber(accepted)}
                  meta="Accepted submissions (excl. run)"
                />
                <Kpi
                  icon={<Cpu size={15} />}
                  label="Running Executions"
                  value={formatNumber(running)}
                  meta={`Pending ${formatNumber(pending)}`}
                />
                <Kpi
                  icon={<Server size={15} />}
                  label="System Health"
                  value={systemHealthLabel}
                  meta={`${healthyCount}/${health.length || 0} services healthy`}
                />
              </>
            )}
        </section>

        <div className="admin-dash-grid">
          <section className="admin-panel span-8" aria-label="Platform activity">
            <div className="admin-panel-head">
              <h3>Platform Activity</h3>
              <span className="hint">Submissions / Accepted · {range}</span>
            </div>
            {loading ? (
              <div className="admin-skel" style={{ height: 220 }} />
            ) : activitySeries.length === 0 ? (
              <div className="admin-empty-soft">
                No submission activity yet.
                <br />
                Your platform hasn&apos;t generated enough data for this chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={activitySeries}>
                  <defs>
                    <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={28} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    name="Submissions"
                    stroke="#6366f1"
                    fill="url(#gSub)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="accepted"
                    name="Accepted"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="admin-panel span-4" aria-label="Submission overview">
            <div className="admin-panel-head">
              <h3>Submission Overview</h3>
            </div>
            {loading ? (
              <div className="admin-skel" style={{ height: 220 }} />
            ) : statusData.length === 0 ? (
              <div className="admin-empty-soft">No status breakdown yet.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                    >
                      {statusData.map((d) => (
                        <Cell key={d.name} fill={STATUS_COLORS[d.name] || "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="admin-breakdown">
                  {statusData.map((d) => (
                    <div key={d.name} className="admin-breakdown-row">
                      <span>{d.name.replace(/_/g, " ")}</span>
                      <span style={{ color: "#e2e8f0" }}>{formatNumber(d.value)}</span>
                      <span>{pct(d.value, statusTotal)}</span>
                      <div className="bar">
                        <i
                          style={{
                            width: pct(d.value, statusTotal),
                            background: STATUS_COLORS[d.name] || "#64748b",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="admin-panel span-5" aria-label="Live activity">
            <div className="admin-panel-head">
              <h3>Live Activity</h3>
              <span className="hint">Submissions + audit</span>
            </div>
            {subsLoading && liveActivity.length === 0 ? (
              <div className="admin-skel" style={{ height: 180 }} />
            ) : liveActivity.length === 0 ? (
              <div className="admin-empty-soft">No recent platform events.</div>
            ) : (
              <div className="admin-activity-list">
                {liveActivity.map((ev) => (
                  <div key={ev.id} className="admin-activity-item">
                    <div>{ev.icon}</div>
                    <div>
                      <div className="title">{ev.title}</div>
                      <div className="entity">{ev.entity}</div>
                    </div>
                    <div className="when">{relativeTime(ev.when)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel span-4" aria-label="Code execution">
            <div className="admin-panel-head">
              <h3>Code Execution</h3>
              <span className="admin-rt-status">
                <span className={`admin-status-dot ${execCritical ? "offline" : "healthy"}`} />
                {execCritical ? "Critical" : "Healthy"}
              </span>
            </div>
            <div className="admin-engage-grid">
              <MetricCell label="Queued" value={formatNumber(pending)} />
              <MetricCell label="Running" value={formatNumber(running)} />
              <MetricCell label="Accepted" value={formatNumber(accepted)} />
              <MetricCell label="Failed" value={formatNumber(failedExec)} />
              <MetricCell
                label="Timeout"
                value={formatNumber(byStatus.TIME_LIMIT_EXCEEDED || 0)}
              />
              <MetricCell label="Avg runtime" value="Metric unavailable" />
              <MetricCell label="Queue wait" value="Metric unavailable" />
              <MetricCell label="Workers" value="Metric unavailable" />
            </div>
            <p className="admin-muted" style={{ fontSize: "0.72rem", margin: 0 }}>
              Queue / worker CPU metrics are not exposed by EvaluationService yet.
            </p>
          </section>

          <section className="admin-panel span-3" aria-label="System health">
            <div className="admin-panel-head">
              <h3>System Health</h3>
            </div>
            {health.length === 0 ? (
              <div className="admin-skel" style={{ height: 160 }} />
            ) : (
              health.map((h) => (
                <div key={h.name} className="admin-svc-row">
                  <div className="admin-svc-left">
                    <span
                      className={`admin-status-dot ${
                        h.status === "healthy"
                          ? "healthy"
                          : h.status === "warning"
                            ? "degraded"
                            : "offline"
                      }`}
                    />
                    <span>{h.name}</span>
                  </div>
                  <span className="admin-muted" style={{ fontSize: "0.7rem" }}>
                    {h.status}
                  </span>
                </div>
              ))
            )}
            <div className="admin-svc-row">
              <div className="admin-svc-left">
                <span className={`admin-status-dot ${rt.ok ? "healthy" : "unknown"}`} />
                <span>WebSocket</span>
              </div>
              <span className="admin-muted" style={{ fontSize: "0.7rem" }}>
                {rt.ok ? "healthy" : "not configured / offline"}
              </span>
            </div>
          </section>

          <section className="admin-panel span-7" aria-label="Problem performance">
            <div className="admin-panel-head">
              <h3>Problem Performance</h3>
              <button
                type="button"
                className="admin-link"
                onClick={() => onNavigate?.("problems")}
              >
                View all problems →
              </button>
            </div>
            {topProblems.length === 0 ? (
              <div className="admin-empty-soft">
                Not enough submission volume to rank problems in this range.
              </div>
            ) : (
              <DataTable
                emptyTitle="No problems"
                columns={[
                  {
                    key: "rank",
                    header: "#",
                    render: (r) => (
                      <span className={`admin-rank ${Number(r.__rank) <= 3 ? "top" : ""}`}>
                        {r.__rank}
                      </span>
                    ),
                  },
                  {
                    key: "problem",
                    header: "Problem",
                    render: (r) =>
                      r.title ||
                      r.problemTitle ||
                      String(r.problemId || "—").slice(0, 14),
                  },
                  {
                    key: "diff",
                    header: "Difficulty",
                    render: (r) =>
                      r.difficulty ? (
                        <StatusBadge status={String(r.difficulty)} />
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "attempts",
                    header: "Attempts",
                    render: (r) => formatNumber(r.count ?? r.attempts),
                  },
                  {
                    key: "ac",
                    header: "Accepted",
                    render: (r) =>
                      r.accepted != null ? formatNumber(r.accepted) : "—",
                  },
                  {
                    key: "rate",
                    header: "Acceptance",
                    render: (r) =>
                      r.acceptanceRate != null ? `${r.acceptanceRate}%` : "—",
                  },
                ]}
                rows={topProblems.map((r: any, i: number) => ({
                  ...r,
                  __rank: i + 1,
                }))}
                rowKey={(r) => String(r.problemId || r._id || r.__rank)}
              />
            )}
          </section>

          <section className="admin-panel span-5" aria-label="User engagement">
            <div className="admin-panel-head">
              <h3>User Engagement</h3>
            </div>
            <div className="admin-engage-grid">
              <MetricCell label="DAU" value={formatNumber(kpis.dau)} />
              <MetricCell label="WAU" value={formatNumber(kpis.wau)} />
              <MetricCell label="MAU" value={formatNumber(kpis.mau)} />
              <MetricCell label="Total users" value={formatNumber(kpis.totalUsers)} />
              <MetricCell
                label="Today submissions"
                value={formatNumber(kpis.todaySubmissions)}
              />
              <MetricCell label="Accepted" value={formatNumber(accepted)} />
            </div>
            {(charts?.userGrowth || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={charts.userGrowth}>
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#38bdf8"
                    fill="rgba(56,189,248,0.15)"
                    strokeWidth={2}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="admin-empty-soft" style={{ padding: 12 }}>
                No user growth series for this range.
              </div>
            )}
          </section>

          <section className="admin-panel span-4" aria-label="Realtime operations">
            <div className="admin-panel-head">
              <h3>Real-Time Operations</h3>
              <span className="admin-rt-status">
                <span className={`admin-status-dot ${rt.ok ? "healthy" : "unknown"}`} />
                {rt.ok ? "Operational" : "Not configured"}
              </span>
            </div>
            {rt.ok ? (
              <div className="admin-engage-grid">
                <MetricCell
                  label="Connections"
                  value={formatNumber(
                    rt.data?.activeConnections ?? rt.data?.data?.activeConnections
                  )}
                />
                <MetricCell
                  label="Events/sec"
                  value={adminRealtimeApi.metricOrUnavailable(
                    rt.data?.eventsPerSecond ?? rt.data?.data?.eventsPerSecond
                  )}
                />
                <MetricCell
                  label="Online users"
                  value={formatNumber(
                    rt.data?.onlineUsers ?? rt.data?.data?.onlineUsers
                  )}
                />
                <MetricCell
                  label="Latency"
                  value={adminRealtimeApi.metricOrUnavailable(
                    rt.data?.avgLatencyMs ?? rt.data?.data?.avgLatencyMs
                  )}
                />
              </div>
            ) : (
              <div className="admin-empty-soft">
                Socket.IO infrastructure is not currently reachable.
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => onNavigate?.("realtime")}
                  >
                    <Radio size={14} /> Configure Real-Time →
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="admin-panel span-4" aria-label="Quick actions">
            <div className="admin-panel-head">
              <h3>Quick Actions</h3>
            </div>
            <div className="admin-qa-grid">
              <Qa icon={<Plus size={14} />} label="Create Problem" onClick={() => onNavigate?.("problem-editor")} />
              <Qa icon={<FileCode2 size={14} />} label="Add Test Case" onClick={() => onNavigate?.("problem-test-cases")} />
              <Qa icon={<Users size={14} />} label="Manage Users" onClick={() => onNavigate?.("users")} />
              <Qa icon={<Activity size={14} />} label="View Submissions" onClick={() => onNavigate?.("submissions")} />
              <Qa icon={<Megaphone size={14} />} label="Create Announcement" onClick={() => onNavigate?.("announcements")} />
              <Qa icon={<Trophy size={14} />} label="Create Contest" onClick={() => onNavigate?.("leaderboards-contest")} />
            </div>
          </section>

          <section className="admin-panel span-4" aria-label="System alerts">
            <div className="admin-panel-head">
              <h3>System Alerts</h3>
              <Flag size={14} color="#94a3b8" />
            </div>
            {alerts.length === 0 ? (
              <div className="admin-empty-soft">No active alerts from health checks.</div>
            ) : (
              alerts.map((a, i) => (
                <div key={`${a.title}-${i}`} className="admin-alert-item">
                  <div className="admin-alert-top">
                    <StatusBadge status={a.severity.toLowerCase()} />
                    {a.title}
                  </div>
                  <div className="admin-muted" style={{ fontSize: "0.72rem" }}>
                    {a.description}
                  </div>
                  <div className="admin-muted" style={{ fontSize: "0.68rem" }}>
                    {relativeTime(a.at)}
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="admin-panel span-12" aria-label="Recent submissions">
            <div className="admin-panel-head">
              <h3>Recent Submissions</h3>
              <button
                type="button"
                className="admin-link"
                onClick={() => onNavigate?.("submissions")}
              >
                Open live feed →
              </button>
            </div>
            {subsError ? (
              <WidgetError
                compact
                title={subsError.title}
                message={subsError.message}
                onRetry={() => void loadSide()}
              />
            ) : (
              <DataTable
                loading={subsLoading}
                emptyTitle="No recent submissions."
                columns={[
                  {
                    key: "user",
                    header: "User",
                    render: (r) => String(r.userId || "—").slice(0, 10),
                  },
                  {
                    key: "problem",
                    header: "Problem",
                    render: (r) => String(r.problemId || "—").slice(0, 10),
                  },
                  {
                    key: "lang",
                    header: "Language",
                    render: (r) => r.language || "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => (
                      <StatusBadge status={String(r.status || "pending")} />
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
                    render: (r) => (r.memory != null ? `${r.memory} KB` : "—"),
                  },
                  {
                    key: "time",
                    header: "Time",
                    render: (r) => relativeTime(r.createdAt),
                  },
                ]}
                rows={submissions}
                rowKey={(r) => String(r.id || r._id)}
              />
            )}
          </section>
        </div>
      </div>
    </PermissionGuard>
  );
};

const Kpi: FC<{
  icon: ReactNode;
  label: string;
  value: string | number;
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
  <div className="admin-engage-cell">
    <div className="l">{label}</div>
    <div
      className="v"
      style={{
        fontSize:
          typeof value === "string" && String(value).includes("unavailable")
            ? "0.78rem"
            : undefined,
      }}
    >
      {value}
    </div>
  </div>
);

const Qa: FC<{
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ icon, label, onClick }) => (
  <button type="button" className="admin-qa-btn" onClick={onClick}>
    {icon}
    {label}
  </button>
);
