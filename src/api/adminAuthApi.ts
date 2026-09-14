import { authClient } from "./authClient";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: "active" | "suspended" | "banned";
  isEmailVerified?: boolean;
  twoFactorEnabled?: boolean;
  lastActiveAt?: string;
  createdAt?: string;
  updatedAt?: string;
  permissions?: string[];
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const adminAuthApi = {
  getMyPermissions: async () => {
    const res = await authClient.get("/auth/admin/me/permissions");
    return res.data as {
      success: boolean;
      data: { role: string; permissions: string[] };
    };
  },

  listUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }) => {
    const res = await authClient.get("/auth/admin/users", { params });
    return res.data as { success: boolean; data: AdminUser[]; meta: PageMeta };
  },

  getUser: async (id: string) => {
    const res = await authClient.get(`/auth/admin/users/${id}`);
    return res.data as { success: boolean; data: AdminUser };
  },

  updateRole: async (id: string, role: string) => {
    const res = await authClient.patch(`/auth/admin/users/${id}/role`, { role });
    return res.data as { success: boolean; data: AdminUser };
  },

  updateStatus: async (id: string, status: string) => {
    const res = await authClient.patch(`/auth/admin/users/${id}/status`, {
      status,
    });
    return res.data as { success: boolean; data: AdminUser };
  },

  listAuditLogs: async (params?: {
    page?: number;
    limit?: number;
    resource?: string;
    action?: string;
    actorId?: string;
  }) => {
    const res = await authClient.get("/auth/admin/audit-logs", { params });
    return res.data as { success: boolean; data: AuditLog[]; meta: PageMeta };
  },
};
