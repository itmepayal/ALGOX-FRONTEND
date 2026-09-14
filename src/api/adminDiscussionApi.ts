import axios from "axios";

export const DISCUSSION_API_URL = "http://localhost:3008/api/v1";

export const discussionClient = axios.create({
  baseURL: DISCUSSION_API_URL,
  headers: { "Content-Type": "application/json" },
});

discussionClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface AdminDiscussionPost {
  _id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  status: string;
  isPinned: boolean;
  isLocked: boolean;
  upvotes: number;
  commentCount: number;
  viewsCount: number;
  createdAt: string;
  tags?: string[];
}

export interface AdminReport {
  _id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  description?: string;
  priority: string;
  status: string;
  resolution?: string;
  createdAt: string;
}

export const adminDiscussionApi = {
  listPosts: async (params?: Record<string, string | number | undefined>) => {
    const res = await discussionClient.get("/discussions/admin/posts", { params });
    return res.data as {
      success: boolean;
      data: { posts: AdminDiscussionPost[]; total: number; page: number; totalPages: number };
    };
  },

  moderate: async (
    id: string,
    action: "pin" | "unpin" | "lock" | "unlock" | "hide" | "restore" | "delete"
  ) => {
    const res = await discussionClient.post(`/discussions/admin/posts/${id}/moderate`, {
      action,
    });
    return res.data;
  },

  listReports: async (params?: Record<string, string | number | undefined>) => {
    const res = await discussionClient.get("/discussions/admin/reports", { params });
    return res.data as {
      success: boolean;
      data: AdminReport[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    };
  },

  reviewReport: async (id: string) => {
    const res = await discussionClient.post(`/discussions/admin/reports/${id}/review`);
    return res.data;
  },

  resolveReport: async (id: string, resolution?: string) => {
    const res = await discussionClient.post(`/discussions/admin/reports/${id}/resolve`, {
      resolution,
    });
    return res.data;
  },

  dismissReport: async (id: string, resolution?: string) => {
    const res = await discussionClient.post(`/discussions/admin/reports/${id}/dismiss`, {
      resolution,
    });
    return res.data;
  },

  reopenReport: async (id: string) => {
    const res = await discussionClient.post(`/discussions/admin/reports/${id}/reopen`);
    return res.data;
  },
};
