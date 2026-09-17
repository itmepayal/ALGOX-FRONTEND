import { problemClient, type ApiResponse } from "./problemApi";

export type MockInterviewStatus =
  | "in_progress"
  | "timed_out"
  | "completed"
  | "abandoned";

export interface MockInterviewConfig {
  company?: string;
  role?: string;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  durationMinutes: number;
  language: "python" | "javascript" | "cpp" | "java";
  topics: string[];
  problemCount: number;
}

export interface MockScoreCell {
  score: number | null;
  available: boolean;
  signal: string;
  detail?: string;
}

export interface MockInterviewReport {
  generatedAt: string;
  sessionStatus: MockInterviewStatus;
  durationMinutes: number;
  timeUsedMs: number;
  remainingMsAtEnd: number;
  completedBeforeTimeout: boolean;
  problemsTotal: number;
  problemsAttempted: number;
  problemsAccepted: number;
  scores: {
    problemSolving: MockScoreCell;
    correctness: MockScoreCell;
    complexity: MockScoreCell;
    timeManagement: MockScoreCell;
    codeQuality: MockScoreCell;
    performance: MockScoreCell;
    completion: MockScoreCell;
  };
  attempts: Array<{
    problemId: string;
    problemSlug?: string;
    title?: string;
    status?: string;
    testCasesPassed?: number;
    totalTestCases?: number;
    executionTimeMs?: number;
    memoryMb?: number;
  }>;
}

export interface MockInterviewSession {
  id: string;
  userId: string;
  config: MockInterviewConfig;
  status: MockInterviewStatus;
  problemIds: string[];
  attempts: MockInterviewReport["attempts"];
  startedAt: string;
  endsAt: string;
  completedAt?: string | null;
  remainingMs: number;
  serverNow: string;
  report?: MockInterviewReport | null;
}

export const mockInterviewApi = {
  start: async (config: Partial<MockInterviewConfig> & { language: MockInterviewConfig["language"] }) => {
    const res = await problemClient.post<ApiResponse<MockInterviewSession>>(
      "/interviews/start",
      config
    );
    return res.data;
  },

  getActive: async () => {
    const res = await problemClient.get<ApiResponse<MockInterviewSession | null>>(
      "/interviews/active"
    );
    return res.data;
  },

  listMine: async (limit = 20) => {
    const res = await problemClient.get<
      ApiResponse<
        Array<{
          id: string;
          status: MockInterviewStatus | string;
          config?: Partial<MockInterviewConfig>;
          startedAt?: string;
          endsAt?: string;
          completedAt?: string | null;
          problemsTotal?: number;
          hasReport?: boolean;
        }>
      >
    >("/interviews/mine", { params: { limit } });
    return res.data;
  },

  getById: async (sessionId: string) => {
    const res = await problemClient.get<ApiResponse<MockInterviewSession>>(
      `/interviews/${sessionId}`
    );
    return res.data;
  },

  attachSubmission: async (
    sessionId: string,
    problemId: string,
    submissionId: string
  ) => {
    const res = await problemClient.post<ApiResponse<MockInterviewSession>>(
      `/interviews/${sessionId}/attach-submission`,
      { problemId, submissionId }
    );
    return res.data;
  },

  complete: async (sessionId: string) => {
    const res = await problemClient.post<ApiResponse<MockInterviewSession>>(
      `/interviews/${sessionId}/complete`,
      {}
    );
    return res.data;
  },

  getReport: async (sessionId: string) => {
    const res = await problemClient.get<
      ApiResponse<{ sessionId: string; status: string; report: MockInterviewReport }>
    >(`/interviews/${sessionId}/report`);
    return res.data;
  },

  abandon: async (sessionId: string) => {
    const res = await problemClient.post<ApiResponse<MockInterviewSession>>(
      `/interviews/${sessionId}/abandon`,
      {}
    );
    return res.data;
  },
};
