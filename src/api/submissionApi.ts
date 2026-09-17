import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

export const SUBMISSION_API_URL = SERVICE_URLS.submission;

export const submissionClient = createServiceClient(SUBMISSION_API_URL, {
  timeout: 20000,
});

export type SubmissionStatus =
  | "PENDING"
  | "RUNNING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "COMPILATION_ERROR";

export type ProgrammingLanguage = "python" | "javascript" | "cpp" | "java";

/** Run attempts mark Attempted only; submit ACCEPTED marks Solved. */
export type SubmissionSource = "run" | "submit";

export interface Submission {
  id?: string;
  _id?: string;
  userId?: string;
  problemId: string;
  code: string;
  language: ProgrammingLanguage | string;
  status: SubmissionStatus | string;
  /** Absent/legacy rows are treated as submit. */
  source?: SubmissionSource | string;
  output?: string;
  error?: string;
  executionTime?: number;
  memory?: number;
  testCasesPassed?: number;
  totalTestCases?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSubmissionPayload {
  userId?: string;
  problemId: string;
  code: string;
  language: ProgrammingLanguage | string;
  contestId?: string;
  virtualContestSessionId?: string;
  mockInterviewSessionId?: string;
  source?: SubmissionSource;
  status?: SubmissionStatus;
  output?: string;
  error?: string;
  executionTime?: number;
  memory?: number;
  testCasesPassed?: number;
  totalTestCases?: number;
}

export interface SubmissionListQuery {
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit?: number;
    totalPages: number;
  };
}

export const submissionApi = {
  createSubmission: async (payload: CreateSubmissionPayload) => {
    const response = await submissionClient.post<ApiResponse<Submission>>("/submissions", payload);
    return response.data;
  },

  getAllSubmissions: async (query?: SubmissionListQuery) => {
    const response = await submissionClient.get<ApiResponse<Submission[]>>("/submissions", {
      params: query,
    });
    return response.data;
  },

  searchSubmissions: async (q: string) => {
    const response = await submissionClient.get<ApiResponse<Submission[]>>("/submissions/search", {
      params: { q },
    });
    return response.data;
  },

  getByProblemId: async (problemId: string) => {
    const response = await submissionClient.get<ApiResponse<Submission[]>>(`/submissions/problem/${problemId}`);
    return response.data;
  },

  getByUserId: async (userId: string) => {
    const response = await submissionClient.get<ApiResponse<Submission[]>>(`/submissions/user/${userId}`);
    return response.data;
  },

  /** Current user submissions (JWT-scoped). Prefer over getByUserId for product UI. */
  getMySubmissions: async (query?: {
    page?: number;
    limit?: number;
    status?: string;
    language?: string;
    source?: string;
  }) => {
    const response = await submissionClient.get<ApiResponse<Submission[]>>(
      "/submissions/me",
      { params: query }
    );
    return response.data;
  },

  getByStatus: async (status: string) => {
    const response = await submissionClient.get<ApiResponse<Submission[]>>(`/submissions/status/${status}`);
    return response.data;
  },

  getByLanguage: async (language: string) => {
    const response = await submissionClient.get<ApiResponse<Submission[]>>(`/submissions/language/${language}`);
    return response.data;
  },

  getSubmissionById: async (id: string) => {
    const response = await submissionClient.get<ApiResponse<Submission>>(`/submissions/${id}`);
    return response.data;
  },

  deleteSubmission: async (id: string) => {
    const response = await submissionClient.delete<ApiResponse<null>>(`/submissions/${id}`);
    return response.data;
  },
};
