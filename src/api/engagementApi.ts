import axios from "axios";
import { PROBLEM_API_URL } from "./problemApi";
import type { Problem } from "./problemApi";

export type UserReaction = "like" | "dislike" | null;

export interface EngagementState {
  likeCount: number;
  dislikeCount: number;
  bookmarkCount?: number;
  currentUserReaction: UserReaction;
  isBookmarked: boolean;
  isRevision?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const engagementClient = axios.create({
  baseURL: PROBLEM_API_URL,
  headers: { "Content-Type": "application/json" },
});

engagementClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const engagementApi = {
  getEngagement: async (problemId: string) => {
    const res = await engagementClient.get<ApiResponse<EngagementState>>(
      `/problems/${problemId}/engagement`
    );
    return res.data;
  },

  setReaction: async (problemId: string, reaction: "like" | "dislike") => {
    const res = await engagementClient.post<ApiResponse<EngagementState>>(
      `/problems/${problemId}/reaction`,
      { reaction }
    );
    return res.data;
  },

  clearReaction: async (problemId: string) => {
    const res = await engagementClient.delete<ApiResponse<EngagementState>>(
      `/problems/${problemId}/reaction`
    );
    return res.data;
  },

  addBookmark: async (problemId: string) => {
    const res = await engagementClient.post<ApiResponse<EngagementState>>(
      `/problems/${problemId}/bookmark`
    );
    return res.data;
  },

  removeBookmark: async (problemId: string) => {
    const res = await engagementClient.delete<ApiResponse<EngagementState>>(
      `/problems/${problemId}/bookmark`
    );
    return res.data;
  },

  toggleBookmark: async (problemId: string) => {
    const res = await engagementClient.post<ApiResponse<EngagementState>>(
      `/problems/${problemId}/bookmark/toggle`
    );
    return res.data;
  },

  listMyBookmarks: async () => {
    const res = await engagementClient.get<ApiResponse<Problem[]>>(
      `/problems/bookmarks/me`
    );
    return res.data;
  },

  toggleRevision: async (problemId: string) => {
    const res = await engagementClient.post<ApiResponse<EngagementState>>(
      `/problems/${problemId}/revision/toggle`
    );
    return res.data;
  },

  listMyRevisions: async () => {
    const res = await engagementClient.get<
      ApiResponse<{ problemIds: string[] }>
    >(`/problems/revisions/me`);
    return res.data;
  },
};

/** Format counts like 2400 → 2.4K */
export function formatEngagementCount(n: number): string {
  if (!n || n < 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const v = n / 1_000_000;
  return `${v.toFixed(1).replace(/\.0$/, "")}M`;
}
