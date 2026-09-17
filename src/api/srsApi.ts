import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

const client = createServiceClient(SERVICE_URLS.problem);

export type SrsFeedback = "hard" | "okay" | "easy";

export interface SrsCard {
  id: string;
  userId: string;
  problemId: string;
  difficulty: string;
  lastSolvedAt: string | null;
  lastReviewedAt: string | null;
  confidence: SrsFeedback | null;
  confidenceScore: number;
  attempts: number;
  reviewCount: number;
  intervalDays: number;
  nextReviewAt: string;
  status: "active" | "graduated" | "paused";
  createdAt?: string;
  updatedAt?: string;
}

export interface SrsQueuePayload {
  timezone: string;
  todayKey: string;
  premium: boolean;
  limits: { maxCards: number };
  counts: {
    overdue: number;
    dueToday: number;
    upcoming: number;
    completed: number;
    active: number;
  };
  buckets: {
    overdue: SrsCard[];
    dueToday: SrsCard[];
    upcoming: SrsCard[];
    completed: SrsCard[];
  };
  items: SrsCard[];
  recommendations: Array<{
    type: string;
    title: string;
    evidence: string;
    problemId?: string;
  }>;
  algorithm: { standard: string; advanced: string | null };
}

export const srsApi = {
  getQueue: async (bucket?: string) => {
    const res = await client.get("/reviews/queue", {
      params: bucket ? { bucket } : undefined,
    });
    return res.data as { success: boolean; data: SrsQueuePayload };
  },

  enroll: async (problemId: string) => {
    const res = await client.post(`/reviews/enroll/${encodeURIComponent(problemId)}`);
    return res.data as {
      success: boolean;
      data: { created: boolean; duplicate: boolean; card: SrsCard };
    };
  },

  review: async (problemId: string, feedback: SrsFeedback) => {
    const res = await client.post(
      `/reviews/${encodeURIComponent(problemId)}/review`,
      { feedback }
    );
    return res.data as {
      success: boolean;
      data: {
        card: SrsCard;
        schedule: {
          previousIntervalDays: number;
          intervalDays: number;
          nextReviewAt: string;
          feedback: SrsFeedback;
          advanced: boolean;
        };
      };
    };
  },

  reschedule: async (
    problemId: string,
    body: { nextReviewAt?: string; delayDays?: number }
  ) => {
    const res = await client.post(
      `/reviews/${encodeURIComponent(problemId)}/reschedule`,
      body
    );
    return res.data as { success: boolean; data: { card: SrsCard } };
  },

  setStatus: async (
    problemId: string,
    status: "active" | "paused" | "graduated"
  ) => {
    const res = await client.post(
      `/reviews/${encodeURIComponent(problemId)}/status`,
      { status }
    );
    return res.data as { success: boolean; data: { card: SrsCard } };
  },

  getTimezone: async () => {
    const res = await client.get("/reviews/timezone");
    return res.data as { success: boolean; data: { timezone: string } };
  },

  setTimezone: async (timezone: string) => {
    const res = await client.put("/reviews/timezone", { timezone });
    return res.data as { success: boolean; data: { timezone: string } };
  },
};
