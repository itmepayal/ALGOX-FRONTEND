import { useState, useEffect, type FC } from "react";
import {
  Trophy,
  Medal,
  Crown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Award,
  Swords,
} from "lucide-react";
import {
  battleApi,
  type BattleLeaderboardItem,
  type BattlePaginationMeta,
  type CompetitiveRatingStats,
} from "../../api/battleApi";
import { useToast } from "../../context/ToastContext";

interface BattleLeaderboardProps {
  currentUserId: string;
}

export const BattleLeaderboard: FC<BattleLeaderboardProps> = ({
  currentUserId,
}) => {
  const toast = useToast();
  const [items, setItems] = useState<BattleLeaderboardItem[]>([]);
  const [myRankData, setMyRankData] = useState<
    (CompetitiveRatingStats & { rank: number }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<BattlePaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async (targetPage = page) => {
    try {
      setLoading(true);
      setError(null);
      const [lbRes, myRankRes] = await Promise.all([
        battleApi.getLeaderboard({ page: targetPage, limit: 15 }),
        battleApi.getMyRank(),
      ]);

      if (lbRes.success && lbRes.data) {
        setItems(lbRes.data);
        if (lbRes.meta) setMeta(lbRes.meta);
      } else {
        setError("Failed to load competitive leaderboard.");
      }

      if (myRankRes.success && myRankRes.data) {
        setMyRankData(myRankRes.data);
      }
    } catch (err: any) {
      console.error("Leaderboard fetch error:", err);
      setError(
        err?.response?.data?.message || "Could not retrieve competitive rankings."
      );
      toast.error("Failed to update competitive leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(page);
  }, [page]);

  const top3 = items.slice(0, 3);

  return (
    <div className="battle-leaderboard-container space-y-6">
      {/* Header & User Rank Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
              Global Battle Leaderboard
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Authoritative competitive rating rankings based on verified 1v1 Battle results
          </p>
        </div>

        {/* Current User Quick Summary Card */}
        {myRankData && (
          <div className="flex items-center gap-4 bg-slate-950/60 border border-indigo-500/30 px-5 py-3 rounded-xl">
            <div className="flex flex-col items-center border-r border-slate-800 pr-4">
              <span className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
                Your Rank
              </span>
              <span className="text-xl font-extrabold text-indigo-400">
                #{myRankData.rank || "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
                Rating / Peak
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-slate-100">
                  {myRankData.currentRating}
                </span>
                <span className="text-xs text-slate-500">
                  (Peak: {myRankData.peakRating})
                </span>
              </div>
            </div>
            <div className="hidden sm:flex flex-col border-l border-slate-800 pl-4">
              <span className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
                Win Rate
              </span>
              <span className="text-sm font-bold text-emerald-400">
                {myRankData.winRate}% ({myRankData.wins}W / {myRankData.losses}L)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Top 3 Podium Cards */}
      {!loading && top3.length > 0 && page === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          {top3.map((entry) => {
            const isRank1 = entry.rank === 1;
            const isRank2 = entry.rank === 2;
            const isRank3 = entry.rank === 3;

            return (
              <div
                key={entry.user.id}
                className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                  isRank1
                    ? "bg-gradient-to-b from-amber-500/10 via-slate-900/90 to-slate-950 border-amber-500/40 shadow-lg shadow-amber-500/5"
                    : isRank2
                    ? "bg-gradient-to-b from-slate-400/10 via-slate-900/90 to-slate-950 border-slate-400/30"
                    : "bg-gradient-to-b from-amber-700/10 via-slate-900/90 to-slate-950 border-amber-700/30"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${
                        isRank1
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : isRank2
                          ? "bg-slate-400/20 text-slate-300 border-slate-400/50"
                          : "bg-amber-700/20 text-amber-400 border-amber-700/50"
                      }`}
                    >
                      {entry.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                        {entry.user.name}
                        {entry.user.id === currentUserId && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30">
                            YOU
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {entry.rankedBattles} Ranked Battles
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {isRank1 && <Crown className="w-6 h-6 text-amber-400 animate-pulse" />}
                    {isRank2 && <Medal className="w-6 h-6 text-slate-300" />}
                    {isRank3 && <Award className="w-6 h-6 text-amber-600" />}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">Rating</span>
                    <span className="text-xl font-extrabold text-slate-100">
                      {entry.rating}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Win Rate</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {entry.winRate}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                <th className="py-4 px-6">Rank</th>
                <th className="py-4 px-6">Player</th>
                <th className="py-4 px-6 text-right">Rating</th>
                <th className="py-4 px-6 text-right">Peak</th>
                <th className="py-4 px-6 text-center">Record (W/L/D)</th>
                <th className="py-4 px-6 text-right">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {loading ? (
                Array.from({ length: 10 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6">
                      <div className="h-5 w-8 bg-slate-800 rounded"></div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="h-5 w-32 bg-slate-800 rounded"></div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="h-5 w-16 bg-slate-800 rounded ml-auto"></div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="h-5 w-16 bg-slate-800 rounded ml-auto"></div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="h-5 w-24 bg-slate-800 rounded mx-auto"></div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="h-5 w-14 bg-slate-800 rounded ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-rose-400">
                    <div className="flex flex-col items-center gap-3">
                      <p>{error}</p>
                      <button
                        onClick={() => fetchLeaderboard(page)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
                      >
                        <RefreshCw className="w-4 h-4" /> Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Swords className="w-8 h-8 text-slate-600 mb-1" />
                      <p className="font-semibold text-slate-300">
                        No competitive rankings yet.
                      </p>
                      <p className="text-xs text-slate-500">
                        Play a ranked Quick Match to establish your competitive record.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((entry) => {
                  const isMe = entry.user.id === currentUserId;
                  return (
                    <tr
                      key={entry.user.id}
                      className={`transition-colors hover:bg-slate-800/40 ${
                        isMe ? "bg-indigo-950/30 border-l-4 border-l-indigo-500" : ""
                      }`}
                    >
                      <td className="py-4 px-6 font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          {entry.rank === 1 && (
                            <span className="text-amber-400 font-extrabold">🥇 #1</span>
                          )}
                          {entry.rank === 2 && (
                            <span className="text-slate-300 font-extrabold">🥈 #2</span>
                          )}
                          {entry.rank === 3 && (
                            <span className="text-amber-600 font-extrabold">🥉 #3</span>
                          )}
                          {entry.rank > 3 && `#${entry.rank}`}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
                            {entry.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-100 flex items-center gap-2">
                              {entry.user.name}
                              {isMe && (
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                  YOU
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-100">
                        {entry.rating}
                      </td>
                      <td className="py-4 px-6 text-right text-slate-400 text-xs">
                        {entry.peakRating}
                      </td>
                      <td className="py-4 px-6 text-center text-xs text-slate-300">
                        <span className="text-emerald-400 font-semibold">
                          {entry.wins}W
                        </span>{" "}
                        /{" "}
                        <span className="text-rose-400 font-semibold">
                          {entry.losses}L
                        </span>{" "}
                        / <span className="text-slate-400">{entry.draws}D</span>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-emerald-400">
                        {entry.winRate}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              Showing Page <span className="font-semibold text-slate-200">{meta.page}</span> of{" "}
              <span className="font-semibold text-slate-200">{meta.totalPages}</span> ({meta.total} Total Users)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={!meta.hasPreviousPage || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                disabled={!meta.hasNextPage || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
