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

  favouriteAnalytics: async () => {
    const res = await problemClient.get<
      ApiResponse<{
        mostFavourited: Array<{
          id: string;
          title: string;
          slug: string;
          difficulty: string;
          category: string;
          favouriteCount: number;
          isPremium: boolean;
        }>;
        trends: Array<{ date: string; count: number }>;
        freeFavourites: number;
        premiumFavourites: number;
        mostFavouritedFree: Array<{
          id: string;
          title: string;
          favouriteCount: number;
          isPremium: boolean;
        }>;
        mostFavouritedPremium: Array<{
          id: string;
          title: string;
          favouriteCount: number;
          isPremium: boolean;
        }>;
      }>
    >("/problems/admin/favourite-analytics");
    return res.data;
  },

  /** Authoritative catalog aggregates (no client-side paging caps). */
  internalStats: async (params?: { status?: string }) => {
    const res = await problemClient.get<
      ApiResponse<{
        total: number;
        draft: number;
        published: number;
        archived: number;
        today: number;
        catalogStatus?: string;
        matchedProblems?: number;
        byDifficulty: Record<string, number>;
        byCategory?: Record<string, number>;
        byTopic: Record<string, number>;
      }>
    >("/problems/admin/internal-stats", { params });
    return res.data;
  },

  /**
   * Batch title/difficulty lookup for exact problem IDs (dashboard enrichment).
   * Max 100 IDs per request on the server.
   */
  lookupTitles: async (ids: string[]) => {
    const unique = [...new Set(ids.map(String).filter(Boolean))];
    if (unique.length === 0) {
      return { success: true, message: "ok", data: [] as Array<{
        id: string;
        title: string;
        difficulty?: string;
        slug?: string;
      }> };
    }
    const res = await problemClient.get<
      ApiResponse<
        Array<{
          id: string;
          title: string;
          difficulty?: string;
          slug?: string;
        }>
      >
    >("/problems/admin/titles", {
      params: { ids: unique.join(",") },
    });
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
