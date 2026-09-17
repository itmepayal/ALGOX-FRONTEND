import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

export const REALTIME_API_URL = SERVICE_URLS.realtime;

export const realtimeClient = createServiceClient(`${REALTIME_API_URL}/api/v1`);

function metricOrUnavailable(value: unknown): string | number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Metric unavailable";
  }
  return value as number | string;
}

export const adminRealtimeApi = {
  overview: async () => {
    const res = await realtimeClient.get("/admin/realtime/overview");
    return res.data;
  },
  users: async () => {
    const res = await realtimeClient.get("/admin/realtime/users");
    return res.data;
  },
  connections: async () => {
    const res = await realtimeClient.get("/admin/realtime/connections");
    return res.data;
  },
  rooms: async () => {
    const res = await realtimeClient.get("/admin/realtime/rooms");
    return res.data;
  },
  events: async (limit = 100) => {
    const res = await realtimeClient.get("/admin/realtime/events", {
      params: { limit },
    });
    return res.data;
  },
  analytics: async () => {
    const res = await realtimeClient.get("/admin/realtime/analytics");
    return res.data;
  },
  broadcast: async (payload: {
    message: string;
    title?: string;
    target: "everyone" | "online" | "users" | "roles" | "contest";
    userIds?: string[];
    roles?: string[];
    contestId?: string;
  }) => {
    const res = await realtimeClient.post("/admin/realtime/broadcast", payload);
    return res.data;
  },
  disconnect: async (connectionId: string) => {
    const res = await realtimeClient.post(
      `/admin/realtime/connections/${connectionId}/disconnect`
    );
    return res.data;
  },
  metricOrUnavailable,
};
