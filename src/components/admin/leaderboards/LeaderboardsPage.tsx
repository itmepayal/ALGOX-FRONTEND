import { useEffect, useState, type FC } from "react";
import axios from "axios";
import { DataTable } from "../shared/DataTable";
import { PermissionGuard } from "../shared/PermissionGuard";
import { problemClient } from "../../../api/problemApi";

const LEADERBOARD_URL = "http://localhost:3005/api/v1";

type Period = "global" | "daily" | "weekly" | "monthly" | "contest";

interface LeaderboardsPageProps {
  period?: Period;
}

export const LeaderboardsPage: FC<LeaderboardsPageProps> = ({
  period = "global",
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contests, setContests] = useState<any[]>([]);
  const [contestId, setContestId] = useState("");

  useEffect(() => {
    if (period === "contest") {
      let cancelled = false;
      (async () => {
        try {
          setLoading(true);
          setError("");
          const res = await problemClient.get("/admin/contests", {
            params: { page: 1, limit: 50 },
          });
          const list = res.data?.data || [];
          if (!cancelled) {
            setContests(Array.isArray(list) ? list : []);
            const first = list[0]?._id || list[0]?.id;
            if (first) setContestId(String(first));
          }
        } catch (err: any) {
          if (!cancelled) {
            setError(
              err?.response?.data?.message ||
                "Contest API unavailable — start ProblemService"
            );
            setContests([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await axios.get(`${LEADERBOARD_URL}/leaderboard/`, {
          params: {
            page: 1,
            limit: 50,
            period: period === "global" ? "global" : period,
          },
        });
        const data = res.data?.data || res.data || [];
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : data.rankings || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err.message ||
              "Leaderboard service offline"
          );
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    if (period !== "contest" || !contestId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await problemClient.get(
          `/admin/contests/${contestId}/leaderboard`
        );
        const data = res.data?.data || [];
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : data.rankings || []);
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message || "Failed to load contest board"
          );
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, contestId]);

  return (
    <PermissionGuard
      permission="analytics:view"
      fallback={<div className="admin-denied">No permission.</div>}
    >
      {period === "contest" ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select
            className="admin-input"
            value={contestId}
            onChange={(e) => setContestId(e.target.value)}
          >
            {contests.length === 0 ? (
              <option value="">No contests yet</option>
            ) : (
              contests.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.title || c.slug} ({c.status})
                </option>
              ))
            )}
          </select>
        </div>
      ) : period !== "global" ? (
        <p className="admin-muted" style={{ marginBottom: 12 }}>
          {period} rankings from SolveEvent window (empty until solves are
          recorded in-period).
        </p>
      ) : null}
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle={
          period === "contest"
            ? "No contest rankings yet — create a contest and register participants."
            : "No leaderboard rows yet."
        }
        columns={[
          { key: "rank", header: "Rank", render: (r) => r.rank ?? "—" },
          {
            key: "user",
            header: "User",
            render: (r) => r.userName || r.username || r.name || r.userId || "—",
          },
          {
            key: "score",
            header: "Score",
            render: (r) => r.score ?? r.rating ?? "—",
          },
          {
            key: "solved",
            header: "Solved",
            render: (r) =>
              r.totalSolved ??
              r.solved ??
              r.solvedCount ??
              r.problemsSolved ??
              "—",
          },
          {
            key: "streak",
            header: "Streak",
            render: (r) => r.streak ?? r.currentStreak ?? "—",
          },
        ]}
        rows={rows}
        rowKey={(r) => String(r.userId || r._id || r.rank)}
      />
    </PermissionGuard>
  );
};
