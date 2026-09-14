import { useState, type FC, type FormEvent } from "react";
import { Camera, Loader2, LogOut, Trash2 } from "lucide-react";
import { authApi, type User } from "../api/authApi";
import type { Submission, SubmissionStatus } from "../api/submissionApi";
import { isAcceptedStatus } from "../utils/submissionUtils";
import { ImportProgressSection } from "./ImportProgressSection";

const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "PENDING", "RUNNING", "ACCEPTED", "WRONG_ANSWER", "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED", "RUNTIME_ERROR", "COMPILATION_ERROR",
];

interface ProfilePanelProps {
  user: User | null;
  dashTab: "overview" | "submissions" | "sessions" | "security";
  onTabChange: (tab: "overview" | "submissions" | "sessions" | "security") => void;
  editName: string;
  avatarPreview: string;
  profileMsg: string;
  updatingProfile: boolean;
  userSubmissions: Submission[];
  loadingSubmissions: boolean;
  submissionSearch: string;
  submissionStatusFilter: string;
  submissionLangFilter: string;
  selectedSubmission: Submission | null;
  deletingSubmissionId: string | null;
  sessions: any[];
  securityLogs: any[];
  onNameChange: (v: string) => void;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdateProfile: (e: FormEvent) => void;
  onLoadSubmissions: () => void;
  onSubmissionSearchChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onLangFilterChange: (v: string) => void;
  onViewSubmission: (id?: string) => void;
  onDeleteSubmission: (id?: string) => void;
  onClearSelectedSubmission: () => void;
  onRevokeSession: (id: string) => void;
  onLogoutAllSessions?: () => void;
  onToggle2FA?: (enable: boolean) => void;
  onChangePassword?: (curr: string, next: string) => void;
  onSignout: () => void;
  /** Refresh dashboard submissions / streak after progress import. */
  onProgressImported?: () => void | Promise<void>;
}

