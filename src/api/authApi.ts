import { authClient } from "./authClient";
import { clearAccessToken, setAccessToken } from "./accessToken";
import type { AccessTier, PublicSubscription } from "../access/accessModel";
import type { FeatureId } from "../access/features";

export interface User {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  status?: "active" | "suspended" | "banned";
  isEmailVerified?: boolean;
  twoFactorEnabled?: boolean;
  /** Live permissions from GET /auth/admin/me/permissions when available. */
  permissions?: string[];
  /** Safe entitlement snapshot from AuthService (read-only). */
  subscription?: PublicSubscription;
  /** Server-derived access tier for authenticated users (FREE | PREMIUM). */
  accessTier?: AccessTier;
  /** Server-resolved feature ids for UI (advisory). */
  features?: FeatureId[] | string[];
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user?: User;
    token?: string;
    accessToken?: string;
    require2FA?: boolean;
    userId?: string;
    otp?: string;
    [key: string]: any;
  };
}

function persistSessionFromAuthResponse(data: AuthResponse["data"] | undefined) {
  const token = data?.token || data?.accessToken;
  if (typeof token === "string" && token) {
    setAccessToken(token);
  }
  if (data?.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }
}

export const authApi = {
  // Sign Up / Register
  signup: async (userData: { name: string; email: string; password: string }) => {
    const response = await authClient.post<AuthResponse>("/auth/signup", userData);
    persistSessionFromAuthResponse(response.data.data);
    return response.data;
  },

  // Sign In / Login
  signin: async (credentials: { email: string; password: string }) => {
    const response = await authClient.post<AuthResponse>("/auth/login", credentials);
    persistSessionFromAuthResponse(response.data.data);
    return response.data;
  },

  // Verify 2FA Login
  verify2FA: async (userId: string, otp: string) => {
    const response = await authClient.post<AuthResponse>("/auth/login/2fa", { userId, otp });
    persistSessionFromAuthResponse(response.data.data);
    return response.data;
  },

  requestPasswordReset: async (email: string) => {
    const response = await authClient.post<AuthResponse>("/auth/forgot-password", { email });
    return response.data;
  },

  resetPassword: async (data: { email: string; otp: string; newPassword: string }) => {
    const response = await authClient.post<AuthResponse>("/auth/reset-password", data);
    return response.data;
  },

  // Toggle 2FA Setting
  toggle2FA: async (enable: boolean) => {
    const response = await authClient.post<AuthResponse>("/auth/2fa/toggle", { enable });
    return response.data;
  },

  // Change Password
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await authClient.post<AuthResponse>("/auth/change-password", data);
    return response.data;
  },

  // Send Email Verification Code
  sendEmailVerification: async () => {
    const response = await authClient.post<AuthResponse>("/auth/email/send-verification");
    return response.data;
  },

  // Verify Email OTP
  verifyEmailOtp: async (otp: string) => {
    const response = await authClient.post<AuthResponse>("/auth/email/verify", { otp });
    return response.data;
  },

  getActiveSessions: async () => {
    const response = await authClient.get<AuthResponse>("/auth/sessions");
    return response.data;
  },

  // Revoke Specific Session
  revokeSession: async (sessionId: string) => {
    const response = await authClient.delete<AuthResponse>(`/auth/sessions/${sessionId}`);
    return response.data;
  },

  // Logout All Sessions
  logoutAllSessions: async () => {
    const response = await authClient.post<AuthResponse>("/auth/logout-all");
    return response.data;
  },

  // Get Security Logs
  getSecurityLogs: async () => {
    const response = await authClient.get<AuthResponse>("/auth/security-logs");
    return response.data;
  },

  // Get Current User Profile
  getProfile: async () => {
    const response = await authClient.get<AuthResponse>("/auth/me");
    return response.data;
  },

  // Update Profile (Name & Avatar)
  updateProfile: async (data: { name?: string; avatar?: string }) => {
    const response = await authClient.put<AuthResponse>("/auth/profile", data);
    if (response.data.data) {
      localStorage.setItem("user", JSON.stringify(response.data.data));
    }
    return response.data;
  },

  // Sign Out / Logout
  signout: async () => {
    try {
      await authClient.post("/auth/logout");
    } finally {
      clearAccessToken();
      localStorage.removeItem("user");
    }
  },

  listNotifications: async (params?: {
    page?: number;
    limit?: number;
    read?: string;
    type?: string;
  }) => {
    const response = await authClient.get<AuthResponse>("/auth/notifications", {
      params,
    });
    return response.data;
  },

  unreadNotificationCount: async () => {
    const response = await authClient.get<AuthResponse>(
      "/auth/notifications/unread-count"
    );
    return response.data;
  },

  markNotificationRead: async (id: string) => {
    const response = await authClient.post<AuthResponse>(
      `/auth/notifications/${id}/read`
    );
    return response.data;
  },

  markAllNotificationsRead: async () => {
    const response = await authClient.post<AuthResponse>(
      "/auth/notifications/read-all"
    );
    return response.data;
  },

  listAnnouncements: async () => {
    const response = await authClient.get<AuthResponse>("/auth/announcements");
    return response.data;
  },
};
