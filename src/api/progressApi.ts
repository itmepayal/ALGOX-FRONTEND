import axios from "axios";
import { PROBLEM_API_URL } from "./problemApi";

export interface ProgressImportPreview {
  totalSubmissions: number;
  uniqueProblems: number;
  solvedProblems: number;
  attemptedProblems: number;
  alreadyImportedProblems: number;
  newProblems: number;
  affectedSheets: number;
  revisionItemsAffected: number;
  activityDays: number;
  lastSubmissionAt: string | null;
  estimatedChanges: {
    progressUpserts: number;
    sheetSyncs: number;
    weakProblemFlags: number;
  };
}

export interface ProgressImportResult extends ProgressImportPreview {
  updatedProblems: number;
  sheetsSynced: Array<{
    sheetId: string;
    sheetName: string;
    solvedInSheet: number;
    attemptedInSheet: number;
    totalInSheet: number;
  }>;
  dashboard: {
    solvedProblems: number;
    attemptedProblems: number;
    uniqueProblems: number;
    totalSubmissions: number;
  };
  activity: {
    activeDays: number;
    lastActivityAt: string | null;
  };
  lastImportedAt: string;
}

export interface ProgressImportStatus {
  totalSubmissions: number;
  problemsAttempted: number;
  problemsSolved: number;
  problemsAttemptedOnly?: number;
  totalProgressRecords: number;
  lastSubmissionDate: string | null;
  lastSyncDate: string | null;
  hasImportedBefore: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const progressClient = axios.create({
  baseURL: PROBLEM_API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 90000,
});

progressClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const progressApi = {
  getStatus: async () => {
    const res = await progressClient.get<ApiResponse<ProgressImportStatus>>(
      "/progress/import/status"
    );
    return res.data;
  },

  previewImport: async () => {
    const res = await progressClient.post<ApiResponse<ProgressImportPreview>>(
      "/progress/import/preview"
    );
    return res.data;
  },

  importProgress: async () => {
    const res = await progressClient.post<ApiResponse<ProgressImportResult>>(
      "/progress/import"
    );
    return res.data;
  },
};