export const ProfilePanel: FC<ProfilePanelProps> = ({
  user,
  dashTab,
  onTabChange,
  editName,
  avatarPreview,
  profileMsg,
  updatingProfile,
  userSubmissions,
  loadingSubmissions,
  submissionSearch,
  submissionStatusFilter,
  submissionLangFilter,
  selectedSubmission,
  deletingSubmissionId,
  sessions,
  securityLogs,
  onNameChange,
  onAvatarChange,
  onUpdateProfile,
  onLoadSubmissions,
  onSubmissionSearchChange,
  onStatusFilterChange,
  onLangFilterChange,
  onViewSubmission,
  onDeleteSubmission,
  onClearSelectedSubmission,
  onRevokeSession,
  onLogoutAllSessions,
  onToggle2FA,
  onChangePassword,
  onSignout,
  onProgressImported,
}) => {
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");

  const [emailOtp, setEmailOtp] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailVerifyMsg, setEmailVerifyMsg] = useState("");

  const handlePassSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!onChangePassword) return;
    try {
      setPassMsg("");
      await onChangePassword(currPass, newPass);
      setPassMsg("Password changed successfully!");
      setCurrPass("");
      setNewPass("");
    } catch (err: any) {
      setPassMsg(err.response?.data?.message || err.message || "Failed to change password");
    }
  };

  return (
    <div className="profile-layout">
      <div className="profile-card">
        <div className="profile-avatar-wrap">
          {avatarPreview || user?.avatar ? (
            <img src={avatarPreview || user?.avatar} alt={user?.name} className="profile-avatar" />
          ) : (
            <div className="profile-avatar-fallback">{user?.name?.charAt(0) || "U"}</div>
          )}
          <label htmlFor="avatarInput" className="profile-avatar-edit">
            <Camera size={13} />
            <input id="avatarInput" type="file" accept="image/*" onChange={onAvatarChange} style={{ display: "none" }} />
          </label>
        </div>
        <div className="profile-name">{user?.name}</div>
        <div className="profile-email">{user?.email}</div>

        <nav className="profile-nav">
          {(["overview", "submissions", "sessions", "security"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`profile-nav-btn ${dashTab === tab ? "active" : ""}`}
              onClick={() => onTabChange(tab)}
            >
              <span>
                {tab === "overview" && "Account Overview"}
                {tab === "submissions" && "My Submissions"}
                {tab === "sessions" && "Active Sessions"}
                {tab === "security" && "Audit Logs"}
              </span>
              {tab === "submissions" && <span>{userSubmissions.length}</span>}
              {tab === "sessions" && <span>{sessions.length}</span>}
            </button>
          ))}
          <button type="button" className="profile-nav-btn danger" onClick={onSignout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </nav>
      </div>

      <div className="profile-panel">
        {dashTab === "overview" && (
          <>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16 }}>Account Settings</h3>
            {profileMsg && (
              <p style={{ marginBottom: 12, color: profileMsg.includes("success") ? "var(--success)" : "var(--error)", fontSize: "0.85rem" }}>
                {profileMsg}
              </p>
            )}
            <form className="profile-form" onSubmit={onUpdateProfile}>
              <label>Full Name</label>
              <input type="text" value={editName} onChange={(e) => onNameChange(e.target.value)} />
              <label>Email</label>
              <input type="email" value={user?.email || ""} disabled style={{ opacity: 0.6 }} />
              <button type="submit" className="btn-primary" disabled={updatingProfile}>
                {updatingProfile ? "Saving..." : "Save Changes"}
              </button>
            </form>

            <hr style={{ margin: "24px 0", borderColor: "var(--border-subtle)", opacity: 0.4 }} />

            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>Email Verification Status</h3>
            {emailVerifyMsg && (
              <p style={{ marginBottom: 12, color: emailVerifyMsg.includes("success") || emailVerifyMsg.includes("sent") ? "var(--success)" : "var(--error)", fontSize: "0.85rem" }}>
                {emailVerifyMsg}
              </p>
            )}
            <div style={{ padding: "14px", backgroundColor: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isVerifyingEmail ? "12px" : 0 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Email Verification</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Status: <span style={{ color: user?.isEmailVerified ? "var(--success)" : "var(--warning)", fontWeight: 600 }}>{user?.isEmailVerified ? "Verified" : "Unverified"}</span>
                  </div>
                </div>
                {!user?.isEmailVerified && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                    onClick={async () => {
                      try {
                        setEmailVerifyMsg("");
                        const res = await authApi.sendEmailVerification();
                        setEmailVerifyMsg(res.message + (res.data?.otp ? ` [Dev OTP: ${res.data.otp}]` : ""));
                        setIsVerifyingEmail(true);
                      } catch (err: any) {
                        setEmailVerifyMsg(err.response?.data?.message || "Failed to send verification email");
                      }
                    }}
                  >
                    Send Verification Code
                  </button>
                )}
              </div>

              {isVerifyingEmail && !user?.isEmailVerified && (
                <form
                  style={{ display: "flex", gap: "8px", marginTop: "10px" }}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      setEmailVerifyMsg("");
                      const res = await authApi.verifyEmailOtp(emailOtp);
                      setEmailVerifyMsg(res.message || "Email verified successfully!");
                      setIsVerifyingEmail(false);
                      setEmailOtp("");
                    } catch (err: any) {
                      setEmailVerifyMsg(err.response?.data?.message || "OTP verification failed");
                    }
                  }}
                >
                  <input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "0.85rem" }}
                    required
                  />
                  <button type="submit" className="btn-primary" style={{ fontSize: "0.8rem", padding: "6px 14px" }}>Verify OTP</button>
                </form>
              )}
            </div>

            <hr style={{ margin: "24px 0", borderColor: "var(--border-subtle)", opacity: 0.4 }} />

            <ImportProgressSection onImported={onProgressImported} />

            <hr style={{ margin: "24px 0", borderColor: "var(--border-subtle)", opacity: 0.4 }} />

            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>Security & Authentication</h3>
            <div style={{ padding: "14px", backgroundColor: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Two-Factor Authentication (2FA)</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Status: <span style={{ color: user?.twoFactorEnabled ? "var(--success)" : "var(--warning)", fontWeight: 600 }}>{user?.twoFactorEnabled ? "Enabled" : "Disabled"}</span></div>
              </div>
              {onToggle2FA && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ backgroundColor: user?.twoFactorEnabled ? "var(--error)" : "var(--primary)", fontSize: "0.8rem", padding: "6px 12px" }}
                  onClick={() => onToggle2FA(!user?.twoFactorEnabled)}
                >
                  {user?.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                </button>
              )}
            </div>

            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>Change Password</h3>
            {passMsg && (
              <p style={{ marginBottom: 12, color: passMsg.includes("success") ? "var(--success)" : "var(--error)", fontSize: "0.85rem" }}>
                {passMsg}
              </p>
            )}
            <form className="profile-form" onSubmit={handlePassSubmit}>
              <label>Current Password</label>
              <input
                type="password"
                placeholder="Enter current password"
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
                required
              />
              <label>New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary">Update Password</button>
            </form>
          </>
        )}

        {dashTab === "submissions" && (
          <>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>Submission History</h3>
            <div className="submission-filters">
              <input
                type="text"
                placeholder="Search..."
                value={submissionSearch}
                onChange={(e) => onSubmissionSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onLoadSubmissions()}
              />
              <select value={submissionStatusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
                <option value="mine">My submissions</option>
                <option value="all">All</option>
                {SUBMISSION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={submissionLangFilter} onChange={(e) => onLangFilterChange(e.target.value)}>
                <option value="all">All languages</option>
                <option value="javascript">javascript</option>
                <option value="python">python</option>
                <option value="cpp">cpp</option>
                <option value="java">java</option>
              </select>
              <button type="button" className="btn-primary" onClick={onLoadSubmissions}>Apply</button>
            </div>

            {selectedSubmission && (
              <div style={{ marginBottom: 14, padding: 14, background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong style={{ color: "var(--primary-hover)" }}>{selectedSubmission.status}</strong>
                  <button type="button" className="btn-ghost" onClick={onClearSelectedSubmission}>Close</button>
                </div>
                <pre style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", color: "var(--primary-hover)" }}>{selectedSubmission.code}</pre>
              </div>
            )}

            {loadingSubmissions ? (
              <div className="loading-center"><Loader2 size={32} className="animate-spin" /></div>
            ) : userSubmissions.length === 0 ? (
              <div className="empty-state"><p>No submissions yet.</p></div>
            ) : (
              userSubmissions.map((sub, idx) => {
                const sid = sub.id || sub._id;
                return (
                  <div key={sid || idx} className="submission-row">
                    <div style={{ cursor: "pointer", flex: 1 }} onClick={() => onViewSubmission(sid)}>
                      <strong>#{idx + 1}</strong> · {sub.language} ·{" "}
                      <span style={{ color: isAcceptedStatus(sub.status) ? "var(--success)" : "var(--error)" }}>{sub.status}</span>
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => onDeleteSubmission(sid)} disabled={deletingSubmissionId === sid}>
                      {deletingSubmissionId === sid ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}

        {dashTab === "sessions" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Active Sessions</h3>
              {onLogoutAllSessions && (
                <button type="button" className="btn-ghost" style={{ color: "var(--error)", fontSize: "0.8rem" }} onClick={onLogoutAllSessions}>
                  Revoke All Sessions
                </button>
              )}
            </div>
            {sessions.length === 0 ? (
              <div className="empty-state"><p>No active sessions.</p></div>
            ) : (
              sessions.map((s: any, idx) => (
                <div key={idx} className="submission-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.userAgent || "Browser"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>IP: {s.ip || "—"}</div>
                  </div>
                  <button type="button" className="btn-ghost" style={{ color: "var(--error)" }} onClick={() => onRevokeSession(s.id)}>Revoke</button>
                </div>
              ))
            )}
          </>
        )}

        {dashTab === "security" && (
          <>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>Security Logs</h3>
            {securityLogs.length === 0 ? (
              <div className="empty-state"><p>No logs recorded.</p></div>
            ) : (
              securityLogs.map((l: any, idx) => (
                <div key={idx} className="submission-row">
                  <span style={{ color: "var(--primary-hover)", fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{l.action || l.event}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{l.createdAt || "Recent"}</span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};
