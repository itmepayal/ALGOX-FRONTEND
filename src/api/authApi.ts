import { authClient } from "./authClient";

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

export const authApi = {
  // Sign Up / Register
  signup: async (userData: { name: string; email: string; password: string }) => {
    const response = await authClient.post<AuthResponse>("/auth/signup", userData);
    if (response.data.data?.token || response.data.data?.accessToken) {
      const token = response.data.data.token || response.data.data.accessToken;
      localStorage.setItem("accessToken", token!);
      localStorage.setItem("user", JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  // Sign In / Login
  signin: async (credentials: { email: string; password: string }) => {
    const response = await authClient.post<AuthResponse>("/auth/login", credentials);
    if (response.data.data?.token || response.data.data?.accessToken) {
      const token = response.data.data.token || response.data.data.accessToken;
      localStorage.setItem("accessToken", token!);
      localStorage.setItem("user", JSON.stringify(response.data.data.user));
    }
    console.log(response);
    return response.data;
  },

  // Verify 2FA Login
  verify2FA: async (userId: string, otp: string) => {
    const response = await authClient.post<AuthResponse>("/auth/login/2fa", { userId, otp });
    if (response.data.data?.token || response.data.data?.accessToken) {
      const token = response.data.data.token || response.data.data.accessToken;
      localStorage.setItem("accessToken", token!);
      localStorage.setItem("user", JSON.stringify(response.data.data.user));
    }
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
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
    }
  },
};
