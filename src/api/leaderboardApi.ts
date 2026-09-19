import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

const LEADERBOARD_URL = SERVICE_URLS.leaderboard;

const client = createServiceClient(LEADERBOARD_URL);

/** Client UI period — mapped to backend `global` for All Time. */
export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all";

/**
 * Real LeaderboardService ranking row shape.
 * @see server/LeaderboardService repositories/leaderboard.repository.ts
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  /** Denormalized public display name from UserStats (not Mongo id). */
  userName?: string;
  /** Legacy aliases — prefer userName. */
  username?: string;
  name?: string;
  solvedEasy?: number;
  solvedMedium?: number;
  solvedHard?: number;
  totalSolved?: number;
  /** Legacy aliases — prefer totalSolved. */
  problemsSolved?: number;
  solvedCount?: number;
  rating?: number;
  score?: number;
}

export interface LeaderboardMeta {
  total: number;
  page: number;
  totalPages: number;
  period?: string;
  from?: string;
  to?: string;
  message?: string;
}

export interface UserLeaderboardStats {
  userId?: string;
  userName?: string;
  solvedEasy?: number;
  solvedMedium?: number;
  solvedHard?: number;
  totalSolved?: number;
  rating?: number;
  /** 1-based global Redis rank when available; null/absent if unranked. */
  globalRank?: number | null;
  score?: number;
}

export const leaderboardApi = {
  getLeaderboard: async (params?: {
    period?: LeaderboardPeriod;
    page?: number;
    limit?: number;
  }) => {
    const period =
      params?.period === "all" ? "global" : params?.period || "global";
    const { page, limit } = params || {};
    const res = await client.get("/leaderboard/", {
      params: { period, page, limit },
    });
    return res.data as {
      success: boolean;
      data: LeaderboardEntry[];
      meta?: LeaderboardMeta;
    };
  },

  /** Own or looked-up user stats — 404 when user has never been ranked. */
  getUserStats: async (userId: string) => {
    const res = await client.get(
      `/leaderboard/user/${encodeURIComponent(userId)}`
    );
    return res.data as {
      success: boolean;
      message?: string;
      data: UserLeaderboardStats;
    };
  },
};
