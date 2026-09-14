import { authClient } from "./authClient";

export type JudgeLanguage = "cpp" | "python" | "javascript" | "java";

export interface PlatformSettings {
  platformName: string;
  logoUrl: string;
  faviconUrl: string;
  supportEmail: string;
  tagline: string;
  defaultLanguage: JudgeLanguage;
  supportedLanguages: JudgeLanguage[];
  defaultPageSize: number;
  maxPageSize: number;
  maxSubmissionsPerHour: number;
  maxRunPerHour: number;
  maxCodeLength: number;
  concurrentSubmissionCap: number;
  defaultTimeoutMs: number;
  defaultMemoryMb: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowAdminBypass: boolean;
  registrationEnabled: boolean;
  requireEmailVerification: boolean;
  discussionsEnabled: boolean;
  requireAuthToPost: boolean;
  emailNotificationsEnabled: boolean;
  announceNewSheets: boolean;
  announceMaintenance: boolean;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export type PublicPlatformSettings = Pick<
  PlatformSettings,
  | "platformName"
  | "logoUrl"
  | "faviconUrl"
  | "tagline"
  | "supportEmail"
  | "defaultLanguage"
  | "supportedLanguages"
  | "maintenanceMode"
  | "maintenanceMessage"
  | "allowAdminBypass"
  | "registrationEnabled"
  | "requireEmailVerification"
  | "discussionsEnabled"
  | "requireAuthToPost"
>;

export const adminSettingsApi = {
  get: async () => {
    const res = await authClient.get("/auth/admin/settings");
    return res.data as { success: boolean; data: PlatformSettings; message: string };
  },

  update: async (patch: Partial<PlatformSettings>) => {
    const res = await authClient.patch("/auth/admin/settings", patch);
    return res.data as { success: boolean; data: PlatformSettings; message: string };
  },

  reset: async () => {
    const res = await authClient.post("/auth/admin/settings/reset");
    return res.data as { success: boolean; data: PlatformSettings; message: string };
  },

  getPublic: async () => {
    const res = await authClient.get("/auth/public/settings");
    return res.data as {
      success: boolean;
      data: PublicPlatformSettings;
      message: string;
    };
  },
};
