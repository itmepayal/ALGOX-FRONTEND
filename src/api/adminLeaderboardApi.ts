import axios from "axios";

const LEADERBOARD_URL = "http://localhost:3005/api/v1";

const client = axios.create({
  baseURL: LEADERBOARD_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const adminLeaderboardApi = {
  rebuild: async () => {
    const res = await client.post("/leaderboard/admin/rebuild");
    return res.data;
  },
  resetUser: async (userId: string, note?: string) => {
    const res = await client.post(`/leaderboard/admin/reset-user/${userId}`, {
      note,
    });
    return res.data;
  },
  suspendEntry: async (
    userId: string,
    suspended = true,
    note?: string
  ) => {
    const res = await client.post(
      `/leaderboard/admin/suspend-entry/${userId}`,
      { suspended, note }
    );
    return res.data;
  },
  listAudit: async (params?: { page?: number; limit?: number }) => {
    const res = await client.get("/leaderboard/admin/audit", { params });
    return res.data;
  },
};
