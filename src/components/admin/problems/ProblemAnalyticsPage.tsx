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
import { adminProblemApi } from "../../../api/adminProblemApi";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";
import { StatusBadge } from "../shared/StatusBadge";

const COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#64748b"];

export const ProblemAnalyticsPage: FC = () => {
  const [problems, setProblems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [problemMeta, setProblemMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminProblemApi.list({ page: 1, limit: 100 });
        if (!cancelled) setProblems(res.data || []);
      } catch {
        if (!cancelled) setProblems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) {
      setStats(null);
      setProblemMeta(null);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [sRes, pRes] = await Promise.all([
        adminSubmissionApi.problemStats(selectedId, days),
        adminProblemApi.getById(selectedId),
      ]);
      setStats(sRes.data || null);
      setProblemMeta(pRes.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [selectedId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const quality = useMemo(() => {
    const flags: string[] = [];
    if (!problemMeta) return flags;
    const tcs = problemMeta.testcases || problemMeta.testCases || [];
    if (!tcs.length) flags.push("Missing test cases");
    if (!problemMeta.examples?.length && !problemMeta.description) {
      flags.push("Thin description / examples");
    }
    if (!problemMeta.constraints) flags.push("Missing constraints");
    if ((stats?.acceptanceRate ?? 100) < 15 && (stats?.totalAttempts || 0) > 20) {
      flags.push("Low acceptance rate");
    }
    const by = (stats?.byStatus || {}) as Record<string, number>;
    const attempts = Number(stats?.totalAttempts || 0) || 1;
    if ((by.RUNTIME_ERROR || 0) / attempts > 0.25) {
      flags.push("High runtime error rate");
    }
    if ((by.TIME_LIMIT_EXCEEDED || 0) / attempts > 0.2) {
      flags.push("High TLE rate");
    }
    return flags;
  }, [problemMeta, stats]);

  const statusData = useMemo(() => {
    const by = (stats?.byStatus || {}) as Record<string, number>;
    return Object.entries(by).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const langData = useMemo(() => {
    const by = (stats?.byLanguage || {}) as Record<string, number>;
    return Object.entries(by).map(([name, value]) => ({ name, value }));
  }, [stats]);

  return (
    <PermissionGuard
      permission="analytics:view"
      fallback={<div className="admin-denied">No analytics permission.</div>}
    >
      <p className="admin-page-lead">
        Per-problem attempt/accept metrics from real submissions. Quality flags
        combine problem metadata + failure mix.
      </p>
      <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ minWidth: 260 }}
        >
          <option value="">Select a problem…</option>
          {problems.map((p) => (
            <option key={p.id || p._id} value={p.id || p._id}>
              {p.title} ({p.status})
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7d series</option>
          <option value={30}>30d series</option>
          <option value={90}>90d series</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
        {problemMeta?.status ? (
          <StatusBadge status={problemMeta.status} />
        ) : null}
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {!selectedId ? (
        <p className="admin-muted">Choose a problem to load analytics.</p>
      ) : loading ? (
        <p className="admin-muted">Loading…</p>
      ) : stats ? (
        <>
          <div className="admin-stats-grid" style={{ marginBottom: 16 }}>
            <StatsCard label="Attempts" value={stats.totalAttempts ?? 0} />
            <StatsCard label="Accepted" value={stats.totalAccepted ?? 0} />
            <StatsCard label="Acceptance %" value={stats.acceptanceRate ?? 0} />
            <StatsCard label="Failed" value={stats.failedCount ?? 0} />
            <StatsCard
              label="Avg time"
              value={stats.avgExecutionTime ?? "—"}
            />
            <StatsCard label="Avg memory" value={stats.avgMemory ?? "—"} />
            <StatsCard
              label="Top fail"
              value={stats.mostCommonFailureStatus || "—"}
            />
          </div>
          {quality.length ? (
            <div style={{ marginBottom: 12 }}>
              <strong>Quality indicators</strong>
              <ul>
                {quality.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="admin-muted">No quality warnings for this problem.</p>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <div style={{ height: 240 }}>
              <h4>Status mix</h4>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={75}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ height: 240 }}>
              <h4>Languages</h4>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={langData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#a855f7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </PermissionGuard>
  );
};
