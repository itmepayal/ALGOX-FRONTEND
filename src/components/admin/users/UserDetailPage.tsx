import { useEffect, useState, type FC } from "react";
import { Activity, Code2, FileCode2, Monitor } from "lucide-react";
import {
  adminAuthApi,
  type AdminUser,
  type UserActivityItem,
  type UserProgress,
  type UserSession,
} from "../../../api/adminAuthApi";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { ConfirmDialog } from "../../ConfirmDialog";
import { DataTable } from "../shared/DataTable";
import { EmptyState } from "../shared/EmptyState";
import { usePermission } from "../../../rbac/usePermission";
import { resolveAccessTier } from "../../../access/accessModel";

interface Props {
  id: string;
  onBack: () => void;
}

type DetailTab = "profile" | "activity" | "progress" | "sessions";
type SubConfirm = "grant" | "revoke" | null;

function defaultPremiumEndIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  // datetime-local value (local)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const UserDetailPage: FC<Props> = ({ id, onBack }) => {
  const { can } = usePermission();
  const [row, setRow] = useState<AdminUser | null>(null);
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<DetailTab>("profile");
  const [confirmStatus, setConfirmStatus] = useState<
    "suspended" | "banned" | "active" | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSub, setConfirmSub] = useState<SubConfirm>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [periodEndLocal, setPeriodEndLocal] = useState(defaultPremiumEndIso);
  const [tempPassword, setTempPassword] = useState("");
  const [activity, setActivity] = useState<UserActivityItem[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const load = async () => {
    const res = await adminAuthApi.getUser(id);
    setRow(res.data);
    setRole(res.data.role);
  };

  useEffect(() => {
    load().catch((err: any) =>
      setError(err?.response?.data?.message || err.message)
    );
  }, [id]);

  useEffect(() => {
    if (tab === "profile") return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingExtra(true);
        setError("");
        if (tab === "activity") {
          const res = await adminAuthApi.getUserActivity(id, {
            page: 1,
            limit: 50,
          });
          if (!cancelled) setActivity(res.data || []);
        } else if (tab === "progress") {
          const res = await adminAuthApi.getUserProgress(id);
          if (!cancelled) setProgress(res.data);
        } else if (tab === "sessions") {
          const res = await adminAuthApi.listUserSessions(id);
          if (!cancelled) setSessions(res.data || []);
        }
      } catch (err: any) {
        if (!cancelled)
          setError(err?.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, id]);

  const canUpdate = can("users:update");
  const canDelete = can("users:delete");

  const applySubscription = async (action: "grant" | "revoke") => {
    setSubBusy(true);
    setError("");
    setMsg("");
    try {
      if (action === "grant") {
        const end = periodEndLocal
          ? new Date(periodEndLocal).toISOString()
          : null;
        if (end && Number.isNaN(Date.parse(end))) {
          setError("Invalid period end datetime");
          return;
        }
        const res = await adminAuthApi.updateSubscription(id, {
          plan: "PREMIUM",
          status: "active",
          currentPeriodEnd: end,
          source: "admin_grant",
          cancelAtPeriodEnd: false,
        });
        setRow(res.data);
        setMsg("Premium granted via admin override");
      } else {
        const res = await adminAuthApi.updateSubscription(id, {
          plan: "FREE",
          status: "none",
          source: "admin_grant",
        });
        setRow(res.data);
        setMsg("Premium revoked — user set to FREE");
      }
      setConfirmSub(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
      setConfirmSub(null);
    } finally {
      setSubBusy(false);
    }
  };

  const sub = row?.subscription;
  const tier =
    row?.accessTier ||
    resolveAccessTier(row ? { subscription: row.subscription, accessTier: row.accessTier } : null);
  const isPremiumNow = tier === "PREMIUM";

  return (
    <PermissionGuard
      permission="users:view"
      fallback={<div className="admin-denied">No users permission.</div>}
    >
      <div className="admin-toolbar">
        <button type="button" className="admin-btn" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "profile" ? "primary" : ""}`}
          onClick={() => setTab("profile")}
        >
          Profile
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "activity" ? "primary" : ""}`}
          onClick={() => setTab("activity")}
        >
          Activity
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "progress" ? "primary" : ""}`}
          onClick={() => setTab("progress")}
        >
          Progress
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "sessions" ? "primary" : ""}`}
          onClick={() => setTab("sessions")}
        >
          Sessions
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {msg ? <p className="admin-muted">{msg}</p> : null}
      {tempPassword ? (
        <p className="admin-muted">
          Temporary password (copy now): <code>{tempPassword}</code>
        </p>
      ) : null}

      {!row ? (
        <p className="admin-muted">Loading…</p>
      ) : tab === "profile" ? (
        <div style={{ maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>{row.name}</h2>
          <p className="admin-muted">{row.email}</p>
          <p>
            Status: <StatusBadge status={row.status} />
            {row.mustChangePassword ? (
              <span className="admin-muted"> · must change password</span>
            ) : null}
          </p>
          <div className="admin-field">
            <label>Role</label>
            <select
              value={role}
              disabled={!canUpdate}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="user">user</option>
              <option value="moderator">moderator</option>
              <option value="content_manager">content_manager</option>
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
            </select>
          </div>
          {canUpdate && (
            <div className="admin-toolbar">
              <button
                type="button"
                className="admin-btn primary"
                onClick={async () => {
                  try {
                    await adminAuthApi.updateRole(id, role);
                    setMsg("Role updated");
                    await load();
                  } catch (err: any) {
                    setError(err?.response?.data?.message || err.message);
                  }
                }}
              >
                Save role
              </button>
              {row.status === "active" ? (
                <>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setConfirmStatus("suspended")}
                  >
                    Suspend
                  </button>
                  <button
                    type="button"
                    className="admin-btn danger"
                    onClick={() => setConfirmStatus("banned")}
                  >
                    Ban
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setConfirmStatus("active")}
                >
                  Reactivate
                </button>
              )}
              <button
                type="button"
                className="admin-btn"
                onClick={async () => {
                  try {
                    const res = await adminAuthApi.resetPassword(id);
                    setTempPassword(res.data.temporaryPassword);
                    setMsg("Password reset — sessions revoked");
                    await load();
                  } catch (err: any) {
                    setError(err?.response?.data?.message || err.message);
                  }
                }}
              >
                Reset password
              </button>
              {canDelete ? (
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  Soft delete
                </button>
              ) : null}
            </div>
          )}

          <section
            className="admin-card"
            style={{ marginTop: 24, padding: 16 }}
            aria-labelledby="user-sub-heading"
          >
            <h3 id="user-sub-heading" style={{ marginTop: 0, fontSize: 15 }}>
              Subscription
            </h3>
            <p className="admin-muted" style={{ marginTop: 0 }}>
              Ledger override via existing admin API — does not change platform
              role.
            </p>
            <div
              style={{
                display: "grid",
                gap: 8,
                fontSize: "0.875rem",
                marginBottom: 12,
              }}
            >
              <div>
                Access tier:{" "}
                <StatusBadge status={isPremiumNow ? "premium" : "free"} />
              </div>
              <div>
                Plan: <strong>{sub?.plan || "FREE"}</strong>
                {" · "}
                Status: <StatusBadge status={sub?.status || "none"} />
              </div>
              <div className="admin-muted">
                Source: {sub?.source || "—"}
                {sub?.currentPeriodEnd
                  ? ` · Period end: ${new Date(sub.currentPeriodEnd).toLocaleString()}`
                  : null}
              </div>
            </div>

            {canUpdate ? (
              <>
                <div className="admin-field">
                  <label htmlFor="sub-period-end">Premium period end</label>
                  <input
                    id="sub-period-end"
                    type="datetime-local"
                    value={periodEndLocal}
                    onChange={(e) => setPeriodEndLocal(e.target.value)}
                    disabled={subBusy}
                  />
                </div>
                <div className="admin-toolbar">
                  <button
                    type="button"
                    className="admin-btn primary"
                    disabled={subBusy}
                    onClick={() => setConfirmSub("grant")}
                  >
                    Grant Premium
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={subBusy || !isPremiumNow}
                    onClick={() => setConfirmSub("revoke")}
                  >
                    Revoke to Free
                  </button>
                </div>
              </>
            ) : (
              <p className="admin-muted">
                Requires <code>users:update</code> to grant or revoke.
              </p>
            )}
          </section>
        </div>
      ) : tab === "activity" ? (
        loadingExtra ? (
          <p className="admin-muted">Loading activity…</p>
        ) : (
          <DataTable
            rowKey={(a) => a.id}
            columns={[
              {
                key: "createdAt",
                header: "When",
                render: (a) =>
                  a.createdAt
                    ? new Date(a.createdAt).toLocaleString()
                    : "—",
              },
              { key: "type", header: "Type", render: (a) => a.type },
              { key: "action", header: "Action", render: (a) => a.action },
              {
                key: "detail",
                header: "Detail",
                render: (a) => a.detail || "—",
              },
              { key: "ip", header: "IP", render: (a) => a.ip || "—" },
            ]}
            rows={activity}
            emptyTitle="No activity yet"
            emptyDescription="Login, role, and account events for this user will appear here."
            emptyIcon={<Activity size={18} strokeWidth={1.75} />}
          />
        )
      ) : tab === "progress" ? (
        loadingExtra || !progress ? (
          <p className="admin-muted">Loading progress…</p>
        ) : (
          <div>
            <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: 16 }}>
              <span>Attempted: {progress.problemsAttempted}</span>
              <span>Solved: {progress.problemsSolved}</span>
              <span>Submissions: {progress.submissionCount}</span>
              <span>Accepted: {progress.acceptedCount}</span>
              <span>Acceptance: {progress.acceptanceRate}%</span>
            </div>
            <h4>Languages</h4>
            {Object.keys(progress.byLanguage || {}).length === 0 ? (
              <EmptyState
                compact
                icon={<Code2 size={18} strokeWidth={1.75} />}
                title="No language data yet"
                description="Languages appear after this user submits code."
              />
            ) : (
              <ul>
                {Object.entries(progress.byLanguage || {}).map(([lang, n]) => (
                  <li key={lang}>
                    {lang}: {n}
                  </li>
                ))}
              </ul>
            )}
            <h4>Recent submissions</h4>
            <DataTable
              rowKey={(s) => String(s.id)}
              columns={[
                {
                  key: "problemId",
                  header: "Problem",
                  render: (s) => s.problemId,
                },
                { key: "status", header: "Status", render: (s) => s.status },
                {
                  key: "language",
                  header: "Lang",
                  render: (s) => s.language || "—",
                },
                {
                  key: "createdAt",
                  header: "When",
                  render: (s) =>
                    s.createdAt
                      ? new Date(s.createdAt).toLocaleString()
                      : "—",
                },
              ]}
              rows={progress.recentSubmissions || []}
              emptyTitle="No submissions yet"
              emptyDescription="Recent submissions from this user will show up here."
              emptyIcon={<FileCode2 size={18} strokeWidth={1.75} />}
            />
          </div>
        )
      ) : loadingExtra ? (
        <p className="admin-muted">Loading sessions…</p>
      ) : (
        <div>
          {canUpdate ? (
            <div className="admin-toolbar">
              <button
                type="button"
                className="admin-btn danger"
                onClick={async () => {
                  try {
                    await adminAuthApi.revokeAllUserSessions(id);
                    setMsg("All sessions revoked");
                    const res = await adminAuthApi.listUserSessions(id);
                    setSessions(res.data || []);
                  } catch (err: any) {
                    setError(err?.response?.data?.message || err.message);
                  }
                }}
              >
                Revoke all sessions
              </button>
            </div>
          ) : null}
          <DataTable
            rowKey={(s) => s.id}
            columns={[
              { key: "ip", header: "IP", render: (s) => s.ip || "—" },
              {
                key: "userAgent",
                header: "Device",
                render: (s) => s.userAgent || "—",
              },
              {
                key: "createdAt",
                header: "Login",
                render: (s) =>
                  s.createdAt
                    ? new Date(s.createdAt).toLocaleString()
                    : "—",
              },
              {
                key: "expiresAt",
                header: "Expires",
                render: (s) =>
                  s.expiresAt
                    ? new Date(s.expiresAt).toLocaleString()
                    : "—",
              },
              {
                key: "status",
                header: "Status",
                render: (s) => (s.expired ? "expired" : "active"),
              },
              {
                key: "actions",
                header: "",
                render: (s) =>
                  canUpdate ? (
                    <button
                      type="button"
                      className="admin-btn danger"
                      onClick={async () => {
                        try {
                          await adminAuthApi.revokeUserSession(id, s.id);
                          setSessions((prev) =>
                            prev.filter((x) => x.id !== s.id)
                          );
                        } catch (err: any) {
                          setError(
                            err?.response?.data?.message || err.message
                          );
                        }
                      }}
                    >
                      Revoke
                    </button>
                  ) : (
                    "—"
                  ),
              },
            ]}
            rows={sessions}
            emptyTitle="No active sessions"
            emptyDescription="Active logins for this account will appear here."
            emptyIcon={<Monitor size={18} strokeWidth={1.75} />}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmStatus)}
        title={`${confirmStatus} user?`}
        description="This change is audited. Suspend/ban also revokes all sessions immediately."
        confirmLabel="Confirm"
        confirmVariant={confirmStatus === "banned" ? "danger" : "primary"}
        onCancel={() => setConfirmStatus(null)}
        onConfirm={async () => {
          if (!confirmStatus) return;
          try {
            await adminAuthApi.updateStatus(id, confirmStatus);
            setConfirmStatus(null);
            setMsg("Status updated");
            await load();
          } catch (err: any) {
            setError(err?.response?.data?.message || err.message);
            setConfirmStatus(null);
          }
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Soft-delete this user?"
        description="Account is marked deleted and banned. Sessions are revoked. Data is retained for audit."
        confirmLabel="Delete"
        confirmVariant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await adminAuthApi.deleteUser(id);
            setConfirmDelete(false);
            onBack();
          } catch (err: any) {
            setError(err?.response?.data?.message || err.message);
            setConfirmDelete(false);
          }
        }}
      />
      <ConfirmDialog
        open={confirmSub === "grant"}
        title="Grant Premium?"
        description="Writes the subscription ledger (admin_grant), updates entitlement snapshot, and audits the change. Does not change platform role."
        confirmLabel="Grant Premium"
        confirmVariant="primary"
        confirming={subBusy}
        confirmingLabel="Granting…"
        onCancel={() => {
          if (!subBusy) setConfirmSub(null);
        }}
        onConfirm={() => void applySubscription("grant")}
      />
      <ConfirmDialog
        open={confirmSub === "revoke"}
        title="Revoke Premium?"
        description="Ends the live subscription and sets entitlement to FREE. Audited as user.subscription_change."
        confirmLabel="Revoke"
        confirmVariant="danger"
        confirming={subBusy}
        confirmingLabel="Revoking…"
        onCancel={() => {
          if (!subBusy) setConfirmSub(null);
        }}
        onConfirm={() => void applySubscription("revoke")}
      />
    </PermissionGuard>
  );
};
