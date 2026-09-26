import { useCallback, useEffect, useState, type FC, type ReactNode } from "react";
import {
  Cpu,
  Database,
  Layers,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";
import {
  HEALTH_ENDPOINTS,
  pingHealthDetailed,
  adminAnalyticsApi,
} from "../../../api/adminAnalyticsApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { WidgetError } from "../shared/WidgetError";
import "./code-execution.css";

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
  raw: Record<string, unknown>;
};

type HealthSnapshot = {
  service?: string;
  redis?: string;
  queue: QueueSnapshot | null;
  checkedAt: string;
  latencyMs: number | null;
};

const MISSING_TELEMETRY = [
  {
    name: "Active / Pending Job Details",
    purpose: "Inspect BullMQ waiting & active jobs (id, submissionId, age)",
    needed: "GET EvaluationService admin queue jobs (read-only, RBAC)",
  },
  {
    name: "Job Outcomes History",
    purpose: "Browse recent job outcomes and failure reasons from the queue",
    needed: "GET EvaluationService admin queue jobs?state=completed|failed",
  },
  {
    name: "Execution Latency Metrics",
    purpose: "p50 / p95 judge duration and queue wait time",
    needed: "Latency metrics on /health or a dedicated metrics endpoint",
  },
  {
    name: "Recent Execution Events Stream",
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

const KvRow: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="admin-execution-kv-row">
    <dt className="admin-execution-kv-label">{label}</dt>
    <dd className="m-0 text-right font-medium">{children}</dd>
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

  return (
    <PermissionGuard
      permission="health:view"
      fallback={<div className="admin-denied">No health permission.</div>}
    >
      <div className="admin-execution-page">
        {/* Header Toolbar */}
        <div className="admin-execution-header-toolbar">
          <div className="admin-execution-header-info">
            <p className="admin-page-lead">
              Operational console for EvaluationService — BullMQ queue + Redis metrics from <code>/api/v1/health</code>.
            </p>
            <div className="admin-execution-header-meta">
              Last checked {formatClock(lastChecked)}
              {snapshot?.latencyMs != null ? ` · fetch latency ${snapshot.latencyMs} ms` : ""}
              {` · auto-refresh ${AUTO_REFRESH_MS / 1000}s`}
            </div>
          </div>

          <div className="admin-execution-header-actions">
            <StatusBadge status={queueStatusTone(q?.status)} />
            <button
              type="button"
              className="admin-btn"
              disabled={refreshing || loadState === "loading"}
              onClick={() => void load(true)}
            >
              <RefreshCw
                size={14}
                strokeWidth={1.75}
                className={refreshing || loadState === "loading" ? "animate-spin" : undefined}
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error State */}
        {loadState === "error" && !snapshot ? (
          <WidgetError
            title="EvaluationService Unreachable"
            message={error || "Could not load /api/v1/health response."}
            onRetry={() => void load(true)}
          />
        ) : null}

        {/* Empty State */}
        {loadState === "empty" ? (
          <div className="admin-execution-card">
            <EmptyState
              icon={<Cpu size={20} strokeWidth={1.75} />}
              title="No health payload"
              description="EvaluationService responded but returned no service/queue/redis metrics."
            />
          </div>
        ) : null}

        {snapshot ? (
          <>
            {error ? (
              <div className="admin-user-detail-alert error" style={{ marginBottom: 4 }}>
                <span>Queue note: {error}</span>
              </div>
            ) : null}

            {/* 4 Top Health KPI Cards */}
            <div className="admin-execution-health-grid">
              <div className="admin-execution-health-card">
                <div className="admin-execution-health-head">
                  <span className="admin-execution-health-label">Queue Health</span>
                  <div className="admin-execution-health-icon">
                    <Layers size={18} strokeWidth={1.75} />
                  </div>
                </div>
                <div className="admin-execution-health-body">
                  <StatusBadge status={queueStatusTone(q?.status)} />
                </div>
                <div className="admin-execution-health-sub">
                  Status: <strong>{q?.status || "unknown"}</strong>
                  {q?.error ? ` — ${q.error}` : ""}
                </div>
              </div>

              <div className="admin-execution-health-card">
                <div className="admin-execution-health-head">
                  <span className="admin-execution-health-label">Redis Status</span>
                  <div className="admin-execution-health-icon">
                    <Database size={18} strokeWidth={1.75} />
                  </div>
                </div>
                <div className="admin-execution-health-body">
                  <StatusBadge
                    status={
                      snapshot.redis === "connected" ? "published" : "archived"
                    }
                  />
                </div>
                <div className="admin-execution-health-sub">
                  State: <strong>{snapshot.redis || "—"}</strong>
                </div>
              </div>

              <div className="admin-execution-health-card">
                <div className="admin-execution-health-head">
                  <span className="admin-execution-health-label">Evaluation Service</span>
                  <div className="admin-execution-health-icon">
                    <Server size={18} strokeWidth={1.75} />
                  </div>
                </div>
                <div className="admin-execution-health-body">
                  <span className="admin-execution-health-title">
                    {snapshot.service || "EvaluationService"}
                  </span>
                </div>
                <div className="admin-execution-health-sub">
                  Source: GET /health
                </div>
              </div>

              <div className="admin-execution-health-card">
                <div className="admin-execution-health-head">
                  <span className="admin-execution-health-label">Submission Dependency</span>
                  <div className="admin-execution-health-icon">
                    <Zap size={18} strokeWidth={1.75} />
                  </div>
                </div>
                <div className="admin-execution-health-body">
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
                <div className="admin-execution-health-sub">
                  {submissionPing?.ms != null
                    ? `${submissionPing.ms} ms`
                    : submissionPing?.error || "—"}
                  {" · HTTP ping"}
                </div>
              </div>
            </div>

            {/* Queue Overview Panel */}
            <section className="admin-execution-queue-panel">
              <div className="admin-execution-panel-head">
                <h3 className="admin-execution-panel-title">Queue Overview</h3>
                <p className="admin-execution-panel-sub">
                  BullMQ job counts from EvaluationService (not fabricated)
                </p>
              </div>

              <div className="admin-execution-queue-grid">
                <div className="admin-execution-queue-cell">
                  <span className="admin-execution-cell-label">Waiting</span>
                  <span className="admin-execution-cell-val">{formatNumber(q?.waiting)}</span>
                </div>

                <div className="admin-execution-queue-cell">
                  <span className="admin-execution-cell-label">Active</span>
                  <span className="admin-execution-cell-val">{formatNumber(q?.active)}</span>
                </div>

                <div className="admin-execution-queue-cell">
                  <span className="admin-execution-cell-label">Completed</span>
                  <span className="admin-execution-cell-val">{formatNumber(q?.completed)}</span>
                </div>

                <div className={`admin-execution-queue-cell ${q?.failed && q.failed > 0 ? "has-error" : ""}`}>
                  <span className="admin-execution-cell-label">Failed</span>
                  <span className="admin-execution-cell-val" style={{ color: q?.failed && q.failed > 0 ? "#fca5a5" : undefined }}>
                    {formatNumber(q?.failed)}
                  </span>
                </div>

                <div className={`admin-execution-queue-cell ${q?.delayed && q.delayed > 0 ? "has-warning" : ""}`}>
                  <span className="admin-execution-cell-label">Delayed</span>
                  <span className="admin-execution-cell-val" style={{ color: q?.delayed && q.delayed > 0 ? "#fef08a" : undefined }}>
                    {formatNumber(q?.delayed)}
                  </span>
                </div>

                <div className="admin-execution-queue-cell">
                  <span className="admin-execution-cell-label">Paused</span>
                  <span className="admin-execution-cell-val">{formatNumber(q?.paused)}</span>
                </div>

                <div className="admin-execution-queue-cell">
                  <span className="admin-execution-cell-label">Workers</span>
                  <span className="admin-execution-cell-val">{formatNumber(q?.configuredWorkers)}</span>
                </div>
              </div>

              <p className="admin-execution-queue-foot">
                <span>ⓘ Snapshot at {formatClock(snapshot.checkedAt)}. Worker count is the configured concurrency constant from EvaluationService, not a live process census.</span>
              </p>
            </section>

            {/* 2-Column Bottom Grid */}
            <div className="admin-execution-bottom-grid">
              {/* Health Details */}
              <section className="admin-execution-card">
                <div className="admin-execution-panel-head">
                  <h3 className="admin-execution-panel-title">Health Details</h3>
                  <p className="admin-execution-panel-sub">
                    Fields returned by EvaluationService /health payload
                  </p>
                </div>
                <dl className="admin-execution-kv-table m-0">
                  <KvRow label="Service">{snapshot.service || "—"}</KvRow>
                  <KvRow label="Redis">{snapshot.redis || "—"}</KvRow>
                  <KvRow label="Queue status">{q?.status || "—"}</KvRow>
                  <KvRow label="Waiting">{formatNumber(q?.waiting)}</KvRow>
                  <KvRow label="Active">{formatNumber(q?.active)}</KvRow>
                  <KvRow label="Completed">{formatNumber(q?.completed)}</KvRow>
                  <KvRow label="Failed">{formatNumber(q?.failed)}</KvRow>
                  <KvRow label="Delayed">{formatNumber(q?.delayed)}</KvRow>
                  <KvRow label="Paused">{formatNumber(q?.paused)}</KvRow>
                  <KvRow label="Configured workers">
                    {formatNumber(q?.configuredWorkers)}
                  </KvRow>
                </dl>
              </section>

              {/* Telemetry Availability */}
              <section className="admin-execution-card">
                <div className="admin-execution-panel-head">
                  <h3 className="admin-execution-panel-title">Telemetry Availability</h3>
                  <p className="admin-execution-panel-sub">
                    Operational coverage — no mock telemetry generated
                  </p>
                </div>

                <div className="admin-telemetry-grid">
                  {MISSING_TELEMETRY.map((item) => (
                    <div className="admin-telemetry-item" key={item.name}>
                      <div className="admin-telemetry-head">
                        <span className="admin-telemetry-title">{item.name}</span>
                        <span className="admin-telemetry-badge">Not Exposed</span>
                      </div>
                      <span className="admin-telemetry-desc">{item.purpose}</span>
                    </div>
                  ))}
                </div>

                <p className="admin-execution-queue-foot" style={{ marginTop: "auto", paddingTop: 8 }}>
                  <span>Failed submission outcomes (WA/RE/TLE) remain on Submissions → Failed Executions (SubmissionService).</span>
                </p>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
};
