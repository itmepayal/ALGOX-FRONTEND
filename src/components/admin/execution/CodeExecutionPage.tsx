import { useCallback, useEffect, useState, type FC, type ReactNode } from "react";
import {
  AlertTriangle,
  Cpu,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import {
  HEALTH_ENDPOINTS,
  pingHealthDetailed,
  adminAnalyticsApi,
} from "../../../api/adminAnalyticsApi";
import { StatsCard } from "../shared/StatsCard";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { Button } from "../../ui/button";

const AUTO_REFRESH_MS = 15_000;

type LoadState = "loading" | "ready" | "error" | "empty";

type QueueSnapshot = {
  status?: string;
  waiting?: number;
  active?: number;
  completed?: number;
  failed?: number;
  delayed?: number;
  paused?: number;
  configuredWorkers?: number;
  error?: string;
  /** Raw keys returned by EvaluationService (for transparency). */
  raw: Record<string, unknown>;
};

type HealthSnapshot = {
  service?: string;
  redis?: string;
  queue: QueueSnapshot | null;
  checkedAt: string;
  latencyMs: number | null;
};

/** APIs that would deepen the console but are not exposed by EvaluationService. */
const MISSING_APIS: Array<{ name: string; purpose: string; needed: string }> = [
  {
    name: "Active / pending job list",
    purpose: "Inspect BullMQ waiting & active jobs (id, submissionId, age)",
    needed: "GET EvaluationService admin queue jobs (read-only, RBAC)",
  },
  {
    name: "Completed / failed job list",
    purpose: "Browse recent job outcomes and failure reasons from the queue",
    needed: "GET EvaluationService admin queue jobs?state=completed|failed",
  },
  {
    name: "Execution latency",
    purpose: "p50 / p95 judge duration and queue wait time",
    needed: "Latency metrics on /health or a dedicated metrics endpoint",
  },
  {
    name: "Recent execution events",
    purpose: "Live worker start/finish stream for this console",
    needed: "Realtime ingest of execution.* events or an events admin API",
  },
];

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function queueStatusTone(
  status: string | undefined
): "published" | "draft" | "archived" {
  if (status === "healthy") return "published";
  if (status === "degraded") return "draft";
  return "archived";
}

function parseQueue(raw: unknown): QueueSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  return {
    status: q.status != null ? String(q.status) : undefined,
    waiting: num(q.waiting) ?? undefined,
    active: num(q.active ?? q.running) ?? undefined,
    completed: num(q.completed) ?? undefined,
    failed: num(q.failed) ?? undefined,
    delayed: num(q.delayed) ?? undefined,
    paused: num(q.paused) ?? undefined,
    configuredWorkers: num(q.configuredWorkers) ?? undefined,
    error: q.error != null ? String(q.error) : undefined,
    raw: q,
  };
}

const Kv: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
    <dt className="admin-muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
      {label}
    </dt>
    <dd className="m-0 text-right font-medium" style={{ fontSize: "0.875rem" }}>
      {children}
    </dd>
  </div>
);

