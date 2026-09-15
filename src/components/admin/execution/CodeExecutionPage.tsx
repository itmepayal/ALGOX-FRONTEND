import { useEffect, useState, type FC } from "react";
import { Cpu } from "lucide-react";
import {
  HEALTH_ENDPOINTS,
  pingHealth,
  adminAnalyticsApi,
} from "../../../api/adminAnalyticsApi";
import { StatsCard } from "../shared/StatsCard";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";

type QueueView =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | {
      status: "ready";
      waiting: number;
      running: number;
      failed: number;
    };

export const CodeExecutionPage: FC = () => {
  const [health, setHealth] = useState<
    Array<{ name: string; status: string; url: string }>
  >([]);
  const [kpis, setKpis] = useState<any>({});
  const [queue, setQueue] = useState<QueueView>({ status: "loading" });
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

      let nextQueue: QueueView = { status: "empty" };
      try {
        const h = await adminAnalyticsApi.executionHealth();
        const q = h.data?.queue || {};
        const waiting = Number(q.waiting);
        const running = Number(q.active ?? q.running);
        const failed = Number(q.failed);
        if (
          Number.isFinite(waiting) &&
          Number.isFinite(running) &&
          Number.isFinite(failed)
        ) {
          nextQueue = { status: "ready", waiting, running, failed };
        } else {
          nextQueue = { status: "empty" };
        }
      } catch (err: any) {
        nextQueue = {
          status: "error",
          message:
            err?.response?.data?.message ||
            err?.message ||
            "Evaluation health unavailable",
        };
      }

      if (cancelled) return;
      setHealth(rows);
      setKpis(overview);
      setQueue(nextQueue);
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
        Live service health + Evaluation BullMQ queue (waiting / running / failed).
        {updatedAt ? ` Updated ${new Date(updatedAt).toLocaleTimeString()}.` : ""}
      </p>
      <div className="admin-stats-grid" style={{ marginBottom: 14 }}>
        <StatsCard label="Submissions (range)" value={kpis.totalSubmissions ?? "—"} />
        <StatsCard label="Accepted rate" value={`${kpis.successRate ?? 0}%`} />
        <StatsCard label="Today submissions" value={kpis.todaySubmissions ?? "—"} />
      </div>
      <div className="admin-stats-grid" style={{ marginBottom: 14 }}>
        {queue.status === "loading" && (
          <div className="admin-stat-card admin-muted">Loading queue…</div>
        )}
        {queue.status === "error" && (
          <div className="admin-stat-card admin-muted">{queue.message}</div>
        )}
        {queue.status === "empty" && (
          <div className="admin-stat-card" style={{ gridColumn: "1 / -1" }}>
            <EmptyState
              compact
              icon={<Cpu size={18} strokeWidth={1.75} />}
              title="Queue metrics unavailable"
              description="Connect EvaluationService to inspect waiting, running, and failed jobs."
            />
          </div>
        )}
        {queue.status === "ready" && (
          <>
            <StatsCard label="Waiting" value={queue.waiting} />
            <StatsCard label="Running" value={queue.running} />
            <StatsCard label="Failed" value={queue.failed} />
          </>
        )}
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
