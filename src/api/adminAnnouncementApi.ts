import { authClient } from "./authClient";

export interface AdminAnnouncement {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority?: string;
  status: string;
  audience: string;
  actionUrl?: string;
  scheduledAt?: string;
  publishedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export const adminAnnouncementApi = {
  list: async (params?: Record<string, string | number | undefined>) => {
    const res = await authClient.get("/auth/admin/announcements", { params });
    return res.data as {
      success: boolean;
      data: AdminAnnouncement[];
      meta?: { total: number; page: number; limit: number; totalPages: number };
    };
  },

  create: async (payload: Partial<AdminAnnouncement>) => {
    const res = await authClient.post("/auth/admin/announcements", payload);
    return res.data;
  },

  update: async (id: string, payload: Partial<AdminAnnouncement>) => {
    const res = await authClient.patch(`/auth/admin/announcements/${id}`, payload);
    return res.data;
  },

  publish: async (id: string) => {
    const res = await authClient.post(`/auth/admin/announcements/${id}/publish`);
    return res.data;
  },

  schedule: async (id: string, scheduledAt: string) => {
    const res = await authClient.post(`/auth/admin/announcements/${id}/schedule`, {
      scheduledAt,
    });
    return res.data;
  },

  expire: async (id: string) => {
    const res = await authClient.post(`/auth/admin/announcements/${id}/expire`);
    return res.data;
  },

  archive: async (id: string) => {
    const res = await authClient.post(`/auth/admin/announcements/${id}/archive`);
    return res.data;
  },
};

