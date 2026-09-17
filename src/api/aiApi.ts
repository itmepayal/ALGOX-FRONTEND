import { problemClient, type ApiResponse } from "./problemApi";

export type AiFeatureId =
  | "explain_problem"
  | "give_hint"
  | "explain_error"
  | "explain_test_case"
  | "find_bug"
  | "explain_complexity"
  | "optimize_approach"
  | "compare_approaches"
  | "generate_similar_problem"
  | "interview_mode";

export interface AiUsageSnapshot {
  dateKey: string;
  accessTier: "FREE" | "PREMIUM";
  quota: number;
  used: number;
  remaining: number;
  failed: number;
  byFeature: Record<string, number>;
  premiumFeatures: boolean;
  features: Array<{
    id: AiFeatureId;
    label: string;
    description: string;
    premiumOnly: boolean;
  }>;
  providerConfigured: boolean;
}

export interface AiAssistResponse {
  feature: AiFeatureId;
  reply: string;
  learningMode: true;
  refusedDump: boolean;
  usage: {
    dateKey: string;
    quota: number;
    used: number;
    remaining: number;
    failed: number;
  };
  provider: "openai" | "policy" | "none";
}

/**
 * AlgoPath AI — ProblemService `/ai/*`.
 * Quota/usage are server-authoritative; never send quota/apiKey from client.
 */
export const aiApi = {
  getUsage: async () => {
    const res = await problemClient.get<ApiResponse<AiUsageSnapshot>>(
      "/ai/usage"
    );
    return res.data;
  },

  getHistory: async (limit = 30) => {
    const res = await problemClient.get<
      ApiResponse<{
        items: Array<{
          feature: string;
          success: boolean;
          failureReason?: string;
          createdAt: string;
          provider?: string;
        }>;
      }>
    >("/ai/history", { params: { limit } });
    return res.data;
  },

  assist: async (payload: {
    feature: AiFeatureId;
    problemId?: string;
    userMessage?: string;
    errorMessage?: string;
    testCase?: string;
    codeSnippet?: string;
    language?: "python" | "javascript" | "cpp" | "java";
  }) => {
    const res = await problemClient.post<ApiResponse<AiAssistResponse>>(
      "/ai/assist",
      payload
    );
    return res.data;
  },
};
