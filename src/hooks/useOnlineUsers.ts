import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "../api/accessToken";
import {
  connectRealtimeSocket,
  getRealtimeSocket,
} from "../realtime/socket";

const PRESENCE_COUNT = "presence:count";
const PRESENCE_GET = "presence:get";
const PRESENCE_UPDATE = "user.presence.update";
const HEARTBEAT = "user.heartbeat";
const ROOM_JOIN = "room.join";
const ROOM_LEAVE = "room.leave";

export type OnlineUsersState = {
  /** Unique online users; null while loading / unavailable */
  onlineUsers: number | null;
  connected: boolean;
  reconnecting: boolean;
  unavailable: boolean;
};

/**
 * Subscribe to platform-wide unique online user count via RealtimeService.
 * Multi-tab safe (server tracks sockets per userId).
 */
export function useOnlineUsers(options?: {
  problemId?: string | null;
  enabled?: boolean;
}): OnlineUsersState {
  const problemId = options?.problemId ?? null;
  const enabled = options?.enabled !== false;
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const joinedRoomRef = useRef<string | null>(null);

  const applyCount = useCallback((payload: unknown) => {
    const n = Number((payload as any)?.onlineUsers);
    if (Number.isFinite(n) && n >= 0) {
      setOnlineUsers(n);
      setUnavailable(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const token = getAccessToken();
    if (!token) {
      setUnavailable(true);
      setOnlineUsers(null);
      return;
    }

    const socket = connectRealtimeSocket();
    if (!socket) {
      setUnavailable(true);
      return;
    }

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      setUnavailable(false);
      socket.emit(PRESENCE_GET, {}, (res: unknown) => applyCount(res));
      socket.emit(PRESENCE_UPDATE, {
        currentPage: problemId ? "problem" : "app",
        currentProblem: problemId,
        status: "ONLINE",
      });
      if (problemId) {
        const room = `problem:${problemId}`;
        if (joinedRoomRef.current && joinedRoomRef.current !== room) {
          socket.emit(ROOM_LEAVE, { room: joinedRoomRef.current });
        }
        socket.emit(ROOM_JOIN, { room });
        joinedRoomRef.current = room;
      }
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onReconnectAttempt = () => {
      setReconnecting(true);
      setConnected(false);
    };

    const onReconnect = () => {
      setReconnecting(false);
      onConnect();
    };

    const onConnectError = () => {
      if (!socket.connected) {
        setUnavailable(true);
        setConnected(false);
      }
    };

    const onCount = (payload: unknown) => applyCount(payload);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on(PRESENCE_COUNT, onCount);

    // Manager-level reconnect (socket.io-client v4) — not emitted on the Socket.
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);

    if (socket.connected) onConnect();
    else {
      socket.emit(PRESENCE_GET, {}, (res: unknown) => applyCount(res));
    }

    const heartbeat = window.setInterval(() => {
      if (socket.connected) socket.emit(HEARTBEAT);
    }, 30_000);

    return () => {
      window.clearInterval(heartbeat);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off(PRESENCE_COUNT, onCount);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
      if (joinedRoomRef.current) {
        socket.emit(ROOM_LEAVE, { room: joinedRoomRef.current });
        joinedRoomRef.current = null;
      }
    };
  }, [enabled, problemId, applyCount]);

  useEffect(() => {
    if (!enabled) return;
    const socket = getRealtimeSocket();
    if (!socket?.connected) return;
    socket.emit(PRESENCE_UPDATE, {
      currentPage: problemId ? "problem" : "app",
      currentProblem: problemId,
      status: "ONLINE",
    });
  }, [enabled, problemId]);

  return { onlineUsers, connected, reconnecting, unavailable };
}
