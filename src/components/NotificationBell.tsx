import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Bell, Loader2 } from "lucide-react";
import { authApi } from "../api/authApi";
import { connectRealtimeSocket } from "../realtime/socket";
import { hasAccessToken } from "../api/accessToken";

const NOTIFICATION_CREATED = "notification.created";

interface NotificationItem {
  id?: string;
  _id?: string;
  title: string;
  message: string;
  read?: boolean;
  createdAt?: string;
}

interface Props {
  enabled?: boolean;
}

export const NotificationBell: FC<Props> = ({ enabled = true }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadUnread = useCallback(async () => {
    if (!enabled || !hasAccessToken()) return;
    try {
      const res = await authApi.unreadNotificationCount();
      const count = (res.data as { count?: number })?.count ?? 0;
      setUnread(count);
    } catch {
      // ignore
    }
  }, [enabled]);

  const loadList = useCallback(async () => {
    if (!enabled || !hasAccessToken()) return;
    setLoading(true);
    try {
      const res = await authApi.listNotifications({ page: 1, limit: 20 });
      setItems((res.data as NotificationItem[]) || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadUnread();
    const id = window.setInterval(() => void loadUnread(), 60_000);
    return () => window.clearInterval(id);
  }, [loadUnread]);

  useEffect(() => {
    if (!enabled || !hasAccessToken()) return;
    const socket = connectRealtimeSocket();
    if (!socket) return;

    const refresh = () => {
      void loadUnread();
      if (open) void loadList();
    };

    socket.on(NOTIFICATION_CREATED, refresh);
    return () => {
      socket.off(NOTIFICATION_CREATED, refresh);
    };
  }, [enabled, loadUnread, loadList, open]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open, loadList]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!enabled) return null;

  const markRead = async (id: string) => {
    try {
      await authApi.markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) => ((n.id || n._id) === id ? { ...n, read: true } : n))
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const markAll = async () => {
    try {
      await authApi.markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="platform-icon-btn"
        title="Notifications"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: "var(--primary)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            maxHeight: 400,
            overflow: "auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <strong style={{ fontSize: "0.9rem" }}>Notifications</strong>
            {unread > 0 && (
              <button
                type="button"
                className="lc-hint-reveal-btn"
                style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                onClick={() => void markAll()}
              >
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-center" style={{ padding: 24 }}>
              <Loader2 size={18} className="spin" />
            </div>
          ) : items.length === 0 ? (
            <p style={{ padding: 16, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              No notifications
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((n) => {
                const id = String(n.id || n._id || "");
                return (
                  <li
                    key={id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border-subtle)",
                      opacity: n.read ? 0.65 : 1,
                      cursor: n.read ? "default" : "pointer",
                    }}
                    onClick={() => {
                      if (!n.read && id) void markRead(id);
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{n.title}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                      {n.message}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
