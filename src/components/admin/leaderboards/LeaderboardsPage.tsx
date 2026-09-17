import { useEffect, useState, type FC } from "react";
import {
  Ban,
  Flame,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trophy,
  User as UserIcon,
} from "lucide-react";
import { DataTable } from "../shared/DataTable";
import { PermissionGuard } from "../shared/PermissionGuard";
import { problemClient } from "../../../api/problemApi";
import { adminLeaderboardApi } from "../../../api/adminLeaderboardApi";
import { leaderboardApi } from "../../../api/leaderboardApi";
import { useToast } from "../../../context/ToastContext";
import { usePermission } from "../../../rbac/usePermission";
import { ConfirmDialog } from "../../ConfirmDialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import type { AdminTab } from "../adminNav";
import { cn } from "../../../lib/cn";
import "../problems/problem-editor.css";

type Period = "global" | "daily" | "weekly" | "monthly" | "contest";

interface LeaderboardsPageProps {
  period?: Period;
  onNavigate?: (tab: AdminTab) => void;
}

const PERIOD_TABS: Array<{ id: Period; tab: AdminTab; label: string }> = [
  { id: "global", tab: "leaderboards", label: "Global" },
  { id: "daily", tab: "leaderboards-daily", label: "Daily" },
  { id: "weekly", tab: "leaderboards-weekly", label: "Weekly" },
  { id: "monthly", tab: "leaderboards-monthly", label: "Monthly" },
  { id: "contest", tab: "leaderboards-contest", label: "Contest" },
];

const PERIOD_TITLE: Record<Period, string> = {
  global: "Live Leaderboard",
  daily: "Daily Leaderboard",
  weekly: "Weekly Leaderboard",
  monthly: "Monthly Leaderboard",
  contest: "Contest Leaderboard",
};

function displayName(row: any): string | null {
  const name = row.userName || row.username || row.name || row.displayName;
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === "anonymous") return null;
  return trimmed;
}

function userIdOf(row: any): string {
  return String(row.userId || row._id || "").trim();
}

const UserCell: FC<{ row: any }> = ({ row }) => {
  const id = userIdOf(row);
  const name = displayName(row);

  return (
    <div className="flex min-w-0 max-w-[min(280px,100%)] items-start gap-2.5">
      <span
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"
        aria-hidden
      >
        <UserIcon size={14} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        {name ? (
          <>
            <span className="font-primary block truncate text-sm font-medium leading-snug text-foreground">
              {name}
            </span>
            {id ? (
              <span
                className="font-code mt-0.5 block truncate text-[0.7rem] leading-snug text-muted-foreground"
                title={id}
              >
                {id}
              </span>
            ) : null}
          </>
        ) : id ? (
          <>
            <span
              className="font-code block truncate text-sm font-medium leading-snug text-foreground"
              title={id}
            >
              {id}
            </span>
            <span className="font-primary mt-0.5 block text-[0.7rem] leading-snug text-muted-foreground">
              User ID
            </span>
          </>
        ) : (
          <span className="font-primary text-sm text-muted-foreground">—</span>
        )}
      </span>
    </div>
  );
};

