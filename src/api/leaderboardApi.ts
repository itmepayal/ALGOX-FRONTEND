import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

const LEADERBOARD_URL = SERVICE_URLS.leaderboard;

const client = createServiceClient(LEADERBOARD_URL);

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

export interface UserLeaderboardStats {
  userId?: string;
  userName?: string;
  solvedEasy?: number;
  solvedMedium?: number;
  solvedHard?: number;
  totalSolved?: number;
  rating?: number;
  globalRank?: number | null;
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

  /** Own or public user stats — 404 when user has never been ranked. */
  getUserStats: async (userId: string) => {
    const res = await client.get(`/leaderboard/user/${encodeURIComponent(userId)}`);
    return res.data as {
      success: boolean;
      message?: string;
      data: UserLeaderboardStats;
    };
  },
};
