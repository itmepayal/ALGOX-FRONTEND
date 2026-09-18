import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

export const PROBLEM_API_URL = SERVICE_URLS.problem;

export const problemClient = createServiceClient(PROBLEM_API_URL);

export interface Testcase {
  input?: any;
  output?: string;
  expectedOutput?: string;
  isHidden?: boolean;
  explanation?: string;
  weight?: number;
  order?: number;
  _id?: string;
}

export interface CodeStub {
  language: "python" | "javascript" | "cpp" | "java";
  startSnippet: string;
  userTemplate: string;
}

export interface ProblemResource {
  type: "youtube" | "article" | "editorial" | "docs" | "practice";
  url: string;
  label?: string;
  isPremium?: boolean;
}

export interface Problem {
  id?: string;
  _id?: string;
  title: string;
  slug: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "Easy" | "Medium" | "Hard";
  status?: "draft" | "published" | "archived";
  category: string;
  tags: string[];
  /** Problem-level classification from API (FREE=false / PREMIUM=true). */
  isPremium?: boolean;
  /** True when problem belongs to a published FREE Learning Sheet. */
  isSheetFree?: boolean;
  access?: "FREE" | "PREMIUM";
  /** True when premium problem content was redacted (no entitlement). */
  accessLocked?: boolean;
  editorialLocked?: boolean;
  hintsLocked?: boolean;
  editorial?: string;
  hints?: string[];
  examples?: Testcase[];
  constraints?: string;
  starterCode?: Partial<Record<"python" | "javascript" | "cpp" | "java", string>>;
  functionName?: string;
  className?: string;
  codeStubs?: CodeStub[];
  testcases?: Testcase[];
  resources?: ProblemResource[];
  videoUrl?: string;
  articleUrl?: string;
  practiceUrl?: string;
  /** Public-only list length (same as filtered testcases). */
  publicTestcaseCount?: number;
  /** Hidden suite size — count only; content never sent on public APIs. */
  hiddenTestcaseCount?: number;
  /** public + hidden */
  totalTestcaseCount?: number;
  likeCount?: number;
  dislikeCount?: number;
  bookmarkCount?: number;
  isBookmarked?: boolean;
  isFavourite?: boolean;
  isImportant?: boolean;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProblemQuery {
  page?: number;
  limit?: number;
  search?: string;
  difficulty?: string;
  category?: string;
  /** all | free | premium */
  access?: "all" | "free" | "premium";
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const problemApi = {
  // Get all problems with pagination & filters
  getProblems: async (query?: ProblemQuery) => {
    const response = await problemClient.get<ApiResponse<Problem[]>>("/problems", {
      params: query,
    });
    return response.data;
  },

  // Get problem by ID
  getProblemById: async (id: string) => {
    const response = await problemClient.get<ApiResponse<Problem>>(`/problems/${id}`);
    return response.data;
  },

  // Get problem by slug
  getProblemBySlug: async (slug: string) => {
    const response = await problemClient.get<ApiResponse<Problem>>(`/problems/slug/${slug}`);
    return response.data;
  },
};
