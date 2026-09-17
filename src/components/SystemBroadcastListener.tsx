import { useEffect, useState, type FC } from "react";
import { Megaphone, X } from "lucide-react";
import { connectRealtimeSocket } from "../realtime/socket";
import { hasAccessToken } from "../api/accessToken";

const SYSTEM_BROADCAST = "system.broadcast";

type BroadcastPayload = {
  title?: string;
  message?: string;
  at?: number;
};

/**
 * Listens for admin Broadcast Center `system.broadcast` on the shared realtime socket.
 * Renders a dismissible banner — does not invent notifications or persist locally as SoT.
 */
export const SystemBroadcastListener: FC<{ enabled?: boolean }> = ({
  enabled = true,
}) => {
  const [banner, setBanner] = useState<BroadcastPayload | null>(null);

  useEffect(() => {
    if (!enabled || !hasAccessToken()) return;
    const socket = connectRealtimeSocket();
    if (!socket) return;

    const onBroadcast = (payload: BroadcastPayload) => {
      if (!payload?.message && !payload?.title) return;
      setBanner({
        title: payload.title || "Announcement",
        message: payload.message || "",
        at: payload.at || Date.now(),
      });
    };

    socket.on(SYSTEM_BROADCAST, onBroadcast);
    return () => {
      socket.off(SYSTEM_BROADCAST, onBroadcast);
    };
  }, [enabled]);

  if (!banner) return null;

  return (
    <div
      className="system-broadcast-banner"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 80,
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--border-strong, #333)",
        background: "var(--bg-elevated, #1a1a1a)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        color: "var(--text-main, #fff)",
      }}
    >
      <Megaphone size={18} strokeWidth={1.75} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{banner.title}</div>
        {banner.message ? (
          <div style={{ fontSize: "0.85rem", opacity: 0.9, marginTop: 4 }}>
            {banner.message}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss broadcast"
        onClick={() => setBanner(null)}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          padding: 2,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
