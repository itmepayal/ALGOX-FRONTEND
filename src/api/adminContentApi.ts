import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

const CONTENT_API_URL = SERVICE_URLS.content;

export const contentClient = createServiceClient(CONTENT_API_URL);

export const adminContentApi = {
  listArticles: async (params?: Record<string, string | number | undefined>) => {
    const res = await contentClient.get("/content/admin/articles", { params });
    return res.data;
  },
  createArticle: async (payload: Record<string, unknown>) => {
    const res = await contentClient.post("/content/articles", payload);
    return res.data;
  },
  updateArticle: async (id: string, payload: Record<string, unknown>) => {
    const res = await contentClient.patch(`/content/admin/articles/${id}`, payload);
    return res.data;
  },
  deleteArticle: async (id: string) => {
    const res = await contentClient.delete(`/content/admin/articles/${id}`);
    return res.data;
  },
  listStudyPlans: async (params?: Record<string, string | number | undefined>) => {
    const res = await contentClient.get("/content/admin/study-plans", { params });
    return res.data;
  },
  createStudyPlan: async (payload: Record<string, unknown>) => {
    const res = await contentClient.post("/content/study-plans", payload);
    return res.data;
  },
  updateStudyPlan: async (id: string, payload: Record<string, unknown>) => {
    const res = await contentClient.patch(
      `/content/admin/study-plans/${id}`,
      payload
    );
    return res.data;
  },
  deleteStudyPlan: async (id: string) => {
    const res = await contentClient.delete(`/content/admin/study-plans/${id}`);
    return res.data;
  },
  listEditorials: async (params?: Record<string, string | number | undefined>) => {
    const res = await contentClient.get("/content/admin/editorials", { params });
    return res.data;
  },
  upsertEditorial: async (payload: Record<string, unknown>) => {
    const res = await contentClient.post("/content/editorials", payload);
    return res.data;
  },
  deleteEditorial: async (id: string) => {
    const res = await contentClient.delete(`/content/admin/editorials/${id}`);
    return res.data;
  },
  listNotes: async (params?: Record<string, string | number | undefined>) => {
    const res = await contentClient.get("/content/admin/notes", { params });
    return res.data;
  },
  deleteNote: async (id: string) => {
    const res = await contentClient.delete(`/content/admin/notes/${id}`);
    return res.data;
  },

  // ── Companies ──────────────────────────────────────────────────────
  listCompanies: async (params?: Record<string, string | number | undefined>) => {
    const res = await contentClient.get("/content/admin/companies", { params });
    return res.data;
  },
  createCompany: async (payload: Record<string, unknown>) => {
    const res = await contentClient.post("/content/admin/companies", payload);
    return res.data;
  },
  updateCompany: async (id: string, payload: Record<string, unknown>) => {
    const res = await contentClient.patch(
      `/content/admin/companies/${id}`,
      payload
    );
    return res.data;
  },
  deleteCompany: async (id: string) => {
    const res = await contentClient.delete(`/content/admin/companies/${id}`);
    return res.data;
  },
  listCompanyQuestions: async (
    companyId: string,
    params?: Record<string, string | number | undefined>
  ) => {
    const res = await contentClient.get(
      `/content/admin/companies/${companyId}/questions`,
      { params }
    );
    return res.data;
  },
  createCompanyQuestion: async (
    companyId: string,
    payload: Record<string, unknown>
  ) => {
    const res = await contentClient.post(
      `/content/admin/companies/${companyId}/questions`,
      payload
    );
    return res.data;
  },
  deleteCompanyQuestion: async (companyId: string, questionId: string) => {
    const res = await contentClient.delete(
      `/content/admin/companies/${companyId}/questions/${questionId}`
    );
    return res.data;
  },
};