export const CodeExecutionPage: FC = () => {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [submissionPing, setSubmissionPing] = useState<{
    status: string;
    ms: number | null;
    error?: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      else setLoadState("loading");
      setError("");

      const evalEp = HEALTH_ENDPOINTS.find((e) => e.name === "Evaluation");
      const subEp = HEALTH_ENDPOINTS.find((e) => e.name === "Submission");

      const started = performance.now();
      const [healthRes, subPing] = await Promise.all([
        adminAnalyticsApi.executionHealth(),
        subEp
          ? pingHealthDetailed(subEp.url)
          : Promise.resolve({
              status: "offline" as const,
              ms: null,
              error: "Submission health URL not configured",
            }),
      ]);
      const latencyMs = Math.round(performance.now() - started);

      const data = healthRes.data;
      const queue = parseQueue(data?.queue);
      const checkedAt = new Date().toISOString();

      setSubmissionPing({
        status: subPing.status,
        ms: subPing.ms,
        error: subPing.error,
      });
      setLastChecked(checkedAt);

      if (!data || (!data.queue && !data.redis && !data.service)) {
        setSnapshot(null);
        setLoadState("empty");
        return;
      }

      setSnapshot({
        service: data.service,
        redis: data.redis,
        queue,
        checkedAt,
        latencyMs: evalEp ? latencyMs : null,
      });

      if (queue?.status === "unavailable" && queue.error) {
        setLoadState("ready");
        setError(queue.error);
        return;
      }

      setLoadState("ready");
    } catch (err: any) {
      setSnapshot(null);
      setLoadState("error");
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "EvaluationService /health unavailable"
      );
      setLastChecked(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const q = snapshot?.queue;
  const hasCounts =
    q &&
    [q.waiting, q.active, q.completed, q.failed].some(
      (n) => typeof n === "number"
    );

  return (
    <PermissionGuard
      permission="health:view"
      fallback={<div className="admin-denied">No permission.</div>}
    >
      <div className="admin-toolbar" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px" }}>
          <p className="admin-page-lead" style={{ margin: 0 }}>
            Operational console for EvaluationService — BullMQ queue + Redis from{" "}
            <code>/api/v1/health</code> only. No Docker shell or host commands.
          </p>
          <p className="admin-muted" style={{ margin: "6px 0 0" }}>
            Last checked {formatClock(lastChecked)}
            {snapshot?.latencyMs != null ? ` · health fetch ${snapshot.latencyMs} ms` : ""}
            {` · auto-refresh ${AUTO_REFRESH_MS / 1000}s`}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void load(true)}
          disabled={refreshing || loadState === "loading"}
          aria-label="Refresh execution health"
        >
          {refreshing || loadState === "loading" ? (
            <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
          ) : (
            <RefreshCw size={14} strokeWidth={1.75} />
          )}
          Refresh
        </Button>
      </div>

      {loadState === "loading" && !snapshot ? (
        <div className="admin-panel" style={{ padding: 24 }}>
          <p className="admin-muted" style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
            <Loader2 size={16} className="animate-spin" />
            Loading EvaluationService health…
          </p>
        </div>
      ) : null}

      {loadState === "error" && !snapshot ? (
        <div className="admin-panel" style={{ padding: 16 }}>
          <EmptyState
            icon={<AlertTriangle size={18} strokeWidth={1.75} />}
            title="EvaluationService unreachable"
            description={error || "Could not load /api/v1/health."}
          />
        </div>
      ) : null}

      {loadState === "empty" ? (
        <div className="admin-panel" style={{ padding: 16 }}>
          <EmptyState
            icon={<Cpu size={18} strokeWidth={1.75} />}
            title="No health payload"
            description="EvaluationService responded but returned no service/queue/redis fields."
          />
        </div>
      ) : null}

      {snapshot ? (
        <>
          {error ? (
            <p className="admin-muted" style={{ marginBottom: 10, color: "var(--destructive, #b91c1c)" }}>
              Queue note: {error}
            </p>
          ) : null}

          <div className="admin-stats-grid" style={{ marginBottom: 14 }}>
            <div className="admin-stat-card">
              <div className="label">Queue health</div>
              <div style={{ margin: "8px 0" }}>
                <StatusBadge
                  status={queueStatusTone(q?.status)}
                />
              </div>
              <div className="admin-muted" style={{ fontSize: "0.75rem" }}>
                {q?.status || "unknown"}
                {q?.error ? ` — ${q.error}` : ""}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="label">Redis</div>
              <div style={{ margin: "8px 0" }}>
                <StatusBadge
                  status={
                    snapshot.redis === "connected" ? "published" : "archived"
                  }
                />
              </div>
              <div className="admin-muted" style={{ fontSize: "0.75rem" }}>
                {snapshot.redis || "—"}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="label">Service</div>
              <div style={{ margin: "8px 0", fontWeight: 600 }}>
                {snapshot.service || "EvaluationService"}
              </div>
              <div className="admin-muted" style={{ fontSize: "0.75rem" }}>
                Source: EvaluationService GET /health
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="label">Submission (dependency ping)</div>
              <div style={{ margin: "8px 0" }}>
                <StatusBadge
                  status={
                    submissionPing?.status === "healthy"
                      ? "published"
                      : submissionPing?.status === "warning"
                        ? "draft"
                        : "archived"
                  }
                />
              </div>
              <div className="admin-muted" style={{ fontSize: "0.75rem" }}>
                {submissionPing?.ms != null
                  ? `${submissionPing.ms} ms`
                  : submissionPing?.error || "—"}
                {" · HTTP ping only"}
              </div>
            </div>
          </div>

          <section className="admin-panel" style={{ marginBottom: 14 }} aria-label="Queue status">
            <div className="admin-panel-head">
              <div>
                <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Queue status</h3>
                <p className="admin-panel-desc">
                  BullMQ job counts from EvaluationService (not fabricated)
                </p>
              </div>
            </div>
            <div className="admin-panel-body">
              {!hasCounts ? (
                <EmptyState
                  compact
                  icon={<Server size={18} strokeWidth={1.75} />}
                  title="Queue counts unavailable"
                  description={
                    q?.error ||
                    "waiting / active / completed / failed were not present in the health payload."
                  }
                />
              ) : (
                <div className="admin-stats-grid">
                  <StatsCard label="Waiting (queued)" value={formatNumber(q?.waiting)} />
                  <StatsCard label="Active jobs" value={formatNumber(q?.active)} />
                  <StatsCard label="Completed jobs" value={formatNumber(q?.completed)} />
                  <StatsCard label="Failed jobs" value={formatNumber(q?.failed)} />
                  <StatsCard label="Delayed" value={formatNumber(q?.delayed)} />
                  <StatsCard label="Paused" value={formatNumber(q?.paused)} />
                  <StatsCard
                    label="Configured workers"
                    value={formatNumber(q?.configuredWorkers)}
                  />
                </div>
              )}
            </div>
            <p className="admin-panel-foot">
              Snapshot at {formatClock(snapshot.checkedAt)}. Worker count is the
              configured concurrency constant from EvaluationService, not a live
              process census.
            </p>
          </section>

          <section className="admin-panel" style={{ marginBottom: 14 }} aria-label="Health details">
            <div className="admin-panel-head">
              <div>
                <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Health details</h3>
                <p className="admin-panel-desc">Fields returned by EvaluationService</p>
              </div>
            </div>
            <div className="admin-panel-body">
              <dl style={{ margin: 0 }}>
                <Kv label="Service">{snapshot.service || "—"}</Kv>
                <Kv label="Redis">{snapshot.redis || "—"}</Kv>
                <Kv label="Queue status">{q?.status || "—"}</Kv>
                <Kv label="Waiting">{formatNumber(q?.waiting)}</Kv>
                <Kv label="Active">{formatNumber(q?.active)}</Kv>
                <Kv label="Completed">{formatNumber(q?.completed)}</Kv>
                <Kv label="Failed">{formatNumber(q?.failed)}</Kv>
                <Kv label="Delayed">{formatNumber(q?.delayed)}</Kv>
                <Kv label="Paused">{formatNumber(q?.paused)}</Kv>
                <Kv label="Configured workers">
                  {formatNumber(q?.configuredWorkers)}
                </Kv>
              </dl>
            </div>
          </section>
        </>
      ) : null}

      <section className="admin-panel" aria-label="APIs not available">
        <div className="admin-panel-head">
          <div>
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
              Not available from EvaluationService
            </h3>
            <p className="admin-panel-desc">
              Reported gaps — UI does not invent mock jobs, latency, or events
            </p>
          </div>
        </div>
        <div className="admin-panel-body">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {MISSING_APIS.map((item) => (
              <li key={item.name} style={{ marginBottom: 10 }}>
                <strong>{item.name}</strong>
                <div className="admin-muted" style={{ fontSize: "0.8rem" }}>
                  {item.purpose}
                </div>
                <div className="admin-muted" style={{ fontSize: "0.75rem" }}>
                  Needed: {item.needed}
                </div>
              </li>
            ))}
          </ul>
          <p className="admin-muted" style={{ marginTop: 12, marginBottom: 0, fontSize: "0.75rem" }}>
            Failed submission outcomes (WA/RE/TLE) remain on Submissions → Failed
            Executions (SubmissionService), not Evaluation queue job lists.
          </p>
        </div>
      </section>
    </PermissionGuard>
  );
};
