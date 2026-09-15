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

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username?: string;
  name?: string;
  score?: number;
  problemsSolved?: number;
  solvedCount?: number;
}

export const leaderboardApi = {
  getLeaderboard: async (params?: {
    period?: LeaderboardPeriod;
    page?: number;
    limit?: number;
  }) => {
    const period =
      params?.period === "all" ? "global" : params?.period || "global";
    const res = await client.get("/leaderboard/", {
      params: { ...params, period },
    });
    return res.data as {
      success: boolean;
      data: LeaderboardEntry[];
      meta?: {
        total: number;
        page: number;
        totalPages: number;
        period?: string;
      };
    };
  },
};
