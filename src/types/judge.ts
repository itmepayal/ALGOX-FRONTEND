import type { SubmissionStatus } from "../api/submissionApi";

export interface RunCaseResult {
  index: number;
  input: string;
  expected: string;
  actual: string;
  status:
    | "PENDING"
    | "RUNNING"
    | "PASSED"
    | "FAILED"
    | "RUNTIME_ERROR"
    | "COMPILATION_ERROR"
    | "TIME_LIMIT_EXCEEDED"
    | "ERROR";
  error?: string;
  executionTime?: number;
  memory?: number;
}

export interface RunResult {
  mode: "run";
  status: SubmissionStatus | string;
  cases: RunCaseResult[];
  passed: number;
  total: number;
  executionTime?: number;
  memory?: number;
  error?: string;
}
