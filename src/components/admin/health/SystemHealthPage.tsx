import { useEffect, useState, type FC } from "react";
import {
  HEALTH_ENDPOINTS,
  pingHealth,
} from "../../../api/adminAnalyticsApi";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";

type HealthState = "healthy" | "offline" | "warning" | "checking";

export const SystemHealthPage: FC = () => {
  const [states, setStates] = useState<Record<string, HealthState>>({});

  const refresh = async () => {
    const next: Record<string, HealthState> = {};
    for (const ep of HEALTH_ENDPOINTS) next[ep.name] = "checking";
    setStates(next);
    await Promise.all(
      HEALTH_ENDPOINTS.map(async (ep) => {
        const status = await pingHealth(ep.url);
        setStates((prev) => ({ ...prev, [ep.name]: status }));
      })
    );
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <PermissionGuard
      permission="health:view"
      fallback={<div className="admin-denied">No health permission.</div>}
    >
      <div className="admin-toolbar">
        <button type="button" className="admin-btn primary" onClick={refresh}>
          Refresh
        </button>
        <span className="admin-muted">Live pings only — no invented metrics</span>
      </div>
      <div className="admin-stats-grid">
        {HEALTH_ENDPOINTS.map((ep) => (
          <div key={ep.name} className="admin-stat-card">
            <div className="label">{ep.name} Service</div>
            <div style={{ marginTop: 8 }}>
              <StatusBadge status={states[ep.name] || "checking"} />
            </div>
            <div className="admin-muted" style={{ marginTop: 8 }}>
              {ep.url}
            </div>
          </div>
        ))}
      </div>
    </PermissionGuard>
  );
};
