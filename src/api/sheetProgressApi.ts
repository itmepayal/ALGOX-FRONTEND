import { PROBLEM_API_URL } from "./problemApi";
import { createServiceClient } from "./authClient";

export const STRIVER_A2Z_SHEET_ID = "striver-a2z";
export const STRIVER_A2Z_SHEET_NAME =
  "AlgoPath Sheet - Learn DSA from A to Z";

export interface SheetProgress {
  sheetId: string;
  sheetName?: string;
  resetAt: string | null;
  completed: number;
  total: number;
  progress: number;
  hasResetBoundary?: boolean;
  lastSyncedAt?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const sheetClient = createServiceClient(PROBLEM_API_URL);

export const sheetProgressApi = {
  getProgress: async (sheetId: string) => {
    const res = await sheetClient.get<ApiResponse<SheetProgress>>(
      `/problems/sheets/${encodeURIComponent(sheetId)}/progress`
    );
    return res.data;
  },

  resetProgress: async (sheetId: string) => {
    const res = await sheetClient.post<ApiResponse<SheetProgress>>(
      `/problems/sheets/${encodeURIComponent(sheetId)}/reset-progress`
    );
    return res.data;
  },
};
