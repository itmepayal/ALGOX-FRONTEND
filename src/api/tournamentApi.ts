import { problemClient } from "./problemApi";

export type TournamentStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "SEEDED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export interface Tournament {
  id?: string;
  _id?: string;
  title: string;
  slug: string;
  description?: string;
  status: TournamentStatus;
  format: "SINGLE_ELIMINATION";
  maxParticipants: number;
  minParticipants: number;
  currentRound: number;
  totalRounds: number;
  participantCount: number;
  championId?: string;
  championName?: string;
  startTime: string;
  isRegistered?: boolean;
  myParticipant?: TournamentParticipant | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TournamentParticipant {
  id?: string;
  _id?: string;
  tournamentId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  seed: number;
  status: "REGISTERED" | "ACTIVE" | "ELIMINATED" | "CHAMPION";
  wins: number;
  losses: number;
  currentRound: number;
  eliminatedRound?: number;
  registeredAt?: string;
}

export interface TournamentMatchParticipant {
  userId: string;
  userName: string;
  seed: number;
}

export interface TournamentMatch {
  id?: string;
  _id?: string;
  tournamentId: string;
  roundNumber: number;
  matchNumber: number;
  label: string;
  participantA?: TournamentMatchParticipant;
  participantB?: TournamentMatchParticipant;
  winnerId?: string;
  loserId?: string;
  battleId?: string;
  status: "PENDING" | "READY" | "LIVE" | "COMPLETED" | "CANCELLED";
  nextMatchId?: string;
  nextMatchSlot?: "A" | "B";
  scheduledAt?: string;
  completedAt?: string;
}

export interface TournamentBracketPayload {
  tournament: Tournament;
  matches: TournamentMatch[];
}

export interface TournamentResultsPayload {
  tournament: Tournament;
  champion: { id: string; name: string } | null;
  participants: TournamentParticipant[];
}

export interface TournamentMySummaryPayload {
  tournamentsEntered: number;
  items: Array<{
    tournamentId: string;
    title: string;
    slug: string;
    status: string;
    seed: number;
    userStatus: string;
    wins: number;
    losses: number;
    registeredAt: string;
  }>;
}

export const tournamentApi = {
  listTournaments: async () => {
    const res = await problemClient.get("/tournaments/");
    return res.data as { success: boolean; data: Tournament[] };
  },

  getTournamentBySlug: async (slug: string) => {
    const res = await problemClient.get(`/tournaments/${encodeURIComponent(slug)}`);
    return res.data as { success: boolean; data: Tournament };
  },

  register: async (slug: string) => {
    const res = await problemClient.post(`/tournaments/${encodeURIComponent(slug)}/register`);
    return res.data as { success: boolean; data: TournamentParticipant };
  },

  getBracket: async (slug: string) => {
    const res = await problemClient.get(`/tournaments/${encodeURIComponent(slug)}/bracket`);
    return res.data as { success: boolean; data: TournamentBracketPayload };
  },

  getResults: async (slug: string) => {
    const res = await problemClient.get(`/tournaments/${encodeURIComponent(slug)}/results`);
    return res.data as { success: boolean; data: TournamentResultsPayload };
  },

  getMySummary: async () => {
    const res = await problemClient.get("/tournaments/me/summary");
    return res.data as { success: boolean; data: TournamentMySummaryPayload };
  },

  startMatchBattle: async (matchId: string) => {
    const res = await problemClient.post(`/tournaments/matches/${encodeURIComponent(matchId)}/start-battle`);
    return res.data as { success: boolean; data: { match: TournamentMatch; battle: any } };
  },
};
