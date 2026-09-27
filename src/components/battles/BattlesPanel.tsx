import { useState, useEffect, type FC } from "react";
import type {
  Battle,
  MyBattlesData,
  BattleStatsData,
  BattlePaginationMeta,
} from "../../api/battleApi";
import { battleApi } from "../../api/battleApi";
import { ChallengeStudentModal } from "./ChallengeStudentModal";
import { QuickMatchModal } from "./QuickMatchModal";
import { BattleLobby } from "./BattleLobby";
import { BattleWorkspace } from "./BattleWorkspace";
import { BattleResultModal } from "./BattleResultModal";
import { BattleLeaderboard } from "./BattleLeaderboard";
import { connectRealtimeSocket } from "../../realtime/socket";
import {
  Swords,
  Plus,
  Inbox,
  History,
  Play,
  Check,
  X,
  Loader2,
  Trophy,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Flame,
  Zap,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import "./battles.css";

interface BattlesPanelProps {
  currentUserId: string;
}

type ViewState = "dashboard" | "lobby" | "workspace" | "result";

export const BattlesPanel: FC<BattlesPanelProps> = ({ currentUserId }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"active" | "incoming" | "history" | "leaderboard">("active");
  const [myBattles, setMyBattles] = useState<MyBattlesData>({
    incoming: [],
    active: [],
    history: [],
  });
  const [loading, setLoading] = useState(true);

  // Statistics state
  const [stats, setStats] = useState<BattleStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // History Pagination & Filtering state
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [paginationMeta, setPaginationMeta] = useState<BattlePaginationMeta | null>(null);

  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>("dashboard");
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [isQuickMatchModalOpen, setIsQuickMatchModalOpen] = useState(false);

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const res = await battleApi.getBattleStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Failed to load battle stats", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadBattles = async (page = historyPage, filter = historyFilter) => {
    try {
      setLoading(true);
      const res = await battleApi.getMyBattles({ page, limit: 12, filter });
      if (res.success && res.data) {
        setMyBattles(res.data);
        if (res.data.pagination || res.meta) {
          setPaginationMeta(res.data.pagination || res.meta || null);
        }
      }
    } catch (err) {
      console.error("Failed to load battles", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadBattles(historyPage, historyFilter);

    const socket = connectRealtimeSocket();
    if (socket) {
      socket.on("battle:invite", (data: any) => {
        toast.info(`Challenge received from ${data.creator?.name || "a student"}!`);
        loadBattles(historyPage, historyFilter);
        loadStats();
      });

      socket.on("battle:accepted", () => {
        loadBattles(historyPage, historyFilter);
        loadStats();
      });

      socket.on("battle:declined", () => {
        loadBattles(historyPage, historyFilter);
        loadStats();
      });

      socket.on("matchmaking:matched", (data: any) => {
        toast.success("Compatible opponent found! Entering Battle Lobby...");
        if (data?.battleId) {
          setSelectedBattleId(data.battleId);
          setViewState("lobby");
        }
        loadBattles(historyPage, historyFilter);
        loadStats();
      });
    }

    return () => {
      if (socket) {
        socket.off("battle:invite");
        socket.off("battle:accepted");
        socket.off("battle:declined");
        socket.off("matchmaking:matched");
      }
    };
  }, []);

  const handleFilterChange = (newFilter: "all" | "completed" | "cancelled") => {
    setHistoryFilter(newFilter);
    setHistoryPage(1);
    loadBattles(1, newFilter);
  };

  const handlePageChange = (newPage: number) => {
    setHistoryPage(newPage);
    loadBattles(newPage, historyFilter);
  };

  const handleAcceptChallenge = async (id: string) => {
    try {
      const res = await battleApi.acceptChallenge(id);
      if (res.success) {
        toast.success("Challenge accepted!");
        setSelectedBattleId(id);
        setViewState("lobby");
        loadBattles(historyPage, historyFilter);
        loadStats();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to accept challenge");
    }
  };

  const handleDeclineChallenge = async (id: string) => {
    try {
      const res = await battleApi.declineChallenge(id);
      if (res.success) {
        toast.info("Challenge declined.");
        loadBattles(historyPage, historyFilter);
        loadStats();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to decline challenge");
    }
  };

  const handleOpenBattle = (battle: Battle) => {
    setSelectedBattleId(battle.id);
    if (battle.status === "ACTIVE") {
      setViewState("workspace");
    } else if (["ACCEPTED", "WAITING", "READY"].includes(battle.status)) {
      setViewState("lobby");
    } else {
      setViewState("result");
    }
  };

  // Render Sub-Views (Lobby, Workspace, Result)
  if (viewState === "lobby" && selectedBattleId) {
    return (
      <BattleLobby
        battleId={selectedBattleId}
        currentUserId={currentUserId}
        onBack={() => {
          setViewState("dashboard");
          loadBattles(historyPage, historyFilter);
          loadStats();
        }}
        onStartBattle={() => setViewState("workspace")}
      />
    );
  }

  if (viewState === "workspace" && selectedBattleId) {
    return (
      <BattleWorkspace
        battleId={selectedBattleId}
        currentUserId={currentUserId}
        onBattleFinished={() => {
          setViewState("result");
          loadStats();
        }}
        onForfeit={async () => {
          try {
            await battleApi.forfeitBattle(selectedBattleId);
            setViewState("result");
            loadStats();
          } catch (err) {
            console.error("Failed to forfeit battle", err);
          }
        }}
      />
    );
  }

  if (viewState === "result" && selectedBattleId) {
    return (
      <BattleResultModal
        battleId={selectedBattleId}
        currentUserId={currentUserId}
        onBack={() => {
          setViewState("dashboard");
          loadBattles(historyPage, historyFilter);
          loadStats();
        }}
        onChallengeAgain={() => {
          setViewState("dashboard");
          setIsChallengeModalOpen(true);
        }}
      />
    );
  }

  return (
    <div className="battles-container animate-fade-in">
      {/* Top Hero Card Header */}
      <header className="ax-hero-compact">
        <div className="ax-hero-left">
          <div className="ax-hero-badge-wrap">
            <span className="ax-hero-kicker">1V1 COMPETITIVE PRACTICE</span>
          </div>
          <h1 className="ax-hero-title">
            <Swords size={22} className="ax-hero-icon" />
            1v1 DSA Battles
          </h1>
          <p className="ax-hero-sub">
            Challenge your friends to real-time 1v1 competitive DSA coding battles.
          </p>
          <div className="ax-hero-meta">
            <span className="ax-tag-pill">
              <Swords size={13} /> Real-Time Arena
            </span>
            <span className="ax-tag-pill">
              <Trophy size={13} /> Competitive Practice
            </span>
            <span className="ax-tag-pill is-status">
              <span className="ax-status-dot" /> Matchmaking Ready
            </span>
          </div>
        </div>

        <div className="ax-hero-right flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsQuickMatchModalOpen(true)}
            className="ax-btn accent"
            style={{
              background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
              borderColor: "rgba(245, 158, 11, 0.5)",
              color: "#fff",
              boxShadow: "0 0 15px rgba(245, 158, 11, 0.2)"
            }}
          >
            <Zap size={14} className="fill-white" /> Quick Match
          </button>
          <button
            type="button"
            onClick={() => setIsChallengeModalOpen(true)}
            className="ax-btn accent"
          >
            <Plus size={14} /> Challenge Student
          </button>
        </div>
      </header>

      {/* BATTLE PERFORMANCE STATISTICS SUMMARY WIDGET */}
      <section className="ax-progress-bar-card" aria-label="Battle performance statistics">
        <div className="ax-progress-card-header">
          <span className="ax-progress-kicker">
            <BarChart2 size={13} className="inline mr-1 text-indigo-400" />
            YOUR BATTLE PERFORMANCE STATISTICS
          </span>
        </div>

        {statsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          </div>
        ) : stats ? (
          <div className="ax-progress-stats-right flex-wrap gap-2 pt-1">
            <div className="ax-stat-block">
              <span className="ax-stat-label">TOTAL BATTLES</span>
              <b className="ax-stat-val">{stats.totalBattles}</b>
            </div>
            <div className="ax-stat-block">
              <span className="ax-stat-label">
                <span className="ax-diff-dot easy" /> WINS
              </span>
              <b className="ax-stat-val text-emerald-400">{stats.wins}</b>
            </div>
            <div className="ax-stat-block">
              <span className="ax-stat-label">
                <span className="ax-diff-dot hard" /> LOSSES
              </span>
              <b className="ax-stat-val text-rose-400">{stats.losses}</b>
            </div>
            <div className="ax-stat-block">
              <span className="ax-stat-label">
                <span className="ax-diff-dot medium" /> DRAWS
              </span>
              <b className="ax-stat-val text-amber-400">{stats.draws}</b>
            </div>
            <div className="ax-stat-block">
              <span className="ax-stat-label">WIN RATE</span>
              <b className="ax-stat-val text-indigo-300">{stats.winRate}%</b>
            </div>
            <div className="ax-stat-block">
              <span className="ax-stat-label">BEST STREAK</span>
              <b className="ax-stat-val text-sky-400 flex items-center gap-1">
                {stats.bestStreak} <Flame size={12} className="text-orange-400" />
              </b>
            </div>
            <div className="ax-stat-block">
              <span className="ax-stat-label">CURRENT STREAK</span>
              <b className="ax-stat-val text-purple-400 flex items-center gap-1">
                {stats.currentStreak} <Flame size={12} className="text-orange-400" />
              </b>
            </div>
            <div className="ax-stat-block">
              <span className="ax-stat-label">AVG DURATION</span>
              <b className="ax-stat-val text-slate-300">{stats.averageDurationMinutes}m</b>
            </div>
          </div>
        ) : null}
      </section>

      {/* Navigation Tabs */}
      <nav className="ax-nav-tabs" role="tablist" aria-label="Battle views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "active"}
          className={`ax-tab-btn ${activeTab === "active" ? "active" : ""}`}
          onClick={() => setActiveTab("active")}
        >
          <Play size={14} />
          <span>Active Battles</span>
          <span className="ax-tab-badge">{myBattles.active.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "incoming"}
          className={`ax-tab-btn ${activeTab === "incoming" ? "active" : ""}`}
          onClick={() => setActiveTab("incoming")}
        >
          <Inbox size={14} />
          <span>Incoming</span>
          <span className="ax-tab-badge">{myBattles.incoming.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          className={`ax-tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <History size={14} />
          <span>Battle History</span>
          <span className="ax-tab-badge">{paginationMeta?.total ?? myBattles.history.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "leaderboard"}
          className={`ax-tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          <Trophy size={14} className="text-amber-400" />
          <span>Leaderboard</span>
        </button>
      </nav>

      {activeTab === "leaderboard" ? (
        <BattleLeaderboard currentUserId={currentUserId} />
      ) : loading ? (
        <div className="flex min-h-[250px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      ) : (
        <>
          {/* Active Tab */}
          {activeTab === "active" && (
            <div>
              {myBattles.active.length === 0 ? (
                <div className="ax-empty-card">
                  <div className="ax-empty-icon-wrap">
                    <Swords size={22} />
                  </div>
                  <h3 className="ax-empty-title">No Active Battles</h3>
                  <p className="ax-empty-sub">
                    Challenge a friend or accept an incoming challenge to start competing in real time.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsChallengeModalOpen(true)}
                    className="ax-btn accent"
                    style={{ marginTop: "14px" }}
                  >
                    <Plus size={14} /> Create Challenge
                  </button>
                </div>
              ) : (
                <div className="battles-grid">
                  {myBattles.active.map((battle) => {
                    const isCreator = battle.creatorId === currentUserId;
                    const oppName = isCreator ? battle.opponentName : battle.creatorName;

                    return (
                      <div key={battle.id} className="battle-card">
                        <div>
                          <div className="battle-card-vs">
                            <div className="player-info">
                              <div className="player-avatar">
                                {oppName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-white">vs {oppName}</div>
                                <div className="text-xs text-slate-400">
                                  {battle.problemCount} Problems • <span className="capitalize">{battle.difficulty}</span>
                                </div>
                              </div>
                            </div>
                            <span className="vs-badge">LIVE</span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pt-2 border-t border-white/5">
                            <span>Status: <strong className="text-emerald-400">{battle.status}</strong></span>
                            <span>{Math.round(battle.durationSeconds / 60)} Mins</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenBattle(battle)}
                          className="ax-btn accent w-full mt-2"
                        >
                          <Play size={14} /> {battle.status === "ACTIVE" ? "Enter Workspace" : "Enter Lobby"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Incoming Tab */}
          {activeTab === "incoming" && (
            <div>
              {myBattles.incoming.length === 0 ? (
                <div className="ax-empty-card">
                  <div className="ax-empty-icon-wrap">
                    <Inbox size={22} />
                  </div>
                  <h3 className="ax-empty-title">No Incoming Challenges</h3>
                  <p className="ax-empty-sub">
                    When another student challenges you to a 1v1 battle, it will appear here.
                  </p>
                </div>
              ) : (
                <div className="battles-grid">
                  {myBattles.incoming.map((battle) => (
                    <div key={battle.id} className="battle-card">
                      <div>
                        <div className="battle-card-vs">
                          <div className="player-info">
                            <div className="player-avatar">
                              {battle.creatorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{battle.creatorName}</div>
                              <div className="text-xs text-slate-400">{battle.creatorEmail}</div>
                            </div>
                          </div>
                          <span className="vs-badge pending">PENDING</span>
                        </div>

                        <div className="text-xs text-slate-300 space-y-1 mb-4">
                          <div>Difficulty: <strong className="capitalize text-indigo-400">{battle.difficulty}</strong></div>
                          <div>Problems: <strong>{battle.problemCount}</strong></div>
                          <div>Duration: <strong>{Math.round(battle.durationSeconds / 60)} mins</strong></div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeclineChallenge(battle.id)}
                          className="ax-btn flex-1"
                        >
                          <X size={14} className="text-rose-400" /> Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcceptChallenge(battle.id)}
                          className="ax-btn accent flex-1"
                        >
                          <Check size={14} /> Accept & Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div>
              {/* History Server Filter Buttons */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  {(["all", "completed", "cancelled"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => handleFilterChange(f)}
                      className={`ax-btn capitalize ${historyFilter === f ? "accent" : ""}`}
                      style={{ height: "30px", fontSize: "0.78rem" }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {paginationMeta && (
                  <span className="text-xs text-slate-400">
                    Showing {myBattles.history.length} of {paginationMeta.total} battles
                  </span>
                )}
              </div>

              {myBattles.history.length === 0 ? (
                <div className="ax-empty-card">
                  <div className="ax-empty-icon-wrap">
                    <History size={22} />
                  </div>
                  <h3 className="ax-empty-title">No Battle History</h3>
                  <p className="ax-empty-sub">
                    {historyFilter === "completed"
                      ? "No completed battle results found."
                      : historyFilter === "cancelled"
                      ? "No cancelled or declined challenges found."
                      : "Completed 1v1 battle results will be saved here."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="battles-grid">
                    {myBattles.history.map((battle) => {
                      const isCreator = battle.creatorId === currentUserId;
                      const oppName = isCreator ? battle.opponentName : battle.creatorName;
                      const isWon = battle.winnerId === currentUserId;
                      const isDraw = !battle.winnerId && battle.status !== "FORFEITED";

                      return (
                        <div key={battle.id} className="battle-card">
                          <div>
                            <div className="battle-card-vs">
                              <div className="player-info">
                                <div className="player-avatar">
                                  {oppName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white">vs {oppName}</div>
                                  <div className="text-xs text-slate-400">
                                    {new Date(battle.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <span
                                className="ax-tag-pill"
                                style={{
                                  color: isWon
                                    ? "#4ade80"
                                    : isDraw
                                    ? "#fcd34d"
                                    : "#fca5a5",
                                  borderColor: isWon
                                    ? "rgba(34, 197, 94, 0.3)"
                                    : isDraw
                                    ? "rgba(245, 158, 11, 0.3)"
                                    : "rgba(239, 68, 68, 0.3)",
                                  background: isWon
                                    ? "rgba(34, 197, 94, 0.1)"
                                    : isDraw
                                    ? "rgba(245, 158, 11, 0.1)"
                                    : "rgba(239, 68, 68, 0.1)",
                                }}
                              >
                                {isWon ? "WON" : isDraw ? "DRAW" : "LOST"}
                              </span>
                            </div>

                            <div className="text-xs text-slate-300 space-y-1 mb-3">
                              <div>Difficulty: <strong className="capitalize">{battle.difficulty}</strong></div>
                              <div>Status: <strong className="text-slate-400">{battle.status}</strong></div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenBattle(battle)}
                            className="ax-btn w-full mt-2"
                          >
                            <Trophy size={14} className="text-yellow-400" /> View Results
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Server Pagination Controls */}
                  {paginationMeta && paginationMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6">
                      <button
                        type="button"
                        onClick={() => handlePageChange(historyPage - 1)}
                        disabled={!paginationMeta.hasPreviousPage}
                        className="ax-btn"
                      >
                        <ChevronLeft size={14} /> Previous
                      </button>
                      <span className="text-xs font-semibold text-slate-400">
                        Page {paginationMeta.page} of {paginationMeta.totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePageChange(historyPage + 1)}
                        disabled={!paginationMeta.hasNextPage}
                        className="ax-btn"
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Challenge Creation Modal */}
      <ChallengeStudentModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        onChallengeCreated={(bId) => {
          setSelectedBattleId(bId);
          setViewState("lobby");
          loadBattles(historyPage, historyFilter);
          loadStats();
        }}
      />

      {/* Quick Matchmaking Modal */}
      <QuickMatchModal
        isOpen={isQuickMatchModalOpen}
        onClose={() => setIsQuickMatchModalOpen(false)}
        onMatchFound={(bId) => {
          setSelectedBattleId(bId);
          setViewState("lobby");
          loadBattles(historyPage, historyFilter);
          loadStats();
        }}
      />
    </div>
  );
};
