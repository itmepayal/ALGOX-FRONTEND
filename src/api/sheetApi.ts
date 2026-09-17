import { problemClient, type ApiResponse } from "./problemApi";

export interface PublishedSheetMeta {
  id: string;
  name: string;
  totalProblems: number;
  status?: string;
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
  status?: string;
  sections?: SheetPreviewSection[];
}

export const sheetApi = {
  listPublished: async () => {
    const res = await problemClient.get<ApiResponse<PublishedSheetMeta[]>>("/sheets");
    return res.data;
  },

  getPreview: async (sheetId: string) => {
    const res = await problemClient.get<ApiResponse<SheetPreview>>(
      `/sheets/${encodeURIComponent(sheetId)}/preview`
    );
    return res.data;
  },
};
