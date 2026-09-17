import { io, Socket } from "socket.io-client";
import { SERVICE_URLS } from "../api/serviceUrls";
import { getAccessToken } from "../api/accessToken";

const REALTIME_URL = SERVICE_URLS.realtime;

let socket: Socket | null = null;

function buildAuthPayload(): { token: string; reconnecting: boolean } {
  const mgr = socket?.io as { reconnecting?: boolean; _reconnecting?: boolean } | undefined;
  return {
    token: getAccessToken() || "",
    // Socket.IO v4 Manager uses private `_reconnecting`; public typings omit it.
    reconnecting: Boolean(mgr?.reconnecting ?? mgr?._reconnecting),
  };
}

/** Lazily connect authenticated user to RealtimeService. Never trusts client-supplied userId. */
export function connectRealtimeSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) return null;

  // Reuse singleton even while reconnecting — do not spawn duplicate clients.
  if (socket) {
    // Keep auth as a callback so refreshed HTTP tokens apply on reconnect.
    socket.auth = (cb: (data: Record<string, unknown>) => void) => {
      cb(buildAuthPayload());
    };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(REALTIME_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    // Callback auth: always send current access token (+ reconnecting hint).
    auth: (cb) => {
      cb(buildAuthPayload());
    },
    transports: ["websocket", "polling"],
  });

  socket.on("connect_error", (err) => {
    console.warn("[realtime] connect_error", err.message);
  });

  return socket;
}

export function disconnectRealtimeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getRealtimeSocket(): Socket | null {
  return socket;
}
