import { problemClient, type Problem, type ApiResponse } from "./problemApi";

export type ProblemStatus = "draft" | "published" | "archived";

export interface AdminProblem extends Problem {
  status?: ProblemStatus;
  hints?: string[];
  createdBy?: string;
  updatedBy?: string;
  publishedAt?: string;
}

export const adminProblemApi = {
  list: async (params?: Record<string, string | number | undefined>) => {
    const res = await problemClient.get<ApiResponse<AdminProblem[]>>(
      "/problems/admin/list",
      { params }
    );
    return res.data;
  },

  getById: async (id: string) => {
    const res = await problemClient.get<ApiResponse<AdminProblem>>(
      `/problems/admin/${id}`
    );
    return res.data;
  },

  create: async (payload: Partial<AdminProblem>) => {
    const res = await problemClient.post<ApiResponse<AdminProblem>>(
      "/problems",
      payload
    );
    return res.data;
  },

  update: async (id: string, payload: Partial<AdminProblem>) => {
    const res = await problemClient.put<ApiResponse<AdminProblem>>(
      `/problems/${id}`,
      payload
    );
    return res.data;
  },

  remove: async (id: string) => {
    const res = await problemClient.delete(`/problems/${id}`);
    return res.data;
  },

  setStatus: async (id: string, status: ProblemStatus) => {
    const res = await problemClient.patch<ApiResponse<AdminProblem>>(
      `/problems/admin/${id}/status`,
      { status }
    );
    return res.data;
  },

  duplicate: async (id: string) => {
    const res = await problemClient.post<ApiResponse<AdminProblem>>(
      `/problems/admin/${id}/duplicate`
    );
    return res.data;
  },

  bulk: async (body: {
    ids: string[];
    action: "status" | "difficulty" | "tags";
    status?: ProblemStatus;
    difficulty?: string;
    tags?: string[];
    tagMode?: "replace" | "add";
  }) => {
    const res = await problemClient.post("/problems/admin/bulk", body);
    return res.data;
  },
};
