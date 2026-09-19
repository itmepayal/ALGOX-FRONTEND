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
  /** Infrastructure flag — do not surface provider details in product UI. */
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
  provider: "gemini" | "openai" | "policy" | "none";
}

export interface AiHistoryItem {
  feature: string;
  success: boolean;
  failureReason?: string;
  problemId?: string;
  hadCodeSnippet?: boolean;
  codeLength?: number;
  latencyMs?: number;
  createdAt: string;
  dateKey?: string;
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

  getHistory: async (
    limit = 30,
    status: "all" | "success" | "failed" = "all"
  ) => {
    const res = await problemClient.get<
      ApiResponse<{ items: AiHistoryItem[] }>
    >("/ai/history", {
      params: {
        limit,
        ...(status !== "all" ? { status } : {}),
      },
    });
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
