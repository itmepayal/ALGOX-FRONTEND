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

  getById: async (id: string) => {
    const res = await submissionClient.get(`/submissions/admin/${id}`);
    return res.data as { success: boolean; data: Submission };
  },

  update: async (id: string, payload: Partial<Submission>) => {
    const res = await submissionClient.put(`/submissions/${id}`, payload);
    return res.data as { success: boolean; data: Submission };
  },

  remove: async (id: string) => {
    const res = await submissionClient.delete(`/submissions/${id}`);
    return res.data;
  },
};
