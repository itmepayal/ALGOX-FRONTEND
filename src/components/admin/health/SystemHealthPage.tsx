import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Clock,
  Copy,
  Cpu,
  Database,
  FileCode2,
  Loader2,
  MessageSquare,
  Play,
  Radio,
  RefreshCw,
  Send,
  Shield,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  HEALTH_ENDPOINTS,
  pingHealthDetailed,
  adminAnalyticsApi,
} from "../../../api/adminAnalyticsApi";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { EmptyState } from "../shared/EmptyState";
import { Button } from "../../ui/button";
import { useToast } from "../../../context/ToastContext";
import "./system-health.css";

type PingStatus = "healthy" | "offline" | "warning" | "checking" | "pending";

type ServicePing = {
  status: PingStatus;
  ms: number | null;
  error?: string;
  checkedAt: string | null;
};

type QueueMetrics = {
  waiting: number | null;
  running: number | null;
  failed: number | null;
};

type QueueLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; metrics: QueueMetrics; redis?: string };

const AUTO_REFRESH_MS = 30_000;

const SERVICE_ICONS: Record<string, ReactNode> = {
  Auth: <Shield size={16} strokeWidth={2} className="size-4" aria-hidden />,
  Problem: <FileCode2 size={16} strokeWidth={2} className="size-4" aria-hidden />,
  Submission: <Send size={16} strokeWidth={2} className="size-4" aria-hidden />,
  Leaderboard: <Trophy size={16} strokeWidth={2} className="size-4" aria-hidden />,
  Evaluation: <Cpu size={16} strokeWidth={2} className="size-4" aria-hidden />,
  Analytics: <BarChart3 size={16} strokeWidth={2} className="size-4" aria-hidden />,
  Discussion: (
    <MessageSquare size={16} strokeWidth={2} className="size-4" aria-hidden />
  ),
  Content: <BookOpen size={16} strokeWidth={2} className="size-4" aria-hidden />,
  Realtime: <Radio size={16} strokeWidth={2} className="size-4" aria-hidden />,
};

function readQueue(data: unknown): QueueMetrics | null {
  const q = (data as { queue?: Record<string, unknown> } | undefined)?.queue;
  if (!q || typeof q !== "object") return null;
  const waiting = Number(q.waiting);
  const running = Number(q.active ?? q.running);
  const failed = Number(q.failed);
  if (![waiting, running, failed].every((n) => Number.isFinite(n))) {
    return null;
  }
  return { waiting, running, failed };
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 5) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return new Date(iso).toLocaleTimeString();
}

function formatClock(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString();
}

function parseEndpoint(url: string): { host: string; path: string; display: string } {
  try {
    const u = new URL(url);
    const host = u.host;
    const path = u.pathname + u.search;
    return { host, path, display: `${host}${path}` };
  } catch {
    return { host: url, path: "", display: url };
  }
}

function badgeStatus(status: PingStatus): string {
  if (status === "offline") return "unhealthy";
  if (status === "warning") return "degraded";
  return status;
}

