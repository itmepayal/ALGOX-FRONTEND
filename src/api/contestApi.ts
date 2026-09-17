import { problemClient } from "./problemApi";

export type ContestStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "ENDED"
  | "ARCHIVED";

export interface ContestProblem {
  _id?: string;
  order?: number;
  points?: number;
  problemId?: {
    _id?: string;
    title?: string;
    slug?: string;
    difficulty?: string;
  };
}

export interface Contest {
  id?: string;
  _id?: string;
  title: string;
  slug: string;
  description?: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  status: ContestStatus;
  rules?: string;
  isRegistered?: boolean;
  participantCount?: number;
  problems?: ContestProblem[];
}

export interface ContestLeaderboardPayload {
  contestId: string;
  slug: string;
  status: string;
  page: number;
  limit: number;
  total: number;
  entries: Array<{
    rank: number;
    userId: string;
    score: number;
    solvedCount: number;
    penalty: number;
  }>;
  myEntry: {
    rank: number;
    userId: string;
    score: number;
    solvedCount: number;
    penalty: number;
  } | null;
}

export interface ContestHistoryPayload {
  contestsEntered: number;
  totalScore: number;
  totalSolved: number;
  items: Array<{
    contestId: string;
    title: string | null;
    slug: string | null;
    status: string | null;
    score: number;
    solvedCount: number;
    penalty: number;
    rank: number | null;
    registeredAt?: string;
  }>;
}

export const contestApi = {
  listContests: async () => {
    const res = await problemClient.get("/contests/");
    return res.data as { success: boolean; data: Contest[]; message?: string };
  },

  getContestBySlug: async (slug: string) => {
    const res = await problemClient.get(`/contests/${slug}`);
    return res.data as { success: boolean; data: Contest; message?: string };
  },

  register: async (slug: string) => {
    const res = await problemClient.post(`/contests/${slug}/register`);
    return res.data as { success: boolean; data: unknown; message?: string };
  },

  getLeaderboard: async (slug: string, params?: { page?: number; limit?: number }) => {
    const res = await problemClient.get(
      `/contests/${encodeURIComponent(slug)}/leaderboard`,
      { params }
    );
    return res.data as {
      success: boolean;
      data: ContestLeaderboardPayload;
    };
  },

  getMySummary: async () => {
    const res = await problemClient.get("/contests/me/summary");
    return res.data as { success: boolean; data: ContestHistoryPayload };
  },
};
