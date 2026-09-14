import axios from "axios";

export const PROBLEM_API_URL = "http://localhost:3003/api/v1";

export const problemClient = axios.create({
  baseURL: PROBLEM_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

problemClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

  // Search problems
  searchProblems: async (q: string) => {
    const response = await problemClient.get<ApiResponse<Problem[]>>("/problems/search", {
      params: { q },
    });
    return response.data;
  },

  // Find by difficulty
  findByDifficulty: async (difficulty: string) => {
    const response = await problemClient.get<ApiResponse<Problem[]>>(`/problems/difficulty/${difficulty}`);
    return response.data;
  },

  // Create a new problem
  createProblem: async (problemData: Partial<Problem>) => {
    const response = await problemClient.post<ApiResponse<Problem>>("/problems", problemData);
    return response.data;
  },

  // Update a problem (Admin)
  updateProblem: async (id: string, problemData: Partial<Problem>) => {
    const response = await problemClient.put<ApiResponse<Problem>>(`/problems/${id}`, problemData);
    return response.data;
  },

  // Delete a problem (Admin)
  deleteProblem: async (id: string) => {
    const response = await problemClient.delete<ApiResponse<null>>(`/problems/${id}`);
    return response.data;
  },

  // Get internal problem details (Internal / Judge evaluation view with hidden testcases)
  getInternalProblemById: async (id: string) => {
    const response = await problemClient.get<ApiResponse<Problem>>(`/problems/internal/${id}`);
    return response.data;
  },
};
