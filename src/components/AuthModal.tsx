import { useState, useEffect, type FC, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { usePlatformSettings } from "../context/PlatformSettingsContext";
import { authApi } from "../api/authApi";
import { BrandMark } from "./BrandLogo";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { normalizeApiError } from "../lib/apiError";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Laptop,
  Loader2,
  LogOut,
  ShieldCheck,
} from "lucide-react";

type AuthTab = "login" | "signup" | "2fa" | "forgot_request" | "forgot_confirm";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const AuthModal: FC<{
  initialTab?: AuthTab;
  /** Compact card for overlays — hide large brand chrome slightly. */
  embed?: boolean;
  onSuccess?: () => void;
}> = ({ initialTab = "login", embed = false, onSuccess }) => {
  const { user, signin, signup, signout, setUser } = useAuth();
  const { isEnabled } = usePlatformSettings();
  const registrationOpen = isEnabled("registration");
  const [activeTab, setActiveTab] = useState<AuthTab>(
    initialTab === "signup" && registrationOpen
      ? "signup"
      : initialTab === "signup"
        ? "login"
        : initialTab,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [dashTab, setDashTab] = useState<"overview" | "sessions" | "security">(
    "overview",
  );
  const [sessions, setSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (initialTab === "signup" && !registrationOpen) {
      setActiveTab("login");
      return;
    }
    if (initialTab === "login" || initialTab === "signup") {
      setActiveTab(initialTab);
    }
  }, [initialTab, registrationOpen]);

  useEffect(() => {
    if (!registrationOpen && activeTab === "signup") {
      setActiveTab("login");
    }
  }, [registrationOpen, activeTab]);

  useEffect(() => {
    if (user) {
      void fetchUserSessions();
      void fetchSecurityLogs();
    }
  }, [user]);

  const fetchUserSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await authApi.getActiveSessions();
      if (res.data) setSessions(res.data as any[]);
    } catch {
      /* ignore */
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchSecurityLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await authApi.getSecurityLogs();
      if (res.data) setSecurityLogs(res.data as any[]);
    } catch {
      /* ignore */
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleToggle2FA = async (enable: boolean) => {
    try {
      setErrorMsg("");
      const res = await authApi.toggle2FA(enable);
      setSuccessMsg(
        res.message || `2FA ${enable ? "Enabled" : "Disabled"} successfully`,
      );
      if (user) setUser({ ...user, twoFactorEnabled: enable });
    } catch (err: unknown) {
      setErrorMsg(normalizeApiError(err).message);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await authApi.revokeSession(sessionId);
      void fetchUserSessions();
    } catch (err: unknown) {
      setErrorMsg(normalizeApiError(err).message);
    }
  };

  const handleLogoutAllSessions = async () => {
    try {
      await authApi.logoutAllSessions();
      void signout();
    } catch (err: unknown) {
      setErrorMsg(normalizeApiError(err).message);
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (
      activeTab === "login" ||
      activeTab === "signup" ||
      activeTab === "forgot_request" ||
      activeTab === "forgot_confirm"
    ) {
      if (!email.trim()) next.email = "Email is required.";
      else if (!isValidEmail(email)) next.email = "Enter a valid email address.";
    }
    if (activeTab === "signup" && !name.trim()) {
      next.name = "Name is required.";
    }
    if (
      activeTab === "login" ||
      activeTab === "signup" ||
      activeTab === "forgot_confirm"
    ) {
      if (!password) next.password = "Password is required.";
      else if (password.length < 6)
        next.password = "Password must be at least 6 characters.";
    }
    if (activeTab === "signup") {
      if (!confirmPassword) next.confirmPassword = "Confirm your password.";
      else if (confirmPassword !== password)
        next.confirmPassword = "Passwords do not match.";
    }
    if (
      (activeTab === "2fa" || activeTab === "forgot_confirm") &&
      !otp.trim()
    ) {
      next.otp = "Enter the 6-digit code.";
    }
    setFieldError(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg("");
    setSuccessMsg("");
    if (!validate()) return;
    setLoading(true);

    try {
      if (activeTab === "login") {
        const res = await signin({ email, password });
        if (res?.data?.require2FA) {
          setPendingUserId(res.data.userId);
          setActiveTab("2fa");
          if (res.data.otp) setSuccessMsg(`[Dev Mode OTP]: ${res.data.otp}`);
        } else {
          onSuccess?.();
        }
      } else if (activeTab === "signup") {
        if (!registrationOpen) {
          setErrorMsg("New registrations are currently closed.");
          return;
        }
        await signup({ name, email, password });
        onSuccess?.();
      } else if (activeTab === "2fa") {
        await authApi.verify2FA(pendingUserId, otp);
        const profile = await authApi.getProfile();
        setUser(profile.data as any);
        onSuccess?.();
      } else if (activeTab === "forgot_request") {
        const res = await authApi.requestPasswordReset(email);
        setSuccessMsg(res.message || "If an account exists, a reset code was sent.");
        if (res.data?.otp)
          setSuccessMsg(`OTP sent! [Dev Mode OTP]: ${res.data.otp}`);
        setActiveTab("forgot_confirm");
      } else if (activeTab === "forgot_confirm") {
        const res = await authApi.resetPassword({
          email,
          otp,
          newPassword: password,
        });
        setSuccessMsg(res.message || "Password reset successful. Please sign in.");
        setActiveTab("login");
        setPassword("");
        setOtp("");
      }
    } catch (err: unknown) {
      setErrorMsg(normalizeApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setErrorMsg("");
    setSuccessMsg("");
    setFieldError({});
  };

  const title =
    activeTab === "login"
      ? "Welcome back"
      : activeTab === "signup"
        ? "Create your AlgoPath account"
        : activeTab === "2fa"
          ? "Two-factor verification"
          : activeTab === "forgot_request"
            ? "Reset password"
            : "Set new password";

  const subtitle =
    activeTab === "login"
      ? "Sign in to continue your AlgoPath journey."
      : activeTab === "signup"
        ? "Start building stronger problem-solving skills."
        : activeTab === "2fa"
          ? "Enter the 6-digit code to finish signing in."
          : activeTab === "forgot_request"
            ? "Enter your email to receive a reset code."
            : "Enter the code and choose a new password.";

  const submitLabel =
    activeTab === "login"
      ? loading
        ? "Signing in…"
        : "Sign In"
      : activeTab === "signup"
        ? loading
          ? "Creating account…"
          : "Create Account"
        : activeTab === "2fa"
          ? loading
            ? "Verifying…"
            : "Verify OTP"
          : activeTab === "forgot_request"
            ? loading
              ? "Sending…"
              : "Send Reset Code"
            : loading
              ? "Updating…"
              : "Update Password";

  if (user) {
    if (embed) return null;
    return (
      <div className="auth-shell auth-shell-solo">
        <div className="auth-card">
          <div className="auth-user-head">
            <div className="auth-user-avatar" aria-hidden>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
          </div>

          <div className="auth-user-tabs" role="tablist">
            {(
              [
                ["overview", "Overview"],
                ["sessions", `Sessions (${sessions.length})`],
                ["security", "Audit Logs"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={dashTab === id}
                className={dashTab === id ? "active" : ""}
                onClick={() => setDashTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {errorMsg ? (
            <div className="auth-alert error" role="alert">
              <AlertCircle size={15} aria-hidden />
              <span>{errorMsg}</span>
            </div>
          ) : null}
          {successMsg ? (
            <div className="auth-alert success" role="status">
              <Info size={15} aria-hidden />
              <span>{successMsg}</span>
            </div>
          ) : null}

          {dashTab === "overview" ? (
            <div className="auth-user-panel">
              <div className="auth-meta-row">
                <span>Role</span>
                <strong>{user.role || "User"}</strong>
              </div>
              <div className="auth-meta-row">
                <span>Two-factor auth</span>
                <strong>
                  {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                </strong>
              </div>
              <div className="auth-2fa-box">
                <div>
                  <h4>Two-Factor Auth</h4>
                  <p>Require an OTP code on sign in</p>
                </div>
                <Button
                  size="sm"
                  variant={user.twoFactorEnabled ? "destructive" : "primary"}
                  onClick={() => void handleToggle2FA(!user.twoFactorEnabled)}
                >
                  {user.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                </Button>
              </div>
            </div>
          ) : null}

          {dashTab === "sessions" ? (
            <div className="auth-user-panel">
              <div className="auth-session-head">
                <span>Active devices</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleLogoutAllSessions()}
                >
                  Revoke All
                </Button>
              </div>
              {loadingSessions ? (
                <p className="auth-muted">Loading sessions…</p>
              ) : sessions.length === 0 ? (
                <p className="auth-muted">No active sessions recorded.</p>
              ) : (
                <ul className="auth-session-list">
                  {sessions.map((s: any, idx: number) => (
                    <li key={s.id || idx}>
                      <span>
                        <Laptop size={14} aria-hidden />
                        {s.userAgent || "Browser Session"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleRevokeSession(s.id)}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {dashTab === "security" ? (
            <div className="auth-user-panel">
              {loadingLogs ? (
                <p className="auth-muted">Loading logs…</p>
              ) : securityLogs.length === 0 ? (
                <p className="auth-muted">No security events logged yet.</p>
              ) : (
                <ul className="auth-log-list">
                  {securityLogs.map((log: any, idx: number) => (
                    <li key={log.id || idx}>
                      <strong>{log.event}</strong>
                      <span>
                        {new Date(
                          log.timestamp || Date.now(),
                        ).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => void signout()}
          >
            <LogOut size={16} aria-hidden />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`auth-shell ${embed ? "auth-shell-embed" : ""}`}>
      <aside className="auth-brand-panel" aria-hidden={embed ? undefined : false}>
        <div className="auth-brand-panel-inner">
          <div className="auth-brand-lockup">
            <BrandMark size={36} />
            <span>
              Algo<span>Path</span>
            </span>
          </div>
          <h2>Master DSA with structured practice.</h2>
          <p>
            Solve curated sheets, track progress, and prepare for technical
            interviews in one focused workspace.
          </p>
          <ul className="auth-brand-points">
            <li>Structured DSA sheets</li>
            <li>In-browser code execution</li>
            <li>Progress across devices</li>
          </ul>
        </div>
      </aside>

      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-card-logo">
            <BrandMark size={28} />
            <span>
              Algo<span>Path</span>
            </span>
          </div>
          <h2 id="guest-auth-form-title">{title}</h2>
          <p>{subtitle}</p>
        </div>

        {errorMsg ? (
          <div className="auth-alert error" role="alert">
            <AlertCircle size={15} aria-hidden />
            <span>{errorMsg}</span>
          </div>
        ) : null}
        {successMsg ? (
          <div className="auth-alert success" role="status">
            <Info size={15} aria-hidden />
            <span>{successMsg}</span>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {activeTab === "signup" ? (
            <div className="auth-field">
              <label htmlFor="auth-name">Full name</label>
              <Input
                id="auth-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                error={Boolean(fieldError.name)}
                aria-invalid={Boolean(fieldError.name)}
                aria-describedby={fieldError.name ? "auth-name-err" : undefined}
              />
              {fieldError.name ? (
                <p id="auth-name-err" className="auth-field-error">
                  {fieldError.name}
                </p>
              ) : null}
            </div>
          ) : null}

          {(activeTab === "login" ||
            activeTab === "signup" ||
            activeTab === "forgot_request" ||
            activeTab === "forgot_confirm") && (
            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <Input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                disabled={activeTab === "forgot_confirm"}
                error={Boolean(fieldError.email)}
                aria-invalid={Boolean(fieldError.email)}
                aria-describedby={
                  fieldError.email ? "auth-email-err" : undefined
                }
              />
              {fieldError.email ? (
                <p id="auth-email-err" className="auth-field-error">
                  {fieldError.email}
                </p>
              ) : null}
            </div>
          )}

          {(activeTab === "2fa" || activeTab === "forgot_confirm") && (
            <div className="auth-field">
              <label htmlFor="auth-otp">6-digit OTP</label>
              <Input
                id="auth-otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                error={Boolean(fieldError.otp)}
                aria-invalid={Boolean(fieldError.otp)}
                aria-describedby={fieldError.otp ? "auth-otp-err" : undefined}
                className="font-technical tracking-widest"
              />
              {fieldError.otp ? (
                <p id="auth-otp-err" className="auth-field-error">
                  {fieldError.otp}
                </p>
              ) : null}
            </div>
          )}

          {(activeTab === "login" ||
            activeTab === "signup" ||
            activeTab === "forgot_confirm") && (
            <div className="auth-field">
              <div className="auth-field-label-row">
                <label htmlFor="auth-password">
                  {activeTab === "forgot_confirm" ? "New password" : "Password"}
                </label>
                {activeTab === "login" ? (
                  <button
                    type="button"
                    className="auth-text-link"
                    onClick={() => switchTab("forgot_request")}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <div className="auth-password-wrap">
                <Input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    activeTab === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  error={Boolean(fieldError.password)}
                  aria-invalid={Boolean(fieldError.password)}
                  aria-describedby={
                    fieldError.password ? "auth-password-err" : undefined
                  }
                  className="pr-10"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldError.password ? (
                <p id="auth-password-err" className="auth-field-error">
                  {fieldError.password}
                </p>
              ) : null}
            </div>
          )}

          {activeTab === "signup" ? (
            <div className="auth-field">
              <label htmlFor="auth-confirm">Confirm password</label>
              <div className="auth-password-wrap">
                <Input
                  id="auth-confirm"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  error={Boolean(fieldError.confirmPassword)}
                  aria-invalid={Boolean(fieldError.confirmPassword)}
                  aria-describedby={
                    fieldError.confirmPassword
                      ? "auth-confirm-err"
                      : undefined
                  }
                  className="pr-10"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={
                    showConfirm ? "Hide confirm password" : "Show confirm password"
                  }
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldError.confirmPassword ? (
                <p id="auth-confirm-err" className="auth-field-error">
                  {fieldError.confirmPassword}
                </p>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : null}
            {submitLabel}
          </Button>
        </form>

        <div className="auth-footer-links">
          {activeTab === "login" && registrationOpen ? (
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="auth-text-link"
                onClick={() => switchTab("signup")}
              >
                Create account
              </button>
            </p>
          ) : null}
          {activeTab === "login" && !registrationOpen ? (
            <p className="auth-muted">New registrations are currently closed.</p>
          ) : null}
          {activeTab !== "login" ? (
            <button
              type="button"
              className="auth-text-link"
              onClick={() => switchTab("login")}
            >
              Back to Sign In
            </button>
          ) : null}
        </div>

        <p className="auth-secure-note">
          <ShieldCheck size={13} aria-hidden />
          Secured authentication
        </p>
      </div>
    </div>
  );
};
