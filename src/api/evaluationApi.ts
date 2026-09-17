import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

export const EVALUATION_API_URL = SERVICE_URLS.evaluation;

export const evaluationClient = createServiceClient(EVALUATION_API_URL);

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
  /** Marks this run as a custom case (premium gated server-side). */
  isCustomCase?: boolean;
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
