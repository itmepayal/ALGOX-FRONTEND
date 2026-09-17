import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

export const USER_ANALYTICS_URL = SERVICE_URLS.analytics;

const client = createServiceClient(USER_ANALYTICS_URL);

export interface TopicStrength {
  topic?: string;
  name?: string;
  strength?: number;
  score?: number;
  solved?: number;
  attempted?: number;
  solvedCount?: number;
  totalSubmissions?: number;
}

export interface UserAnalyticsSnapshot {
  userId?: string;
  totalSubmissions?: number;
  acceptedSubmissions?: number;
  acceptanceRate?: number;
  solvedEasy?: number;
  solvedMedium?: number;
  solvedHard?: number;
  currentStreak?: number;
  maxStreak?: number;
  submissionHeatmap?: Array<{ date?: string; count?: number }>;
  topicStrengths?: TopicStrength[];
}

export interface SubmissionAnalyticsItem {
  id: string;
  problemId: string;
  status: string;
  language: string | null;
  executionTime: number | null;
  memory: number | null;
  source: string;
  createdAt: string;
  testCasesPassed?: number | null;
  totalTestCases?: number | null;
}

export interface SubmissionHistoryPayload {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  items: SubmissionAnalyticsItem[];
  aggregates?: {
    byStatus: Record<string, number>;
    byLanguage: Record<string, number>;
    acceptanceRate: number;
    acceptedCount: number;
    avgExecutionTimeMs: number | null;
    avgMemoryMb: number | null;
    runtimeSampleCount: number;
    daily: Array<{
      date: string;
      count: number;
      accepted: number;
      avgExecutionTimeMs: number | null;
      avgMemoryMb: number | null;
    }>;
    acceptanceDaily: Array<{ date: string; accepted: number }>;
    attempts: {
      problemsAttempted: number;
      problemsSolved: number;
      totalAttempts: number;
      avgAttemptsPerProblem: number | null;
    };
  };
  error?: string;
}

export interface PremiumAnalyticsPayload {
  tier: "premium";
  range: string;
  overview: UserAnalyticsSnapshot & { tier?: string };
  history: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    items: SubmissionAnalyticsItem[];
  };
  runtimeTrend: Array<{
    date: string;
    avgExecutionTimeMs: number | null;
    count: number;
  }>;
  memoryTrend: Array<{ date: string; avgMemoryMb: number | null; count: number }>;
  acceptanceTrend: Array<{ date: string; accepted: number }>;
  difficultyPerformance: {
    easy: number;
    medium: number;
    hard: number;
    signal: string;
  };
  languageComparison: Array<{ language: string; count: number }>;
  attemptAnalysis: SubmissionHistoryPayload["aggregates"] extends infer A
    ? A extends { attempts: infer T }
      ? T
      : null
    : null;
  performanceComparison: {
    avgExecutionTimeMs: number | null;
    avgMemoryMb: number | null;
    runtimeSampleCount: number;
    acceptanceRate: number;
    note: string;
  };
  byStatus: Record<string, number>;
}

export interface LearningRecommendation {
  type: "weak_topic" | "study_plan" | "consistency" | "difficulty";
  title: string;
  evidence: string;
  action: string;
  topic?: string;
  studyPlanSlug?: string;
  suggestedProblemCount?: number;
}

export interface LearningAnalyticsPayload {
  tier: "premium";
  range: string;
  from: string;
  to: string;
  performanceOverview: {
    totalSubmissions: number;
    acceptedSubmissions: number;
    acceptanceRate: number;
    avgExecutionTimeMs: number | null;
    avgMemoryMb: number | null;
    runtimeSampleCount: number;
    attempts?: {
      problemsAttempted: number;
      problemsSolved: number;
      totalAttempts: number;
      avgAttemptsPerProblem: number | null;
    };
    byLanguage: Record<string, number>;
    byStatus: Record<string, number>;
    note: string;
  };
  topicMastery: Array<{
    topic: string;
    solvedCount: number;
    totalSubmissions: number;
    acceptanceRate: number | null;
  }>;
  topicWeakness: Array<{
    topic: string;
    solvedCount: number;
    totalSubmissions: number;
    acceptanceRate: number | null;
  }>;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
    total: number;
    easyPct: number | null;
    mediumPct: number | null;
    hardPct: number | null;
    signal: string;
  };
  learningVelocity: {
    rangeDays: number;
    activeDays: number;
    submissions: number;
    accepted: number;
    submissionsPerDay: number | null;
    acceptedPerDay: number | null;
    acceptedPerActiveDay: number | null;
    signal: string;
  };
  consistency: {
    rangeDays: number;
    activeDays: number;
    submissionsInRange: number;
    consistencyRate: number | null;
    signal: string;
  };
  submissionTrends: {
    daily: Array<{
      date: string;
      count: number;
      accepted: number;
      avgExecutionTimeMs: number | null;
      avgMemoryMb: number | null;
    }>;
    acceptanceDaily: Array<{ date: string; accepted: number }>;
  };
  streaks: {
    submission: { current: number; max: number; source: string };
    challenge: {
      current: number;
      longest: number;
      source: string;
      unavailable?: boolean;
    };
  };
  studyPlanProgress: Array<{
    studyPlanSlug: string;
    title: string | null;
    topics: string[];
    status?: string;
    solvedCount: number;
    totalProblemsCount: number;
    completionPercentage: number;
    enrolled: boolean;
  }>;
  contestPerformance: {
    contestsEntered: number;
    totalScore: number;
    totalSolved: number;
    items: Array<{
      contestId: string;
      title: string | null;
      slug: string | null;
      score: number;
      solvedCount: number;
      rank: number | null;
    }>;
    unavailable?: boolean;
  };
  recommendations: LearningRecommendation[];
}

export const userAnalyticsApi = {
  /** Own rollup counters — JWT. */
  getMine: async (userId: string) => {
    const res = await client.get(
      `/analytics/user/${encodeURIComponent(userId)}`
    );
    return res.data as { success: boolean; data: UserAnalyticsSnapshot };
  },

  getOverview: async () => {
    const res = await client.get("/analytics/me/overview");
    return res.data as { success: boolean; data: UserAnalyticsSnapshot };
  },

  getHistory: async (params?: {
    from?: string;
    to?: string;
    range?: string;
    status?: string;
    language?: string;
    source?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await client.get("/analytics/me/history", { params });
    return res.data as { success: boolean; data: SubmissionHistoryPayload };
  },

  getPremium: async (params?: {
    range?: string;
    from?: string;
    to?: string;
    status?: string;
    language?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await client.get("/analytics/me/premium", { params });
    return res.data as { success: boolean; data: PremiumAnalyticsPayload };
  },

  getLearning: async (params?: {
    range?: string;
    from?: string;
    to?: string;
    status?: string;
    language?: string;
  }) => {
    const res = await client.get("/analytics/me/learning", { params });
    return res.data as { success: boolean; data: LearningAnalyticsPayload };
  },
};
