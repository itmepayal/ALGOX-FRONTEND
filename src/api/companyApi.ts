import { contentClient } from "./adminContentApi";

export type CompanyCard = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  isPremium: boolean;
  freePreviewLimit: number;
  isPublished?: boolean;
  roles: string[];
  questionCount: number;
  access?: "full" | "preview" | "locked";
};

export type CompanyQuestion = {
  id: string;
  companyId: string;
  problemId: string;
  title: string;
  slug?: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  role?: string;
  /** Only present when admin configured — never invent client-side. */
  frequency?: number;
  lastSeenAt?: string;
  isPremium: boolean;
  order?: number;
};

export type CompanyPageData = {
  company: CompanyCard;
  topics: string[];
  roles: string[];
  difficulty: { easy: number; medium: number; hard: number };
  questions: CompanyQuestion[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    preview?: boolean;
    previewLimit?: number;
    configuredTotal?: number;
    upgradeRequired?: boolean;
  };
};

export const companyApi = {
  listDirectory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    premium?: "all" | "free" | "premium";
  }) => {
    const res = await contentClient.get("/content/companies", { params });
    return res.data as {
      success: boolean;
      data: CompanyCard[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
  },

  getCompanyPage: async (
    slug: string,
    params?: {
      page?: number;
      limit?: number;
      difficulty?: string;
      topic?: string;
      role?: string;
      access?: "all" | "free" | "premium";
    }
  ) => {
    const res = await contentClient.get(`/content/companies/${slug}`, {
      params,
    });
    return res.data as { success: boolean; data: CompanyPageData };
  },
};
