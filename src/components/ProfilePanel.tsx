import {
  useMemo,
  useState,
  type FC,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Camera,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Settings2,
  Shield,
  Trash2,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { authApi, type User } from "../api/authApi";
import type { Submission, SubmissionStatus } from "../api/submissionApi";
import { isAcceptedStatus } from "../utils/submissionUtils";
import { useAuth } from "../context/AuthContext";
import { ImportProgressSection } from "./ImportProgressSection";
import { EntitlementDebugPanel } from "./access/EntitlementDebugPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/cn";
import "./companies/companies.css";
import "./settings-panel.css";

const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "PENDING",
  "RUNNING",
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "RUNTIME_ERROR",
  "COMPILATION_ERROR",
];

export type SettingsSection =
  | "profile"
  | "account"
  | "security"
  | "progress"
  | "sessions"
  | "submissions"
  | "audit";

interface ProfilePanelProps {
  user: User | null;
  dashTab: SettingsSection;
  onTabChange: (tab: SettingsSection) => void;
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
  sessions: SessionRow[];
  securityLogs: SecurityLogRow[];
  loadingSessions?: boolean;
  loadingSecurityLogs?: boolean;
  currentStreak?: number;
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
  onRevokeSession: (id: string) => void | Promise<void>;
  onLogoutAllSessions?: () => void | Promise<void>;
  onToggle2FA?: (enable: boolean) => void | Promise<void>;
  onChangePassword?: (curr: string, next: string) => void | Promise<void>;
  onSignout: () => void | Promise<void>;
  onProgressImported?: () => void | Promise<void>;
}

export type SessionRow = {
  id?: string;
  _id?: string;
  userAgent?: string;
  ip?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SecurityLogRow = {
  id?: string;
  _id?: string;
  action?: string;
  event?: string;
  createdAt?: string;
  ip?: string;
};

type NavItem = {
  id: SettingsSection;
  label: string;
  desc: string;
  icon: typeof UserIcon;
  group: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "profile",
    label: "Profile",
    desc: "Your public profile",
    icon: UserIcon,
    group: "Profile",
  },
  {
    id: "account",
    label: "Account",
    desc: "Email & account details",
    icon: Settings2,
    group: "Account",
  },
  {
    id: "security",
    label: "Security",
    desc: "Password & 2FA",
    icon: Shield,
    group: "Security",
  },
  {
    id: "sessions",
    label: "Sessions",
    desc: "Signed-in devices",
    icon: Monitor,
    group: "Security",
  },
  {
    id: "progress",
    label: "Progress",
    desc: "Import from submissions",
    icon: Upload,
    group: "Progress",
  },
  {
    id: "submissions",
    label: "My Submissions",
    desc: "Submission history",
    icon: FileText,
    group: "Activity",
  },
  {
    id: "audit",
    label: "Audit Logs",
    desc: "Security activity",
    icon: ClipboardList,
    group: "Activity",
  },
];

function friendlyApiError(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };
  const status = anyErr?.response?.status;
  const msg = anyErr?.response?.data?.message;
  if (typeof msg === "string" && msg.trim() && msg.length < 180) return msg;
  if (status === 401) return "Please sign in again to continue.";
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return "The requested resource was not found.";
  if (status === 409) return "This action conflicts with the current account state.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status && status >= 500) return "Something went wrong on our side. Please try again.";
  if (!anyErr?.response) return "Network error. Check your connection and try again.";
  return fallback;
}

