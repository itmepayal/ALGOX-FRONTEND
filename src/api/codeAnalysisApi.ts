import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

const client = createServiceClient(SERVICE_URLS.problem);

export interface CodeAnalysisFinding {
  id: string;
  category: "complexity" | "quality" | "performance" | "structure";
  severity: "info" | "warning" | "hint";
  title: string;
  detail: string;
  evidence: string;
}

export interface CodeAnalysisResult {
  language: string;
  lineCount: number;
  charCount: number;
  findings: CodeAnalysisFinding[];
  complexity: { estimate: string | null; signal: string };
  qualityScore: number | null;
  explanation: string;
  executed: false;
  note: string;
}

export const codeAnalysisApi = {
  analyze: async (payload: { code: string; language: string }) => {
    const res = await client.post("/code-analysis/analyze", payload);
    return res.data as { success: boolean; data: CodeAnalysisResult };
  },
};
