import { useCallback, useEffect, useState, type FC, type FormEvent } from "react";
import { BookOpen, Trophy, Users } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { ConfirmDialog } from "../../ConfirmDialog";
import {
  adminContestApi,
  type AdminContest,
  type ContestLeaderboardRow,
  type ContestParticipant,
} from "../../../api/adminContestApi";
import { adminProblemApi } from "../../../api/adminProblemApi";
import { hasPermission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";

interface Props {
  id: string;
  onBack: () => void;
}

type DetailTab = "overview" | "problems" | "participants" | "leaderboard";

function problemIdOf(row: {
  problemId:
    | string
    | { _id?: string; id?: string; title?: string; slug?: string };
}): string {
  if (typeof row.problemId === "string") return row.problemId;
  return String(row.problemId?.id || row.problemId?._id || "");
}

function problemLabel(row: {
  problemId:
    | string
    | { title?: string; slug?: string; difficulty?: string };
}): string {
  if (typeof row.problemId === "string") return row.problemId;
  return (
    row.problemId?.title ||
    row.problemId?.slug ||
    "Problem"
  );
}

export const ContestDetailPage: FC<Props> = ({ id, onBack }) => {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, "contests:manage");
  const [contest, setContest] = useState<AdminContest | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);

  const [problemQuery, setProblemQuery] = useState("");
  const [problemOptions, setProblemOptions] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [addProblemId, setAddProblemId] = useState("");
  const [addPoints, setAddPoints] = useState(100);

  const [participants, setParticipants] = useState<ContestParticipant[]>([]);
  const [board, setBoard] = useState<ContestLeaderboardRow[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminContestApi.get(id);
      const c = res.data;
      setContest(c);
      setTitle(c.title || "");
      setDescription(c.description || "");
      setRules(c.rules || "");
      setDurationMinutes(c.durationMinutes || 120);
      setStartTime(
        c.startTime ? new Date(c.startTime).toISOString().slice(0, 16) : ""
      );
      setEndTime(
        c.endTime ? new Date(c.endTime).toISOString().slice(0, 16) : ""
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== "participants" && tab !== "leaderboard") return;
    let cancelled = false;
    (async () => {
      try {
        if (tab === "participants") {
          const res = await adminContestApi.listParticipants(id);
          if (!cancelled) setParticipants(res.data || []);
        } else {
          const res = await adminContestApi.leaderboard(id, false);
          const data = res.data;
          const rows = Array.isArray(data)
            ? data
            : Array.isArray((data as any)?.rankings)
              ? (data as any).rankings
              : [];
          if (!cancelled) setBoard(rows);
        }
      } catch (err: any) {
        if (!cancelled)
          setError(err?.response?.data?.message || err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, id]);

  useEffect(() => {
    if (tab !== "problems") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await adminProblemApi.list({
          page: 1,
          limit: 100,
          search: problemQuery || undefined,
        });
        if (!cancelled) {
          setProblemOptions(
            (res.data || []).map((p: any) => ({
              id: String(p.id || p._id),
              title: p.title,
            }))
          );
        }
      } catch {
        if (!cancelled) setProblemOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, problemQuery]);

  const runAction = async (
    label: string,
    fn: () => Promise<unknown>
  ) => {
    try {
      setBusy(true);
      setError("");
      await fn();
      setMsg(`${label} succeeded`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveOverview = async (e: FormEvent) => {
    e.preventDefault();
    await runAction("Save", () =>
      adminContestApi.update(id, {
        title,
        description,
        rules,
        durationMinutes,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      })
    );
  };

  if (loading) {
    return <p className="admin-muted">Loading contest…</p>;
  }

  if (!contest) {
    return (
      <div>
        <button type="button" className="admin-btn" onClick={onBack}>
          ← Back
        </button>
        <p className="admin-error">{error || "Contest not found"}</p>
      </div>
    );
  }

  return (
    <PermissionGuard
      permission={["contests:manage", "contests:create"]}
      fallback={<div className="admin-denied">No contest permission.</div>}
    >
      <div className="admin-toolbar">
        <button type="button" className="admin-btn" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "overview" ? "primary" : ""}`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "problems" ? "primary" : ""}`}
          onClick={() => setTab("problems")}
        >
          Problems
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "participants" ? "primary" : ""}`}
          onClick={() => setTab("participants")}
        >
          Participants
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "leaderboard" ? "primary" : ""}`}
          onClick={() => setTab("leaderboard")}
        >
          Leaderboard
        </button>
      </div>

      <div className="admin-toolbar" style={{ alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>{contest.title}</h2>
        <StatusBadge status={contest.status} />
        <span className="admin-muted">{contest.slug}</span>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {msg ? <p className="admin-muted">{msg}</p> : null}

      {tab === "overview" ? (
        <div>
          {canManage ? (
            <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={() => void runAction("Schedule", () => adminContestApi.schedule(id))}
              >
                Schedule
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={() => void runAction("Publish", () => adminContestApi.publish(id))}
              >
                Publish
              </button>
              <button
                type="button"
                className="admin-btn primary"
                disabled={busy}
                onClick={() => void runAction("Start", () => adminContestApi.start(id))}
              >
                Start
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={() => void runAction("End", () => adminContestApi.end(id))}
              >
                End
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={() => setConfirmArchive(true)}
              >
                Archive
              </button>
              <button
                type="button"
                className="admin-btn danger"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            </div>
          ) : null}

          <form onSubmit={saveOverview} style={{ maxWidth: 560 }}>
            <div className="admin-field">
              <label>Title</label>
              <input
                value={title}
                disabled={!canManage}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label>Description</label>
              <textarea
                value={description}
                disabled={!canManage}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="admin-field">
              <label>Rules</label>
              <textarea
                value={rules}
                disabled={!canManage}
                onChange={(e) => setRules(e.target.value)}
                rows={4}
              />
            </div>
            <div className="admin-field">
              <label>Start</label>
              <input
                type="datetime-local"
                value={startTime}
                disabled={!canManage}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label>End</label>
              <input
                type="datetime-local"
                value={endTime}
                disabled={!canManage}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label>Duration (minutes)</label>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                disabled={!canManage}
                onChange={(e) =>
                  setDurationMinutes(Number(e.target.value) || 1)
                }
              />
            </div>
            {canManage ? (
              <button type="submit" className="admin-btn primary" disabled={busy}>
                Save changes
              </button>
            ) : null}
          </form>
        </div>
      ) : null}

      {tab === "problems" ? (
        <div>
          {canManage ? (
            <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
              <input
                placeholder="Search problems…"
                value={problemQuery}
                onChange={(e) => setProblemQuery(e.target.value)}
              />
              <select
                value={addProblemId}
                onChange={(e) => setAddProblemId(e.target.value)}
                style={{ minWidth: 220 }}
              >
                <option value="">Select problem…</option>
                {problemOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={addPoints}
                onChange={(e) => setAddPoints(Number(e.target.value) || 0)}
                title="Points"
                style={{ width: 90 }}
              />
              <button
                type="button"
                className="admin-btn primary"
                disabled={!addProblemId || busy}
                onClick={async () => {
                  await runAction("Add problem", async () => {
                    await adminContestApi.addProblem(id, {
                      problemId: addProblemId,
                      points: addPoints,
                    });
                    setAddProblemId("");
                  });
                }}
              >
                Add
              </button>
            </div>
          ) : null}
          <DataTable
            rowKey={(r) => problemIdOf(r) || String(r.order)}
            rows={contest.problems || []}
            emptyTitle="No problems attached"
            emptyDescription="Add problems from the catalog to build this contest."
            emptyIcon={<BookOpen size={18} strokeWidth={1.75} />}
            columns={[
              {
                key: "problem",
                header: "Problem",
                render: (r) => problemLabel(r),
              },
              {
                key: "points",
                header: "Points",
                render: (r) => r.points ?? 100,
              },
              {
                key: "order",
                header: "Order",
                render: (r) => r.order ?? "—",
              },
              {
                key: "actions",
                header: "",
                render: (r) =>
                  canManage ? (
                    <button
                      type="button"
                      className="admin-btn danger"
                      onClick={() =>
                        void runAction("Remove problem", () =>
                          adminContestApi.removeProblem(id, problemIdOf(r))
                        )
                      }
                    >
                      Remove
                    </button>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
        </div>
      ) : null}

      {tab === "participants" ? (
        <DataTable
          rowKey={(p) => String(p.id || p._id || p.userId)}
          rows={participants}
          emptyTitle="No participants yet"
          emptyDescription="Registered users will show up once they join this contest."
          emptyIcon={<Users size={18} strokeWidth={1.75} />}
          columns={[
            { key: "userId", header: "User", render: (p) => p.userId },
            {
              key: "score",
              header: "Score",
              render: (p) => p.score ?? 0,
            },
            {
              key: "penalty",
              header: "Penalty",
              render: (p) => p.penalty ?? 0,
            },
            {
              key: "registeredAt",
              header: "Registered",
              render: (p) =>
                p.registeredAt
                  ? new Date(p.registeredAt).toLocaleString()
                  : "—",
            },
          ]}
        />
      ) : null}

      {tab === "leaderboard" ? (
        <div>
          {canManage ? (
            <div className="admin-toolbar">
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={async () => {
                  try {
                    setBusy(true);
                    const res = await adminContestApi.leaderboard(id, true);
                    const data = res.data;
                    const rows = Array.isArray(data)
                      ? data
                      : Array.isArray((data as any)?.rankings)
                        ? (data as any).rankings
                        : [];
                    setBoard(rows);
                    setMsg("Leaderboard recomputed");
                  } catch (err: any) {
                    setError(err?.response?.data?.message || err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Recompute
              </button>
            </div>
          ) : null}
          <DataTable
            rowKey={(r) => String(r.userId || r.rank || Math.random())}
            rows={board}
            emptyTitle="No rankings yet"
            emptyDescription="Rankings appear after participants submit solutions."
            emptyIcon={<Trophy size={18} strokeWidth={1.75} />}
            columns={[
              {
                key: "rank",
                header: "Rank",
                render: (r) => r.rank ?? "—",
              },
              {
                key: "userId",
                header: "User",
                render: (r) => r.userId || "—",
              },
              {
                key: "score",
                header: "Score",
                render: (r) => r.score ?? 0,
              },
              {
                key: "penalty",
                header: "Penalty",
                render: (r) => r.penalty ?? 0,
              },
              {
                key: "solved",
                header: "Solved",
                render: (r) => r.solvedCount ?? "—",
              },
            ]}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmArchive}
        title="Archive contest?"
        description="Archived contests cannot be modified further."
        confirmLabel="Archive"
        onCancel={() => setConfirmArchive(false)}
        onConfirm={async () => {
          setConfirmArchive(false);
          await runAction("Archive", () => adminContestApi.archive(id));
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete contest?"
        description="This removes the contest record. Prefer archive when possible."
        confirmLabel="Delete"
        confirmVariant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          try {
            await adminContestApi.remove(id);
            onBack();
          } catch (err: any) {
            setError(err?.response?.data?.message || err.message);
          }
        }}
      />
    </PermissionGuard>
  );
};
