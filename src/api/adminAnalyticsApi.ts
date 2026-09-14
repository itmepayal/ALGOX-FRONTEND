import axios from "axios";

export const ANALYTICS_API_URL = "http://localhost:3007/api/v1";

export const analyticsClient = axios.create({
  baseURL: ANALYTICS_API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

analyticsClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const adminAnalyticsApi = {
  overview: async (range = "30d") => {
    const res = await analyticsClient.get("/analytics/admin/overview", {
      params: { range },
    });
    return res.data as { success: boolean; data: any };
  },

  charts: async (range = "30d") => {
    const res = await analyticsClient.get("/analytics/admin/charts", {
      params: { range },
    });
    return res.data as { success: boolean; data: any };
  },
};

export const HEALTH_ENDPOINTS = [
  { name: "Auth", url: "http://localhost:3001/api/v1/health" },
  { name: "Problem", url: "http://localhost:3003/api/v1/health" },
  { name: "Submission", url: "http://localhost:3004/api/v1/health" },
  { name: "Leaderboard", url: "http://localhost:3005/api/v1/health" },
  { name: "Evaluation", url: "http://localhost:3006/api/v1/health" },
  { name: "Analytics", url: "http://localhost:3007/api/v1/health" },
  { name: "Discussion", url: "http://localhost:3008/health" },
  { name: "Realtime", url: "http://localhost:3010/health" },
] as const;

export async function pingHealth(
  url: string,
  timeoutMs = 4000
): Promise<"healthy" | "offline" | "warning"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) return "healthy";
    return "warning";
  } catch {
    clearTimeout(timer);
    return "offline";
  }
}
