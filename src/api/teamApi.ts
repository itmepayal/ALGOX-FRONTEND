import { problemClient, type ApiResponse } from "./problemApi";

export type TeamRole = "OWNER" | "CAPTAIN" | "MEMBER";
export type TeamStatus = "ACTIVE" | "SUSPENDED" | "DISBANDED";
export type TeamBattleState =
  | "CREATED"
  | "PENDING_ACCEPTANCE"
  | "ACCEPTED"
  | "LOBBY"
  | "READY"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "ABANDONED";

export interface TeamMemberDto {
  id: string;
  userId: string;
  username: string;
  email?: string;
  avatar?: string;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamDto {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  description: string;
  ownerId: string;
  status: TeamStatus;
  maxMembers: number;
  rating: number;
  peakRating: number;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  createdAt: string;
  members?: TeamMemberDto[];
  memberCount?: number;
}

export interface TeamInvitationDto {
  id: string;
  team: TeamDto;
  invitedBy: {
    _id: string;
    username: string;
    email?: string;
  };
  expiresAt: string;
  createdAt: string;
}

export interface TeamBattleDto {
  id?: string;
  _id?: string;
  teamAId: any;
  teamBId: any;
  creatorId: string;
  teamAParticipants: any[];
  teamBParticipants: any[];
  problemIds: any[];
  state: TeamBattleState;
  durationSeconds: number;
  startedAt?: string;
  endsAt?: string;
  completedAt?: string;
  teamAScore: number;
  teamBScore: number;
  winnerTeamId?: string;
  teamARatingChange: number;
  teamBRatingChange: number;
  createdAt: string;
}

export interface TeamLeaderboardItem extends TeamDto {
  rank: number;
  winRate: number;
}

export const teamApi = {
  createTeam: async (name: string, description = "") => {
    const res = await problemClient.post<ApiResponse<TeamDto>>("/teams", {
      name,
      description,
    });
    return res.data;
  },

  getMyTeam: async () => {
    const res = await problemClient.get<ApiResponse<TeamDto | null>>("/teams/me");
    return res.data;
  },

  getTeamById: async (id: string) => {
    const res = await problemClient.get<ApiResponse<TeamDto>>(`/teams/${id}`);
    return res.data;
  },

  inviteUser: async (teamId: string, targetUserId: string) => {
    const res = await problemClient.post<ApiResponse<any>>(
      `/teams/${teamId}/invitations`,
      { targetUserId }
    );
    return res.data;
  },

  getMyInvitations: async () => {
    const res = await problemClient.get<ApiResponse<TeamInvitationDto[]>>(
      "/teams/invitations/me"
    );
    return res.data;
  },

  acceptInvitation: async (invitationId: string) => {
    const res = await problemClient.post<ApiResponse<TeamDto>>(
      `/teams/invitations/${invitationId}/accept`
    );
    return res.data;
  },

  rejectInvitation: async (invitationId: string) => {
    const res = await problemClient.post<ApiResponse<{ message: string }>>(
      `/teams/invitations/${invitationId}/reject`
    );
    return res.data;
  },

  leaveTeam: async (teamId: string) => {
    const res = await problemClient.post<ApiResponse<{ message: string }>>(
      `/teams/${teamId}/leave`
    );
    return res.data;
  },

  removeMember: async (teamId: string, userId: string) => {
    const res = await problemClient.delete<ApiResponse<{ message: string }>>(
      `/teams/${teamId}/members/${userId}`
    );
    return res.data;
  },

  updateMemberRole: async (teamId: string, userId: string, role: TeamRole) => {
    const res = await problemClient.patch<ApiResponse<{ message: string }>>(
      `/teams/${teamId}/members/${userId}/role`,
      { role }
    );
    return res.data;
  },

  transferOwnership: async (teamId: string, newOwnerUserId: string) => {
    const res = await problemClient.post<ApiResponse<{ message: string }>>(
      `/teams/${teamId}/transfer-ownership`,
      { newOwnerUserId }
    );
    return res.data;
  },

  challengeTeam: async (teamAId: string, teamBId: string, durationSeconds = 1800) => {
    const res = await problemClient.post<ApiResponse<TeamBattleDto>>("/team-battles", {
      teamAId,
      teamBId,
      durationSeconds,
    });
    return res.data;
  },

  acceptBattle: async (battleId: string) => {
    const res = await problemClient.post<ApiResponse<TeamBattleDto>>(
      `/team-battles/${battleId}/accept`
    );
    return res.data;
  },

  selectParticipants: async (
    battleId: string,
    teamId: string,
    participantUserIds: string[]
  ) => {
    const res = await problemClient.post<ApiResponse<TeamBattleDto>>(
      `/team-battles/${battleId}/participants`,
      { teamId, participantUserIds }
    );
    return res.data;
  },

  startBattle: async (battleId: string) => {
    const res = await problemClient.post<ApiResponse<TeamBattleDto>>(
      `/team-battles/${battleId}/start`
    );
    return res.data;
  },

  finishBattle: async (battleId: string) => {
    const res = await problemClient.post<ApiResponse<TeamBattleDto>>(
      `/team-battles/${battleId}/finish`
    );
    return res.data;
  },

  getBattleById: async (battleId: string) => {
    const res = await problemClient.get<ApiResponse<TeamBattleDto>>(
      `/team-battles/${battleId}`
    );
    return res.data;
  },

  getLeaderboard: async (page = 1, limit = 20) => {
    const res = await problemClient.get<
      ApiResponse<{
        items: TeamLeaderboardItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>
    >("/team-battles/leaderboard", {
      params: { page, limit },
    });
    return res.data;
  },
};