export const LeaderboardsPage: FC<LeaderboardsPageProps> = ({
  period = "global",
  onNavigate,
}) => {
  const toast = useToast();
  const { can } = usePermission();
  const canAdmin = can("settings:update");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contests, setContests] = useState<any[]>([]);
  const [contestId, setContestId] = useState("");
  const [resetUserId, setResetUserId] = useState("");
  const [audit, setAudit] = useState<any[]>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const reloadGlobal = async () => {
    const res = await leaderboardApi.getLeaderboard({
      page: 1,
      limit: 50,
      period: "all",
    });
    const data = res.data || [];
    setRows(Array.isArray(data) ? data : (data as any).rankings || []);
  };

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
        const res = await leaderboardApi.getLeaderboard({
          page: 1,
          limit: 50,
          period: period === "global" ? "all" : period,
        });
        const data = res.data || [];
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : (data as any).rankings || []);
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

  const onRebuild = async () => {
    try {
      setRebuilding(true);
      const res = await adminLeaderboardApi.rebuild();
      toast.success(`Rebuilt ${res.data?.rebuilt ?? 0} ranking entries`);
      await reloadGlobal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Rebuild failed");
    } finally {
      setRebuilding(false);
    }
  };

  const onResetUser = async () => {
    const id = resetUserId.trim();
    if (!id) return;
    try {
      setResetting(true);
      await adminLeaderboardApi.resetUser(id);
      toast.success("Leaderboard entry reset successfully");
      setConfirmReset(false);
      await reloadGlobal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Unable to reset entry");
    } finally {
      setResetting(false);
    }
  };

  const onSuspend = async () => {
    const id = resetUserId.trim();
    if (!id) return;
    try {
      setSuspending(true);
      await adminLeaderboardApi.suspendEntry(id, true);
      toast.success("Entry suspended");
      setConfirmSuspend(false);
      await reloadGlobal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Suspend failed");
    } finally {
      setSuspending(false);
    }
  };

  const onLoadAudit = async () => {
    try {
      setLoadingAudit(true);
      const res = await adminLeaderboardApi.listAudit({ page: 1, limit: 10 });
      setAudit(res.data || []);
    } catch {
      setAudit([]);
      toast.error("Unable to load audit");
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <PermissionGuard
      permission={period === "contest" ? "contests:manage" : "analytics:view"}
      fallback={<div className="admin-denied">No permission.</div>}
    >
      <div className="pe-page mx-auto w-full gap-5">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <div>
              <h2 className="pe-title">{PERIOD_TITLE[period]}</h2>
              <p className="pe-sub">
                Rankings across global and time-boxed competition windows.
              </p>
            </div>
          </div>
          {period === "global" && canAdmin ? (
            <div className="pe-topbar-actions flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={rebuilding}
                onClick={() => void onRebuild()}
                aria-label={
                  rebuilding ? "Rebuilding rankings" : "Rebuild rankings"
                }
              >
                {rebuilding ? (
                  <Loader2
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <RefreshCw
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                )}
                {rebuilding ? "Rebuilding…" : "Rebuild rankings"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!resetUserId.trim() || resetting}
                onClick={() => setConfirmReset(true)}
                aria-label={
                  resetting ? "Resetting leaderboard entry" : "Reset entry"
                }
              >
                {resetting ? (
                  <Loader2
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <RotateCcw
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                )}
                {resetting ? "Resetting…" : "Reset"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!resetUserId.trim() || suspending}
                onClick={() => setConfirmSuspend(true)}
                aria-label={
                  suspending ? "Suspending entry" : "Suspend entry"
                }
              >
                {suspending ? (
                  <Loader2
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <Ban
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                )}
                {suspending ? "Suspending…" : "Suspend entry"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingAudit}
                onClick={() => void onLoadAudit()}
                aria-label={loadingAudit ? "Loading audit" : "Load audit"}
              >
                {loadingAudit ? (
                  <Loader2
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <History
                    size={14}
                    strokeWidth={1.75}
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                )}
                {loadingAudit ? "Loading…" : "Load audit"}
              </Button>
            </div>
          ) : null}
        </header>

        {onNavigate ? (
          <div
            className="admin-seg"
            role="tablist"
            aria-label="Leaderboard period"
          >
            {PERIOD_TABS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                className={period === p.id ? "active" : ""}
                onClick={() => onNavigate(p.tab)}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}

        {period === "global" && canAdmin ? (
          <section className="pe-card !p-4">
            <div className="pe-card-head !mb-3">
              <h3>Entry actions</h3>
              <p>Enter a user ID to reset ranking or suspend an entry</p>
            </div>
            <div className="relative min-w-0 max-w-xl">
              <Input
                value={resetUserId}
                onChange={(e) => setResetUserId(e.target.value)}
                placeholder="User ID to reset / suspend"
                aria-label="User ID to reset or suspend"
                className="bg-background font-code"
              />
            </div>
          </section>
        ) : null}

        {audit.length > 0 ? (
          <section className="pe-card !p-4">
            <div className="pe-card-head !mb-3">
              <h3>Audit</h3>
              <p>Recent ranking admin actions</p>
            </div>
            <pre className="font-technical m-0 max-h-40 overflow-auto rounded-[calc(var(--radius)-2px)] border border-border bg-muted p-3 text-xs text-muted-foreground">
              {JSON.stringify(audit, null, 2)}
            </pre>
          </section>
        ) : null}

        {period === "contest" ? (
          <div className="flex flex-wrap gap-2">
            <select
              className="admin-input min-w-[220px]"
              value={contestId}
              onChange={(e) => setContestId(e.target.value)}
              aria-label="Select contest"
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
          <p className="admin-muted !mb-0 text-sm">
            {period} rankings from SolveEvent window (empty until solves are
            recorded in-period).
          </p>
        ) : null}

        {error ? <p className="admin-error mb-0">{error}</p> : null}

        <section className="pe-card !p-0 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="pe-card-head !mb-0">
              <h3>Rankings</h3>
              <p>
                {loading
                  ? "Loading rankings…"
                  : `${rows.length} entr${rows.length === 1 ? "y" : "ies"}`}
              </p>
            </div>
          </div>
          <div className="p-0 [&_.admin-table-wrap]:max-h-[min(70vh,720px)] [&_.admin-table-wrap]:rounded-none [&_.admin-table-wrap]:border-0 [&_.admin-table-wrap]:shadow-none">
            <DataTable
              loading={loading}
              minWidth="640px"
              emptyTitle={
                period === "contest"
                  ? "No contest rankings yet"
                  : "No leaderboard rows yet"
              }
              emptyDescription={
                period === "contest"
                  ? "Create a contest and register participants to populate rankings."
                  : "Rankings will appear when competition data is available."
              }
              emptyIcon={
                <Trophy size={18} strokeWidth={1.75} aria-hidden />
              }
              emptyAction={
                period === "global" && canAdmin ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={rebuilding}
                    onClick={() => void onRebuild()}
                  >
                    {rebuilding ? (
                      <Loader2
                        size={14}
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <RefreshCw
                        size={14}
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0"
                        aria-hidden
                      />
                    )}
                    Rebuild rankings
                  </Button>
                ) : undefined
              }
              columns={[
                {
                  key: "rank",
                  header: "Rank",
                  width: "72px",
                  technical: true,
                  skeletonWidth: "2.5rem",
                  render: (r) => {
                    const rank = r.rank;
                    if (rank == null) {
                      return (
                        <span className="font-primary text-muted-foreground">
                          —
                        </span>
                      );
                    }
                    const top = Number(rank) <= 3;
                    return (
                      <span
                        className={cn(
                          "font-technical inline-flex tabular-nums",
                          top
                            ? "text-sm font-semibold text-foreground"
                            : "text-sm text-muted-foreground",
                        )}
                      >
                        #{rank}
                      </span>
                    );
                  },
                },
                {
                  key: "user",
                  header: "User",
                  width: "min(280px, 36vw)",
                  skeletonWidth: "12rem",
                  render: (r) => <UserCell row={r} />,
                },
                {
                  key: "score",
                  header: "Score",
                  width: "96px",
                  technical: true,
                  align: "right",
                  skeletonWidth: "3rem",
                  render: (r) => {
                    const score = r.score ?? r.rating;
                    return (
                      <span className="font-technical text-sm font-semibold tabular-nums text-foreground">
                        {score == null
                          ? "—"
                          : Number(score).toLocaleString()}
                      </span>
                    );
                  },
                },
                {
                  key: "solved",
                  header: "Solved",
                  width: "88px",
                  technical: true,
                  align: "right",
                  skeletonWidth: "2.5rem",
                  render: (r) => {
                    const solved =
                      r.totalSolved ??
                      r.solved ??
                      r.solvedCount ??
                      r.problemsSolved;
                    return (
                      <span className="font-technical text-sm tabular-nums text-foreground">
                        {solved == null ? "—" : Number(solved).toLocaleString()}
                      </span>
                    );
                  },
                },
                {
                  key: "streak",
                  header: "Streak",
                  width: "96px",
                  technical: true,
                  skeletonWidth: "3rem",
                  render: (r) => {
                    const streak = r.streak ?? r.currentStreak;
                    if (streak == null) {
                      return (
                        <span className="font-primary text-muted-foreground">
                          —
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1.5 font-technical text-sm tabular-nums text-foreground">
                        <Flame
                          size={13}
                          strokeWidth={1.75}
                          className="text-chart-2"
                          aria-hidden
                        />
                        {Number(streak).toLocaleString()}
                      </span>
                    );
                  },
                },
              ]}
              rows={rows}
              rowKey={(r) => String(r.userId || r._id || r.rank)}
            />
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset user ranking?"
        description={
          <>
            This will reset the leaderboard ranking for user{" "}
            <strong className="font-code text-foreground">
              {resetUserId.trim() || "—"}
            </strong>
            .
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Reset"
        confirmVariant="danger"
        confirming={resetting}
        confirmingLabel="Resetting…"
        onCancel={() => {
          if (!resetting) setConfirmReset(false);
        }}
        onConfirm={() => void onResetUser()}
      />

      <ConfirmDialog
        open={confirmSuspend}
        title="Suspend leaderboard entry?"
        description={
          <>
            This will suspend the leaderboard entry for user{" "}
            <strong className="font-code text-foreground">
              {resetUserId.trim() || "—"}
            </strong>
            .
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Suspend entry"
        confirmVariant="danger"
        confirming={suspending}
        confirmingLabel="Suspending…"
        onCancel={() => {
          if (!suspending) setConfirmSuspend(false);
        }}
        onConfirm={() => void onSuspend()}
      />
    </PermissionGuard>
  );
};
