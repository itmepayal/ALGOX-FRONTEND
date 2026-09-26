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
import "./user-detail.css";

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
      <div className="admin-user-detail-page">
        {/* Header */}
        <div className="admin-user-detail-header">
          <div className="admin-user-detail-header-top">
            <div className="admin-user-detail-header-title">
              <h1>{row ? row.name : "User Detail"}</h1>
              {row ? <StatusBadge status={row.status} /> : null}
            </div>
          </div>
          <p className="admin-page-lead">
            Manage profile, activity, progress, and active sessions for this user.
          </p>
        </div>

        {/* Tab Navigation Bar */}
        <nav className="admin-user-detail-nav" aria-label="User detail sections">
          <button
            type="button"
            className="admin-detail-tab admin-detail-tab-back"
            onClick={onBack}
          >
            ← Back
          </button>
          <button
            type="button"
            className={`admin-detail-tab ${tab === "profile" ? "is-active" : ""}`}
            onClick={() => setTab("profile")}
          >
            Profile
          </button>
          <button
            type="button"
            className={`admin-detail-tab ${tab === "activity" ? "is-active" : ""}`}
            onClick={() => setTab("activity")}
          >
            Activity
          </button>
          <button
            type="button"
            className={`admin-detail-tab ${tab === "progress" ? "is-active" : ""}`}
            onClick={() => setTab("progress")}
          >
            Progress
          </button>
          <button
            type="button"
            className={`admin-detail-tab ${tab === "sessions" ? "is-active" : ""}`}
            onClick={() => setTab("sessions")}
          >
            Sessions
          </button>
        </nav>

        {/* Banners */}
        {error ? (
          <div className="admin-user-detail-alert error">
            <span>{error}</span>
          </div>
        ) : null}
        {msg ? (
          <div className="admin-user-detail-alert info">
            <span>{msg}</span>
          </div>
        ) : null}
        {tempPassword ? (
          <div className="admin-user-detail-alert password">
            <span>
              Temporary password (copy now): <strong>{tempPassword}</strong>
            </span>
          </div>
        ) : null}

        {/* Tab Content */}
        {!row ? (
          <p className="admin-muted">Loading user profile…</p>
        ) : tab === "profile" ? (
          <div className="admin-user-profile-grid">
            {/* User Identity & Account Controls */}
            <div className="admin-user-card">
              <div className="admin-user-card-header">
                <div>
                  <h3 className="admin-user-card-title">User Account & Role</h3>
                  <p className="admin-user-card-subtitle">Account overview and role assignment</p>
                </div>
                <StatusBadge status={row.status} />
              </div>

              <div className="admin-user-identity-box">
                <div className="admin-user-identity-name">{row.name}</div>
                <div className="admin-user-identity-email">{row.email}</div>
                <div className="admin-user-identity-meta">
                  <span>ID: <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.78rem" }}>{row.id}</code></span>
                  {row.mustChangePassword ? <span> · Must change password</span> : null}
                </div>
              </div>

              <div className="admin-user-form-group">
                <label>Platform Role</label>
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
                <div className="admin-user-actions-group">
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
                        className="admin-btn danger-secondary"
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
                  {canDelete && (
                    <button
                      type="button"
                      className="admin-btn danger"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Soft delete
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Subscription Card */}
            <div className="admin-user-card">
              <div className="admin-user-card-header">
                <div>
                  <h3 className="admin-user-card-title">Subscription & Access Tier</h3>
                  <p className="admin-user-card-subtitle">Override subscription ledger & access limits</p>
                </div>
                <StatusBadge status={isPremiumNow ? "premium" : "free"} />
              </div>

              <dl className="admin-user-sub-kv">
                <div className="admin-user-sub-item">
                  <dt>Access Tier</dt>
                  <dd><StatusBadge status={isPremiumNow ? "premium" : "free"} /></dd>
                </div>
                <div className="admin-user-sub-item">
                  <dt>Plan</dt>
                  <dd>{sub?.plan || "FREE"}</dd>
                </div>
                <div className="admin-user-sub-item">
                  <dt>Status</dt>
                  <dd><StatusBadge status={sub?.status || "none"} /></dd>
                </div>
                <div className="admin-user-sub-item">
                  <dt>Source</dt>
                  <dd>{sub?.source || "—"}</dd>
                </div>
                {sub?.currentPeriodEnd ? (
                  <div className="admin-user-sub-item" style={{ gridColumn: "span 2" }}>
                    <dt>Premium Period End</dt>
                    <dd>{new Date(sub.currentPeriodEnd).toLocaleString()}</dd>
                  </div>
                ) : null}
              </dl>

              {canUpdate ? (
                <>
                  <div className="admin-user-form-group">
                    <label htmlFor="sub-period-end">Grant Expiration Date</label>
                    <input
                      id="sub-period-end"
                      type="datetime-local"
                      value={periodEndLocal}
                      onChange={(e) => setPeriodEndLocal(e.target.value)}
                      disabled={subBusy}
                    />
                  </div>
                  <div className="admin-user-actions-group">
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
                      className="admin-btn danger-secondary"
                      disabled={subBusy || !isPremiumNow}
                      onClick={() => setConfirmSub("revoke")}
                    >
                      Revoke to Free
                    </button>
                  </div>
                </>
              ) : (
                <p className="admin-page-lead" style={{ fontSize: "0.8125rem" }}>
                  Requires <code>users:update</code> permission to grant or revoke access.
                </p>
              )}
            </div>
          </div>
        ) : tab === "activity" ? (
          loadingExtra ? (
            <p className="admin-muted">Loading activity history…</p>
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
                {
                  key: "type",
                  header: "Type",
                  render: (a) => (
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      {a.type}
                    </span>
                  ),
                },
                {
                  key: "action",
                  header: "Action",
                  render: (a) => <StatusBadge status={a.action} />,
                },
                {
                  key: "detail",
                  header: "Detail",
                  render: (a) => a.detail || "—",
                },
                {
                  key: "ip",
                  header: "IP",
                  render: (a) => (
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                      {a.ip || "—"}
                    </span>
                  ),
                },
              ]}
              rows={activity}
              emptyTitle="No activity recorded"
              emptyDescription="Login, security, role, and account events for this user will appear here."
              emptyIcon={<Activity size={20} strokeWidth={1.75} />}
            />
          )
        ) : tab === "progress" ? (
          loadingExtra || !progress ? (
            <p className="admin-muted">Loading user progress…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Metric Row */}
              <div className="admin-user-metrics-row">
                <div className="admin-user-metric-card">
                  <span className="metric-value">{progress.problemsAttempted}</span>
                  <span className="metric-label">Attempted</span>
                </div>
                <div className="admin-user-metric-card">
                  <span className="metric-value">{progress.problemsSolved}</span>
                  <span className="metric-label">Solved</span>
                </div>
                <div className="admin-user-metric-card">
                  <span className="metric-value">{progress.submissionCount}</span>
                  <span className="metric-label">Submissions</span>
                </div>
                <div className="admin-user-metric-card">
                  <span className="metric-value">{progress.acceptedCount}</span>
                  <span className="metric-label">Accepted</span>
                </div>
                <div className="admin-user-metric-card">
                  <span className="metric-value">{progress.acceptanceRate}%</span>
                  <span className="metric-label">Acceptance</span>
                </div>
              </div>

              {/* Languages */}
              <div className="admin-user-card" style={{ gap: 12 }}>
                <div className="admin-user-card-header" style={{ paddingBottom: 8 }}>
                  <h3 className="admin-user-card-title">Languages Breakdown</h3>
                </div>
                {Object.keys(progress.byLanguage || {}).length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Code2 size={18} strokeWidth={1.75} />}
                    title="No language data yet"
                    description="Languages will appear after this user submits code."
                  />
                ) : (
                  <div className="admin-language-pills">
                    {Object.entries(progress.byLanguage || {}).map(([lang, n]) => (
                      <div className="admin-language-pill" key={lang}>
                        <span className="admin-language-pill-name">{lang}</span>
                        <span className="admin-language-pill-count">{n} submissions</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Submissions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="admin-user-card-title" style={{ margin: 0 }}>Recent Submissions</h3>
                <DataTable
                  rowKey={(s) => String(s.id)}
                  columns={[
                    {
                      key: "problemId",
                      header: "Problem",
                      render: (s) => (
                        <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                          {s.problemId}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (s) => <StatusBadge status={s.status} />,
                    },
                    {
                      key: "language",
                      header: "Lang",
                      render: (s) => (
                        <span className="admin-submission-lang-badge">
                          {s.language || "—"}
                        </span>
                      ),
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
                  emptyIcon={<FileCode2 size={20} strokeWidth={1.75} />}
                />
              </div>
            </div>
          )
        ) : loadingExtra ? (
          <p className="admin-muted">Loading active sessions…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {canUpdate && sessions.length > 0 && (
              <div className="admin-sessions-toolbar">
                <button
                  type="button"
                  className="admin-btn danger-secondary"
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
            )}
            <DataTable
              rowKey={(s) => s.id}
              columns={[
                {
                  key: "ip",
                  header: "IP Address",
                  render: (s) => (
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.8125rem", color: "var(--text-main)" }}>
                      {s.ip || "—"}
                    </span>
                  ),
                },
                {
                  key: "userAgent",
                  header: "Device / User Agent",
                  render: (s) => (
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", maxWidth: "320px", display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.userAgent || "—"}
                    </span>
                  ),
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
                  render: (s) => (
                    <StatusBadge status={s.expired ? "expired" : "active"} />
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (s) =>
                    canUpdate ? (
                      <button
                        type="button"
                        className="admin-btn danger-secondary"
                        style={{ height: 30, padding: "0 10px", fontSize: "0.75rem" }}
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
              emptyIcon={<Monitor size={20} strokeWidth={1.75} />}
            />
          </div>
        )}

        {/* Confirm Dialogs */}
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
      </div>
    </PermissionGuard>
  );
};
