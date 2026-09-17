import { useCallback, useEffect, useState, type FC } from "react";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import {
  contestApi,
  type Contest,
  type ContestLeaderboardPayload,
  type ContestHistoryPayload,
  type ContestProblem,
} from "../api/contestApi";
import { virtualContestApi, type VirtualContestAnalytics, type VirtualContestSession } from "../api/virtualContestApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { Button } from "./ui/button";
import { connectRealtimeSocket } from "../realtime/socket";

interface Props {
  authenticated?: boolean;
  onOpenProblem?: (
    problem: { id?: string; slug?: string; title?: string },
    contestId?: string,
    virtualSessionId?: string
  ) => void;
  onVirtualSessionChange?: (sessionId: string | null) => void;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function problemRef(entry: ContestProblem) {
  const p = entry.problemId;
  if (typeof p === "object" && p) return p;
  if (typeof p === "string") return { _id: p };
  return undefined;
}

function problemTitle(entry: ContestProblem): string {
  const p = problemRef(entry);
  if (p?.title) return p.title;
  return "Untitled problem";
}

function problemOpenPayload(entry: ContestProblem) {
  const p = problemRef(entry);
  return {
    id: p?._id,
    slug: p?.slug,
    title: p?.title || problemTitle(entry),
  };
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export const ContestsPanel: FC<Props> = ({
  authenticated,
  onOpenProblem,
  onVirtualSessionChange,
}) => {
  const { user } = useAuth();
  const virtualOk = canAccess(user, "premium.virtual_contest");

  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<Contest | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [board, setBoard] = useState<ContestLeaderboardPayload | null>(null);
  const [history, setHistory] = useState<ContestHistoryPayload | null>(null);
  const [virtualSession, setVirtualSession] =
    useState<VirtualContestSession | null>(null);
  const [virtualBusy, setVirtualBusy] = useState(false);
  const [virtualAnalytics, setVirtualAnalytics] =
    useState<VirtualContestAnalytics | null>(null);

  const loadVirtualAnalytics = useCallback(async (sessionId: string) => {
    try {
      const res = await virtualContestApi.analytics(sessionId);
      setVirtualAnalytics(res.data || null);
    } catch {
      setVirtualAnalytics(null);
    }
  }, []);

  const finishVirtual = useCallback(
    async (sessionId: string) => {
      setVirtualBusy(true);
      try {
        const r = await virtualContestApi.complete(sessionId);
        setVirtualSession(r.data);
        onVirtualSessionChange?.(null);
        await loadVirtualAnalytics(sessionId);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || "Finish failed");
      } finally {
        setVirtualBusy(false);
      }
    },
    [loadVirtualAnalytics, onVirtualSessionChange]
  );

  const loadDetail = useCallback(async (slug: string) => {
    const res = await contestApi.getContestBySlug(slug);
    setDetail(res.data || null);
    try {
      const lb = await contestApi.getLeaderboard(slug, { limit: 20 });
      setBoard(lb.data || null);
    } catch {
      setBoard(null);
    }
    return res.data || null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await contestApi.listContests();
      setContests(res.data || []);
      if (authenticated) {
        try {
          const hist = await contestApi.getMySummary();
          setHistory(hist.data || null);
        } catch {
          setHistory(null);
        }
        if (virtualOk) {
          try {
            const active = await virtualContestApi.getActive();
            setVirtualSession(active.data || null);
            onVirtualSessionChange?.(active.data?.id || null);
          } catch {
            setVirtualSession(null);
          }
        }
      }
    } catch {
      setError("Failed to load contests.");
    } finally {
      setLoading(false);
    }
  }, [authenticated, virtualOk, onVirtualSessionChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedSlug) {
      setDetail(null);
      setBoard(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      setError("");
      try {
        if (!cancelled) await loadDetail(selectedSlug);
      } catch {
        if (!cancelled) {
          setError("Failed to load contest details.");
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSlug, loadDetail]);

  // Live contest: poll status + leaderboard while LIVE (scheduler may also end it)
  useEffect(() => {
    if (!selectedSlug || detail?.status !== "LIVE") return;
    const t = setInterval(() => {
      void loadDetail(selectedSlug).catch(() => undefined);
    }, 8_000);
    return () => clearInterval(t);
  }, [selectedSlug, detail?.status, loadDetail]);

  // Realtime: join contest room for leaderboard / status pushes
  useEffect(() => {
    if (!authenticated || !selectedSlug || !detail) return;
    const contestId = detail._id || detail.id;
    if (!contestId) return;
    if (detail.status !== "LIVE" && detail.status !== "SCHEDULED") return;

    const socket = connectRealtimeSocket();
    if (!socket) return;

    const room = `contest:${contestId}`;
    const refresh = () => {
      void loadDetail(selectedSlug).catch(() => undefined);
    };

    const join = () => {
      socket.emit("room.join", { room });
    };
    join();
    socket.on("connect", join);
    socket.on("leaderboard.updated", refresh);
    socket.on("contest.started", refresh);
    socket.on("contest.ended", refresh);
    socket.on("contest.status_changed", refresh);

    return () => {
      socket.off("connect", join);
      socket.off("leaderboard.updated", refresh);
      socket.off("contest.started", refresh);
      socket.off("contest.ended", refresh);
      socket.off("contest.status_changed", refresh);
      socket.emit("room.leave", { room });
    };
  }, [
    authenticated,
    selectedSlug,
    detail?._id,
    detail?.id,
    detail?.status,
    loadDetail,
  ]);

  // Poll virtual timer
  useEffect(() => {
    if (!virtualSession || virtualSession.status !== "in_progress") return;
    const t = setInterval(() => {
      void virtualContestApi
        .getById(virtualSession.id)
        .then((res) => {
          setVirtualSession(res.data);
          onVirtualSessionChange?.(
            res.data?.status === "in_progress" ? res.data.id : null
          );
        })
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, [virtualSession?.id, virtualSession?.status, onVirtualSessionChange]);

  // Soft-refresh contest list so SCHEDULED→LIVE appears without manual reload
  useEffect(() => {
    if (selectedSlug) return;
    const t = setInterval(() => {
      void contestApi
        .listContests()
        .then((res) => setContests(res.data || []))
        .catch(() => undefined);
    }, 15_000);
    return () => clearInterval(t);
  }, [selectedSlug]);

  const handleRegister = async (slug: string) => {
    if (!authenticated) {
      setError("Sign in to register for contests.");
      return;
    }
    setRegistering(slug);
    setError("");
    try {
      await contestApi.register(slug);
      await load();
      if (selectedSlug === slug) await loadDetail(slug);
    } catch {
      setError("Registration failed (already registered or closed).");
    } finally {
      setRegistering(null);
    }
  };

  const handleStartVirtual = async (slug: string, mode: "practice" | "virtual") => {
    if (!virtualOk) return;
    setVirtualBusy(true);
    setError("");
    try {
      const res = await virtualContestApi.start(slug, mode);
      setVirtualSession(res.data);
      onVirtualSessionChange?.(res.data.id);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Virtual start failed"
      );
    } finally {
      setVirtualBusy(false);
    }
  };

  const handleOpenProblem = (
    entry: ContestProblem,
    contest?: Contest,
    virtualId?: string
  ) => {
    if (!onOpenProblem) return;
    const payload = problemOpenPayload(entry);
    if (!payload.id && !payload.slug) return;
    const contestId = virtualId ? undefined : contest?._id || contest?.id;
    onOpenProblem(payload, contestId, virtualId);
  };

  if (selectedSlug) {
    const c = detail;
    const canRegister =
      authenticated &&
      c &&
      !c.isRegistered &&
      (c.status === "SCHEDULED" || c.status === "LIVE");
    const canVirtual =
      c && (c.status === "ENDED" || c.status === "ARCHIVED");

    return (
      <div className="learn-layout animate-fade-in">
        <header className="learn-header">
          <button
            type="button"
            className="platform-icon-btn"
            onClick={() => setSelectedSlug(null)}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{c?.title || "Contest"}</h1>
            {c && (
              <p>
                {statusLabel(c.status)} · {formatTime(c.startTime)} –{" "}
                {formatTime(c.endTime)}
              </p>
            )}
          </div>
        </header>

        {error ? (
          <div className="free-home-alert" role="alert">
            {error}
          </div>
        ) : null}

        {loadingDetail ? (
          <div className="loading-center">
            <Loader2 size={20} className="spin" /> Loading contest…
          </div>
        ) : c ? (
          <div className="learn-grid-2">
            <section className="learn-card">
              <div className="learn-card-head">
                <h2>Overview</h2>
                <span className="platform-chip">{statusLabel(c.status)}</span>
              </div>
              {c.description ? (
                <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
                  {c.description}
                </p>
              ) : null}
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <div>Start: {formatTime(c.startTime)}</div>
                <div>End: {formatTime(c.endTime)}</div>
                {c.durationMinutes ? (
                  <div>Duration: {c.durationMinutes} min</div>
                ) : null}
                {c.participantCount != null ? (
                  <div>Participants: {c.participantCount}</div>
                ) : null}
                {board?.myEntry ? (
                  <div style={{ marginTop: 8 }}>
                    Your rank: <strong>#{board.myEntry.rank}</strong> · score{" "}
                    {board.myEntry.score}
                  </div>
                ) : null}
              </div>

              {canRegister ? (
                <button
                  type="button"
                  className="lc-hint-reveal-btn"
                  style={{ marginTop: 12 }}
                  disabled={registering === c.slug}
                  onClick={() => void handleRegister(c.slug)}
                >
                  {registering === c.slug ? "Registering…" : "Register"}
                </button>
              ) : c.isRegistered ? (
                <span
                  className="platform-chip platform-chip-streak"
                  style={{ marginTop: 12 }}
                >
                  Registered
                </span>
              ) : null}

              {canVirtual ? (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 8 }}>
                    Past contest practice
                  </h3>
                  {!virtualOk ? (
                    <UpgradePrompt
                      feature="premium.virtual_contest"
                      title="Virtual contests"
                      description="Replay ended contests on a server timer. Practice mode never affects rating."
                    />
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button
                        type="button"
                        size="sm"
                        disabled={virtualBusy}
                        onClick={() => void handleStartVirtual(c.slug, "virtual")}
                      >
                        Start virtual
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={virtualBusy}
                        onClick={() => void handleStartVirtual(c.slug, "practice")}
                      >
                        Practice mode
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            <section className="learn-card">
              <h2>Problems</h2>
              {!c.problems?.length ? (
                <p className="empty-state">No problems listed yet.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {c.problems.map((entry, idx) => {
                    const payload = problemOpenPayload(entry);
                    const canOpen = Boolean(
                      onOpenProblem && (payload.id || payload.slug)
                    );
                    return (
                      <li
                        key={entry._id || idx}
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {idx + 1}.{" "}
                          {canOpen ? (
                            <button
                              type="button"
                              className="platform-link-btn"
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                font: "inherit",
                                fontWeight: 600,
                                color: "var(--primary)",
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                handleOpenProblem(
                                  entry,
                                  c,
                                  virtualSession?.status === "in_progress"
                                    ? virtualSession.id
                                    : undefined
                                )
                              }
                            >
                              {problemTitle(entry)}
                            </button>
                          ) : (
                            problemTitle(entry)
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {entry.points != null ? `${entry.points} pts` : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="learn-card" style={{ gridColumn: "1 / -1" }}>
              <div className="learn-card-head">
                <h2>
                  <Trophy size={16} aria-hidden /> Leaderboard
                </h2>
              </div>
              {!board?.entries?.length ? (
                <p className="empty-state">No rankings yet.</p>
              ) : (
                <ul className="free-home-activity">
                  {board.entries.map((e) => (
                    <li key={`${e.userId}-${e.rank}`}>
                      #{e.rank} · score {e.score} · solved {e.solvedCount} ·
                      penalty {e.penalty}
                      {board.myEntry?.userId === e.userId ? " (you)" : ""}
                    </li>
                  ))}
                </ul>
              )}
              <p className="free-home-muted" style={{ marginTop: 8, fontSize: 12 }}>
                Rating updates only when live contests end — computed server-side.
              </p>
            </section>
          </div>
        ) : (
          <p className="empty-state">Contest not found.</p>
        )}
      </div>
    );
  }

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>Contests</h1>
          <p>Public contests, leaderboards, and premium virtual replays.</p>
        </div>
      </header>

      {error ? (
        <div className="free-home-alert" role="alert">
          {error}
        </div>
      ) : null}

      {virtualSession?.status === "in_progress" ? (
        <section className="learn-card" style={{ marginBottom: 16 }}>
          <strong>Active virtual contest</strong> ·{" "}
          {virtualSession.sourceContestSlug} · remaining{" "}
          {formatMs(virtualSession.remainingMs)}
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={virtualBusy}
              onClick={() => void finishVirtual(virtualSession.id)}
            >
              Finish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={virtualBusy}
              onClick={() =>
                void virtualContestApi
                  .abandon(virtualSession.id)
                  .then((r) => {
                    setVirtualSession(r.data);
                    setVirtualAnalytics(null);
                    onVirtualSessionChange?.(null);
                  })
              }
            >
              Abandon
            </Button>
          </div>
        </section>
      ) : null}

      {virtualAnalytics ? (
        <section className="learn-card" style={{ marginBottom: 16 }}>
          <h2>Virtual contest analytics</h2>
          <p className="free-home-muted">
            Solved {virtualAnalytics.breakdown.solvedCount} · Attempted{" "}
            {virtualAnalytics.breakdown.attemptedCount} · Unsolved{" "}
            {virtualAnalytics.breakdown.unsolvedCount} · Mode{" "}
            {virtualAnalytics.breakdown.mode} · Rating impact:{" "}
            {virtualAnalytics.breakdown.ratingImpact}
          </p>
          {(virtualAnalytics.recommendations || []).length === 0 ? (
            <p className="empty-state">No recommendations for this session.</p>
          ) : (
            <ul className="free-home-activity">
              {virtualAnalytics.recommendations.map((rec, i) => (
                <li key={`${rec.title}-${i}`}>
                  <strong>{rec.title}</strong>
                  <span className="free-home-muted">
                    {" "}
                    — {rec.evidence}. {rec.action}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {virtualAnalytics.session.report?.note ? (
            <p className="free-home-muted" style={{ marginTop: 8 }}>
              {virtualAnalytics.session.report.note}
            </p>
          ) : null}
        </section>
      ) : null}

      {authenticated && history ? (
        <section className="learn-card" style={{ marginBottom: 16 }}>
          <h2>Your contest history</h2>
          <p className="free-home-muted">
            Entered {history.contestsEntered} · total score {history.totalScore}{" "}
            · solved {history.totalSolved}
          </p>
          {(history.items || []).length === 0 ? (
            <p className="empty-state">No contests yet.</p>
          ) : (
            <ul className="free-home-activity">
              {history.items.slice(0, 8).map((item) => (
                <li key={item.contestId}>
                  {item.title || item.slug} · score {item.score}
                  {item.rank != null ? ` · rank #${item.rank}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {loading ? (
        <div className="loading-center">
          <Loader2 size={20} className="spin" /> Loading…
        </div>
      ) : contests.length === 0 ? (
        <p className="empty-state">No public contests.</p>
      ) : (
        <div className="learn-grid-2">
          {contests.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="learn-card"
              style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => setSelectedSlug(c.slug)}
            >
              <div className="learn-card-head">
                <h2>{c.title}</h2>
                <span className="platform-chip">{statusLabel(c.status)}</span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                {formatTime(c.startTime)} – {formatTime(c.endTime)}
              </p>
              {c.isRegistered ? (
                <span className="platform-chip platform-chip-streak">
                  Registered
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
