import { SERVICE_URLS } from "./serviceUrls";
import { createServiceClient } from "./authClient";

const LEADERBOARD_URL = SERVICE_URLS.leaderboard;

const client = createServiceClient(LEADERBOARD_URL);

export const adminLeaderboardApi = {
  rebuild: async () => {
    const res = await client.post("/leaderboard/admin/rebuild");
    return res.data;
  },
  resetUser: async (userId: string, note?: string) => {
    const res = await client.post(`/leaderboard/admin/reset-user/${userId}`, {
      note,
    });
    return res.data;
  },
  suspendEntry: async (
    userId: string,
    suspended = true,
    note?: string
  ) => {
    const res = await client.post(
      `/leaderboard/admin/suspend-entry/${userId}`,
      { suspended, note }
    );
    return res.data;
  },
  listAudit: async (params?: { page?: number; limit?: number }) => {
    const res = await client.get("/leaderboard/admin/audit", { params });
    return res.data;
  },
};
