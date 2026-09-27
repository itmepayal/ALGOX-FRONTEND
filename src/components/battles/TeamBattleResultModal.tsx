import { useState, useEffect, type FC } from "react";
import { teamApi, type TeamBattleDto } from "../../api/teamApi";
import { Trophy, ArrowLeft, Loader2 } from "lucide-react";

interface TeamBattleResultModalProps {
  battleId: string;
  currentUserId: string;
  onBack: () => void;
}

export const TeamBattleResultModal: FC<TeamBattleResultModalProps> = ({
  battleId,
  onBack,
}) => {
  const [battle, setBattle] = useState<TeamBattleDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResult = async () => {
      try {
        setLoading(true);
        const res = await teamApi.getBattleById(battleId);
        if (res.success && res.data) {
          setBattle(res.data);
        }
      } catch (err) {
        console.error("Failed to load battle result", err);
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [battleId]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="text-center py-12">
        <button type="button" onClick={onBack} className="ax-btn">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const teamAName = battle.teamAId?.name || "Team A";
  const teamBName = battle.teamBId?.name || "Team B";
  const winnerTeamId = battle.winnerTeamId;
  const isTeamAWinner = winnerTeamId === battle.teamAId?.id || winnerTeamId === battle.teamAId?._id;
  const isDraw = !winnerTeamId;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-scale-in">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="ax-btn">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>

      <div className="battle-card p-8 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-black border border-indigo-500/30 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
          <Trophy size={32} />
        </div>

        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {isDraw ? "IT'S A DRAW!" : isTeamAWinner ? `${teamAName} VICTORY!` : `${teamBName} VICTORY!`}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Official Server-Authoritative Team Battle Result
          </p>
        </div>

        {/* SCORE BREAKDOWN */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-black/50 border border-white/5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-indigo-300 block">{teamAName}</span>
            <span className="text-3xl font-black text-white">{battle.teamAScore}</span>
            <div className="text-xs font-bold text-emerald-400">
              Rating Change: {battle.teamARatingChange >= 0 ? `+${battle.teamARatingChange}` : battle.teamARatingChange}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-purple-300 block">{teamBName}</span>
            <span className="text-3xl font-black text-white">{battle.teamBScore}</span>
            <div className="text-xs font-bold text-emerald-400">
              Rating Change: {battle.teamBRatingChange >= 0 ? `+${battle.teamBRatingChange}` : battle.teamBRatingChange}
            </div>
          </div>
        </div>

        <button type="button" onClick={onBack} className="ax-btn accent px-8 py-2.5">
          Return to Team Arena
        </button>
      </div>
    </div>
  );
};
