import { problemClient } from "./problemApi";

export type BattleStatus =
  | "PENDING"
  | "ACCEPTED"
  | "WAITING"
  | "READY"
  | "ACTIVE"
  | "FINISHED"
  | "RESULT_PUBLISHED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED"
  | "FORFEITED";

export type BattleDifficulty = "easy" | "medium" | "hard" | "mixed";

export interface StudentSearchResult {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
}

export interface Battle {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  opponentId: string;
  opponentName: string;
  opponentEmail: string;
  status: BattleStatus;
  difficulty: BattleDifficulty;
  problemCount: number;
  durationSeconds: number;
  startedAt?: string | null;
  endsAt?: string | null;
  finishedAt?: string | null;
  winnerId?: string | null;
  forfeitedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BattleParticipant {
  id: string;
  battleId: string;
  userId: string;
  score: number;
  solvedCount: number;
  wrongAttempts: number;
  isReady: boolean;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "RECONNECTING";
  joinedAt?: string | null;
  finishedAt?: string | null;
  lastSeenAt?: string;
}

export interface BattleProblemItem {
  id: string;
  problemId: string;
  order: number;
  points: number;
  title: string;
  slug: string;
  difficulty: string;
  description?: string;
  constraints?: string;
  examples?: Array<{ input: any; output: string; explanation?: string }>;
  codeStubs?: Array<{ language: string; startSnippet: string; userTemplate: string }>;
  starterCode?: Record<string, string>;
  functionName?: string;
  className?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  testcases?: Array<{ input: any; output: string; explanation?: string }>;
}

export interface BattleSubmissionItem {
  id: string;
  battleId: string;
  userId: string;
  problemId: string;
  submissionId: string;
  status: string;
  pointsAwarded: number;
  isFirstSolve: boolean;
  submittedAt: string;
}

export interface BattleResultData {
  battle: Battle;
  participants: BattleParticipant[];
  problems: BattleProblemItem[];
  submissions: BattleSubmissionItem[];
}

export interface BattlePaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  filter: string;
}

export interface CompetitiveRatingStats {
  rank?: number;
  currentRating: number;
  peakRating: number;
  rankedBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  avgRatingChange: number;
}

export interface BattleLeaderboardItem {
  rank: number;
  user: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  };
  rating: number;
  peakRating: number;
  rankedBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export interface BattleStatsData {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
  averageDurationSeconds: number;
  averageDurationMinutes: number;
}

export interface MyBattlesData {
  incoming: Battle[];
  active: Battle[];
  history: Battle[];
  pagination?: BattlePaginationMeta;
}

