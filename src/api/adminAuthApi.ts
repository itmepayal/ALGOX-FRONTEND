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
  mustChangePassword?: boolean;
  deletedAt?: string | null;
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

export interface UserActivityItem {
  id: string;
  type: string;
  action: string;
  detail?: string;
  ip?: string;
  createdAt: string;
}

export interface UserProgress {
  userId: string;
  submissionCount: number;
  acceptedCount: number;
  acceptanceRate: number;
  problemsAttempted: number;
  problemsSolved: number;
  easySolved: number | null;
  mediumSolved: number | null;
  hardSolved: number | null;
  byLanguage: Record<string, number>;
  recentSolved: Array<{
    id: string;
    problemId: string;
    language?: string;
    createdAt?: string;
  }>;
  recentSubmissions: Array<{
    id: string;
    problemId: string;
    status: string;
    language?: string;
    createdAt?: string;
  }>;
}

export interface UserSession {
  id: string;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: string;
  expiresAt?: string;
  expired: boolean;
}

export const adminAuthApi = {
  getMyPermissions: async () => {
    const res = await authClient.get("/auth/admin/me/permissions");
    return res.data as {
      success: boolean;
      data: { role: string; permissions: string[] };
    };
  },

  getRoleMatrix: async () => {
    const res = await authClient.get("/auth/admin/roles/matrix");
    return res.data as {
      success: boolean;
      data: {
        permissions: string[];
        matrix: Record<string, string[]>;
        overrides: Array<{
          role: string;
          updatedBy?: string;
          updatedAt?: string;
        }>;
      };
    };
  },

  updateRolePermissions: async (role: string, permissions: string[]) => {
    const res = await authClient.put(`/auth/admin/roles/${role}/permissions`, {
      permissions,
    });
    return res.data as {
      success: boolean;
      data: { role: string; permissions: string[] };
    };
  },

  resetRolePermissions: async (role: string) => {
    const res = await authClient.post(`/auth/admin/roles/${role}/reset`);
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

  createUser: async (payload: {
    name: string;
    email: string;
    password?: string;
    role?: string;
    status?: string;
  }) => {
    const res = await authClient.post("/auth/admin/users", payload);
    return res.data as {
      success: boolean;
      data: { user: AdminUser; temporaryPassword?: string };
    };
  },

  deleteUser: async (id: string) => {
    const res = await authClient.delete(`/auth/admin/users/${id}`);
    return res.data as { success: boolean; data: AdminUser };
  },

  resetPassword: async (id: string, temporaryPassword?: string) => {
    const res = await authClient.post(`/auth/admin/users/${id}/reset-password`, {
      temporaryPassword,
    });
    return res.data as {
      success: boolean;
      data: { user: AdminUser; temporaryPassword: string };
    };
  },

  getUserActivity: async (
    id: string,
    params?: { page?: number; limit?: number }
  ) => {
    const res = await authClient.get(`/auth/admin/users/${id}/activity`, {
      params,
    });
    return res.data as {
      success: boolean;
      data: UserActivityItem[];
      meta: PageMeta;
    };
  },

  getUserProgress: async (id: string) => {
    const res = await authClient.get(`/auth/admin/users/${id}/progress`);
    return res.data as { success: boolean; data: UserProgress };
  },

  listUserSessions: async (id: string) => {
    const res = await authClient.get(`/auth/admin/users/${id}/sessions`);
    return res.data as { success: boolean; data: UserSession[] };
  },

  revokeUserSession: async (id: string, sessionId: string) => {
    const res = await authClient.delete(
      `/auth/admin/users/${id}/sessions/${sessionId}`
    );
    return res.data as { success: boolean };
  },

  revokeAllUserSessions: async (id: string) => {
    const res = await authClient.delete(`/auth/admin/users/${id}/sessions`);
    return res.data as { success: boolean };
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
