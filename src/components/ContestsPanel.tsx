import { useCallback, useEffect, useState, type FC } from "react";
import { Loader2, Trophy } from "lucide-react";
import { contestApi, type Contest } from "../api/contestApi";

interface Props {
  authenticated?: boolean;
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

export const ContestsPanel: FC<Props> = ({ authenticated }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await contestApi.listContests();
      setContests(res.data || []);
    } catch {
      setError("Failed to load contests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    } catch {
      setError("Registration failed.");
    } finally {
      setRegistering(null);
    }
  };

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <Trophy size={22} /> Contests
          </h1>
          <p>Weekly coding contests and timed challenges.</p>
        </div>
      </header>

      {error && (
        <p style={{ color: "var(--danger, #ef4444)", marginBottom: 12 }}>{error}</p>
      )}

      {loading ? (
        <div className="loading-center">
          <Loader2 size={20} className="spin" /> Loading contests…
        </div>
      ) : contests.length === 0 ? (
        <div className="placeholder-tab">
          <Trophy size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
          <h2>No contests scheduled</h2>
          <p>Check back soon for upcoming events.</p>
        </div>
      ) : (
        <div className="learn-grid-2">
          {contests.map((c) => {
            const slug = c.slug;
            const canRegister =
              authenticated &&
              !c.isRegistered &&
              (c.status === "SCHEDULED" || c.status === "LIVE");
            return (
              <section key={slug} className="learn-card">
                <div className="learn-card-head">
                  <h2>{c.title}</h2>
                  <span className="platform-chip">{statusLabel(c.status)}</span>
                </div>
                {c.description && (
                  <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
                    {c.description}
                  </p>
                )}
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  <div>Start: {formatTime(c.startTime)}</div>
                  <div>End: {formatTime(c.endTime)}</div>
                  {c.durationMinutes ? <div>Duration: {c.durationMinutes} min</div> : null}
                  {c.participantCount != null ? (
                    <div>Participants: {c.participantCount}</div>
                  ) : null}
                </div>
                {c.isRegistered ? (
                  <span className="platform-chip platform-chip-streak" style={{ marginTop: 12 }}>
                    Registered
                  </span>
                ) : canRegister ? (
                  <button
                    type="button"
                    className="lc-hint-reveal-btn"
                    style={{ marginTop: 12 }}
                    disabled={registering === slug}
                    onClick={() => void handleRegister(slug)}
                  >
                    {registering === slug ? "Registering…" : "Register"}
                  </button>
                ) : !authenticated ? (
                  <p style={{ marginTop: 12, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Sign in to register
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
