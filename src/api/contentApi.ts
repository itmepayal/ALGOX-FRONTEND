import { contentClient } from "./adminContentApi";

export interface ContentArticle {
  _id: string;
  title: string;
  slug: string;
  summary?: string;
  content: string;
  category?: string;
  tags?: string[];
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentStudyPlan {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  difficulty?: string;
  estimatedDays?: number;
  problemSlugs?: string[];
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProblemEditorialSolution {
  title: string;
  approachName: string;
  explanation: string;
  timeComplexity: string;
  spaceComplexity: string;
  codeSnippets?: Array<{ language: string; code: string }>;
}

export interface ProblemEditorial {
  problemId: string;
  videoUrl?: string;
  hints?: string[];
  solutions: ProblemEditorialSolution[];
  isPremiumOnly?: boolean;
}

export interface ProblemNote {
  _id?: string;
  userId: string;
  problemId: string;
  noteText: string;
  tags?: string[];
  updatedAt?: string;
}

export const contentApi = {
  listArticles: async (params?: Record<string, string | number | undefined>) => {
    const res = await contentClient.get("/content/articles", { params });
    return res.data as {
      success: boolean;
      data: ContentArticle[];
      meta?: { total: number; page: number; totalPages: number };
    };
  },

  getArticleBySlug: async (slug: string) => {
    const res = await contentClient.get(`/content/articles/${slug}`);
    return res.data as { success: boolean; data: ContentArticle };
  },

  listStudyPlans: async (params?: Record<string, string | number | undefined>) => {
    const res = await contentClient.get("/content/study-plans", { params });
    return res.data as {
      success: boolean;
      data: ContentStudyPlan[];
      meta?: { total: number; page: number; totalPages: number };
    };
  },

  getStudyPlanBySlug: async (slug: string) => {
    const res = await contentClient.get(`/content/study-plans/${slug}`);
    return res.data as { success: boolean; data: ContentStudyPlan };
  },

  getEditorialByProblemId: async (problemId: string) => {
    const res = await contentClient.get(`/content/editorials/problem/${problemId}`);
    return res.data as { success: boolean; data: ProblemEditorial | null };
  },

  getProblemNote: async (userId: string, problemId: string) => {
    const res = await contentClient.get(`/content/notes/${userId}/${problemId}`);
    return res.data as { success: boolean; data: ProblemNote | null };
  },

  upsertProblemNote: async (payload: {
    userId: string;
    problemId: string;
    content: string;
  }) => {
    const res = await contentClient.post("/content/notes", {
      problemId: payload.problemId,
      noteText: payload.content,
    });
    return res.data as { success: boolean; data: ProblemNote; message?: string };
  },
};
