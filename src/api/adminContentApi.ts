import axios from "axios";

const CONTENT_API_URL =
  import.meta.env.VITE_CONTENT_API_URL || "http://localhost:3009/api/v1";

export const contentClient = axios.create({
  baseURL: CONTENT_API_URL,
  headers: { "Content-Type": "application/json" },
});

contentClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
};