function describeDevice(ua?: string): string {
  if (!ua || !ua.trim()) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

function formatWhen(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanizeAction(raw?: string): string {
  if (!raw) return "Account activity";
  const cleaned = raw
    .replace(/^SESSION_REVOKED_.+/i, "Session revoked")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function accountStatus(user: User | null): {
  label: string;
  tone: "ok" | "warn" | "danger";
} {
  const s = (user?.status || "active").toLowerCase();
  if (s === "suspended") return { label: "Suspended", tone: "warn" };
  if (s === "banned") return { label: "Banned", tone: "danger" };
  return { label: "Active", tone: "ok" };
}

function sessionId(s: SessionRow): string {
  return String(s.id || s._id || "");
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
  loadingSessions = false,
  loadingSecurityLogs = false,
  currentStreak = 0,
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
  const { setUser } = useAuth();

  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurr, setShowCurr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passSaving, setPassSaving] = useState(false);

  const [emailOtp, setEmailOtp] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailVerifyMsg, setEmailVerifyMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const status = accountStatus(user);
  const avatarSrc = avatarPreview || user?.avatar || "";
  const initial = (user?.name || "U").charAt(0).toUpperCase();

  const stats = useMemo(() => {
    const problemIds = new Set<string>();
    const solvedIds = new Set<string>();
    for (const s of userSubmissions) {
      const pid = String(s.problemId || "").trim();
      if (!pid) continue;
      problemIds.add(pid);
      if (isAcceptedStatus(s.status)) solvedIds.add(pid);
    }
    return {
      submissions: userSubmissions.length,
      attempted: problemIds.size,
      solved: solvedIds.size,
      streak: currentStreak,
    };
  }, [userSubmissions, currentStreak]);

  const navGroups = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of NAV_ITEMS) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, []);

  const handlePassSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!onChangePassword) return;
    if (newPass.length < 8) {
      setPassMsg({ type: "err", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg({ type: "err", text: "New password and confirmation do not match." });
      return;
    }
    try {
      setPassSaving(true);
      setPassMsg(null);
      await onChangePassword(currPass, newPass);
      setPassMsg({ type: "ok", text: "Password updated successfully." });
      setCurrPass("");
      setNewPass("");
      setConfirmPass("");
    } catch (err) {
      setPassMsg({
        type: "err",
        text: friendlyApiError(err, "Failed to update password."),
      });
    } finally {
      setPassSaving(false);
    }
  };

  const sendVerification = async () => {
    try {
      setEmailBusy(true);
      setEmailVerifyMsg(null);
      const res = await authApi.sendEmailVerification();
      const devOtp =
        import.meta.env.DEV && res.data?.otp
          ? ` Dev OTP: ${String(res.data.otp)}`
          : "";
      setEmailVerifyMsg({
        type: "ok",
        text: (res.message || "Verification code sent.") + devOtp,
      });
      setIsVerifyingEmail(true);
    } catch (err) {
      setEmailVerifyMsg({
        type: "err",
        text: friendlyApiError(err, "Failed to send verification email."),
      });
    } finally {
      setEmailBusy(false);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setEmailBusy(true);
      setEmailVerifyMsg(null);
      const res = await authApi.verifyEmailOtp(emailOtp);
      setEmailVerifyMsg({
        type: "ok",
        text: res.message || "Email verified successfully.",
      });
      setIsVerifyingEmail(false);
      setEmailOtp("");
      try {
        const me = await authApi.getProfile();
        if (me.data) {
          setUser(me.data as User);
        } else if (user) {
          setUser({ ...user, isEmailVerified: true });
        }
      } catch {
        if (user) setUser({ ...user, isEmailVerified: true });
      }
    } catch (err) {
      setEmailVerifyMsg({
        type: "err",
        text: friendlyApiError(err, "OTP verification failed."),
      });
    } finally {
      setEmailBusy(false);
    }
  };

  const toggle2FA = async () => {
    if (!onToggle2FA) return;
    const enable = !user?.twoFactorEnabled;
    try {
      setTwoFaBusy(true);
      setTwoFaMsg(null);
      await onToggle2FA(enable);
      setTwoFaMsg({
        type: "ok",
        text: enable
          ? "Two-factor authentication enabled."
          : "Two-factor authentication disabled.",
      });
    } catch (err) {
      setTwoFaMsg({
        type: "err",
        text: friendlyApiError(err, "Failed to update two-factor authentication."),
      });
    } finally {
      setTwoFaBusy(false);
    }
  };

  const confirmSignOut = async () => {
    try {
      setSignOutBusy(true);
      await onSignout();
    } finally {
      setSignOutBusy(false);
      setSignOutOpen(false);
    }
  };

  const confirmLogoutAll = async () => {
    if (!onLogoutAllSessions) return;
    try {
      setLogoutAllBusy(true);
      await onLogoutAllSessions();
    } catch {
      /* parent handles signout flow */
    } finally {
      setLogoutAllBusy(false);
      setLogoutAllOpen(false);
    }
  };

  const revoke = async (id: string) => {
    if (!id) return;
    try {
      setRevokingId(id);
      await onRevokeSession(id);
    } finally {
      setRevokingId(null);
    }
  };

  const profileMsgTone =
    profileMsg && /success/i.test(profileMsg) ? "ok" : profileMsg ? "err" : null;

  return (
    <div className="co-page ps-page">
      <header className="co-header ps-header">
        <div>
          <h1 className="co-title">
            <Settings2 size={22} aria-hidden />
            Profile &amp; Settings
          </h1>
          <p className="ps-sublede">
            Manage your account, security, progress and AlgoPath preferences.
          </p>
        </div>
        <div className="ps-header-user" aria-label="Signed-in account">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="ps-header-avatar"
            />
          ) : (
            <div className="ps-header-avatar-fallback" aria-hidden>
              {initial}
            </div>
          )}
          <div className="ps-header-meta">
            <p className="ps-header-name">{user?.name || "—"}</p>
            <p className="ps-header-email">{user?.email || "—"}</p>
            <span className="ps-status">
              <span
                className={cn(
                  "ps-status-dot",
                  status.tone === "warn" && "warn",
                  status.tone === "danger" && "danger",
                )}
                aria-hidden
              />
              {status.label}
            </span>
          </div>
        </div>
      </header>

      <div
        className="ps-mobile-nav"
        role="tablist"
        aria-label="Settings sections"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={dashTab === item.id}
            className={cn("ps-mobile-chip", dashTab === item.id && "active")}
            onClick={() => onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="ps-mobile-chip"
          onClick={() => setSignOutOpen(true)}
        >
          Sign Out
        </button>
      </div>

      <div className="ps-layout">
        <nav className="ps-nav" aria-label="Settings">
          {navGroups.map(([group, items]) => (
            <div key={group} className="ps-nav-group">
              <p className="ps-nav-label">{group}</p>
              {items.map((item) => {
                const Icon = item.icon;
                const active = dashTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn("ps-nav-btn", active && "active")}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onTabChange(item.id)}
                  >
                    <Icon size={16} aria-hidden />
                    <span className="ps-nav-btn-text">
                      <span className="ps-nav-btn-title">{item.label}</span>
                      <span className="ps-nav-btn-desc">{item.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          <div className="ps-nav-group">
            <p className="ps-nav-label">Account</p>
            <button
              type="button"
              className="ps-nav-btn danger"
              onClick={() => setSignOutOpen(true)}
            >
              <LogOut size={16} aria-hidden />
              <span className="ps-nav-btn-text">
                <span className="ps-nav-btn-title">Sign Out</span>
                <span className="ps-nav-btn-desc">End this session</span>
              </span>
            </button>
          </div>
        </nav>

        <div className="ps-main">
          {dashTab === "profile" && (
            <>
              <div className="ps-section-head">
                <h2>Profile</h2>
                <p>Your AlgoPath identity and progress at a glance.</p>
              </div>

              <section className="ps-card" aria-labelledby="ps-profile-card">
                <h3 id="ps-profile-card" className="ps-card-title">
                  Profile
                </h3>
                <div className="ps-profile-hero">
                  <div className="ps-avatar-wrap">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={user?.name || "Avatar"}
                        className="ps-avatar"
                      />
                    ) : (
                      <div className="ps-avatar-fallback" aria-hidden>
                        {initial}
                      </div>
                    )}
                    <label className="ps-avatar-edit" title="Change avatar">
                      <Camera size={13} aria-hidden />
                      <span className="sr-only">Change avatar</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onAvatarChange}
                      />
                    </label>
                  </div>
                  <div className="ps-profile-info">
                    <h3>{user?.name || "—"}</h3>
                    <p className="ps-email">{user?.email || "—"}</p>
                    <span className="ps-status">
                      <span
                        className={cn(
                          "ps-status-dot",
                          status.tone === "warn" && "warn",
                          status.tone === "danger" && "danger",
                        )}
                        aria-hidden
                      />
                      {status.label}
                    </span>
                  </div>
                </div>
              </section>

              <div className="ps-stats" aria-label="Account statistics">
                <div className="ps-stat">
                  <p className="ps-stat-value">{stats.submissions}</p>
                  <p className="ps-stat-label">Submissions</p>
                </div>
                <div className="ps-stat">
                  <p className="ps-stat-value">{stats.attempted}</p>
                  <p className="ps-stat-label">Attempted</p>
                </div>
                <div className="ps-stat">
                  <p className="ps-stat-value">{stats.solved}</p>
                  <p className="ps-stat-label">Solved</p>
                </div>
                <div className="ps-stat">
                  <p className="ps-stat-value">
                    {stats.streak}
                    <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                      {" "}
                      Day
                    </span>
                  </p>
                  <p className="ps-stat-label">Current Streak</p>
                </div>
              </div>
            </>
          )}

          {dashTab === "account" && (
            <>
              <div className="ps-section-head">
                <h2>Account</h2>
                <p>Update the information associated with your AlgoPath account.</p>
              </div>

              <section className="ps-card">
                <h3 className="ps-card-title">Account Settings</h3>
                <p className="ps-card-desc">
                  Update the information associated with your AlgoPath account.
                </p>
                {profileMsg && profileMsgTone && (
                  <p className={cn("ps-msg", profileMsgTone)} role="status">
                    {profileMsg}
                  </p>
                )}
                <form className="ps-form" onSubmit={onUpdateProfile}>
                  <div className="ps-field">
                    <label htmlFor="ps-full-name">Full Name</label>
                    <input
                      id="ps-full-name"
                      type="text"
                      value={editName}
                      onChange={(e) => onNameChange(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="ps-field">
                    <label htmlFor="ps-email">Email</label>
                    <input
                      id="ps-email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      autoComplete="email"
                    />
                  </div>
                  <div className="ps-row-actions">
                    <Button type="submit" disabled={updatingProfile || !editName.trim()}>
                      {updatingProfile ? (
                        <>
                          <Loader2 size={16} className="animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </form>
              </section>

              <section className="ps-card">
                <h3 className="ps-card-title">Email Verification</h3>
                <p className="ps-card-desc">
                  Verify your email to keep your AlgoPath account secure.
                </p>
                {emailVerifyMsg && (
                  <p className={cn("ps-msg", emailVerifyMsg.type)} role="status">
                    {emailVerifyMsg.text}
                  </p>
                )}
                <div className="ps-status-row">
                  <div>
                    {user?.isEmailVerified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <span className="ps-status">
                        <span className="ps-status-dot warn" aria-hidden />
                        Unverified
                      </span>
                    )}
                    {!user?.isEmailVerified && (
                      <p
                        className="ps-card-desc"
                        style={{ marginTop: 8, marginBottom: 0 }}
                      >
                        Your email address has not been verified yet.
                      </p>
                    )}
                  </div>
                  {!user?.isEmailVerified && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={emailBusy}
                      onClick={() => void sendVerification()}
                    >
                      {emailBusy ? (
                        <>
                          <Loader2 size={14} className="animate-spin" aria-hidden />
                          Sending…
                        </>
                      ) : (
                        "Send Verification Code"
                      )}
                    </Button>
                  )}
                </div>
                {isVerifyingEmail && !user?.isEmailVerified && (
                  <form className="ps-otp-row" onSubmit={verifyOtp}>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit code"
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value)}
                      aria-label="Email verification code"
                      required
                    />
                    <Button type="submit" size="sm" disabled={emailBusy || !emailOtp.trim()}>
                      Verify
                    </Button>
                  </form>
                )}
              </section>
            </>
          )}

          {dashTab === "security" && (
            <>
              <div className="ps-section-head">
                <h2>Security &amp; Authentication</h2>
                <p>
                  Protect your AlgoPath account and manage authentication methods.
                </p>
              </div>

              <section className="ps-card">
                <h3 className="ps-card-title">Change Password</h3>
                <p className="ps-card-desc">
                  Choose a strong password you don&apos;t use elsewhere.
                </p>
                {passMsg && (
                  <p className={cn("ps-msg", passMsg.type)} role="status">
                    {passMsg.text}
                  </p>
                )}
                <form className="ps-form" onSubmit={handlePassSubmit}>
                  <div className="ps-field">
                    <label htmlFor="ps-curr-pass">Current Password</label>
                    <div className="ps-pass-wrap">
                      <input
                        id="ps-curr-pass"
                        type={showCurr ? "text" : "password"}
                        placeholder="Enter current password"
                        value={currPass}
                        onChange={(e) => setCurrPass(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="ps-pass-toggle"
                        aria-label={showCurr ? "Hide current password" : "Show current password"}
                        onClick={() => setShowCurr((v) => !v)}
                      >
                        {showCurr ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="ps-field">
                    <label htmlFor="ps-new-pass">New Password</label>
                    <div className="ps-pass-wrap">
                      <input
                        id="ps-new-pass"
                        type={showNew ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="ps-pass-toggle"
                        aria-label={showNew ? "Hide new password" : "Show new password"}
                        onClick={() => setShowNew((v) => !v)}
                      >
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="ps-field">
                    <label htmlFor="ps-confirm-pass">Confirm New Password</label>
                    <div className="ps-pass-wrap">
                      <input
                        id="ps-confirm-pass"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Enter new password"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="ps-pass-toggle"
                        aria-label={
                          showConfirm ? "Hide confirmation password" : "Show confirmation password"
                        }
                        onClick={() => setShowConfirm((v) => !v)}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={passSaving || !onChangePassword}>
                    {passSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" aria-hidden />
                        Updating…
                      </>
                    ) : (
                      <>
                        <KeyRound size={16} aria-hidden />
                        Update Password
                      </>
                    )}
                  </Button>
                </form>
              </section>

              <section className="ps-card">
                <h3 className="ps-card-title">Two-Factor Authentication</h3>
                <p className="ps-card-desc">
                  Add an additional layer of security to your account.
                </p>
                {twoFaMsg && (
                  <p className={cn("ps-msg", twoFaMsg.type)} role="status">
                    {twoFaMsg.text}
                  </p>
                )}
                <div className="ps-status-row">
                  <div>
                    <p className="ps-session-meta" style={{ marginBottom: 6 }}>
                      Status
                    </p>
                    {user?.twoFactorEnabled ? (
                      <Badge variant="success">Enabled</Badge>
                    ) : (
                      <span className="ps-status">
                        <span className="ps-status-dot warn" aria-hidden />
                        Disabled
                      </span>
                    )}
                    {user?.twoFactorEnabled && (
                      <p
                        className="ps-card-desc"
                        style={{ marginTop: 8, marginBottom: 0 }}
                      >
                        Your account is protected with two-factor authentication.
                      </p>
                    )}
                  </div>
                  {onToggle2FA && (
                    <Button
                      type="button"
                      size="sm"
                      variant={user?.twoFactorEnabled ? "destructive" : "primary"}
                      disabled={twoFaBusy}
                      onClick={() => void toggle2FA()}
                    >
                      {twoFaBusy ? (
                        <>
                          <Loader2 size={14} className="animate-spin" aria-hidden />
                          Updating…
                        </>
                      ) : user?.twoFactorEnabled ? (
                        "Disable 2FA"
                      ) : (
                        "Enable 2FA"
                      )}
                    </Button>
                  )}
                </div>
              </section>

              <EntitlementDebugPanel />
            </>
          )}

          {dashTab === "progress" && (
            <>
              <div className="ps-section-head">
                <h2>Import Progress</h2>
                <p>Restore your AlgoPath progress from previous submissions.</p>
              </div>
              <section className="ps-card">
                <ImportProgressSection onImported={onProgressImported} />
              </section>
            </>
          )}

          {dashTab === "sessions" && (
            <>
              <div className="ps-section-head">
                <h2>Active Sessions</h2>
                <p>
                  Review devices currently signed in to your AlgoPath account.
                </p>
              </div>
              <section className="ps-card">
                <div className="ps-status-row" style={{ marginBottom: 12 }}>
                  <h3 className="ps-card-title" style={{ margin: 0 }}>
                    Signed-in devices
                  </h3>
                  {onLogoutAllSessions && sessions.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setLogoutAllOpen(true)}
                    >
                      Sign out all sessions
                    </Button>
                  )}
                </div>

                {loadingSessions ? (
                  <div className="ps-skel" aria-busy="true">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-4/5" />
                  </div>
                ) : sessions.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Monitor size={18} />}
                    title="No Active Sessions"
                    description="You don't currently have any additional active sessions listed for this account."
                  />
                ) : (
                  sessions.map((s, idx) => {
                    const id = sessionId(s);
                    return (
                      <div key={id || idx} className="ps-session-row">
                        <div>
                          <p className="ps-session-title">
                            {describeDevice(s.userAgent)}
                          </p>
                          <p className="ps-session-meta">
                            {s.ip ? `IP ${s.ip} · ` : ""}
                            {s.updatedAt || s.createdAt
                              ? `Last seen ${formatWhen(s.updatedAt || s.createdAt)}`
                              : "Active session"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={!id || revokingId === id}
                          onClick={() => void revoke(id)}
                        >
                          {revokingId === id ? (
                            <Loader2 size={14} className="animate-spin" aria-hidden />
                          ) : (
                            "Revoke"
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </section>
            </>
          )}

          {dashTab === "submissions" && (
            <>
              <div className="ps-section-head">
                <h2>My Submissions</h2>
                <p>Review and manage your AlgoPath submission history.</p>
              </div>

              <section className="ps-card">
                <div className="ps-status-row">
                  <div>
                    <h3 className="ps-card-title">My Submissions</h3>
                    <p className="ps-card-desc" style={{ marginBottom: 0 }}>
                      {stats.submissions} total submission
                      {stats.submissions === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onLoadSubmissions}
                  >
                    Refresh
                    <ArrowRight size={14} aria-hidden />
                  </Button>
                </div>
              </section>

              <section className="ps-card">
                <div className="ps-filters">
                  <input
                    type="text"
                    placeholder="Search…"
                    value={submissionSearch}
                    onChange={(e) => onSubmissionSearchChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onLoadSubmissions()}
                    aria-label="Search submissions"
                  />
                  <select
                    value={submissionStatusFilter}
                    onChange={(e) => onStatusFilterChange(e.target.value)}
                    aria-label="Filter by status"
                  >
                    <option value="mine">My submissions</option>
                    <option value="all">All</option>
                    {SUBMISSION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={submissionLangFilter}
                    onChange={(e) => onLangFilterChange(e.target.value)}
                    aria-label="Filter by language"
                  >
                    <option value="all">All languages</option>
                    <option value="javascript">javascript</option>
                    <option value="python">python</option>
                    <option value="cpp">cpp</option>
                    <option value="java">java</option>
                  </select>
                  <Button type="button" size="sm" onClick={onLoadSubmissions}>
                    Apply
                  </Button>
                </div>

                {selectedSubmission && (
                  <div className="ps-code-preview">
                    <div className="ps-status-row">
                      <Badge
                        variant={
                          isAcceptedStatus(selectedSubmission.status)
                            ? "success"
                            : "danger"
                        }
                      >
                        {selectedSubmission.status}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={onClearSelectedSubmission}
                      >
                        Close
                      </Button>
                    </div>
                    <pre>{selectedSubmission.code}</pre>
                  </div>
                )}

                {loadingSubmissions ? (
                  <div className="ps-skel" aria-busy="true">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-3/4" />
                  </div>
                ) : userSubmissions.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<FileText size={18} />}
                    title="No Submissions Yet"
                    description="Solve a problem to see your submission history here."
                  />
                ) : (
                  userSubmissions.map((sub, idx) => {
                    const sid = sub.id || sub._id;
                    return (
                      <div key={sid || idx} className="ps-submission-row">
                        <button
                          type="button"
                          className="ps-nav-btn"
                          style={{ flex: 1, padding: "4px 0" }}
                          onClick={() => onViewSubmission(sid)}
                        >
                          <span className="ps-nav-btn-text">
                            <span className="ps-nav-btn-title">
                              #{idx + 1} · {sub.language}
                            </span>
                            <span
                              className="ps-nav-btn-desc"
                              style={{
                                color: isAcceptedStatus(sub.status)
                                  ? "var(--success)"
                                  : "var(--error)",
                              }}
                            >
                              {sub.status}
                            </span>
                          </span>
                        </button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Delete submission"
                          disabled={deletingSubmissionId === sid}
                          onClick={() => onDeleteSubmission(sid)}
                        >
                          {deletingSubmissionId === sid ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </section>
            </>
          )}

          {dashTab === "audit" && (
            <>
              <div className="ps-section-head">
                <h2>Audit Logs</h2>
                <p>Review important security and account activity.</p>
              </div>
              <section className="ps-card">
                <h3 className="ps-card-title">Recent account activity</h3>
                <p className="ps-card-desc">
                  Security events for your account only — not administrator logs.
                </p>
                {loadingSecurityLogs ? (
                  <div className="ps-skel" aria-busy="true">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-2/3" />
                  </div>
                ) : securityLogs.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<ClipboardList size={18} />}
                    title="No Audit Activity"
                    description="Security and account events will appear here as you use AlgoPath."
                  />
                ) : (
                  securityLogs.map((l, idx) => (
                    <div key={String(l.id || l._id || idx)} className="ps-log-row">
                      <div>
                        <p className="ps-log-action">
                          {humanizeAction(l.action || l.event)}
                        </p>
                        {l.ip ? (
                          <p className="ps-log-meta">IP {l.ip}</p>
                        ) : null}
                      </div>
                      <span className="ps-log-meta">{formatWhen(l.createdAt)}</span>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out of AlgoPath?"
        description="You will need to sign in again to access your account."
        confirmLabel="Sign Out"
        confirmingLabel="Signing out…"
        confirming={signOutBusy}
        cancelLabel="Cancel"
        onCancel={() => {
          if (!signOutBusy) setSignOutOpen(false);
        }}
        onConfirm={() => void confirmSignOut()}
      />

      <ConfirmDialog
        open={logoutAllOpen}
        title="Sign out all sessions?"
        description="This ends every signed-in session for your account, including this one. You will need to sign in again."
        confirmLabel="Sign Out All"
        confirmingLabel="Signing out…"
        confirming={logoutAllBusy}
        cancelLabel="Cancel"
        onCancel={() => {
          if (!logoutAllBusy) setLogoutAllOpen(false);
        }}
        onConfirm={() => void confirmLogoutAll()}
      />
    </div>
  );
};
