import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
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
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";

const COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#64748b"];

export const SubmissionAnalyticsPage: FC = () => {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Record<string, any> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminSubmissionApi.internalStats(days);
      setStats(res.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusData = useMemo(() => {
    const by = (stats?.byStatus || {}) as Record<string, number>;
    return Object.entries(by).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const langData = useMemo(() => {
    const by = (stats?.byLanguage || {}) as Record<string, number>;
    return Object.entries(by).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const volumeByDay = useMemo(() => {
    const series = (stats?.series || []) as Array<{
      date: string;
      status: string;
      count: number;
    }>;
    const map: Record<string, number> = {};
    for (const s of series) {
      map[s.date] = (map[s.date] || 0) + s.count;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [stats]);

  const failRate = useMemo(() => {
    const total = Number(stats?.total || 0);
    const accepted = Number(stats?.accepted || 0);
    if (!total) return 0;
    return Math.round(((total - accepted) / total) * 1000) / 10;
  }, [stats]);

  return (
    <PermissionGuard
      permission="analytics:view"
      fallback={<div className="admin-denied">No analytics permission.</div>}
    >
      <p className="admin-page-lead">
        Live submission volume, acceptance, languages, and failure mix from
        SubmissionService.
      </p>
      <div className="admin-toolbar">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {loading ? <p className="admin-muted">Loading…</p> : null}
      {!loading && stats ? (
        <>
          <div className="admin-stats-grid" style={{ marginBottom: 16 }}>
            <StatsCard label="Total submissions" value={stats.total ?? 0} />
            <StatsCard label="Accepted" value={stats.accepted ?? 0} />
            <StatsCard
              label="Acceptance %"
              value={stats.successRate ?? 0}
            />
            <StatsCard label="Failure %" value={failRate} />
            <StatsCard
              label="Avg time (ms)"
              value={stats.avgExecutionTime ?? "—"}
            />
            <StatsCard label="Avg memory" value={stats.avgMemory ?? "—"} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            <div style={{ height: 260 }}>
              <h4>Status distribution</h4>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ height: 260 }}>
              <h4>Language usage</h4>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={langData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ height: 260, gridColumn: "1 / -1" }}>
              <h4>Volume trend ({days}d)</h4>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={volumeByDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" hide={volumeByDay.length > 40} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </PermissionGuard>
  );
};
