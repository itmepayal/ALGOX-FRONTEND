import { contentClient } from "./adminContentApi";

export interface ContentArticle {
  _id: string;
  title: string;
  slug: string;
  summary?: string;
  content: string;
  category?: string;
  tags?: string[];
  authorName?: string;
  authorAvatar?: string;
  readTimeMinutes?: number;
  isPublished?: boolean;
  isPremium?: boolean;
  accessLocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type StudyPlanProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export interface StudyPlanProgress {
  status: StudyPlanProgressStatus;
  completedProblemIds: string[];
  solvedCount: number;
  totalProblemsCount: number;
  completionPercentage: number;
  resumeProblemId?: string | null;
  resumeSectionIndex?: number;
  enrolledAt?: string;
  completedAt?: string | null;
  lastStudiedAt?: string;
  enrolled?: boolean;
  studyPlanSlug?: string;
}

export interface StudyPlanSection {
  order?: number;
  title: string;
  description: string;
  problemIds?: string[];
  problemCount?: number;
  estimatedMinutes?: number;
  locked?: boolean;
}

export interface ContentStudyPlan {
  id?: string;
  _id?: string;
  title: string;
  slug: string;
  description?: string;
  category?: string;
  topics?: string[];
  difficulty?: string;
  estimatedMinutes?: number;
  estimatedDays?: number;
  sections?: StudyPlanSection[];
  cards?: StudyPlanSection[];
  problemIds?: string[];
  problemSlugs?: string[];
  totalProblemsCount?: number;
  sectionCount?: number;
  access?: "FREE" | "PREMIUM";
  isPremium?: boolean;
  isPublished?: boolean;
  prerequisiteSlugs?: string[];
  accessLocked?: boolean;
  progress?: StudyPlanProgress;
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
  accessLocked?: boolean;
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
      data: {
        articles: ContentArticle[];
        total: number;
        page: number;
        totalPages: number;
      };
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

  enrollStudyPlan: async (slug: string) => {
    const res = await contentClient.post(`/content/study-plans/${slug}/enroll`, {});
    return res.data as { success: boolean; data: StudyPlanProgress; message?: string };
  },

  markStudyPlanProblem: async (studyPlanSlug: string, problemId: string) => {
    const res = await contentClient.post("/content/study-plans/progress", {
      studyPlanSlug,
      problemId,
    });
    return res.data as { success: boolean; data: StudyPlanProgress; message?: string };
  },

  completeStudyPlan: async (slug: string) => {
    const res = await contentClient.post(`/content/study-plans/${slug}/complete`, {});
    return res.data as { success: boolean; data: StudyPlanProgress; message?: string };
  },

  resumeStudyPlan: async (slug: string) => {
    const res = await contentClient.get(`/content/study-plans/${slug}/resume`);
    return res.data as {
      success: boolean;
      data: {
        progress: StudyPlanProgress;
        resumeProblemId: string | null;
        resumeSectionIndex: number;
      };
    };
  },

  getEditorialByProblemId: async (problemId: string) => {
    const res = await contentClient.get(`/content/editorials/problem/${problemId}`);
    return res.data as { success: boolean; data: ProblemEditorial | null };
  },

  getProblemNote: async (userId: string, problemId: string) => {
    const res = await contentClient.get(`/content/notes/${userId}/${problemId}`);
    return res.data as { success: boolean; data: ProblemNote | null };
  },

  listUserNotes: async (userId: string, tag?: string) => {
    const res = await contentClient.get(`/content/notes/user/${userId}`, {
      params: tag ? { tag } : undefined,
    });
    return res.data as { success: boolean; data: ProblemNote[] };
  },

  upsertProblemNote: async (payload: {
    userId: string;
    problemId: string;
    content: string;
    tags?: string[];
  }) => {
    const res = await contentClient.post("/content/notes", {
      problemId: payload.problemId,
      noteText: payload.content,
      ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
    });
    return res.data as {
      success: boolean;
      data: ProblemNote | null;
      message?: string;
    };
  },

  deleteProblemNote: async (userId: string, problemId: string) => {
    const res = await contentClient.delete(
      `/content/notes/${userId}/${problemId}`
    );
    return res.data as {
      success: boolean;
      data: { deleted: boolean };
      message?: string;
    };
  },

  listMyStudyPlanProgress: async () => {
    const res = await contentClient.get("/content/study-plans/progress/me");
    return res.data as { success: boolean; data: StudyPlanProgress[] };
  },
};