export const SystemHealthPage: FC = () => {
  const toast = useToast();
  const [pings, setPings] = useState<Record<string, ServicePing>>({});
  const [queueState, setQueueState] = useState<QueueLoadState>({
    status: "loading",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const checking: Record<string, ServicePing> = {};
    for (const ep of HEALTH_ENDPOINTS) {
      checking[ep.name] = {
        status: "checking",
        ms: null,
        checkedAt: null,
      };
    }
    setPings(checking);
    setQueueState({ status: "loading" });

    await Promise.all(
      HEALTH_ENDPOINTS.map(async (ep) => {
        const result = await pingHealthDetailed(ep.url);
        const checkedAt = new Date().toISOString();
        setPings((prev) => ({
          ...prev,
          [ep.name]: {
            status: result.status,
            ms: result.ms,
            error: result.error,
            checkedAt,
          },
        }));
      }),
    );

    try {
      const res = await adminAnalyticsApi.executionHealth();
      const metrics = readQueue(res.data);
      if (!metrics) {
        setQueueState({ status: "empty" });
      } else {
        setQueueState({
          status: "ready",
          metrics,
          redis:
            typeof res.data?.redis === "string" ? res.data.redis : undefined,
        });
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to load Evaluation queue metrics";
      setQueueState({ status: "error", message });
    }

    setLastChecked(new Date().toISOString());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setLiveTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    void liveTick;
    const values = HEALTH_ENDPOINTS.map(
      (ep) => pings[ep.name]?.status || "checking",
    );
    const total = values.length;
    const healthy = values.filter((s) => s === "healthy").length;
    const checking = values.filter(
      (s) => s === "checking" || s === "pending",
    ).length;
    const unhealthy = values.filter(
      (s) => s === "offline" || s === "warning",
    ).length;
    return { total, healthy, unhealthy, checking };
  }, [pings, liveTick]);

  const copyEndpoint = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Endpoint copied", url);
    } catch {
      toast.error("Unable to copy endpoint");
    }
  };

  return (
    <PermissionGuard
      permission="health:view"
      fallback={<div className="admin-denied">No health permission.</div>}
    >
      <div className="sh-page">
        <header className="sh-header">
          <div>
            <h2>System Health</h2>
            <p className="sh-header-sub">
              Monitor service availability, execution infrastructure, and
              real-time platform health.
            </p>
            <p className="sh-note" style={{ marginTop: 6 }}>
              Live pings only — no invented metrics
            </p>
          </div>
          <div className="sh-header-actions">
            <span className="sh-live" aria-live="polite">
              <span
                className={`sh-live-dot${refreshing ? " paused" : ""}`}
                aria-hidden
              />
              {refreshing ? "Checking…" : "Live"}
            </span>
            <span className="sh-checked">
              Last checked {formatClock(lastChecked)}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label="Refresh health checks"
            >
              {refreshing ? (
                <Loader2
                  size={14}
                  strokeWidth={2}
                  className="size-3.5 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <RefreshCw
                  size={14}
                  strokeWidth={2}
                  className="size-3.5 shrink-0"
                  aria-hidden
                />
              )}
              Refresh
            </Button>
          </div>
        </header>

        <section aria-label="Execution queue">
          {queueState.status === "loading" ? (
            <div className="sh-queue-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="sh-queue-card" aria-hidden>
                  <div className="sh-skel" style={{ height: 14, width: "40%" }} />
                  <div className="sh-skel" style={{ height: 28, width: "35%" }} />
                  <div className="sh-skel" style={{ height: 12, width: "70%" }} />
                </div>
              ))}
            </div>
          ) : null}

          {queueState.status === "error" ? (
            <div className="sh-empty-wrap">
              <EmptyState
                compact
                icon={
                  <AlertTriangle size={18} strokeWidth={1.75} aria-hidden />
                }
                title="Evaluation queue unavailable"
                description={queueState.message}
              />
            </div>
          ) : null}

          {queueState.status === "empty" ? (
            <div className="sh-empty-wrap">
              <EmptyState
                compact
                icon={<Cpu size={18} strokeWidth={1.75} aria-hidden />}
                title="Queue metrics unavailable"
                description="Start EvaluationService to view BullMQ waiting, running, and failed jobs."
              />
            </div>
          ) : null}

          {queueState.status === "ready" ? (
            <div className="sh-queue-grid">
              <article className="sh-queue-card">
                <div className="sh-queue-top">
                  <span className="sh-queue-label">Waiting</span>
                  <span className="sh-queue-icon" aria-hidden>
                    <Clock size={15} strokeWidth={2} className="size-[15px]" />
                  </span>
                </div>
                <div className="sh-queue-value">
                  {formatNumber(queueState.metrics.waiting)}
                </div>
                <p className="sh-queue-desc">Jobs waiting for execution</p>
              </article>
              <article className="sh-queue-card tone-primary">
                <div className="sh-queue-top">
                  <span className="sh-queue-label">Running</span>
                  <span className="sh-queue-icon" aria-hidden>
                    <Play size={15} strokeWidth={2} className="size-[15px]" />
                  </span>
                </div>
                <div className="sh-queue-value">
                  {formatNumber(queueState.metrics.running)}
                </div>
                <p className="sh-queue-desc">Jobs currently executing</p>
              </article>
              <article className="sh-queue-card tone-danger">
                <div className="sh-queue-top">
                  <span className="sh-queue-label">Failed</span>
                  <span className="sh-queue-icon" aria-hidden>
                    <XCircle size={15} strokeWidth={2} className="size-[15px]" />
                  </span>
                </div>
                <div className="sh-queue-value">
                  {formatNumber(queueState.metrics.failed)}
                </div>
                <p className="sh-queue-desc">Jobs that failed execution</p>
              </article>
            </div>
          ) : null}
        </section>

        <section className="sh-section" aria-label="Service health">
          <div className="sh-section-head">
            <div>
              <h3>Service Health</h3>
              <p className="sh-section-desc">
                Live status of all platform services
              </p>
            </div>
            <div className="sh-summary-chips" aria-label="Service summary">
              <span className="sh-chip">{summary.total} Services</span>
              <span className="sh-chip ok">{summary.healthy} Healthy</span>
              <span className="sh-chip bad">{summary.unhealthy} Unhealthy</span>
              {summary.checking > 0 ? (
                <span className="sh-chip">{summary.checking} Checking</span>
              ) : null}
            </div>
          </div>

          <div className="sh-service-grid">
            {queueState.status === "ready" && queueState.redis ? (
              <article className="sh-service-card infra">
                <div className="sh-service-top">
                  <div className="sh-service-identity">
                    <span className="sh-service-icon" aria-hidden>
                      <Database size={16} strokeWidth={2} className="size-4" />
                    </span>
                    <div>
                      <h4 className="sh-service-name">Evaluation Redis</h4>
                      <p className="sh-service-kind">Infrastructure</p>
                    </div>
                  </div>
                  <StatusBadge
                    status={
                      queueState.redis === "connected" ? "healthy" : "unhealthy"
                    }
                  />
                </div>
                <div className="sh-service-meta">
                  <div className="sh-meta-row">
                    <span className="sh-meta-label">Type</span>
                    <span className="sh-meta-value">Redis</span>
                  </div>
                  <div className="sh-meta-row">
                    <span className="sh-meta-label">State</span>
                    <span className="sh-meta-value">{queueState.redis}</span>
                  </div>
                  <div className="sh-meta-row">
                    <span className="sh-meta-label">Source</span>
                    <span className="sh-meta-value">Evaluation /health</span>
                  </div>
                </div>
              </article>
            ) : null}

            {HEALTH_ENDPOINTS.map((ep) => {
              const ping = pings[ep.name];
              const status = ping?.status || "checking";
              const endpoint = parseEndpoint(ep.url);
              const icon =
                SERVICE_ICONS[ep.name] || (
                  <Activity
                    size={16}
                    strokeWidth={2}
                    className="size-4"
                    aria-hidden
                  />
                );

              return (
                <article key={ep.name} className="sh-service-card">
                  <div className="sh-service-top">
                    <div className="sh-service-identity">
                      <span className="sh-service-icon" aria-hidden>
                        {icon}
                      </span>
                      <div>
                        <h4 className="sh-service-name">{ep.name} Service</h4>
                        <p className="sh-service-kind">HTTP health check</p>
                      </div>
                    </div>
                    <StatusBadge status={badgeStatus(status)} />
                  </div>

                  <div className="sh-service-meta">
                    <div className="sh-meta-row">
                      <span className="sh-meta-label">Host</span>
                      <span className="sh-meta-value" title={endpoint.host}>
                        {endpoint.host}
                      </span>
                    </div>
                    <div className="sh-meta-row">
                      <span className="sh-meta-label">Path</span>
                      <span className="sh-meta-value" title={endpoint.path}>
                        {endpoint.path || "/"}
                      </span>
                    </div>
                    <div className="sh-meta-row">
                      <span className="sh-meta-label">Response</span>
                      <span className="sh-meta-value">
                        {ping?.ms != null ? `${ping.ms}ms` : "—"}
                      </span>
                    </div>
                    <div className="sh-meta-row">
                      <span className="sh-meta-label">Checked</span>
                      <span className="sh-meta-value">
                        {relativeTime(ping?.checkedAt)}
                      </span>
                    </div>
                    {ping?.error ? (
                      <div className="sh-meta-row">
                        <span className="sh-meta-label">Detail</span>
                        <span className="sh-meta-value" title={ping.error}>
                          {ping.error}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="sh-endpoint">
                    <a
                      href={ep.url}
                      target="_blank"
                      rel="noreferrer"
                      title={ep.url}
                    >
                      {endpoint.display}
                    </a>
                    <button
                      type="button"
                      className="sh-endpoint-copy"
                      onClick={() => void copyEndpoint(ep.url)}
                      aria-label={`Copy ${ep.name} health endpoint`}
                      title="Copy endpoint"
                    >
                      <Copy
                        size={12}
                        strokeWidth={2}
                        className="size-3"
                        aria-hidden
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </PermissionGuard>
  );
};

export default SystemHealthPage;
