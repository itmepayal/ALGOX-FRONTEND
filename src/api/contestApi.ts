import { problemClient } from "./problemApi";

export type ContestStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "ENDED"
  | "ARCHIVED";

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
};
