import { useState, useEffect, type FC } from "react";
import { battleApi, type BattleResultData } from "../../api/battleApi";
import { Trophy, Swords, CheckCircle2, XCircle, ArrowLeft, Loader2 } from "lucide-react";

interface BattleResultModalProps {
  battleId: string;
  currentUserId: string;
  onBack: () => void;
  onChallengeAgain?: () => void;
}

export const BattleResultModal: FC<BattleResultModalProps> = ({
  battleId,
  currentUserId,
  onBack,
  onChallengeAgain,
}) => {
  const [result, setResult] = useState<BattleResultData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResult() {
      try {
        const res = await battleApi.getBattleResult(battleId);
        if (res.success && res.data) {
          setResult(res.data);
        }
      } catch (err) {
        console.error("Failed to load battle result", err);
      } finally {
        setLoading(false);
      }
    }
    fetchResult();
  }, [battleId]);

  if (loading || !result) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  const { battle, participants, problems, submissions } = result;

  const me = participants.find((p) => p.userId === currentUserId);
  const opp = participants.find((p) => p.userId !== currentUserId);

  const isCreator = battle.creatorId === currentUserId;
  const oppName = isCreator ? battle.opponentName : battle.creatorName;

  const isWinner = battle.winnerId === currentUserId;
  const isDraw = !battle.winnerId && battle.status !== "FORFEITED";
  const isForfeit = battle.status === "FORFEITED";

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-900/90 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl text-white">
      {/* Result Banner */}
      <div
        className={`result-banner ${
          isWinner ? "win" : isDraw ? "draw" : "loss"
        }`}
      >
        <Trophy className="h-12 w-12 mx-auto mb-2 text-yellow-400" />
        <h1 className="text-3xl font-black tracking-tight">
          {isWinner
            ? "🏆 YOU WON THE BATTLE!"
            : isDraw
            ? "🤝 BATTLE ENDED IN A DRAW!"
            : isForfeit && battle.forfeitedBy === currentUserId
            ? "⚔️ YOU FORFEITED THE BATTLE"
            : "⚔️ OPPONENT WON THE BATTLE"}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Final Scores — You: <span className="font-bold text-sky-400">{me?.score || 0} pts</span> | {oppName}: <span className="font-bold text-purple-400">{opp?.score || 0} pts</span>
        </p>
      </div>

      {/* Players Score Comparison */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* You */}
        <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/10 text-center">
          <div className="text-xs uppercase tracking-wider font-bold text-sky-400">YOU</div>
          <div className="text-3xl font-black text-white mt-1">{me?.score || 0}</div>
          <div className="text-xs text-slate-300 mt-1">
            Solved: <span className="font-bold text-white">{me?.solvedCount || 0}</span> / {problems.length} | Wrong: <span className="font-bold text-rose-400">{me?.wrongAttempts || 0}</span>
          </div>
        </div>

        {/* Opponent */}
        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 text-center">
          <div className="text-xs uppercase tracking-wider font-bold text-purple-400">{oppName}</div>
          <div className="text-3xl font-black text-white mt-1">{opp?.score || 0}</div>
          <div className="text-xs text-slate-300 mt-1">
            Solved: <span className="font-bold text-white">{opp?.solvedCount || 0}</span> / {problems.length} | Wrong: <span className="font-bold text-rose-400">{opp?.wrongAttempts || 0}</span>
          </div>
        </div>
      </div>

      {/* Per-Problem Breakdown */}
      <div className="mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
          Problem-by-Problem Summary
        </h3>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-800/60">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs text-slate-400 uppercase font-semibold">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Problem</th>
                <th className="p-3">Difficulty</th>
                <th className="p-3">Base Points</th>
                <th className="p-3">Your Status</th>
                <th className="p-3">{oppName}'s Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {problems.map((prob, idx) => {
                const mySub = submissions.find(
                  (s) => s.userId === currentUserId && s.problemId === prob.problemId && s.status === "ACCEPTED"
                );
                const oppSub = submissions.find(
                  (s) => s.userId !== currentUserId && s.problemId === prob.problemId && s.status === "ACCEPTED"
                );

                return (
                  <tr key={prob.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-semibold text-white">{prob.title}</td>
                    <td className="p-3">
                      <span className="capitalize text-xs font-bold px-2 py-0.5 rounded bg-white/10">
                        {prob.difficulty}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-sky-400">{prob.points} pts</td>
                    <td className="p-3">
                      {mySub ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Solved
                          {mySub.isFirstSolve && (
                            <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded ml-1">
                              +20 Bonus
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <XCircle className="h-4 w-4 text-slate-500" /> Unsolved
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {oppSub ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-400">
                          <CheckCircle2 className="h-4 w-4" /> Solved
                          {oppSub.isFirstSolve && (
                            <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded ml-1">
                              +20 Bonus
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <XCircle className="h-4 w-4 text-slate-500" /> Unsolved
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex gap-4 pt-2 border-t border-white/10">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-800 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Battles
        </button>
        {onChallengeAgain && (
          <button
            type="button"
            onClick={onChallengeAgain}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90"
          >
            <Swords className="h-4 w-4" /> Challenge Again
          </button>
        )}
      </div>
    </div>
  );
};
