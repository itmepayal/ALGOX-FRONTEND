import { useState, useEffect, type FC } from "react";
import { battleApi, type Battle, type BattleParticipant } from "../../api/battleApi";
import { connectRealtimeSocket } from "../../realtime/socket";
import { Swords, Check, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "../../context/ToastContext";

interface BattleLobbyProps {
  battleId: string;
  currentUserId: string;
  onBack: () => void;
  onStartBattle: () => void;
}

export const BattleLobby: FC<BattleLobbyProps> = ({
  battleId,
  currentUserId,
  onBack,
  onStartBattle,
}) => {
  const toast = useToast();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [participants, setParticipants] = useState<BattleParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Fetch initial lobby data & join socket room
  const loadLobby = async () => {
    try {
      const res = await battleApi.joinLobby(battleId);
      if (res.success && res.data) {
        setBattle(res.data.battle);
        setParticipants(res.data.participants || []);

        const me = res.data.participants.find((p) => p.userId === currentUserId);
        if (me) setIsReady(me.isReady);

        if (res.data.battle.status === "ACTIVE") {
          onStartBattle();
        }
      }
    } catch (err: any) {
      console.error("Failed to join lobby", err);
      toast.error(err?.response?.data?.message || "Failed to load lobby");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLobby();

    const socket = connectRealtimeSocket();
    if (socket) {
      socket.emit("room.join", { room: `battle:${battleId}` });

      socket.on("battle:ready", (data: any) => {
        if (data.battleId === battleId && data.participants) {
          setParticipants(data.participants);
        }
      });

      socket.on("battle:opponent_status", (data: any) => {
        if (data.battleId === battleId) {
          loadLobby();
        }
      });

      socket.on("battle:started", (data: any) => {
        if (data.battleId === battleId) {
          setCountdown(3);
        }
      });
    }

    return () => {
      if (socket) {
        socket.emit("room.leave", { room: `battle:${battleId}` });
        socket.off("battle:ready");
        socket.off("battle:opponent_status");
        socket.off("battle:started");
      }
    };
  }, [battleId]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onStartBattle();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleToggleReady = async () => {
    const nextState = !isReady;
    setIsReady(nextState);
    try {
      const res = await battleApi.setReady(battleId, nextState);
      if (res.success && res.data) {
        setBattle(res.data.battle);
        setParticipants(res.data.participants || []);
        if (res.data.battle.status === "ACTIVE") {
          setCountdown(3);
        }
      }
    } catch (err: any) {
      setIsReady(!nextState);
      toast.error(err?.response?.data?.message || "Failed to update ready state");
    }
  };

  if (loading || !battle) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  const isCreator = battle.creatorId === currentUserId;
  const opponentName = isCreator ? battle.opponentName : battle.creatorName;

  const mePart = participants.find((p) => p.userId === currentUserId);
  const oppPart = participants.find((p) => p.userId !== currentUserId);

  return (
    <div className="lobby-container">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Battles
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-400">
            {battle.difficulty.toUpperCase()}
          </span>
          <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-400">
            {battle.problemCount} Problems
          </span>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
            {Math.round(battle.durationSeconds / 60)} Mins
          </span>
        </div>
      </div>

      <div className="mt-6 text-center">
        <h2 className="text-2xl font-black text-white">⚔️ BATTLE LOBBY</h2>
        <p className="mt-1 text-sm text-slate-400">
          Wait for both participants to get ready to launch the 1v1 battle!
        </p>
      </div>

      {/* VS Cards */}
      <div className="lobby-vs-area">
        {/* You */}
        <div className={`lobby-player-card ${mePart?.isReady ? "ready" : ""}`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-2xl font-black text-white shadow-lg">
            YOU
          </div>
          <div className="mt-3 font-bold text-white text-lg">
            {isCreator ? battle.creatorName : battle.opponentName}
          </div>
          <div className="mt-1 text-xs font-semibold text-emerald-400">● Connected</div>
          <div className="mt-3">
            {mePart?.isReady ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                <Check className="h-4 w-4" /> READY
              </span>
            ) : (
              <span className="text-xs text-slate-400">NOT READY</span>
            )}
          </div>
        </div>

        {/* VS Badge */}
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 font-black text-white shadow-lg shadow-rose-500/30">
            VS
          </div>
          {countdown !== null && (
            <div className="mt-3 text-2xl font-black text-sky-400 animate-bounce">
              Starting in {countdown}...
            </div>
          )}
        </div>

        {/* Opponent */}
        <div className={`lobby-player-card ${oppPart?.isReady ? "ready" : ""}`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500 to-pink-600 text-2xl font-black text-white shadow-lg">
            {opponentName.charAt(0).toUpperCase()}
          </div>
          <div className="mt-3 font-bold text-white text-lg">{opponentName}</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">
            {oppPart?.connectionStatus === "CONNECTED" ? (
              <span className="text-emerald-400">● Connected</span>
            ) : (
              <span className="text-slate-500">○ Disconnected</span>
            )}
          </div>
          <div className="mt-3">
            {oppPart?.isReady ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                <Check className="h-4 w-4" /> READY
              </span>
            ) : (
              <span className="text-xs text-slate-400">WAITING...</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="mt-8 space-y-4 max-w-md mx-auto">
        <button
          type="button"
          onClick={handleToggleReady}
          className={`ready-toggle-btn ${isReady ? "is-ready" : "not-ready"}`}
        >
          {isReady ? (
            <>
              <Check className="h-5 w-5" /> YOU ARE READY! (Click to unready)
            </>
          ) : (
            <>
              <Swords className="h-5 w-5" /> I'M READY FOR BATTLE!
            </>
          )}
        </button>
      </div>
    </div>
  );
};
