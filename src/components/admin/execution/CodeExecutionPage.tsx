import { useEffect, useState, type FC } from "react";
import {
  HEALTH_ENDPOINTS,
  pingHealth,
  adminAnalyticsApi,
} from "../../../api/adminAnalyticsApi";
import { StatsCard } from "../shared/StatsCard";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";

export const CodeExecutionPage: FC = () => {
  const [health, setHealth] = useState<
    Array<{ name: string; status: string; url: string }>
  >([]);
  const [kpis, setKpis] = useState<any>({});
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await Promise.all(
        HEALTH_ENDPOINTS.filter((e) =>
          ["Submission", "Evaluation"].includes(e.name)
        ).map(async (e) => ({
          name: e.name,
          url: e.url,
          status: await pingHealth(e.url),
        }))
      );
      let overview: any = null;
      try {
        const o = await adminAnalyticsApi.overview("7d");
        overview = o.data?.kpis || {};
      } catch {
        overview = {};
      }
      if (cancelled) return;
      setHealth(rows);
      setKpis(overview);
      setUpdatedAt(new Date().toISOString());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PermissionGuard
      permission="health:view"
      fallback={<div className="admin-denied">No permission.</div>}
    >
      <p className="admin-muted" style={{ marginBottom: 12 }}>
        Live service health + submission KPIs. Deep queue/worker heartbeats require
        EvaluationService queue metrics endpoints (next infra pass).
        {updatedAt ? ` Updated ${new Date(updatedAt).toLocaleTimeString()}.` : ""}
      </p>
      <div className="admin-stats-grid" style={{ marginBottom: 14 }}>
        <StatsCard label="Submissions (range)" value={kpis.totalSubmissions ?? "—"} />
        <StatsCard label="Accepted rate" value={`${kpis.successRate ?? 0}%`} />
        <StatsCard label="Today submissions" value={kpis.todaySubmissions ?? "—"} />
      </div>
      <div className="admin-stats-grid">
        {health.map((h) => (
          <div key={h.name} className="admin-stat-card">
            <div className="label">{h.name}</div>
            <div style={{ margin: "8px 0" }}>
              <StatusBadge status={h.status === "healthy" ? "published" : "archived"} />
            </div>
            <div className="admin-muted" style={{ fontSize: "0.72rem" }}>
              {h.url}
            </div>
          </div>
        ))}
      </div>
    </PermissionGuard>
  );
};
