import { useState, useEffect, type FC } from "react";
import {
  Trophy,
  Users,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Plus,
  CheckCircle,
  Swords,
  Award,
} from "lucide-react";
import {
  tournamentApi,
  type Tournament,
  type TournamentBracketPayload,
  type TournamentResultsPayload,
  type TournamentMySummaryPayload,
} from "../../api/tournamentApi";
import { TournamentBracket } from "./TournamentBracket";
import { useToast } from "../../context/ToastContext";

interface TournamentPanelProps {
  currentUserId: string;
  onStartTournamentBattle?: (battleId: string) => void;
}

export const TournamentPanel: FC<TournamentPanelProps> = ({
  currentUserId,
  onStartTournamentBattle,
}) => {
  const toast = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [bracketData, setBracketData] = useState<TournamentBracketPayload | null>(null);
  const [resultsData, setResultsData] = useState<TournamentResultsPayload | null>(null);
  const [mySummary, setMySummary] = useState<TournamentMySummaryPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      setError(null);
      const [listRes, summaryRes] = await Promise.all([
        tournamentApi.listTournaments(),
        tournamentApi.getMySummary(),
      ]);

      if (listRes.success && listRes.data) {
        setTournaments(listRes.data);
      }
      if (summaryRes.success && summaryRes.data) {
        setMySummary(summaryRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load tournaments", err);
      setError("Failed to load tournaments list.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (slug: string, updateUrl = true) => {
    try {
      setSelectedSlug(slug);
      setDetailLoading(true);
      if (updateUrl && !window.location.pathname.includes(slug)) {
        window.history.pushState({}, "", `/tournaments/${slug}`);
      }
      const [bracketRes, resultsRes] = await Promise.all([
        tournamentApi.getBracket(slug).catch(() => null),
        tournamentApi.getResults(slug).catch(() => null),
      ]);

      if (bracketRes && bracketRes.success && bracketRes.data) {
        setBracketData(bracketRes.data);
      }
      if (resultsRes && resultsRes.success && resultsRes.data) {
        setResultsData(resultsRes.data);
      }
    } catch (err) {
      console.error("Failed to load tournament detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
    // Parse slug from URL if user opened /tournaments/:slug directly
    const path = window.location.pathname;
    const match = path.match(/^\/tournaments\/([^/]+)/);
    if (match && match[1]) {
      handleOpenDetail(match[1], false);
    }
  }, []);

  const handleRegister = async (slug: string) => {
    try {
      setRegistering(true);
      const res = await tournamentApi.register(slug);
      if (res.success) {
        toast.success("Successfully registered for tournament!");
        await fetchTournaments();
        if (selectedSlug === slug) {
          await handleOpenDetail(slug);
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to register";
      toast.error(msg);
    } finally {
      setRegistering(false);
    }
  };

  const handleStartMatchBattle = async (matchId: string) => {
    try {
      const res = await tournamentApi.startMatchBattle(matchId);
      if (res.success && res.data.battle && onStartTournamentBattle) {
        onStartTournamentBattle(res.data.battle.id || res.data.battle._id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to start match battle");
    }
  };

  // Render Bracket Detail View
  if (selectedSlug && bracketData) {
    const t = bracketData.tournament;
    const isFull = t.participantCount >= t.maxParticipants;

    return (
      <div className="ax-workspace animate-fade-in">
        <div>
          <button
            onClick={() => {
              setSelectedSlug(null);
              setBracketData(null);
              setResultsData(null);
              if (window.location.pathname !== "/tournaments") {
                window.history.pushState({}, "", "/tournaments");
              }
            }}
            className="ax-btn"
          >
            <ChevronLeft size={14} /> Back to Tournaments
          </button>
        </div>

        {/* Tournament Detail Header */}
        <header className="ax-hero-compact">
          <div className="ax-hero-left">
            <div className="ax-hero-badge-wrap">
              <span className="ax-hero-kicker">TOURNAMENT BRACKET</span>
            </div>
            <h1 className="ax-hero-title">
              <Trophy size={22} className="ax-hero-icon" />
              {t.title}
            </h1>
            <p className="ax-hero-sub">
              {t.description || "Single Elimination Knockout Tournament"}
            </p>
            <div className="ax-hero-meta">
              <span className={`ax-status-badge ${t.status}`}>
                {t.status.replace("_", " ")}
              </span>
              <span className="ax-tag-pill">
                <Users size={13} /> {t.participantCount} / {t.maxParticipants} Participants
              </span>
              <span className="ax-tag-pill">
                <Award size={13} /> Single Elimination
              </span>
            </div>
          </div>

          <div className="ax-hero-right">
            {t.status === "REGISTRATION_OPEN" && !t.isRegistered && (
              <button
                disabled={isFull || registering}
                onClick={() => handleRegister(t.slug)}
                className="ax-btn accent"
              >
                {registering ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {isFull ? "Tournament Full" : "Register Now"}
              </button>
            )}

            {t.isRegistered && (
              <span className="ax-tag-pill is-status">
                <CheckCircle size={13} /> Registered
              </span>
            )}
          </div>
        </header>

        {/* Interactive Bracket Viewer */}
        {detailLoading ? (
          <div
            className="ax-progress-bar-card"
            style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}
          >
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--ax-accent)" }} />
          </div>
        ) : (
          <div className="ax-progress-bar-card">
            <div className="ax-progress-card-header" style={{ marginBottom: "16px" }}>
              <span className="ax-hero-title" style={{ fontSize: "1.1rem" }}>
                <Swords size={18} className="ax-hero-icon" /> Interactive Tournament Bracket
              </span>
            </div>
            <TournamentBracket
              tournament={t}
              matches={bracketData.matches}
              currentUserId={currentUserId}
              onStartMatchBattle={handleStartMatchBattle}
            />
          </div>
        )}

        {/* Final Standings / Results */}
        {resultsData && resultsData.participants.length > 0 && (
          <div className="ax-progress-bar-card">
            <div className="ax-progress-card-header" style={{ marginBottom: "16px" }}>
              <span className="ax-hero-title" style={{ fontSize: "1.1rem" }}>
                <Award size={18} className="ax-hero-icon" /> Tournament Standings
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--ax-border)", textTransform: "uppercase", fontSize: "0.72rem", color: "var(--ax-text-muted)", letterSpacing: "0.04em" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Seed</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Player</th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>Wins / Losses</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsData.participants.map((p) => (
                    <tr
                      key={p.userId}
                      style={{
                        borderBottom: "1px solid var(--ax-border)",
                        background: p.userId === currentUserId ? "rgba(99, 102, 241, 0.08)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--ax-text-muted)" }}>
                        #{p.seed}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--ax-text-main)" }}>
                        {p.userName}
                        {p.userId === currentUserId && (
                          <span
                            className="ax-tag-pill"
                            style={{ marginLeft: "8px", fontSize: "0.65rem", background: "rgba(99, 102, 241, 0.2)", color: "#a5b4fc" }}
                          >
                            YOU
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span style={{ color: "var(--ax-success)", fontWeight: 700 }}>{p.wins}W</span> /{" "}
                        <span style={{ color: "var(--ax-danger)", fontWeight: 700 }}>{p.losses}L</span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <span className={`ax-status-badge ${p.status}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ax-workspace animate-fade-in">
      {/* Header Banner */}
      <header className="ax-hero-compact">
        <div className="ax-hero-left">
          <div className="ax-hero-badge-wrap">
            <span className="ax-hero-kicker">KNOCKOUT TOURNAMENTS</span>
          </div>
          <h1 className="ax-hero-title">
            <Trophy size={22} className="ax-hero-icon" />
            Competitive Coding Tournaments
          </h1>
          <p className="ax-hero-sub">
            Orchestrated single-elimination knockout tournaments powered by Battle V1 engine
          </p>
          <div className="ax-hero-meta">
            <span className="ax-tag-pill">
              <Swords size={13} /> Battle V1 Engine
            </span>
            <span className="ax-tag-pill">
              <Award size={13} /> Single Elimination
            </span>
            <span className="ax-tag-pill is-status">
              <span className="ax-status-dot" /> Live Orchestration
            </span>
          </div>
        </div>

        {mySummary && (
          <div className="ax-hero-right">
            <div className="ax-stat-block">
              <span className="ax-stat-label">
                <Trophy size={11} /> ENTERED
              </span>
              <span className="ax-stat-val">
                {mySummary.tournamentsEntered} Tournaments
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      {loading ? (
        <div
          className="ax-progress-bar-card"
          style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "240px" }}
        >
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--ax-accent)" }} />
        </div>
      ) : error ? (
        <div
          className="ax-progress-bar-card"
          style={{ textAlign: "center", padding: "40px 24px", alignItems: "center", gap: "12px" }}
        >
          <p style={{ color: "var(--ax-danger)", margin: 0 }}>{error}</p>
          <button onClick={fetchTournaments} className="ax-btn">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : tournaments.length === 0 ? (
        <div
          className="ax-progress-bar-card"
          style={{ textAlign: "center", padding: "48px 24px", alignItems: "center", gap: "8px" }}
        >
          <Trophy size={36} style={{ color: "var(--ax-text-muted)", marginBottom: "4px" }} />
          <h3 className="ax-hero-title" style={{ fontSize: "1.1rem" }}>No tournaments available right now</h3>
          <p className="ax-hero-sub">Check back soon for upcoming single-elimination knockout tournaments.</p>
        </div>
      ) : (
        <div className="ax-tournaments-grid">
          {tournaments.map((t) => {
            const isFull = t.participantCount >= t.maxParticipants;

            return (
              <div key={t.id || t._id} className="ax-tournament-card">
                <div>
                  <div className="ax-tournament-header-row">
                    <span className={`ax-status-badge ${t.status}`}>
                      {t.status.replace("_", " ")}
                    </span>
                    <span className="ax-participant-count">
                      <Users size={14} /> {t.participantCount} / {t.maxParticipants}
                    </span>
                  </div>

                  <div className="ax-tournament-body" style={{ marginTop: "12px" }}>
                    <h2 className="ax-tournament-title">{t.title}</h2>
                    <p className="ax-tournament-desc">
                      {t.description || "8-player single elimination E2E test"}
                    </p>
                  </div>
                </div>

                <div className="ax-divider" />

                <div className="ax-card-actions">
                  {t.status === "REGISTRATION_OPEN" && !t.isRegistered ? (
                    <button
                      disabled={isFull || registering}
                      onClick={() => handleRegister(t.slug)}
                      className="ax-btn accent"
                    >
                      {registering ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      {isFull ? "Full" : "Register"}
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    onClick={() => handleOpenDetail(t.slug)}
                    className="ax-btn"
                    style={{ marginLeft: "auto" }}
                  >
                    <Swords size={14} /> View Bracket
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