export const battleApi = {
  searchStudents: async (query: string) => {
    const res = await problemClient.get(
      `/battles/search-students?q=${encodeURIComponent(query)}`
    );
    return res.data as { success: boolean; data: StudentSearchResult[] };
  },

  createChallenge: async (params: {
    opponentId: string;
    difficulty?: BattleDifficulty;
    problemCount?: number;
    durationSeconds?: number;
  }) => {
    const res = await problemClient.post("/battles", params);
    return res.data as { success: boolean; data: Battle };
  },

  getBattleById: async (id: string) => {
    const res = await problemClient.get(`/battles/${encodeURIComponent(id)}`);
    return res.data as { success: boolean; data: Battle };
  },

  acceptChallenge: async (id: string) => {
    const res = await problemClient.post(
      `/battles/${encodeURIComponent(id)}/accept`
    );
    return res.data as { success: boolean; data: Battle };
  },

  declineChallenge: async (id: string) => {
    const res = await problemClient.post(
      `/battles/${encodeURIComponent(id)}/decline`
    );
    return res.data as { success: boolean; data: Battle };
  },

  cancelChallenge: async (id: string) => {
    const res = await problemClient.post(
      `/battles/${encodeURIComponent(id)}/cancel`
    );
    return res.data as { success: boolean; data: Battle };
  },

  joinLobby: async (id: string) => {
    const res = await problemClient.post(`/battles/${encodeURIComponent(id)}/join`);
    return res.data as {
      success: boolean;
      data: {
        battle: Battle;
        participants: BattleParticipant[];
        problems: BattleProblemItem[];
      };
    };
  },

  setReady: async (id: string, isReady = true) => {
    const res = await problemClient.post(`/battles/${encodeURIComponent(id)}/ready`, {
      isReady,
    });
    return res.data as {
      success: boolean;
      data: {
        battle: Battle;
        participants: BattleParticipant[];
        problems: BattleProblemItem[];
      };
    };
  },

  getBattleProblems: async (id: string) => {
    const res = await problemClient.get(
      `/battles/${encodeURIComponent(id)}/problems`
    );
    return res.data as { success: boolean; data: BattleProblemItem[] };
  },

  getBattleResult: async (id: string) => {
    const res = await problemClient.get(
      `/battles/${encodeURIComponent(id)}/result`
    );
    return res.data as { success: boolean; data: BattleResultData };
  },

  getMyBattles: async (params?: { page?: number; limit?: number; filter?: string }) => {
    const queryParts: string[] = [];
    if (params?.page) queryParts.push(`page=${params.page}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    if (params?.filter) queryParts.push(`filter=${encodeURIComponent(params.filter)}`);
    const queryString = queryParts.length ? `?${queryParts.join("&")}` : "";

    const res = await problemClient.get(`/battles/my${queryString}`);
    return res.data as {
      success: boolean;
      data: MyBattlesData;
      meta?: BattlePaginationMeta;
    };
  },

  getBattleStats: async () => {
    const res = await problemClient.get("/battles/stats");
    return res.data as { success: boolean; data: BattleStatsData };
  },

  getRatingStats: async () => {
    const res = await problemClient.get("/battles/rating/me");
    return res.data as {
      success: boolean;
      data: {
        currentRating: number;
        peakRating: number;
        rankedBattles: number;
        wins: number;
        losses: number;
        draws: number;
        winRate: number;
        currentStreak: number;
        bestStreak: number;
        avgRatingChange: number;
      };
    };
  },

  getRatingHistory: async (params?: { page?: number; limit?: number }) => {
    const queryParts: string[] = [];
    if (params?.page) queryParts.push(`page=${params.page}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    const queryString = queryParts.length ? `?${queryParts.join("&")}` : "";

    const res = await problemClient.get(`/battles/rating/history${queryString}`);
    return res.data as {
      success: boolean;
      data: {
        history: Array<{
          id: string;
          userId: string;
          battleId: string;
          opponentId: string;
          opponentName: string;
          previousRating: number;
          newRating: number;
          ratingChange: number;
          opponentRatingBefore: number;
          opponentRatingAfter: number;
          result: "WIN" | "LOSS" | "DRAW";
          battleMode: string;
          createdAt: string;
        }>;
        pagination: BattlePaginationMeta;
      };
    };
  },

  joinMatchmaking: async (params?: {
    difficulty?: BattleDifficulty;
    topic?: string;
    battleMode?: string;
  }) => {
    const res = await problemClient.post("/battles/matchmaking/join", params || {});
    return res.data as {
      success: boolean;
      data: {
        status: "SEARCHING" | "MATCHED";
        battleId?: string;
        battle?: Battle;
        queueEntry?: any;
      };
    };
  },

  cancelMatchmaking: async () => {
    const res = await problemClient.post("/battles/matchmaking/cancel");
    return res.data as { success: boolean; data: { success: boolean; message: string } };
  },

  getMatchmakingStatus: async () => {
    const res = await problemClient.get("/battles/matchmaking/status");
    return res.data as {
      success: boolean;
      data: {
        status: "IDLE" | "SEARCHING" | "MATCHED" | "IN_BATTLE";
        battleId?: string;
        battleStatus?: string;
        queueEntry?: any;
      };
    };
  },

  forfeitBattle: async (id: string) => {
    const res = await problemClient.post(
      `/battles/${encodeURIComponent(id)}/forfeit`
    );
    return res.data as { success: boolean; data: Battle };
  },

  getLeaderboard: async (params?: { page?: number; limit?: number }) => {
    const res = await problemClient.get("/battles/leaderboard", { params });
    return res.data as {
      success: boolean;
      data: BattleLeaderboardItem[];
      meta?: BattlePaginationMeta;
    };
  },

  getMyRank: async () => {
    const res = await problemClient.get("/battles/leaderboard/me");
    return res.data as {
      success: boolean;
      data: CompetitiveRatingStats & { rank: number };
    };
  },
};
