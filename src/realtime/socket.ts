import { io, Socket } from "socket.io-client";

const REALTIME_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_REALTIME_URL) ||
  "http://localhost:3010";

let socket: Socket | null = null;

/** Lazily connect authenticated user to RealtimeService. Never trusts client-supplied userId. */
export function connectRealtimeSocket(): Socket | null {
  const token = localStorage.getItem("accessToken");
  if (!token) return null;

  if (socket?.connected) return socket;

  socket = io(REALTIME_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    auth: { token },
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
