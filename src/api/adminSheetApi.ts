import { problemClient } from "./problemApi";

export interface AdminSheet {
  _id?: string;
  sheetId: string;
  title: string;
  description?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  order?: number;
  createdAt?: string;
}

export const adminSheetApi = {
  list: async (params?: Record<string, string | number | undefined>) => {
    const res = await problemClient.get("/admin/sheets", { params });
    return res.data as { success: boolean; data: AdminSheet[]; meta?: any };
  },

  get: async (sheetId: string) => {
    const res = await problemClient.get(`/admin/sheets/${sheetId}`);
    return res.data;
  },

  preview: async (sheetId: string) => {
    const res = await problemClient.get(`/admin/sheets/${sheetId}/preview`);
    return res.data;
  },

  create: async (payload: Partial<AdminSheet> & { sheetId: string; title: string }) => {
    const res = await problemClient.post("/admin/sheets", payload);
    return res.data;
  },

  update: async (sheetId: string, payload: Partial<AdminSheet>) => {
    const res = await problemClient.patch(`/admin/sheets/${sheetId}`, payload);
    return res.data;
  },

  publish: async (sheetId: string) => {
    const res = await problemClient.post(`/admin/sheets/${sheetId}/publish`);
    return res.data;
  },

  archive: async (sheetId: string) => {
    const res = await problemClient.post(`/admin/sheets/${sheetId}/archive`);
    return res.data;
  },

  syncFromCatalog: async () => {
    const res = await problemClient.post("/admin/sheets/sync-from-catalog");
    return res.data;
  },
};
