import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

const client = createServiceClient(SERVICE_URLS.problem);

export type SrsFeedback = "hard" | "okay" | "easy";

export interface SrsFeedbackPreview {
  intervalDays: number;
  nextReviewAt: string;
}

export interface SrsCard {
  id: string;
  userId: string;
  problemId: string;
  title: string;
  slug: string | null;
  tags: string[];
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
  feedbackPreview?: {
    hard: SrsFeedbackPreview;
    okay: SrsFeedbackPreview;
    easy: SrsFeedbackPreview;
  };
}

export interface SrsImportCandidate {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  solvedAt: string | null;
  enrolled: boolean;
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
  reviewLoad?: {
    today: number;
    tomorrow: number;
    thisWeek: number;
  };
  upcomingByDay?: Array<{ dateKey: string; count: number }>;
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
  algorithm: {
    standard: string;
    advanced: string | null;
    rules?: {
      free: { hard: string; okay: string; easy: string };
      premium: {
        hard: string;
        okay: string;
        easy: string;
        reschedule: string;
      };
    };
  };
}

export const srsApi = {
  getQueue: async (bucket?: string) => {
    const res = await client.get("/reviews/queue", {
      params: bucket ? { bucket } : undefined,
    });
    return res.data as { success: boolean; data: SrsQueuePayload };
  },

  enroll: async (problemId: string) => {
    const res = await client.post(
      `/reviews/enroll/${encodeURIComponent(problemId)}`
    );
    return res.data as {
      success: boolean;
      data: { created: boolean; duplicate: boolean; card: SrsCard };
    };
  },

  listImportCandidates: async () => {
    const res = await client.get("/reviews/import-candidates");
    return res.data as {
      success: boolean;
      data: {
        items: SrsImportCandidate[];
        sources: { progress: number; submissions: number };
      };
    };
  },

  /** Idempotent import of revision cards from ACCEPTED / SOLVED progress. */
  syncFromSolved: async (problemIds?: string[]) => {
    const res = await client.post("/reviews/sync-from-solved", {
      problemIds: problemIds?.length ? problemIds : undefined,
    });
    return res.data as {
      success: boolean;
      data: {
        scanned: number;
        created: number;
        existing: number;
        sources: { progress: number; submissions: number };
      };
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
          duplicate?: boolean;
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
