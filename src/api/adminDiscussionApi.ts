import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

export const DISCUSSION_API_URL = SERVICE_URLS.discussion;

export const discussionClient = createServiceClient(DISCUSSION_API_URL);

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
  assignedTo?: string | null;
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

  getReport: async (id: string) => {
    const res = await discussionClient.get(`/discussions/admin/reports/${id}`);
    return res.data as { success: boolean; data: AdminReport; message?: string };
  },

  /** Assign report to current admin (or optional assignedTo userId). */
  assignReport: async (id: string, assignedTo?: string) => {
    const res = await discussionClient.post(
      `/discussions/admin/reports/${id}/assign`,
      assignedTo ? { assignedTo } : {}
    );
    return res.data as { success: boolean; data: AdminReport; message?: string };
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
