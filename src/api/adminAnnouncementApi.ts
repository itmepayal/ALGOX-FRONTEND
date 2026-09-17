import { authClient } from "./authClient";

/**
 * Admin announcement — AuthService `adminShape()` uses canonical `id`
 * (Mongo `_id` is never returned to clients).
 */
export interface AdminAnnouncement {
  id: string;
  title: string;
  message: string;
  type: string;
  priority?: string;
  status: string;
  audience: string;
  actionUrl?: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** Resolve announcement id from API row (canonical `id`, legacy `_id` fallback). */
export function announcementId(
  row: { id?: string; _id?: string } | null | undefined
): string {
  if (!row) return "";
  return String(row.id || row._id || "").trim();
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
    return res.data as { success: boolean; data: AdminAnnouncement };
  },

  update: async (id: string, payload: Partial<AdminAnnouncement>) => {
    const res = await authClient.patch(
      `/auth/admin/announcements/${id}`,
      payload
    );
    return res.data as { success: boolean; data: AdminAnnouncement };
  },

  publish: async (id: string) => {
    const res = await authClient.post(
      `/auth/admin/announcements/${id}/publish`
    );
    return res.data as { success: boolean; data: AdminAnnouncement };
  },

  schedule: async (id: string, scheduledAt: string) => {
    const res = await authClient.post(
      `/auth/admin/announcements/${id}/schedule`,
      { scheduledAt }
    );
    return res.data as { success: boolean; data: AdminAnnouncement };
  },

  expire: async (id: string) => {
    const res = await authClient.post(`/auth/admin/announcements/${id}/expire`);
    return res.data as { success: boolean; data: AdminAnnouncement };
  },

  archive: async (id: string) => {
    const res = await authClient.post(
      `/auth/admin/announcements/${id}/archive`
    );
    return res.data as { success: boolean; data: AdminAnnouncement };
  },
};
