import { problemClient } from "./problemApi";

export type ContestStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "ENDED"
  | "ARCHIVED";

export interface AdminContest {
  id?: string;
  _id?: string;
  title: string;
  slug: string;
  description?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: ContestStatus;
  rules?: string;
  problems?: ContestProblemRow[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ContestProblemRow {
  id?: string;
  _id?: string;
  problemId:
    | string
    | {
        _id?: string;
        id?: string;
        title?: string;
        slug?: string;
        difficulty?: string;
        status?: string;
      };
  points?: number;
  order?: number;
}

export interface ContestParticipant {
  id?: string;
  _id?: string;
  userId: string;
  score?: number;
  penalty?: number;
  registeredAt?: string;
}

export interface ContestLeaderboardRow {
  rank?: number;
  userId?: string;
  score?: number;
  penalty?: number;
  solvedCount?: number;
}

function cid(c: { id?: string; _id?: string }) {
  return String(c.id || c._id || "");
}

export const adminContestApi = {
  list: async (includeArchived = true) => {
    const res = await problemClient.get("/admin/contests", {
      params: { includeArchived: includeArchived ? "true" : "false" },
    });
    return res.data as { success: boolean; data: AdminContest[] };
  },

  get: async (id: string) => {
    const res = await problemClient.get(`/admin/contests/${id}`);
    return res.data as { success: boolean; data: AdminContest };
  },

  create: async (payload: {
    title: string;
    slug: string;
    description?: string;
    startTime: string;
    endTime: string;
    durationMinutes?: number;
    rules?: string;
    status?: ContestStatus;
  }) => {
    const res = await problemClient.post("/admin/contests", payload);
    return res.data as { success: boolean; data: AdminContest };
  },

  update: async (
    id: string,
    payload: Partial<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      rules: string;
    }>
  ) => {
    const res = await problemClient.patch(`/admin/contests/${id}`, payload);
    return res.data as { success: boolean; data: AdminContest };
  },

  remove: async (id: string) => {
    const res = await problemClient.delete(`/admin/contests/${id}`);
    return res.data as { success: boolean; data: AdminContest };
  },

  publish: async (id: string) => {
    const res = await problemClient.post(`/admin/contests/${id}/publish`);
    return res.data as { success: boolean; data: AdminContest };
  },

  schedule: async (id: string) => {
    const res = await problemClient.post(`/admin/contests/${id}/schedule`);
    return res.data as { success: boolean; data: AdminContest };
  },

  start: async (id: string) => {
    const res = await problemClient.post(`/admin/contests/${id}/start`);
    return res.data as { success: boolean; data: AdminContest };
  },

  end: async (id: string) => {
    const res = await problemClient.post(`/admin/contests/${id}/end`);
    return res.data as { success: boolean; data: AdminContest };
  },

  archive: async (id: string) => {
    const res = await problemClient.post(`/admin/contests/${id}/archive`);
    return res.data as { success: boolean; data: AdminContest };
  },

  addProblem: async (
    id: string,
    payload: { problemId: string; points?: number; order?: number }
  ) => {
    const res = await problemClient.post(
      `/admin/contests/${id}/problems`,
      payload
    );
    return res.data;
  },

  removeProblem: async (id: string, problemId: string) => {
    const res = await problemClient.delete(
      `/admin/contests/${id}/problems/${problemId}`
    );
    return res.data;
  },

  listParticipants: async (id: string) => {
    const res = await problemClient.get(
      `/admin/contests/${id}/participants`
    );
    return res.data as { success: boolean; data: ContestParticipant[] };
  },

  leaderboard: async (id: string, recompute = false) => {
    const res = await problemClient.get(
      `/admin/contests/${id}/leaderboard`,
      { params: { recompute: recompute ? "true" : undefined } }
    );
    return res.data as {
      success: boolean;
      data: ContestLeaderboardRow[] | { rankings?: ContestLeaderboardRow[] };
    };
  },

  id: cid,
};
