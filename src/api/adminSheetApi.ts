import { problemClient } from "./problemApi";

export type AdminSheetStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type AdminSheetAccess = "FREE" | "PREMIUM";

export interface AdminSheet {
  id?: string;
  _id?: string;
  sheetId: string;
  title: string;
  description?: string;
  status: AdminSheetStatus;
  /** FREE sheets unlock linked problems for free users. */
  access?: AdminSheetAccess;
  order?: number;
  totalProblems?: number;
  createdBy?: string;
  updatedBy?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SheetPreviewProblem {
  id?: string;
  order?: number;
  problemId?: string;
  title?: string;
  slug?: string;
  difficulty?: string;
  status?: string;
  category?: string;
}

export interface SheetPreviewTopic {
  id?: string;
  title?: string;
  name?: string;
  order?: number;
  problems?: SheetPreviewProblem[];
}

export interface SheetPreviewSection {
  id?: string;
  title?: string;
  order?: number;
  topics?: SheetPreviewTopic[];
}

export interface SheetPreview {
  sheetId?: string;
  title?: string;
  name?: string;
  status?: AdminSheetStatus;
  description?: string;
  totalProblems?: number;
  sections?: SheetPreviewSection[];
}

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
  meta?: unknown;
};

export const adminSheetApi = {
  list: async (params?: {
    includeArchived?: boolean | string;
  }): Promise<ApiEnvelope<AdminSheet[]>> => {
    const res = await problemClient.get("/admin/sheets", {
      params: {
        includeArchived:
          params?.includeArchived === undefined
            ? "true"
            : String(params.includeArchived),
      },
    });
    return res.data as ApiEnvelope<AdminSheet[]>;
  },

  get: async (sheetId: string): Promise<ApiEnvelope<AdminSheet>> => {
    const res = await problemClient.get(`/admin/sheets/${encodeURIComponent(sheetId)}`);
    return res.data as ApiEnvelope<AdminSheet>;
  },

  preview: async (
    sheetId: string
  ): Promise<ApiEnvelope<SheetPreview>> => {
    const res = await problemClient.get(
      `/admin/sheets/${encodeURIComponent(sheetId)}/preview`
    );
    return res.data as ApiEnvelope<SheetPreview>;
  },

  create: async (payload: {
    sheetId: string;
    title: string;
    description?: string;
    order?: number;
    status?: AdminSheetStatus;
    access?: AdminSheetAccess;
  }): Promise<ApiEnvelope<AdminSheet>> => {
    const res = await problemClient.post("/admin/sheets", payload);
    return res.data as ApiEnvelope<AdminSheet>;
  },

  update: async (
    sheetId: string,
    payload: {
      title?: string;
      description?: string;
      order?: number;
      access?: AdminSheetAccess;
    }
  ): Promise<ApiEnvelope<AdminSheet>> => {
    const res = await problemClient.patch(
      `/admin/sheets/${encodeURIComponent(sheetId)}`,
      payload
    );
    return res.data as ApiEnvelope<AdminSheet>;
  },

  remove: async (
    sheetId: string
  ): Promise<ApiEnvelope<{ sheetId: string; deleted: boolean }>> => {
    const res = await problemClient.delete(
      `/admin/sheets/${encodeURIComponent(sheetId)}`
    );
    return res.data as ApiEnvelope<{ sheetId: string; deleted: boolean }>;
  },

  publish: async (sheetId: string): Promise<ApiEnvelope<AdminSheet>> => {
    const res = await problemClient.post(
      `/admin/sheets/${encodeURIComponent(sheetId)}/publish`
    );
    return res.data as ApiEnvelope<AdminSheet>;
  },

  archive: async (sheetId: string): Promise<ApiEnvelope<AdminSheet>> => {
    const res = await problemClient.post(
      `/admin/sheets/${encodeURIComponent(sheetId)}/archive`
    );
    return res.data as ApiEnvelope<AdminSheet>;
  },

  /** Global catalog sync, or per-sheet when sheetId is provided. */
  syncFromCatalog: async (opts?: {
    sheetId?: string;
    publish?: boolean;
  }): Promise<ApiEnvelope<unknown>> => {
    const body = {
      sheetId: opts?.sheetId,
      publish: opts?.publish,
    };
    if (opts?.sheetId) {
      const res = await problemClient.post(
        `/admin/sheets/${encodeURIComponent(opts.sheetId)}/sync-from-catalog`,
        body
      );
      return res.data as ApiEnvelope<unknown>;
    }
    const res = await problemClient.post("/admin/sheets/sync-from-catalog", body);
    return res.data as ApiEnvelope<unknown>;
  },

  createSection: async (
    sheetId: string,
    payload: { title: string; order?: number }
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.post(
      `/admin/sheets/${encodeURIComponent(sheetId)}/sections`,
      payload
    );
    return res.data as ApiEnvelope<unknown>;
  },

  updateSection: async (
    sectionId: string,
    payload: { title?: string; order?: number }
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.patch(
      `/admin/sheets/sections/${encodeURIComponent(sectionId)}`,
      payload
    );
    return res.data as ApiEnvelope<unknown>;
  },

  deleteSection: async (sectionId: string): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.delete(
      `/admin/sheets/sections/${encodeURIComponent(sectionId)}`
    );
    return res.data as ApiEnvelope<unknown>;
  },

  reorderSections: async (
    sheetId: string,
    orderedIds: string[]
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.patch(
      `/admin/sheets/${encodeURIComponent(sheetId)}/sections/reorder`,
      { orderedIds }
    );
    return res.data as ApiEnvelope<unknown>;
  },

  createTopic: async (
    sectionId: string,
    payload: { title: string; order?: number }
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.post(
      `/admin/sheets/sections/${encodeURIComponent(sectionId)}/topics`,
      payload
    );
    return res.data as ApiEnvelope<unknown>;
  },

  updateTopic: async (
    topicId: string,
    payload: { title?: string; order?: number }
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.patch(
      `/admin/sheets/topics/${encodeURIComponent(topicId)}`,
      payload
    );
    return res.data as ApiEnvelope<unknown>;
  },

  deleteTopic: async (topicId: string): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.delete(
      `/admin/sheets/topics/${encodeURIComponent(topicId)}`
    );
    return res.data as ApiEnvelope<unknown>;
  },

  reorderTopics: async (
    sectionId: string,
    orderedIds: string[]
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.patch(
      `/admin/sheets/sections/${encodeURIComponent(sectionId)}/topics/reorder`,
      { orderedIds }
    );
    return res.data as ApiEnvelope<unknown>;
  },

  attachProblem: async (
    topicId: string,
    payload: { problemId?: string; slug?: string; order?: number }
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.post(
      `/admin/sheets/topics/${encodeURIComponent(topicId)}/problems`,
      payload
    );
    return res.data as ApiEnvelope<unknown>;
  },

  bulkAttachProblems: async (
    topicId: string,
    problems: Array<{ problemId?: string; slug?: string; order?: number }>
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.post(
      `/admin/sheets/topics/${encodeURIComponent(topicId)}/problems/bulk`,
      { problems }
    );
    return res.data as ApiEnvelope<unknown>;
  },

  reorderProblems: async (
    topicId: string,
    orderedIds: string[]
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.patch(
      `/admin/sheets/topics/${encodeURIComponent(topicId)}/problems/reorder`,
      { orderedIds }
    );
    return res.data as ApiEnvelope<unknown>;
  },

  removeProblem: async (
    topicId: string,
    problemId: string
  ): Promise<ApiEnvelope<unknown>> => {
    const res = await problemClient.delete(
      `/admin/sheets/topics/${encodeURIComponent(topicId)}/problems/${encodeURIComponent(problemId)}`
    );
    return res.data as ApiEnvelope<unknown>;
  },
};
