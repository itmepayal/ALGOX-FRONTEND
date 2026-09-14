import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatsCard } from "../shared/StatsCard";
import { StatusBadge } from "../shared/StatusBadge";
import { adminRealtimeApi } from "../../../api/adminRealtimeApi";
import { LeaderboardsPage } from "../leaderboards/LeaderboardsPage";
import { CodeExecutionPage } from "../execution/CodeExecutionPage";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";

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

function fmtMetric(v: unknown) {
  return adminRealtimeApi.metricOrUnavailable(v);
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

const RealtimeOverview: FC = () => {
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [ov, an] = await Promise.all([
        adminRealtimeApi.overview(),
        adminRealtimeApi.analytics(),
      ]);
      setData(ov.data || ov);
      setAnalytics(an.data || an);
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
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const gatewayOk = !error && data;

  return (
    <PermissionGuard permission="realtime:view">
      <div style={{ marginBottom: 12 }}>
        <StatusBadge status={gatewayOk ? "OPERATIONAL" : "UNAVAILABLE"} />
        <button
          type="button"
          className="admin-btn"
          style={{ marginLeft: 8 }}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {loading && !data ? <p className="admin-muted">Loading…</p> : null}
      <div className="admin-stats-grid" style={{ marginBottom: 14 }}>
        <StatsCard
          label="Active connections"
          value={fmtMetric(data?.activeConnections ?? analytics?.activeConnections)}
        />
        <StatsCard
          label="Peak connections"
          value={fmtMetric(data?.peakConnections ?? analytics?.peakConnections)}
        />
        <StatsCard
          label="Events/sec"
          value={fmtMetric(analytics?.eventsPerSec ?? data?.eventsPerSec)}
        />
        <StatsCard
          label="Avg latency"
          value={fmtMetric(analytics?.avgLatencyMs ?? data?.avgLatencyMs)}
        />
        <StatsCard
          label="Active rooms"
          value={fmtMetric(data?.activeRooms ?? analytics?.activeRooms)}
        />
        <StatsCard
          label="Online users"
          value={fmtMetric(data?.onlineUsers ?? analytics?.onlineUsers)}
        />
      </div>
      <p className="admin-muted">
        Metrics marked “Metric unavailable” are not measured by the gateway yet
        (never invented).
      </p>
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
        emptyTitle="No online socket users."
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
        emptyTitle="No active connections."
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
        emptyTitle="No active rooms."
        columns={[
          { key: "id", header: "Room", render: (r) => r.roomId || r.id },
          { key: "type", header: "Type", render: (r) => r.roomType || r.type || "—" },
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
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await adminRealtimeApi.events(150);
        if (!cancelled) setRows(res.data || []);
        if (!cancelled) setError("");
      } catch (err: any) {
        if (!cancelled)
          setError(err?.response?.data?.message || "Event stream unavailable");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [paused]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, filter]);

  return (
    <PermissionGuard permission="realtime:events">
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          className="admin-input"
          placeholder="Filter events…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="admin-btn"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        emptyTitle="No events yet."
        columns={[
          {
            key: "ts",
            header: "Time",
            render: (r) =>
              r.at || r.timestamp
                ? new Date(r.at || r.timestamp).toLocaleTimeString()
                : "—",
          },
          {
            key: "event",
            header: "Event",
            render: (r) => r.name || r.event || "—",
          },
          {
            key: "source",
            header: "Source",
            render: (r) =>
              r.direction || r.payload?.source || r.source || "—",
          },
          { key: "user", header: "User", render: (r) => r.userId || "—" },
          { key: "room", header: "Room", render: (r) => r.room || "—" },
          {
            key: "status",
            header: "Status",
            render: (r) => r.payload?.status || r.status || "ok",
          },
        ]}
        rows={filtered}
        rowKey={(r) =>
          String(r.id || `${r.at || r.timestamp}-${r.name || r.event}-${r.userId || ""}`)
        }
      />
    </PermissionGuard>
  );
};

const BroadcastCenter: FC = () => {
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<"everyone" | "online">("online");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const send = async () => {
    if (!message.trim()) {
      setError("Message required");
      return;
    }
    try {
      setError("");
      const res = await adminRealtimeApi.broadcast({
        message: message.trim(),
        title: title.trim() || undefined,
        target,
      });
      const d = res.data || res;
      setResult(
        `sent=${d.sent ?? "?"} delivered=${d.delivered ?? "?"} failed=${d.failed ?? "?"}`
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Broadcast failed");
    }
  };

  return (
    <PermissionGuard permission="realtime:broadcast">
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <input
          className="admin-input"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="admin-input"
          rows={4}
          placeholder="Broadcast message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <select
          className="admin-input"
          value={target}
          onChange={(e) => setTarget(e.target.value as any)}
        >
          <option value="online">Online users</option>
          <option value="everyone">Everyone (connected sockets)</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void send()}>
          Send broadcast
        </button>
        {error ? <p className="admin-error">{error}</p> : null}
        {result ? <p className="admin-muted">{result}</p> : null}
      </div>
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
        emptyTitle="No recent submissions."
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
          { key: "problem", header: "Problem", render: (r) => r.problemId || "—" },
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
