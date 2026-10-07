import { authClient } from "./authClient";

const root = "/auth/social";
const data = async <T,>(promise: Promise<{ data: { data: T } }>) => (await promise).data.data;

export const socialApi = {
  progression: () => data<{ xp: number; level: number; xpIntoLevel: number; xpToNextLevel: number; achievements: Array<{ id: string; title: string; description: string; target: number; progress: number; unlockedAt: string | null }>; recentXp: Array<{ eventType: string; xp: number; createdAt: string }> }>(authClient.get("/auth/progression/me")),
  discover: (q: string) => data<Array<{ id: string; name: string; avatar: string }>>(authClient.get(`${root}/discover`, { params: { q } })),
  sendRequest: (userId: string) => data(authClient.post(`${root}/friend-requests`, { userId })),
  requests: (direction: "incoming" | "outgoing") => data<Array<{ requestId: string; user: { id: string; name: string; avatar: string }; createdAt: string }>>(authClient.get(`${root}/friend-requests`, { params: { direction } })),
  respond: (id: string, action: "accept" | "reject" | "cancel") => data(authClient.post(`${root}/friend-requests/${id}/${action}`)),
  friends: () => data<Array<{ id: string; name: string; avatar: string }>>(authClient.get(`${root}/friends`)),
  removeFriend: (id: string) => data(authClient.delete(`${root}/friends/${id}`)),
  follow: (id: string) => data(authClient.post(`${root}/follow/${id}`)),
  unfollow: (id: string) => data(authClient.delete(`${root}/follow/${id}`)),
  followers: () => data<Array<{ id: string; name: string; avatar: string }>>(authClient.get(`${root}/followers`)),
  following: () => data<Array<{ id: string; name: string; avatar: string }>>(authClient.get(`${root}/following`)),
  activity: (limit = 30, before?: string) => data<{ items: Array<{ id: string; type: string; actor: any; target: any; createdAt: string }>; nextCursor: string | null }>(authClient.get(`${root}/activity`, { params: { limit, before } })),
};
