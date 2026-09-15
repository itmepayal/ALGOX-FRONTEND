import axios from "axios";

export const EVALUATION_API_URL = "http://localhost:3006/api/v1";

export const evaluationClient = axios.create({
  baseURL: EVALUATION_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

evaluationClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface RunCodePayload {
  code: string;
  language: string;
  /** Stdin string, or structured judge input (normalized server-side too). */
  input: string | Record<string, unknown> | unknown[] | number | boolean;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  functionName?: string;
  className?: string;
  returnType?: string;
  parameters?: Array<{ name: string; type: string }>;
  problemId?: string;
}

export interface RunCodeResponseData {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  memoryMb: number;
  timedOut: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Array<{ path: string; message: string }>;
}

export const evaluationApi = {
  runCode: async (payload: RunCodePayload) => {
    const response = await evaluationClient.post<ApiResponse<RunCodeResponseData>>(
      "/evaluation/run",
      payload,
      { timeout: 60000 }
    );
    return response.data;
  },
};
