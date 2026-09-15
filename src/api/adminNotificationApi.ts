import { authClient } from "./authClient";

export interface AdminNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
}

export const adminNotificationApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    type?: string;
    read?: string;
    search?: string;
  }) => {
    const res = await authClient.get("/auth/admin/notifications", { params });
    return res.data as {
      success: boolean;
      data: AdminNotification[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
  },

  create: async (payload: {
    title: string;
    message: string;
    type?: string;
    target: "user" | "role" | "broadcast";
    userId?: string;
    roles?: string[];
    expiresAt?: string | null;
    scheduledAt?: string | null;
  }) => {
    const res = await authClient.post("/auth/admin/notifications", payload);
    return res.data as {
      success: boolean;
      data: {
        recipientCount?: number;
        type?: string;
        title: string;
        scheduled?: boolean;
        campaignId?: string;
        scheduledAt?: string;
      };
    };
  },

  remove: async (id: string) => {
    const res = await authClient.delete(`/auth/admin/notifications/${id}`);
    return res.data;
  },

  listCampaigns: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const res = await authClient.get("/auth/admin/notifications/campaigns", {
      params,
    });
    return res.data as {
      success: boolean;
      data: Array<{
        id: string;
        title: string;
        message: string;
        status: string;
        target: string;
        scheduledAt?: string;
        sentAt?: string | null;
        recipientCount?: number;
      }>;
      meta: PageMetaLike;
    };
  },

  cancelCampaign: async (id: string) => {
    const res = await authClient.post(
      `/auth/admin/notifications/campaigns/${id}/cancel`
    );
    return res.data;
  },
};

type PageMetaLike = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
