import {
  submissionClient,
  type Submission,
} from "./submissionApi";

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const adminSubmissionApi = {
  list: async (params?: Record<string, string | number | undefined>) => {
    const res = await submissionClient.get("/submissions/admin/list", {
      params,
    });
    return res.data as {
      success: boolean;
      data: Submission[];
      meta: PageMeta;
    };
  },

  listFailed: async (params?: Record<string, string | number | undefined>) => {
    const res = await submissionClient.get("/submissions/admin/failed", {
      params,
    });
    return res.data as {
      success: boolean;
      data: Submission[];
      meta: PageMeta;
    };
  },

  internalStats: async (days = 30) => {
    const res = await submissionClient.get(
      "/submissions/admin/internal-stats",
      { params: { days } }
    );
    return res.data as { success: boolean; data: Record<string, unknown> };
  },

  problemStats: async (problemId: string, days = 30) => {
    const res = await submissionClient.get(
      `/submissions/admin/problem-stats/${problemId}`,
      { params: { days } }
    );
    return res.data as { success: boolean; data: Record<string, unknown> };
  },

  getById: async (id: string) => {
    const res = await submissionClient.get(`/submissions/admin/${id}`);
    return res.data as { success: boolean; data: Submission };
  },

  remove: async (id: string) => {
    const res = await submissionClient.delete(`/submissions/${id}`);
    return res.data;
  },
};
