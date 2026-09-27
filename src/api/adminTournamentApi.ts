import { problemClient } from "./problemApi";
import type { Tournament } from "./tournamentApi";

export const adminTournamentApi = {
  listAll: async () => {
    const res = await problemClient.get("/admin/tournaments");
    return res.data as { success: boolean; data: Tournament[] };
  },

  create: async (payload: {
    title: string;
    slug: string;
    description?: string;
    maxParticipants?: number;
    startTime: string;
  }) => {
    const res = await problemClient.post("/admin/tournaments", payload);
    return res.data as { success: boolean; data: Tournament };
  },

  update: async (
    id: string,
    payload: Partial<{
      title: string;
      description: string;
      startTime: string;
    }>
  ) => {
    const res = await problemClient.patch(`/admin/tournaments/${id}`, payload);
    return res.data as { success: boolean; data: Tournament };
  },

  publish: async (id: string) => {
    const res = await problemClient.post(`/admin/tournaments/${id}/publish`);
    return res.data as { success: boolean; data: Tournament };
  },

  openRegistration: async (id: string) => {
    const res = await problemClient.post(`/admin/tournaments/${id}/open-registration`);
    return res.data as { success: boolean; data: Tournament };
  },

  closeRegistration: async (id: string) => {
    const res = await problemClient.post(`/admin/tournaments/${id}/close-registration`);
    return res.data as { success: boolean; data: Tournament };
  },

  seed: async (id: string) => {
    const res = await problemClient.post(`/admin/tournaments/${id}/seed`);
    return res.data as { success: boolean; data: Tournament };
  },

  start: async (id: string) => {
    const res = await problemClient.post(`/admin/tournaments/${id}/start`);
    return res.data as { success: boolean; data: Tournament };
  },

  archive: async (id: string) => {
    const res = await problemClient.post(`/admin/tournaments/${id}/archive`);
    return res.data as { success: boolean; data: Tournament };
  },
};
