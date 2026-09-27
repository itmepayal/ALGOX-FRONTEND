import { problemClient } from "./problemApi";

export type SkillConfidence = "LOW" | "MEDIUM" | "HIGH";
export type SkillTrend = "IMPROVING" | "STABLE" | "DECLINING";

export interface TopicSkillSummary {
  topic: string;
  rating: number;
  confidence: SkillConfidence;
  problemsAttempted: number;
  problemsSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalAttempts: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
  trend: SkillTrend;
  lastActivityAt: string | null;
}

export interface UserSkillProfileData {
  overall: {
    averageRating: number;
    strongestTopic: string | null;
    weakestTopic: string | null;
    totalSolved: number;
    evaluatedTopicsCount: number;
  };
  topics: TopicSkillSummary[];
}

export interface SkillApiResponse {
  success: boolean;
  message: string;
  data: UserSkillProfileData;
}

export const skillApi = {
  getMyProfile: async (): Promise<UserSkillProfileData> => {
    const res = await problemClient.get<SkillApiResponse>("/skills/me");
    return res.data.data;
  },

  recalculateMyProfile: async (): Promise<UserSkillProfileData> => {
    const res = await problemClient.post<SkillApiResponse>("/skills/me/recalculate");
    return res.data.data;
  },
};
