import { useState, useEffect, type FC } from "react";
import {
  teamApi,
  type TeamDto,
  type TeamInvitationDto,
  type TeamLeaderboardItem,
  type TeamRole,
} from "../../api/teamApi";
import { connectRealtimeSocket } from "../../realtime/socket";
import { useToast } from "../../context/ToastContext";
import {
  Users,
  UserPlus,
  Shield,
  Crown,
  Swords,
  Trophy,
  LogOut,
  UserX,
  Check,
  X,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";

interface TeamBattlesPanelProps {
  currentUserId: string;
  onOpenTeamBattleLobby: (battleId: string) => void;
}

export const TeamBattlesPanel: FC<TeamBattlesPanelProps> = ({
  currentUserId,
  onOpenTeamBattleLobby,
}) => {
  const toast = useToast();
  const [myTeam, setMyTeam] = useState<TeamDto | null>(null);
  const [invitations, setInvitations] = useState<TeamInvitationDto[]>([]);
  const [leaderboard, setLeaderboard] = useState<TeamLeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Modals
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  // Form states
  const [teamNameInput, setTeamNameInput] = useState("");
  const [teamDescInput, setTeamDescInput] = useState("");
  const [targetUserIdInput, setTargetUserIdInput] = useState("");
  const [challengeTeamIdInput, setChallengeTeamIdInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamRes, invRes] = await Promise.all([
        teamApi.getMyTeam(),
        teamApi.getMyInvitations(),
      ]);

      if (teamRes.success) {
        setMyTeam(teamRes.data || null);
      }
      if (invRes.success && Array.isArray(invRes.data)) {
        setInvitations(invRes.data);
      }
    } catch (err) {
      console.error("Failed to load team data", err);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      const res = await teamApi.getLeaderboard(1, 20);
      if (res.success && res.data?.items) {
        setLeaderboard(res.data.items);
      }
    } catch (err) {
      console.error("Failed to load team leaderboard", err);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadLeaderboard();

    const socket = connectRealtimeSocket();
    if (socket) {
      if (myTeam?.id || myTeam?._id) {
        socket.emit("room.join", { room: `team:${myTeam.id || myTeam._id}` });
      }

      socket.on("team:invitation", () => {
        toast.info("You received a new Team Invitation!");
        loadData();
      });

      socket.on("team:member_joined", () => {
        toast.success("A member joined your team!");
        loadData();
      });

      socket.on("team:member_left", () => {
        loadData();
      });

      socket.on("team:battle_created", (data: any) => {
        toast.warning(
          `Your team received a battle challenge from ${data.challengingTeamName || "another team"}!`
        );
        loadData();
      });
    }

    return () => {
      if (socket) {
        socket.off("team:invitation");
        socket.off("team:member_joined");
        socket.off("team:member_left");
        socket.off("team:battle_created");
      }
    };
  }, [myTeam?.id]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamNameInput.trim()) {
      toast.error("Team name is required");
      return;
    }
    try {
      setSubmitting(true);
      const res = await teamApi.createTeam(teamNameInput, teamDescInput);
      if (res.success && res.data) {
        toast.success("Team created successfully!");
        setMyTeam(res.data);
        setIsCreateTeamOpen(false);
        setTeamNameInput("");
        setTeamDescInput("");
        loadLeaderboard();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const teamId = myTeam?.id || myTeam?._id;
    if (!teamId || !targetUserIdInput.trim()) return;

    try {
      setSubmitting(true);
      const res = await teamApi.inviteUser(teamId, targetUserIdInput.trim());
      if (res.success) {
        toast.success("Invitation sent!");
        setIsInviteModalOpen(false);
        setTargetUserIdInput("");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      const res = await teamApi.acceptInvitation(inviteId);
      if (res.success && res.data) {
        toast.success("Joined team!");
        setMyTeam(res.data);
        loadData();
        loadLeaderboard();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to accept invitation");
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    try {
      const res = await teamApi.rejectInvitation(inviteId);
      if (res.success) {
        toast.info("Invitation rejected");
        loadData();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to reject invitation");
    }
  };

  const handleLeaveTeam = async () => {
    const teamId = myTeam?.id || myTeam?._id;
    if (!teamId) return;

    try {
      const res = await teamApi.leaveTeam(teamId);
      if (res.success) {
        toast.info("Left team");
        setMyTeam(null);
        loadLeaderboard();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to leave team");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const teamId = myTeam?.id || myTeam?._id;
    if (!teamId) return;

    try {
      const res = await teamApi.removeMember(teamId, userId);
      if (res.success) {
        toast.success("Member removed");
        loadData();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove member");
    }
  };

  const handleRoleChange = async (userId: string, newRole: TeamRole) => {
    const teamId = myTeam?.id || myTeam?._id;
    if (!teamId) return;

    try {
      const res = await teamApi.updateMemberRole(teamId, userId, newRole);
      if (res.success) {
        toast.success(`Role updated to ${newRole}`);
        loadData();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update role");
    }
  };

  const handleChallengeTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const myTeamId = myTeam?.id || myTeam?._id;
    if (!myTeamId || !challengeTeamIdInput.trim()) return;

    try {
      setSubmitting(true);
      const res = await teamApi.challengeTeam(myTeamId, challengeTeamIdInput.trim());
      if (res.success && res.data) {
        toast.success("Team battle challenge issued!");
        setIsChallengeModalOpen(false);
        setChallengeTeamIdInput("");
        const battleId = res.data.id || res.data._id;
        if (battleId) onOpenTeamBattleLobby(battleId);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to issue challenge");
    } finally {
      setSubmitting(false);
    }
  };

  const userRoleInTeam: TeamRole | null =
    myTeam?.members?.find((m) => m.userId === currentUserId)?.role || null;
  const isCaptainOrOwner = userRoleInTeam === "OWNER" || userRoleInTeam === "CAPTAIN";
  const isOwner = userRoleInTeam === "OWNER";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Pending Invitations Banner */}
      {invitations.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Sparkles size={16} /> Pending Team Invitations ({invitations.length})
            </span>
          </div>
          <div className="grid gap-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    {inv.team.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    Invited by <strong>{inv.invitedBy.username}</strong> • Rating: {inv.team.rating}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRejectInvite(inv.id)}
                    className="ax-btn text-xs"
                  >
                    <X size={12} className="text-rose-400" /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcceptInvite(inv.id)}
                    className="ax-btn accent text-xs"
                  >
                    <Check size={12} /> Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
        </div>
      ) : myTeam ? (
        /* ACTIVE TEAM CARD */
        <div className="battle-card p-6 rounded-2xl bg-slate-900/90 border border-indigo-500/20 shadow-xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {myTeam.name}
                </h2>
                <span className="ax-tag-pill is-status">
                  <Shield size={12} /> {myTeam.status}
                </span>
                <span className="ax-tag-pill" style={{ color: "#a855f7", borderColor: "rgba(168, 85, 247, 0.3)" }}>
                  <Crown size={12} /> Rating: {myTeam.rating}
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                {myTeam.description || "No description provided."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isCaptainOrOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(true)}
                    className="ax-btn text-xs"
                  >
                    <UserPlus size={13} /> Invite Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChallengeModalOpen(true)}
                    className="ax-btn accent text-xs"
                    style={{
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                    }}
                  >
                    <Swords size={13} /> Issue Challenge
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleLeaveTeam}
                className="ax-btn text-xs"
              >
                <LogOut size={13} className="text-rose-400" /> Leave Team
              </button>
            </div>
          </div>

          {/* Team Performance Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-black/40 border border-white/5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                RATING / PEAK
              </span>
              <span className="text-base font-bold text-indigo-300">
                {myTeam.rating} <span className="text-xs text-slate-500">({myTeam.peakRating})</span>
              </span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                MATCHES
              </span>
              <span className="text-base font-bold text-white">{myTeam.matches}</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                WINS / LOSSES
              </span>
              <span className="text-base font-bold text-emerald-400">
                {myTeam.wins} <span className="text-slate-500 font-normal">/</span> <span className="text-rose-400">{myTeam.losses}</span>
              </span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                WIN RATE
              </span>
              <span className="text-base font-bold text-amber-400">
                {myTeam.matches > 0 ? Math.round((myTeam.wins / myTeam.matches) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Members Roster */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>TEAM ROSTER ({myTeam.members?.length || 0} / {myTeam.maxMembers})</span>
              <span className="text-[11px] text-slate-500 font-normal">Your Role: {userRoleInTeam}</span>
            </h3>

            <div className="grid gap-2">
              {myTeam.members?.map((member) => {
                const isMemberOwner = member.role === "OWNER";
                const isMemberCaptain = member.role === "CAPTAIN";

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center font-bold text-indigo-200 text-xs">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                          {member.username}
                          {isMemberOwner && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                              <Crown size={10} /> OWNER
                            </span>
                          )}
                          {isMemberCaptain && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 flex items-center gap-1">
                              <Shield size={10} /> CAPTAIN
                            </span>
                          )}
                        </div>
                        {member.email && (
                          <div className="text-xs text-slate-400">{member.email}</div>
                        )}
                      </div>
                    </div>

                    {/* Owner management controls */}
                    {isOwner && member.userId !== currentUserId && (
                      <div className="flex items-center gap-2">
                        {member.role === "MEMBER" && (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(member.userId, "CAPTAIN")}
                            className="ax-btn text-[11px] h-7"
                          >
                            Promote Captain
                          </button>
                        )}
                        {member.role === "CAPTAIN" && (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(member.userId, "MEMBER")}
                            className="ax-btn text-[11px] h-7"
                          >
                            Demote Member
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.userId)}
                          className="ax-btn text-[11px] h-7 text-rose-400"
                        >
                          <UserX size={12} /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* NO TEAM EMPTY STATE */
        <div className="ax-empty-card p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400">
            <Users size={24} />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">You are not in a Team</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            Create a new competitive coding clan or request an invitation from an existing team captain to compete in Team Battles.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateTeamOpen(true)}
            className="ax-btn accent px-6 py-2"
          >
            <Plus size={14} /> Create a Team
          </button>
        </div>
      )}

      {/* TEAM LEADERBOARD */}
      <div className="battle-card p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy size={16} className="text-amber-400" /> GLOBAL TEAM RANKINGS
          </h3>
          <span className="text-xs text-slate-400">Total Teams: {leaderboard.length}</span>
        </div>

        {leaderboardLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            No active team rankings available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-black/40 text-slate-400 font-semibold border-b border-white/5 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Team</th>
                  <th className="py-2.5 px-3">Rating</th>
                  <th className="py-2.5 px-3">W / L / D</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((team) => (
                  <tr key={team.id || team._id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-bold text-indigo-400">#{team.rank}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{team.name}</div>
                      <div className="text-[10px] text-slate-400">{team.description || "No description"}</div>
                    </td>
                    <td className="py-3 px-3 font-bold text-purple-300">{team.rating}</td>
                    <td className="py-3 px-3">
                      <span className="text-emerald-400">{team.wins}</span> /{" "}
                      <span className="text-rose-400">{team.losses}</span> /{" "}
                      <span className="text-slate-400">{team.draws}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-amber-400">{team.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE TEAM MODAL */}
      {isCreateTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-indigo-400" /> Create New Team
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateTeamOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  placeholder="e.g. Algo Warriors"
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Description
                </label>
                <textarea
                  value={teamDescInput}
                  onChange={(e) => setTeamDescInput(e.target.value)}
                  placeholder="Describe your clan strategy and goal..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(false)}
                  className="ax-btn flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ax-btn accent flex-1"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVITE USER MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus size={18} className="text-indigo-400" /> Invite Member to Team
              </h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target User ID *
                </label>
                <input
                  type="text"
                  value={targetUserIdInput}
                  onChange={(e) => setTargetUserIdInput(e.target.value)}
                  placeholder="Enter User ID to invite..."
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="ax-btn flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ax-btn accent flex-1"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHALLENGE TEAM MODAL */}
      {isChallengeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Swords size={18} className="text-amber-400" /> Issue Team Battle Challenge
              </h3>
              <button
                type="button"
                onClick={() => setIsChallengeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleChallengeTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Opponent Team ID *
                </label>
                <input
                  type="text"
                  value={challengeTeamIdInput}
                  onChange={(e) => setChallengeTeamIdInput(e.target.value)}
                  placeholder="Enter opponent Team ID..."
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChallengeModalOpen(false)}
                  className="ax-btn flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ax-btn accent flex-1"
                  style={{ background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)" }}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : "Send Challenge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
