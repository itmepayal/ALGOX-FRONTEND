import { problemClient, type ApiResponse } from "./problemApi";

export type ChallengeTier = "standard" | "advanced";

export interface AdminDailyChallenge {
  dateKey: string;
  tier: ChallengeTier;
  isPublished: boolean;
  problemId: string | null;
  problemSlug: string | null;
  title: string | null;
  difficulty: string | null;
  category: string | null;
}

/**
 * Admin CMS for daily challenges — uses existing PUT /challenges/admin/:dateKey.
 */
export const adminChallengeApi = {
  getByDate: async (dateKey: string) => {
    const res = await problemClient.get<ApiResponse<AdminDailyChallenge>>(
      `/challenges/date/${encodeURIComponent(dateKey)}`
    );
    return res.data;
  },

  upsert: async (
    dateKey: string,
    payload: {
      problemId: string;
      tier?: ChallengeTier;
      isPublished?: boolean;
    }
  ) => {
    const res = await problemClient.put<ApiResponse<AdminDailyChallenge>>(
      `/challenges/admin/${encodeURIComponent(dateKey)}`,
      payload
    );
    return res.data;
  },
};
