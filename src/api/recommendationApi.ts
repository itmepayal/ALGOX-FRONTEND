import { problemClient } from "./problemApi";

export interface RecommendationItem {
  problemId: string;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  tags: string[];
  isPremium?: boolean;
  score: number;
  reason: string;
  primaryTopic: string;
  hasFailedAttempts: boolean;
  failedAttemptsCount: number;
}

export interface RecommendationSummary {
  focusTopic: string | null;
  targetDifficulty: string;
  totalCandidatesEvaluated: number;
  userAverageRating: number;
}

export interface RecommendationData {
  summary: RecommendationSummary;
  recommendations: RecommendationItem[];
}

export interface RecommendationApiResponse {
  success: boolean;
  message: string;
  data: RecommendationData;
}

export const recommendationApi = {
  getRecommendations: async (opts?: {
    limit?: number;
    topic?: string;
    difficulty?: string;
  }): Promise<RecommendationData> => {
    const res = await problemClient.get<RecommendationApiResponse>("/recommendations/me", {
      params: opts,
    });
    return res.data.data;
  },
};
