import { submissionClient } from "./submissionApi";

export interface SuspiciousRow {
  _id: string;
  userId: string;
  submissionId: string;
  signals: string[];
  score: number;
  severity: string;
  status: string;
  resolution?: string;
  createdAt: string;
}

export const adminSuspiciousApi = {
  list: async (params?: Record<string, string | number | undefined>) => {
    const res = await submissionClient.get("/admin/suspicious-submissions", { params });
    return res.data as {
      success: boolean;
      data: SuspiciousRow[];
      meta?: { total: number; page: number; limit: number; totalPages: number };
    };
  },

  review: async (id: string) => {
    const res = await submissionClient.post(`/admin/suspicious-submissions/${id}/review`);
    return res.data;
  },

  confirm: async (id: string, resolution?: string) => {
    const res = await submissionClient.post(`/admin/suspicious-submissions/${id}/confirm`, {
      resolution,
    });
    return res.data;
  },

  dismiss: async (id: string, resolution?: string) => {
    const res = await submissionClient.post(`/admin/suspicious-submissions/${id}/dismiss`, {
      resolution,
    });
    return res.data;
  },
};
