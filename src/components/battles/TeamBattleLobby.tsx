import { useState, useEffect, type FC } from "react";
import { teamApi, type TeamBattleDto } from "../../api/teamApi";
import { connectRealtimeSocket } from "../../realtime/socket";
import { useToast } from "../../context/ToastContext";
import {
  Play,
  Check,
  X,
  Loader2,
  Clock,
  ArrowLeft,
} from "lucide-react";

interface TeamBattleLobbyProps {
  battleId: string;
  currentUserId: string;
  onBack: () => void;
  onStartBattle: () => void;
}

export const TeamBattleLobby: FC<TeamBattleLobbyProps> = ({
  battleId,
  onBack,
  onStartBattle,
}) => {
  const toast = useToast();
  const [battle, setBattle] = useState<TeamBattleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadBattle = async () => {
    try {
      setLoading(true);
      const res = await teamApi.getBattleById(battleId);
      if (res.success && res.data) {
        setBattle(res.data);
        if (res.data.state === "LIVE") {
          onStartBattle();
        }
      }
    } catch (err) {
      console.error("Failed to load team battle", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBattle();

    const socket = connectRealtimeSocket();
    if (socket) {
      socket.emit("room.join", { room: `battle:${battleId}` });

      socket.on("team:battle_accepted", () => {
        toast.info("Battle challenge was accepted!");
        loadBattle();
      });

      socket.on("team:member_status", () => {
        loadBattle();
      });

      socket.on("team:battle_started", () => {
        toast.success("Team battle is starting now!");
        onStartBattle();
      });

      socket.on("team:battle_state", (data: any) => {
        if (data.state === "LIVE") {
          onStartBattle();
        } else {
          loadBattle();
        }
      });
    }

    return () => {
      if (socket) {
        socket.off("team:battle_accepted");
        socket.off("team:member_status");
        socket.off("team:battle_started");
        socket.off("team:battle_state");
      }
    };
  }, [battleId]);

  const handleAcceptChallenge = async () => {
    try {
      setSubmitting(true);
      const res = await teamApi.acceptBattle(battleId);
      if (res.success && res.data) {
        toast.success("Battle challenge accepted!");
        setBattle(res.data);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to accept battle");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartBattle = async () => {
    try {
      setSubmitting(true);
      const res = await teamApi.startBattle(battleId);
      if (res.success) {
        toast.success("Team battle initiated!");
        onStartBattle();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to start battle");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBattle = async () => {
    try {
      setSubmitting(true);
      const res = await teamApi.cancelBattle(battleId);
      if (res.success) {
        toast.info("Team battle cancelled.");
        onBack();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to cancel battle");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-rose-400 font-semibold">Team battle not found</div>
        <button type="button" onClick={onBack} className="ax-btn">
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  const teamAName = battle.teamAId?.name || "Team A";
  const teamBName = battle.teamBId?.name || "Team B";

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="ax-btn">
          <ArrowLeft size={14} /> Leave Lobby
        </button>
        <span className="ax-tag-pill is-status">
          <Clock size={12} /> {Math.round(battle.durationSeconds / 60)} Mins Duration
        </span>
      </div>

      {/* VS MATCHHEADER */}
      <div className="battle-card p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-500" />

        <div className="grid grid-cols-3 items-center gap-4 py-4">
          {/* TEAM A */}
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-400/40 flex items-center justify-center mx-auto text-indigo-300 font-bold text-xl">
              {teamAName.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-lg font-bold text-white">{teamAName}</h3>
            <div className="text-xs text-indigo-300">Rating: {battle.teamAId?.rating || 1200}</div>
            <div className="text-xs text-slate-400">
              Roster: {battle.teamAParticipants.length} Members
            </div>
          </div>

          {/* VS BADGE */}
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 font-black">
              VS
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">
              STATE: <strong className="text-indigo-400">{battle.state}</strong>
            </span>
          </div>

          {/* TEAM B */}
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-400/40 flex items-center justify-center mx-auto text-purple-300 font-bold text-xl">
              {teamBName.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-lg font-bold text-white">{teamBName}</h3>
            <div className="text-xs text-purple-300">Rating: {battle.teamBId?.rating || 1200}</div>
            <div className="text-xs text-slate-400">
              Roster: {battle.teamBParticipants.length} Members
            </div>
          </div>
        </div>

        {/* LOBBY CONTROLS */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
          {battle.state === "PENDING_ACCEPTANCE" && (
            <button
              type="button"
              onClick={handleAcceptChallenge}
              disabled={submitting}
              className="ax-btn accent px-6 py-2.5"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Accept Challenge</>}
            </button>
          )}

          {(battle.state === "LOBBY" || battle.state === "ACCEPTED") && (
            <button
              type="button"
              onClick={handleStartBattle}
              disabled={submitting}
              className="ax-btn accent px-8 py-3 text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <><Play size={16} /> Start Team Battle</>}
            </button>
          )}

          <button
            type="button"
            onClick={handleCancelBattle}
            disabled={submitting}
            className="ax-btn px-4 py-2.5 text-rose-400"
          >
            <X size={14} /> Cancel Challenge
          </button>
        </div>
      </div>
    </div>
  );
};
