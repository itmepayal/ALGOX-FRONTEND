import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Cable,
  ChevronDown,
  FileCode2,
  Loader2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ConfirmDialog } from "../../ConfirmDialog";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatsCard } from "../shared/StatsCard";
import { StatusBadge } from "../shared/StatusBadge";
import { EventBadge } from "../shared/EventBadge";
import { SourceBadge } from "../shared/SourceBadge";
import { EmptyState } from "../shared/EmptyState";
import { adminRealtimeApi } from "../../../api/adminRealtimeApi";
import { LeaderboardsPage } from "../leaderboards/LeaderboardsPage";
import { CodeExecutionPage } from "../execution/CodeExecutionPage";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import { useToast } from "../../../context/ToastContext";
import "../problems/problem-editor.css";
import { cn } from "../../../lib/cn";

interface RealtimePageProps {
  mode:
    | "dashboard"
    | "users"
    | "submissions"
    | "executions"
    | "leaderboard"
    | "connections"
    | "rooms"
    | "events"
    | "broadcast";
  onOpenSubmission?: (id: string) => void;
}

/** Display helper only — never invents values. */
function metricDisplay(v: unknown): {
  tracked: boolean;
  value: string | number;
  hint?: string;
} {
  if (v === null || v === undefined || Number.isNaN(v as number)) {
    return {
      tracked: false,
      value: "Not tracked",
      hint: "Not measured by gateway",
    };
  }
  return { tracked: true, value: v as number | string };
}

function pickFirst(...vals: unknown[]) {
  for (const v of vals) {
    if (
      v !== null &&
      v !== undefined &&
      !(typeof v === "number" && Number.isNaN(v))
    ) {
      return v;
    }
  }
  return undefined;
}

function formatUptime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export const RealtimeCenterPage: FC<RealtimePageProps> = ({
  mode,
  onOpenSubmission,
}) => {
  if (mode === "leaderboard") return <LeaderboardsPage period="global" />;
  if (mode === "executions") return <CodeExecutionPage />;
  if (mode === "submissions")
    return <LiveSubmissionsPulse onOpen={onOpenSubmission} />;
  if (mode === "broadcast") return <BroadcastCenter />;
  if (mode === "connections") return <ConnectionsMonitor />;
  if (mode === "rooms") return <RoomsMonitor />;
  if (mode === "events") return <EventStream />;
  if (mode === "users") return <LiveUsers />;
  return <RealtimeOverview />;
};

const NotTracked: FC = () => (
  <span className="inline-flex flex-col items-end gap-0.5 text-right">
    <strong className="font-primary text-sm font-medium text-muted-foreground">
      Not tracked
    </strong>
    <span className="font-primary text-[0.6875rem] font-normal text-muted-foreground/80">
      Not measured by gateway
    </span>
  </span>
);

const KvRow: FC<{
  label: string;
  children: ReactNode;
}> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0 last:pb-0 first:pt-0">
    <dt className="font-primary text-sm text-muted-foreground">{label}</dt>
    <dd className="m-0 min-w-0 text-right">{children}</dd>
  </div>
);

