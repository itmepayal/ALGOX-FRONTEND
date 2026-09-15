import { useCallback, useEffect, useState, type FC } from "react";
import { Loader2, Trophy } from "lucide-react";
import {
  leaderboardApi,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from "../api/leaderboardApi";

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all", label: "All Time" },
];

export const LeaderboardPanel: FC = () => {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await leaderboardApi.getLeaderboard({ period, page: 1, limit: 50 });
      setEntries(res.data || []);
    } catch {
      setError("Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <Trophy size={22} /> Leaderboard
          </h1>
          <p>Top performers by problems solved.</p>
        </div>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`platform-chip ${period === p.id ? "platform-chip-streak" : ""}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ color: "var(--danger, #ef4444)", marginBottom: 12 }}>{error}</p>
      )}

      {loading ? (
        <div className="loading-center">
          <Loader2 size={20} className="spin" /> Loading ranks…
        </div>
      ) : entries.length === 0 ? (
        <div className="placeholder-tab">
          <Trophy size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
          <h2>No rankings yet</h2>
          <p>Solve problems to appear on the leaderboard.</p>
        </div>
      ) : (
        <div className="learn-card">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Rank</th>
                <th style={{ padding: "8px 12px" }}>User</th>
                <th style={{ padding: "8px 12px" }}>Solved</th>
                <th style={{ padding: "8px 12px" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row, idx) => (
                <tr key={row.userId || idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "10px 12px" }}>{row.rank ?? idx + 1}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {row.name || row.username || row.userId?.slice(0, 8) || "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {row.problemsSolved ?? row.solvedCount ?? "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{row.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
