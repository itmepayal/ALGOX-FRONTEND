import { problemClient } from "./problemApi";

export interface VirtualContestSession {
  id: string;
  userId: string;
  sourceContestId: string;
  sourceContestSlug: string;
  mode: "practice" | "virtual";
  status: "in_progress" | "timed_out" | "completed" | "abandoned";
  problemIds: string[];
  attempts: Array<{
    problemId: string;
    submissionId?: string;
    status: string;
    solved: boolean;
    at: string;
  }>;
  startedAt: string;
  endsAt: string;
  completedAt?: string | null;
  remainingMs: number;
  serverNow: string;
  report?: {
    solvedCount: number;
    attemptedCount: number;
    recommendations: Array<{
      title: string;
      evidence: string;
      action: string;
    }>;
    note: string;
  } | null;
}

export interface VirtualContestAnalytics {
  session: VirtualContestSession;
  breakdown: {
    solvedCount: number;
    attemptedCount: number;
    unsolvedCount: number;
    mode: "practice" | "virtual";
    ratingImpact: string;
  };
  recommendations: Array<{
    title: string;
    evidence: string;
    action: string;
  }>;
}

export const virtualContestApi = {
  start: async (contestSlug: string, mode: "practice" | "virtual" = "virtual") => {
    const res = await problemClient.post("/virtual-contests/start", {
      contestSlug,
      mode,
    });
    return res.data as { success: boolean; data: VirtualContestSession };
  },

  getActive: async () => {
    const res = await problemClient.get("/virtual-contests/active");
    return res.data as { success: boolean; data: VirtualContestSession | null };
  },

  getById: async (sessionId: string) => {
    const res = await problemClient.get(
      `/virtual-contests/${encodeURIComponent(sessionId)}`
    );
    return res.data as { success: boolean; data: VirtualContestSession };
  },

  complete: async (sessionId: string) => {
    const res = await problemClient.post(
      `/virtual-contests/${encodeURIComponent(sessionId)}/complete`
    );
    return res.data as { success: boolean; data: VirtualContestSession };
  },

  abandon: async (sessionId: string) => {
    const res = await problemClient.post(
      `/virtual-contests/${encodeURIComponent(sessionId)}/abandon`
    );
    return res.data as { success: boolean; data: VirtualContestSession };
  },

  analytics: async (sessionId: string) => {
    const res = await problemClient.get(
      `/virtual-contests/${encodeURIComponent(sessionId)}/analytics`
    );
    return res.data as {
      success: boolean;
      data: VirtualContestAnalytics;
    };
  },
};