const RealtimeOverview: FC = () => {
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setError("");
      const [ov, an] = await Promise.all([
        adminRealtimeApi.overview(),
        adminRealtimeApi.analytics(),
      ]);
      setData(ov.data || ov);
      setAnalytics(an.data || an);
      setRefreshedAt(new Date());
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "RealtimeService offline (port 3010)"
      );
      setData(null);
      setAnalytics(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const gatewayOk = !error && !!data;

  const activeConnections = pickFirst(
    data?.activeConnections,
    analytics?.activeConnections
  );
  const peakConnections = pickFirst(
    data?.peakConnections,
    analytics?.peakConnections
  );
  const onlineUsers = pickFirst(data?.onlineUsers, analytics?.onlineUsers);
  const eventsPerSec = pickFirst(
    data?.eventsPerSecond,
    analytics?.eventsPerSecond,
    analytics?.eventsPerSec,
    data?.eventsPerSec
  );
  const avgLatency = pickFirst(
    analytics?.avgLatencyMs,
    data?.avgLatencyMs,
    data?.latencyP50Ms,
    analytics?.latencyP50Ms
  );
  // Product “Active rooms” only when explicitly provided — never invent from adapter room map
  const activeRooms = pickFirst(data?.activeRooms, analytics?.activeRooms);

  const historySeries = useMemo(() => {
    const raw =
      analytics?.eventsPerSecondHistory ?? data?.eventsPerSecondHistory;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((v: number, i: number) => ({
      t: i + 1,
      events: typeof v === "number" && !Number.isNaN(v) ? v : 0,
    }));
  }, [analytics, data]);

  const conn = metricDisplay(activeConnections);
  const peak = metricDisplay(peakConnections);
  const online = metricDisplay(onlineUsers);
  const eps = metricDisplay(eventsPerSec);
  const latency = metricDisplay(avgLatency);
  const rooms = metricDisplay(activeRooms);

  return (
    <PermissionGuard permission="realtime:view">
      <div className="pe-page mx-auto w-full gap-6">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <div>
              <h2 className="pe-title">WebSocket Dashboard</h2>
              <p className="pe-sub">
                Monitor real-time connections, rooms, events, and gateway
                health.
              </p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            <StatusBadge status={gatewayOk ? "OPERATIONAL" : "UNAVAILABLE"} />
            <button
              type="button"
              className="admin-btn"
              disabled={loading || refreshing}
              onClick={() => void load(true)}
            >
              <RefreshCw
                size={14}
                strokeWidth={1.75}
                className={refreshing ? "animate-spin" : undefined}
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="admin-form-banner" role="alert">
            <AlertTriangle size={16} aria-hidden />
            <div>
              <strong>Gateway unreachable</strong>
              <div>{error}</div>
            </div>
          </div>
        ) : null}

        {loading && !data ? (
          <p className="admin-muted">Loading gateway metrics…</p>
        ) : null}

        <div className="admin-stats-grid !mb-0">
          <StatsCard
            label="Active Connections"
            value={conn.value}
            hint={conn.tracked ? "Open sockets right now" : conn.hint}
            icon={<Cable size={16} strokeWidth={1.75} />}
          />
          <StatsCard
            label="Peak Connections"
            value={peak.value}
            hint={peak.tracked ? "Highest since gateway start" : peak.hint}
            icon={<Activity size={16} strokeWidth={1.75} />}
          />
          <StatsCard
            label="Online Users"
            value={online.value}
            hint={online.tracked ? "Authenticated presence" : online.hint}
            icon={<Users size={16} strokeWidth={1.75} />}
          />
        </div>

        <div className="pe-layout">
          <section className="pe-card !p-6">
            <div className="pe-card-head !mb-5">
              <h3>Gateway Status</h3>
              <p>Live health from the realtime service</p>
            </div>
            <dl className="m-0">
              <KvRow label="Operational status">
                <StatusBadge
                  status={gatewayOk ? "OPERATIONAL" : "UNAVAILABLE"}
                />
              </KvRow>
              <KvRow label="Active connections">
                <span className="font-technical text-base font-semibold tabular-nums text-foreground">
                  {conn.value}
                </span>
              </KvRow>
              <KvRow label="Peak connections">
                <span className="font-technical text-base font-semibold tabular-nums text-foreground">
                  {peak.value}
                </span>
              </KvRow>
              <KvRow label="Online users">
                <span className="font-technical text-base font-semibold tabular-nums text-foreground">
                  {online.value}
                </span>
              </KvRow>
              {data?.adapter != null ? (
                <KvRow label="Adapter">
                  <span className="font-primary text-sm text-foreground">
                    {String(data.adapter)}
                  </span>
                </KvRow>
              ) : null}
              {data?.uptimeMs != null ? (
                <KvRow label="Uptime">
                  <span className="font-technical text-sm font-semibold tabular-nums text-foreground">
                    {formatUptime(Number(data.uptimeMs))}
                  </span>
                </KvRow>
              ) : null}
              <KvRow label="Last refreshed">
                <span className="font-primary text-sm text-muted-foreground">
                  {refreshedAt
                    ? refreshedAt.toLocaleTimeString()
                    : loading
                      ? "…"
                      : "—"}
                </span>
              </KvRow>
            </dl>
          </section>

          <section className="pe-card !p-6">
            <div className="pe-card-head !mb-5">
              <h3>Realtime Activity</h3>
              <p>Throughput and latency signals</p>
            </div>
            <dl className="m-0">
              <KvRow label="Events/sec">
                {eps.tracked ? (
                  <span className="font-technical text-base font-semibold tabular-nums text-foreground">
                    {eps.value}
                  </span>
                ) : (
                  <NotTracked />
                )}
              </KvRow>
              <KvRow label="Avg latency">
                {latency.tracked ? (
                  <span className="font-technical text-base font-semibold tabular-nums text-foreground">
                    {latency.value} ms
                  </span>
                ) : (
                  <NotTracked />
                )}
              </KvRow>
              <KvRow label="Active rooms">
                {rooms.tracked ? (
                  <span className="font-technical text-base font-semibold tabular-nums text-foreground">
                    {rooms.value}
                  </span>
                ) : (
                  <NotTracked />
                )}
              </KvRow>
            </dl>
          </section>
        </div>

        <section className="pe-card !p-6">
          <div className="pe-card-head !mb-5">
            <h3>Connection Activity</h3>
            <p>Historical WebSocket throughput from the gateway</p>
          </div>
          {historySeries.length > 0 ? (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historySeries}>
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="t"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}s`}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => `Sample ${v}`}
                    formatter={(value) => [value ?? 0, "Events/sec"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="events"
                    stroke="var(--primary)"
                    fill="color-mix(in srgb, var(--primary) 18%, transparent)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              compact
              icon={<Activity size={18} strokeWidth={1.75} />}
              title="No connection history"
              description="Historical WebSocket activity will appear here once the gateway starts collecting it."
            />
          )}
        </section>
      </div>
    </PermissionGuard>
  );
};

const LiveUsers: FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await adminRealtimeApi.users();
        if (!cancelled) setRows(res.data || []);
        if (!cancelled) setError("");
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Realtime offline");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <PermissionGuard permission="realtime:view">
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle="No online users"
        emptyDescription="Socket-connected users will appear here when the realtime service is active."
        emptyIcon={<Users size={18} strokeWidth={1.75} />}
        columns={[
          { key: "user", header: "User", render: (r) => r.userId || r.id },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status || "ONLINE"} />,
          },
          {
            key: "sockets",
            header: "Sockets",
            render: (r) => r.socketCount ?? r.sockets?.length ?? "—",
          },
          {
            key: "page",
            header: "Page",
            render: (r) => r.currentPage || "—",
          },
          {
            key: "activity",
            header: "Last activity",
            render: (r) =>
              r.lastActivity
                ? new Date(r.lastActivity).toLocaleString()
                : "—",
          },
        ]}
        rows={rows}
        rowKey={(r) => r.userId || r.id || JSON.stringify(r)}
      />
    </PermissionGuard>
  );
};

const ConnectionsMonitor: FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminRealtimeApi.connections();
      setRows(res.data || []);
      setError("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load connections");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [load]);

  const disconnect = async (id: string) => {
    if (!window.confirm(`Force disconnect ${id}?`)) return;
    try {
      await adminRealtimeApi.disconnect(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Disconnect failed");
    }
  };

  return (
    <PermissionGuard permission="realtime:connections">
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle="No active connections"
        emptyDescription="Open sockets will list here while clients stay connected."
        emptyIcon={<Cable size={18} strokeWidth={1.75} />}
        columns={[
          {
            key: "id",
            header: "Connection",
            render: (r) => r.socketId || r.id,
          },
          { key: "user", header: "User", render: (r) => r.userId || "—" },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status || "ONLINE"} />,
          },
          {
            key: "connected",
            header: "Connected",
            render: (r) =>
              r.connectedAt ? new Date(r.connectedAt).toLocaleString() : "—",
          },
          {
            key: "rooms",
            header: "Rooms",
            render: (r) => (r.rooms || []).join(", ") || "—",
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <PermissionGuard permission="realtime:disconnect">
                <button
                  type="button"
                  className="admin-link"
                  onClick={() => void disconnect(r.socketId || r.id)}
                >
                  Disconnect
                </button>
              </PermissionGuard>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.socketId || r.id}
      />
    </PermissionGuard>
  );
};

const RoomsMonitor: FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await adminRealtimeApi.rooms();
        if (!cancelled) setRows(res.data || []);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Failed");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <PermissionGuard permission="realtime:rooms">
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle="No active rooms"
        emptyDescription="Contest, problem, and presence rooms show up when users join."
        emptyIcon={<Radio size={18} strokeWidth={1.75} />}
        columns={[
          { key: "id", header: "Room", render: (r) => r.roomId || r.id },
          {
            key: "type",
            header: "Type",
            render: (r) => r.roomType || r.type || "—",
          },
          {
            key: "users",
            header: "Connected",
            render: (r) => r.connectedUsers ?? r.size ?? 0,
          },
          {
            key: "activity",
            header: "Last activity",
            render: (r) =>
              r.lastActivity
                ? new Date(r.lastActivity).toLocaleString()
                : "—",
          },
        ]}
        rows={rows}
        rowKey={(r) => r.roomId || r.id}
      />
    </PermissionGuard>
  );
};

const EventStream: FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await adminRealtimeApi.events(150);
        if (cancelled) return;
        const next = (res.data || []) as any[];
        const nextIds = new Set(
          next.map((r) =>
            String(
              r.id ||
                `${r.at || r.timestamp}-${r.name || r.event}-${r.userId || ""}`
            )
          )
        );

        if (bootstrappedRef.current) {
          const fresh = new Set<string>();
          for (const id of nextIds) {
            if (!knownIdsRef.current.has(id)) fresh.add(id);
          }
          if (fresh.size) {
            setHighlightIds(fresh);
            window.setTimeout(() => {
              setHighlightIds((prev) => {
                const n = new Set(prev);
                for (const id of fresh) n.delete(id);
                return n;
              });
            }, 700);
          }
        } else {
          bootstrappedRef.current = true;
        }

        knownIdsRef.current = nextIds;
        setRows(next);
        setError("");
      } catch (err: any) {
        if (!cancelled)
          setError(err?.response?.data?.message || "Event stream unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [paused]);

  const eventNameOf = (r: any) => String(r.name || r.event || "").trim();
  const sourceOf = (r: any) =>
    String(r.direction || r.payload?.source || r.source || "").trim();
  const statusOf = (r: any) => {
    const raw = String(r.payload?.status || r.status || "ok").trim();
    return raw.toLowerCase() === "ok" ? "OK" : raw.toUpperCase();
  };
  const rowIdOf = (r: any) =>
    String(
      r.id || `${r.at || r.timestamp}-${r.name || r.event}-${r.userId || ""}`
    );

  const eventTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const n = eventNameOf(r);
      if (n) set.add(n);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const s = sourceOf(r);
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(statusOf(r));
    return Array.from(set).sort((a, b) => {
      if (a === "OK") return -1;
      if (b === "OK") return 1;
      return a.localeCompare(b);
    });
  }, [rows]);

  const filtersActive = Boolean(
    search.trim() || eventType || source || status
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (eventType && eventNameOf(r) !== eventType) return false;
      if (source && sourceOf(r) !== source) return false;
      if (status && statusOf(r) !== status) return false;
      if (!q) return true;
      const hay = [
        eventNameOf(r),
        String(r.userId || ""),
        String(r.room || ""),
        sourceOf(r),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, eventType, source, status]);

  const clearFilters = () => {
    setSearch("");
    setEventType("");
    setSource("");
    setStatus("");
  };

  const eventCount = filtered.length;

  const selectWrap =
    "relative inline-flex w-full min-w-0 sm:w-auto sm:flex-none";
  const selectClass = cn(
    "peer flex h-9 w-full appearance-none rounded-lg border border-border bg-background py-0 pr-9 pl-3",
    "font-primary text-sm text-foreground",
    "transition-colors duration-200",
    "hover:border-border",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "sm:w-[158px]",
  );

  return (
    <PermissionGuard permission="realtime:events">
      <div className="pe-page mx-auto w-full gap-6">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <div>
              <h2 className="pe-title">Event Stream</h2>
              <p className="pe-sub">Live WebSocket events from the gateway</p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-primary text-xs font-medium",
                paused
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-primary/30 bg-secondary text-secondary-foreground",
              )}
              aria-live="polite"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  paused
                    ? "bg-muted-foreground"
                    : "bg-primary admin-live-pulse",
                )}
                aria-hidden
              />
              {paused ? "Paused" : "Live"}
            </span>
            <span
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-muted px-2.5 font-technical text-xs font-semibold tabular-nums text-foreground"
              title="Visible events"
            >
              {eventCount}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              aria-label={paused ? "Resume event stream" : "Pause event stream"}
            >
              {paused ? (
                <Play size={14} strokeWidth={1.75} />
              ) : (
                <Pause size={14} strokeWidth={1.75} />
              )}
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
        </header>

        {error ? (
          <div className="admin-form-banner" role="alert">
            <AlertTriangle size={16} aria-hidden />
            <div>
              <strong>Event stream unavailable</strong>
              <div>{error}</div>
            </div>
          </div>
        ) : null}

        <section className="pe-card !p-6">
          <div className="pe-card-head !mb-5">
            <h3>Events</h3>
            <p>
              {paused
                ? "Stream paused — resume to fetch new events"
                : "Newest gateway events appear as they arrive"}
            </p>
          </div>

          <div
            className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center"
            role="search"
            aria-label="Event filters"
          >
            <div className="relative min-w-0 flex-1">
              <Search
                size={15}
                strokeWidth={1.75}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events..."
                aria-label="Search events"
                className="bg-background pl-9"
              />
            </div>

            <div className={cn(selectWrap, "lg:w-[168px]")}>
              <select
                className={cn(selectClass, "lg:w-full")}
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                aria-label="Event type"
              >
                <option value="">All Events</option>
                {eventTypeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>

            <div className={cn(selectWrap, "lg:w-[148px]")}>
              <select
                className={cn(selectClass, "lg:w-full")}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                aria-label="Source"
              >
                <option value="">All Sources</option>
                {sourceOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>

            <div className={cn(selectWrap, "lg:w-[136px]")}>
              <select
                className={cn(selectClass, "lg:w-full")}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Status"
              >
                <option value="">All Status</option>
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>

            {filtersActive ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full shrink-0 lg:w-auto"
                onClick={clearFilters}
              >
                <X size={14} strokeWidth={1.75} />
                Clear filters
              </Button>
            ) : null}
          </div>

          <DataTable
            loading={loading && rows.length === 0}
            highlightIds={highlightIds}
            emptyTitle={
              filtersActive && rows.length > 0
                ? "No matching events"
                : "No events found"
            }
            emptyDescription={
              filtersActive && rows.length > 0
                ? "No gateway events match your current filters."
                : "Waiting for WebSocket activity..."
            }
            emptyIcon={<Activity size={18} strokeWidth={1.75} />}
            emptyAction={
              filtersActive && rows.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
            columns={[
              {
                key: "ts",
                header: "Time",
                width: "112px",
                skeletonWidth: "5rem",
                render: (r) => {
                  const raw = r.at || r.timestamp;
                  if (!raw) {
                    return (
                      <span className="font-primary text-muted-foreground">
                        —
                      </span>
                    );
                  }
                  const d = new Date(raw);
                  return (
                    <time
                      className="font-primary whitespace-nowrap text-xs text-muted-foreground tabular-nums"
                      dateTime={d.toISOString()}
                      title={d.toLocaleString()}
                    >
                      {d.toLocaleTimeString()}
                    </time>
                  );
                },
              },
              {
                key: "event",
                header: "Event",
                width: "200px",
                skeletonWidth: "8rem",
                render: (r) => <EventBadge name={eventNameOf(r) || "—"} />,
              },
              {
                key: "source",
                header: "Source",
                width: "120px",
                skeletonWidth: "4.5rem",
                render: (r) => <SourceBadge source={sourceOf(r)} />,
              },
              {
                key: "user",
                header: "User",
                width: "168px",
                technical: true,
                skeletonWidth: "9rem",
                render: (r) => {
                  const id = r.userId ? String(r.userId) : "";
                  if (!id) {
                    return (
                      <span className="font-primary text-muted-foreground">
                        —
                      </span>
                    );
                  }
                  return (
                    <span
                      className="font-technical block max-w-[168px] truncate text-xs tabular-nums text-foreground"
                      title={id}
                    >
                      {id}
                    </span>
                  );
                },
              },
              {
                key: "room",
                header: "Room",
                width: "140px",
                skeletonWidth: "3rem",
                render: (r) => {
                  const room = r.room ? String(r.room) : "";
                  if (!room) {
                    return (
                      <span className="font-primary text-muted-foreground">
                        —
                      </span>
                    );
                  }
                  return (
                    <span
                      className="font-primary block max-w-[140px] truncate text-xs text-foreground"
                      title={room}
                    >
                      {room}
                    </span>
                  );
                },
              },
              {
                key: "status",
                header: "Status",
                width: "108px",
                skeletonWidth: "3.5rem",
                render: (r) => <StatusBadge status={statusOf(r)} />,
              },
            ]}
            rows={filtered}
            rowKey={rowIdOf}
          />
        </section>
      </div>
    </PermissionGuard>
  );
};

const MESSAGE_MAX = 4000;
const TITLE_MAX = 200;

type BroadcastTarget = "everyone" | "online";

const BroadcastCenter: FC = () => {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<BroadcastTarget>("everyone");
  const [fieldError, setFieldError] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [gatewayOk, setGatewayOk] = useState(false);
  const [activeConnections, setActiveConnections] = useState<number | null>(
    null
  );
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [lastBroadcastAt, setLastBroadcastAt] = useState<Date | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [ov, an] = await Promise.all([
        adminRealtimeApi.overview(),
        adminRealtimeApi.analytics(),
      ]);
      const data = ov.data || ov;
      const analytics = an.data || an;
      setGatewayOk(true);
      const connections = pickFirst(
        data?.activeConnections,
        analytics?.activeConnections
      );
      const users = pickFirst(data?.onlineUsers, analytics?.onlineUsers);
      setActiveConnections(
        typeof connections === "number" ? connections : null
      );
      setOnlineUsers(typeof users === "number" ? users : null);
      const recent = Array.isArray(analytics?.recentBroadcasts)
        ? analytics.recentBroadcasts
        : [];
      setHistory(recent);
    } catch {
      setGatewayOk(false);
      setActiveConnections(null);
      setOnlineUsers(null);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
    const id = window.setInterval(() => void loadMeta(), 5000);
    return () => window.clearInterval(id);
  }, [loadMeta]);

  const connectedSockets =
    typeof activeConnections === "number" ? activeConnections : 0;
  const recipientHint =
    target === "everyone"
      ? `${connectedSockets} connected socket${connectedSockets === 1 ? "" : "s"}`
      : `${typeof onlineUsers === "number" ? onlineUsers : connectedSockets} online user connection${(typeof onlineUsers === "number" ? onlineUsers : connectedSockets) === 1 ? "" : "s"}`;

  const trimmed = message.trim();
  const canSend = Boolean(trimmed) && !sending && gatewayOk;

  const openConfirm = () => {
    if (!trimmed) {
      setFieldError("Message is required.");
      return;
    }
    if (trimmed.length > MESSAGE_MAX) {
      setFieldError(`Message must be at most ${MESSAGE_MAX} characters.`);
      return;
    }
    setFieldError("");
    setConfirmOpen(true);
  };

  const send = async () => {
    if (!trimmed || sending) return;
    try {
      setSending(true);
      setFieldError("");
      const res = await adminRealtimeApi.broadcast({
        message: trimmed,
        title: title.trim() || undefined,
        target,
      });
      const d = res.data || res;
      const delivered = d.delivered ?? d.sent ?? 0;
      toast.success(
        "Broadcast sent successfully",
        `${delivered} recipient${delivered === 1 ? "" : "s"} received the message.`
      );
      setMessage("");
      setTitle("");
      setLastBroadcastAt(new Date());
      setConfirmOpen(false);
      await loadMeta();
    } catch (err: unknown) {
      toast.apiError(err, "Broadcast failed");
      setConfirmOpen(false);
    } finally {
      setSending(false);
    }
  };

  const audienceOptions: Array<{
    id: BroadcastTarget;
    label: string;
    hint: string;
    detail: string;
  }> = [
    {
      id: "everyone",
      label: "Everyone",
      hint: "All connected sockets",
      detail: `${connectedSockets} connected socket${connectedSockets === 1 ? "" : "s"}`,
    },
    {
      id: "online",
      label: "Online users",
      hint: "Authenticated presence connections",
      detail: `${typeof onlineUsers === "number" ? onlineUsers : "—"} online user${onlineUsers === 1 ? "" : "s"}`,
    },
  ];

  return (
    <PermissionGuard permission="realtime:broadcast">
      <div className="pe-page mx-auto w-full gap-6">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <div>
              <h2 className="pe-title">Broadcast Center</h2>
              <p className="pe-sub">
                Send real-time messages to connected users through the gateway.
              </p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-primary text-xs font-medium",
                gatewayOk
                  ? "border-primary/30 bg-secondary text-secondary-foreground"
                  : "border-border bg-muted text-muted-foreground",
              )}
              aria-live="polite"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  gatewayOk ? "bg-primary admin-live-pulse" : "bg-muted-foreground",
                )}
                aria-hidden
              />
              {metaLoading ? "Connecting…" : gatewayOk ? "Live" : "Offline"}
            </span>
            <span
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 font-primary text-xs font-medium text-foreground"
              title="Connected sockets"
            >
              <Users size={13} strokeWidth={1.75} aria-hidden />
              <span className="font-technical tabular-nums">
                {metaLoading
                  ? "…"
                  : typeof activeConnections === "number"
                    ? activeConnections
                    : "—"}
              </span>
              <span className="text-muted-foreground">connected</span>
            </span>
          </div>
        </header>

        <div className="pe-layout">
          <section className="pe-card !p-6">
            <div className="pe-card-head !mb-5">
              <h3>Broadcast Message</h3>
              <p>Send a message to selected connected users.</p>
            </div>

            <div className="flex flex-col gap-5">
              <div className="admin-field !mb-0">
                <label htmlFor="bc-title">Title (optional)</label>
                <input
                  id="bc-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  placeholder="e.g. System maintenance"
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={sending}
                />
                <span className="pe-field-hint">
                  {title.length} / {TITLE_MAX}
                </span>
              </div>

              <div
                className={cn(
                  "admin-field !mb-0",
                  fieldError ? "has-error" : "",
                )}
              >
                <label htmlFor="bc-message">Message</label>
                <textarea
                  id="bc-message"
                  rows={7}
                  value={message}
                  maxLength={MESSAGE_MAX}
                  placeholder="Write your broadcast message..."
                  disabled={sending}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (fieldError) setFieldError("");
                  }}
                  className="min-h-[140px] resize-y"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={
                    fieldError ? "bc-message-error" : "bc-message-hint"
                  }
                />
                {fieldError ? (
                  <span id="bc-message-error" className="admin-field-error">
                    ⚠ {fieldError}
                  </span>
                ) : (
                  <span id="bc-message-hint" className="pe-field-hint">
                    {message.length} / {MESSAGE_MAX} characters
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                  disabled={!canSend}
                  onClick={openConfirm}
                >
                  {sending ? (
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                  ) : (
                    <Send size={14} strokeWidth={1.75} />
                  )}
                  {sending ? "Sending…" : "Send broadcast"}
                </Button>
              </div>

              {!gatewayOk && !metaLoading ? (
                <EmptyState
                  compact
                  icon={<WifiOff size={18} strokeWidth={1.75} />}
                  title="Gateway offline"
                  description="Reconnect the realtime service to send broadcasts."
                />
              ) : null}
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="pe-card !p-6">
              <div className="pe-card-head !mb-5">
                <h3>Audience</h3>
                <p>Who receives this broadcast</p>
              </div>
              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Audience">
                {audienceOptions.map((opt) => {
                  const selected = target === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={sending}
                      onClick={() => setTarget(opt.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[var(--radius)] border px-3.5 py-3 text-left transition-colors",
                        selected
                          ? "border-primary/40 bg-secondary"
                          : "border-border bg-background hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                          selected
                            ? "border-primary/30 bg-card text-primary"
                            : "border-border bg-muted text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        <Users size={15} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-primary block text-sm font-semibold text-foreground">
                          {opt.label}
                        </span>
                        <span className="font-primary block text-xs text-muted-foreground">
                          {opt.hint}
                        </span>
                        <span className="font-technical mt-1 block text-xs tabular-nums text-foreground">
                          {opt.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {gatewayOk && connectedSockets === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    compact
                    icon={<Users size={18} strokeWidth={1.75} />}
                    title="No users online"
                    description="There are currently no connected sockets available for broadcast."
                  />
                </div>
              ) : null}
            </section>

            <section className="pe-card !p-6">
              <div className="pe-card-head !mb-5">
                <h3>Delivery</h3>
                <p>Current gateway delivery context</p>
              </div>
              <dl className="m-0 flex flex-col gap-0">
                <div className="flex items-center justify-between gap-3 border-b border-border py-3 first:pt-0">
                  <dt className="font-primary text-sm text-muted-foreground">
                    Recipients
                  </dt>
                  <dd className="m-0 font-technical text-sm font-semibold tabular-nums text-foreground">
                    {metaLoading ? "…" : recipientHint}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-border py-3">
                  <dt className="font-primary text-sm text-muted-foreground">
                    Connection
                  </dt>
                  <dd className="m-0">
                    <StatusBadge
                      status={
                        metaLoading
                          ? "PENDING"
                          : gatewayOk
                            ? "LIVE"
                            : "OFFLINE"
                      }
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-border py-3">
                  <dt className="font-primary text-sm text-muted-foreground">
                    Status
                  </dt>
                  <dd className="m-0">
                    <StatusBadge
                      status={
                        sending ? "SENDING" : gatewayOk ? "READY" : "OFFLINE"
                      }
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
                  <dt className="font-primary text-sm text-muted-foreground">
                    Last broadcast
                  </dt>
                  <dd className="m-0 font-primary text-sm text-muted-foreground">
                    {lastBroadcastAt
                      ? lastBroadcastAt.toLocaleTimeString()
                      : history[0]?.createdAt
                        ? new Date(history[0].createdAt).toLocaleTimeString()
                        : "—"}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>

        {history.length > 0 ? (
          <section className="pe-card !p-6">
            <div className="pe-card-head !mb-5">
              <h3>Recent broadcasts</h3>
              <p>Latest messages sent through this gateway session</p>
            </div>
            <DataTable
              emptyTitle="No recent broadcasts"
              emptyDescription="Sent broadcasts will appear here."
              emptyIcon={<Radio size={18} strokeWidth={1.75} />}
              columns={[
                {
                  key: "time",
                  header: "Time",
                  width: "110px",
                  skeletonWidth: "4.5rem",
                  render: (r) => {
                    const raw = r.createdAt;
                    if (!raw) {
                      return (
                        <span className="font-primary text-muted-foreground">
                          —
                        </span>
                      );
                    }
                    const d = new Date(raw);
                    return (
                      <time
                        className="font-primary whitespace-nowrap text-xs text-muted-foreground tabular-nums"
                        dateTime={d.toISOString()}
                        title={d.toLocaleString()}
                      >
                        {d.toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    );
                  },
                },
                {
                  key: "message",
                  header: "Message",
                  skeletonWidth: "12rem",
                  render: (r) => (
                    <span
                      className="font-primary block max-w-[320px] truncate text-sm text-foreground"
                      title={String(r.message || r.title || "")}
                    >
                      {r.title || r.message || "—"}
                    </span>
                  ),
                },
                {
                  key: "audience",
                  header: "Audience",
                  width: "120px",
                  skeletonWidth: "5rem",
                  render: (r) => (
                    <SourceBadge
                      source={String(r.targetType || r.target || "—")}
                    />
                  ),
                },
                {
                  key: "recipients",
                  header: "Recipients",
                  width: "110px",
                  technical: true,
                  skeletonWidth: "3rem",
                  render: (r) => (
                    <span className="font-technical text-sm tabular-nums text-foreground">
                      {r.delivered ?? r.sent ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "110px",
                  skeletonWidth: "4rem",
                  render: (r) => (
                    <StatusBadge
                      status={
                        Number(r.failed) > 0
                          ? "FAILED"
                          : Number(r.delivered ?? r.sent) > 0
                            ? "SUCCESS"
                            : "OK"
                      }
                    />
                  ),
                },
              ]}
              rows={history}
              rowKey={(r) => String(r.id || r._id || `${r.createdAt}-${r.message}`)}
            />
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Send broadcast?"
        description={
          <>
            This message will be sent to{" "}
            <strong className="text-foreground">
              {target === "everyone" ? "all connected sockets" : "online users"}
            </strong>
            {gatewayOk ? ` (${recipientHint}).` : "."}
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Send broadcast"
        confirmVariant="primary"
        confirming={sending}
        confirmingLabel="Sending…"
        onCancel={() => {
          if (!sending) setConfirmOpen(false);
        }}
        onConfirm={() => void send()}
      />
    </PermissionGuard>
  );
};

const LiveSubmissionsPulse: FC<{ onOpen?: (id: string) => void }> = ({
  onOpen,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 8000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await adminSubmissionApi.list({ page: 1, limit: 40 });
        if (!cancelled) setRows(res.data || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <PermissionGuard
      permission="submissions:view"
      fallback={<div className="admin-denied">No permission.</div>}
    >
      <p className="admin-muted" style={{ marginBottom: 10 }}>
        Live submissions from SubmissionService (poll). Socket push can overlay
        when clients join submission rooms.
      </p>
      <DataTable
        loading={loading}
        emptyTitle="No recent submissions"
        emptyDescription="New submissions will appear as they arrive."
        emptyIcon={<FileCode2 size={18} strokeWidth={1.75} />}
        columns={[
          {
            key: "id",
            header: "ID",
            render: (r) => (
              <button
                type="button"
                className="admin-link"
                onClick={() => onOpen?.(String(r.id || r._id))}
              >
                {String(r.id || r._id || "").slice(0, 8)}…
              </button>
            ),
          },
          { key: "user", header: "User", render: (r) => r.userId || "—" },
          {
            key: "problem",
            header: "Problem",
            render: (r) => r.problemId || "—",
          },
          { key: "lang", header: "Lang", render: (r) => r.language || "—" },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
        ]}
        rows={rows}
        rowKey={(r) => String(r.id || r._id)}
      />
    </PermissionGuard>
  );
};
