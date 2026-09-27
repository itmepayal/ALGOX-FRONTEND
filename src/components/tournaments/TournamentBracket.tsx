import type { FC } from "react";
import { Crown, Trophy, Swords, CheckCircle, Play } from "lucide-react";
import type {
  TournamentMatch,
  Tournament,
} from "../../api/tournamentApi";

interface TournamentBracketProps {
  tournament: Tournament;
  matches: TournamentMatch[];
  currentUserId: string;
  onStartMatchBattle?: (matchId: string) => void;
}

export const TournamentBracket: FC<TournamentBracketProps> = ({
  tournament,
  matches,
  currentUserId,
  onStartMatchBattle,
}) => {
  const totalRounds = tournament.totalRounds || 3;

  // Group matches by roundNumber (1..totalRounds)
  const roundMap = new Map<number, TournamentMatch[]>();
  for (let r = 1; r <= totalRounds; r++) {
    roundMap.set(r, []);
  }

  for (const m of matches) {
    const list = roundMap.get(m.roundNumber) || [];
    list.push(m);
    roundMap.set(m.roundNumber, list);
  }

  const roundNames: Record<number, string> = {
    1: totalRounds === 3 ? "Quarter Finals" : totalRounds === 4 ? "Round of 16" : "Round 1",
    2: totalRounds === 3 ? "Semi Finals" : totalRounds === 4 ? "Quarter Finals" : "Round 2",
    3: totalRounds === 3 ? "Final" : totalRounds === 4 ? "Semi Finals" : "Quarter Finals",
    4: totalRounds === 4 ? "Final" : "Semi Finals",
    5: "Final",
  };

  return (
    <div className="tournament-bracket-container overflow-x-auto py-6">
      <div className="flex gap-8 min-w-max items-stretch justify-start px-2">
        {Array.from({ length: totalRounds }).map((_, idx) => {
          const roundNum = idx + 1;
          const roundMatches = roundMap.get(roundNum) || [];
          const name = roundNames[roundNum] || `Round ${roundNum}`;
          const isFinalRound = roundNum === totalRounds;

          return (
            <div
              key={roundNum}
              className="flex flex-col flex-1 min-w-[280px] max-w-[320px] justify-around gap-6"
            >
              {/* Round Header */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-center shadow-md">
                <span className="text-xs font-semibold uppercase text-indigo-400 tracking-wider flex items-center justify-center gap-1.5">
                  {isFinalRound ? (
                    <Trophy className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Swords className="w-3.5 h-3.5" />
                  )}
                  {name}
                </span>
              </div>

              {/* Round Matches */}
              <div className="flex flex-col gap-6 justify-around flex-1">
                {roundMatches.map((match) => {
                  const partA = match.participantA;
                  const partB = match.participantB;

                  const isMeInA = partA?.userId === currentUserId;
                  const isMeInB = partB?.userId === currentUserId;
                  const isUserInMatch = isMeInA || isMeInB;

                  const isWinnerA = match.winnerId && match.winnerId === partA?.userId;
                  const isWinnerB = match.winnerId && match.winnerId === partB?.userId;

                  const canStart =
                    match.status === "READY" &&
                    isUserInMatch &&
                    onStartMatchBattle;

                  return (
                    <div
                      key={match.id || `${match.roundNumber}-${match.matchNumber}`}
                      className={`relative rounded-xl border p-3.5 transition-all duration-300 ${
                        isUserInMatch
                          ? "bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                          : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
                        <span>{match.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            match.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : match.status === "LIVE"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                              : match.status === "READY"
                              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {match.status}
                        </span>
                      </div>

                      {/* Participant A Slot */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-lg border my-1 transition-colors ${
                          isWinnerA
                            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                            : isMeInA
                            ? "bg-indigo-900/40 border-indigo-500/40 text-indigo-200"
                            : partA
                            ? "bg-slate-950/60 border-slate-800 text-slate-200"
                            : "bg-slate-950/20 border-slate-800/40 text-slate-500 italic"
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {partA ? (
                            <>
                              <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                #{partA.seed}
                              </span>
                              <span className="font-semibold text-xs truncate">
                                {partA.userName}
                              </span>
                              {isMeInA && (
                                <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 rounded">
                                  YOU
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs">TBD</span>
                          )}
                        </div>
                        {isWinnerA && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>

                      {/* Participant B Slot */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-lg border my-1 transition-colors ${
                          isWinnerB
                            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                            : isMeInB
                            ? "bg-indigo-900/40 border-indigo-500/40 text-indigo-200"
                            : partB
                            ? "bg-slate-950/60 border-slate-800 text-slate-200"
                            : "bg-slate-950/20 border-slate-800/40 text-slate-500 italic"
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {partB ? (
                            <>
                              <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                #{partB.seed}
                              </span>
                              <span className="font-semibold text-xs truncate">
                                {partB.userName}
                              </span>
                              {isMeInB && (
                                <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 rounded">
                                  YOU
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs">TBD</span>
                          )}
                        </div>
                        {isWinnerB && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>

                      {/* Match Start Button for User */}
                      {canStart && match.id && (
                        <button
                          onClick={() => onStartMatchBattle(match.id!)}
                          className="mt-2 w-full py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs rounded-lg shadow-md flex items-center justify-center gap-1.5 transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" /> Start Match Battle
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Champion Display Box */}
        {tournament.championName && (
          <div className="flex flex-col min-w-[240px] justify-center items-center">
            <div className="bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 border border-amber-500/40 p-6 rounded-2xl text-center shadow-xl flex flex-col items-center gap-3">
              <Crown className="w-10 h-10 text-amber-400 animate-bounce" />
              <span className="text-xs font-extrabold uppercase text-amber-400 tracking-wider">
                Tournament Champion
              </span>
              <h3 className="text-xl font-bold text-slate-100">
                {tournament.championName}
              </h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
