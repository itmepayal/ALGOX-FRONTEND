import { useState, useEffect, type FC, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { usePlatformSettings } from "../context/PlatformSettingsContext";
import { authApi } from "../api/authApi";
import { BrandMark } from "./BrandLogo";
import {
  CheckCircle2,
  AlertCircle,
  Laptop,
  LogOut,
  Info,
  Mail,
  Lock,
  User as UserIcon,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

type AuthTab = "login" | "signup" | "2fa" | "forgot_request" | "forgot_confirm";

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
    initialTab === "signup" && registrationOpen ? "signup" : initialTab === "signup" ? "login" : initialTab
  );  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [dashTab, setDashTab] = useState<"overview" | "sessions" | "security">("overview");
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
      fetchUserSessions();
      fetchSecurityLogs();
    }
  }, [user]);

  const fetchUserSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await authApi.getActiveSessions();
      if (res.data) setSessions(res.data as any[]);
    } catch {
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
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleToggle2FA = async (enable: boolean) => {
    try {
      setErrorMsg("");
      const res = await authApi.toggle2FA(enable);
      setSuccessMsg(res.message || `2FA ${enable ? "Enabled" : "Disabled"} successfully`);
      if (user) {
        setUser({ ...user, twoFactorEnabled: enable });
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to update 2FA settings");
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await authApi.revokeSession(sessionId);
      fetchUserSessions();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to revoke session");
    }
  };

  const handleLogoutAllSessions = async () => {
    try {
      await authApi.logoutAllSessions();
      signout();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to logout all sessions");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
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
        setSuccessMsg(res.message || "OTP sent to your email!");
        if (res.data?.otp) setSuccessMsg(`OTP sent! [Dev Mode OTP]: ${res.data.otp}`);
        setActiveTab("forgot_confirm");
      } else if (activeTab === "forgot_confirm") {
        const res = await authApi.resetPassword({ email, otp, newPassword: password });
        setSuccessMsg(res.message || "Password reset successful! Please Sign In.");
        setActiveTab("login");
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Authentication request failed.");
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    if (embed) return null;
    return (
      <div className="auth-card-responsive animate-fade-in" style={{ maxWidth: "580px", width: "100%", margin: "20px auto", padding: "32px 28px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "20px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)", fontFamily: "var(--font-primary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "14px", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(34, 197, 94, 0.15) 100%)", border: "1px solid rgba(99, 102, 241, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)" }}>{user.name}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontFamily: "var(--font-technical)" }}>{user.email}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", padding: "4px", backgroundColor: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
          <button onClick={() => setDashTab("overview")} style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "none", backgroundColor: dashTab === "overview" ? "var(--primary)" : "transparent", color: dashTab === "overview" ? "var(--text-main)" : "var(--text-secondary)", fontSize: "0.825rem", fontWeight: 600, cursor: "pointer" }}>Overview</button>
          <button onClick={() => setDashTab("sessions")} style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "none", backgroundColor: dashTab === "sessions" ? "var(--primary)" : "transparent", color: dashTab === "sessions" ? "var(--text-main)" : "var(--text-secondary)", fontSize: "0.825rem", fontWeight: 600, cursor: "pointer" }}>Sessions ({sessions.length})</button>
          <button onClick={() => setDashTab("security")} style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "none", backgroundColor: dashTab === "security" ? "var(--primary)" : "transparent", color: dashTab === "security" ? "var(--text-main)" : "var(--text-secondary)", fontSize: "0.825rem", fontWeight: 600, cursor: "pointer" }}>Audit Logs</button>
        </div>

        {errorMsg && <div style={{ padding: "10px 14px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "var(--error)", fontSize: "0.825rem", marginBottom: "16px" }}>{errorMsg}</div>}
        {successMsg && <div style={{ padding: "10px 14px", backgroundColor: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "8px", color: "var(--success)", fontSize: "0.825rem", marginBottom: "16px" }}>{successMsg}</div>}

        {dashTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ padding: "14px 16px", backgroundColor: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border-subtle)", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "var(--text-secondary)" }}>User Role</span>
                <span style={{ color: "var(--text-main)", fontWeight: 600, textTransform: "capitalize" }}>{user.role || "Developer"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Two-Factor Security (2FA)</span>
                <span style={{ color: user.twoFactorEnabled ? "var(--success)" : "var(--warning)", fontWeight: 600 }}>{user.twoFactorEnabled ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
            <div style={{ padding: "14px 16px", backgroundColor: "rgba(99, 102, 241, 0.06)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-main)" }}>Two-Factor Auth</h4>
                <p style={{ fontSize: "0.775rem", color: "var(--text-secondary)" }}>Require OTP code on sign in</p>
              </div>
              <button onClick={() => handleToggle2FA(!user.twoFactorEnabled)} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", backgroundColor: user.twoFactorEnabled ? "var(--error)" : "var(--primary)", color: "var(--text-main)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>{user.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}</button>
            </div>
          </div>
        )}

        {dashTab === "sessions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Active Login Devices</span>
              <button onClick={handleLogoutAllSessions} style={{ padding: "4px 10px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--error)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>Revoke All</button>
            </div>
            {loadingSessions ? <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Loading sessions...</p> : sessions.length === 0 ? <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>No active sessions recorded.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                {sessions.map((s: any, idx: number) => (
                  <div key={s.id || idx} style={{ padding: "10px 12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                    <div>
                      <div style={{ color: "var(--text-main)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}><Laptop size={14} color="var(--primary-hover)" /><span>{s.userAgent || "Browser Session"}</span></div>
                    </div>
                    <button onClick={() => handleRevokeSession(s.id)} style={{ padding: "4px 8px", backgroundColor: "transparent", color: "var(--error)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer" }}>Revoke</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {dashTab === "security" && (
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "12px" }}>Recent Security Activities</span>
            {loadingLogs ? <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Loading logs...</p> : securityLogs.length === 0 ? <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>No security events logged yet.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
                {securityLogs.map((log: any, idx: number) => (
                  <div key={log.id || idx} style={{ padding: "8px 10px", backgroundColor: "var(--bg-secondary)", borderRadius: "6px", fontSize: "0.775rem", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--primary-hover)", fontWeight: 600 }}>{log.event}</span>
                    <span style={{ color: "var(--text-muted)" }}>{new Date(log.timestamp || Date.now()).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={signout} style={{ width: "100%", padding: "11px", backgroundColor: "transparent", color: "var(--error)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="auth-card-responsive animate-fade-in"
      style={{
        maxWidth: "440px",
        width: "100%",
        margin: "0 auto",
        padding: "28px 28px 24px 28px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.1)",
        fontFamily: "var(--font-primary)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(17, 24, 39, 0.95) 100%)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            boxShadow: "0 4px 14px rgba(99, 102, 241, 0.2)",
            marginBottom: "12px",
          }}
        >
          <BrandMark size={24} />
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
            Algo<span style={{ color: "var(--primary)" }}>Path</span>
          </span>
        </div>

        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.015em" }}>
          {activeTab === "login" && "Sign In to Your Workspace"}
          {activeTab === "signup" && "Create AlgoPath Account"}
          {activeTab === "2fa" && "Two-Factor Verification"}
          {activeTab === "forgot_request" && "Reset Password"}
          {activeTab === "forgot_confirm" && "Set New Password"}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "4px", lineHeight: "1.4" }}>
          {activeTab === "login" && "Enter your credentials to access your algorithm environment"}
          {activeTab === "signup" && "Join thousands of developers mastering algorithms & system design"}
          {activeTab === "2fa" && "Enter the 6-digit OTP code to complete sign in"}
          {activeTab === "forgot_request" && "Enter your email to receive a password reset OTP"}
          {activeTab === "forgot_confirm" && "Enter OTP code and your new password"}
        </p>
      </div>

      {errorMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "var(--error)", fontSize: "0.8rem", marginBottom: "14px" }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", backgroundColor: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "8px", color: "var(--success)", fontSize: "0.8rem", marginBottom: "14px" }}>
          <Info size={15} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {activeTab === "signup" && (
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Full Name
            </label>
            <div style={{ position: "relative" }}>
              <UserIcon size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Payal Yadav"
                required
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "0.875rem",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.boxShadow = "0 0 0 2px var(--primary-glow)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-subtle)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
        )}

        {(activeTab === "login" || activeTab === "signup" || activeTab === "forgot_request" || activeTab === "forgot_confirm") && (
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                required
                disabled={activeTab === "forgot_confirm"}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "0.875rem",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.boxShadow = "0 0 0 2px var(--primary-glow)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-subtle)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
        )}

        {(activeTab === "2fa" || activeTab === "forgot_confirm") && (
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              6-Digit OTP Code
            </label>
            <div style={{ position: "relative" }}>
              <KeyRound size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                required
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "0.9rem",
                  letterSpacing: "0.15em",
                  fontFamily: "var(--font-technical)",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.boxShadow = "0 0 0 2px var(--primary-glow)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-subtle)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
        )}

        {/* Password */}
        {(activeTab === "login" || activeTab === "signup" || activeTab === "forgot_confirm") && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {activeTab === "forgot_confirm" ? "New Password" : "Password"}
              </label>
              {activeTab === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg("");
                    setSuccessMsg("");
                    setActiveTab("forgot_request");
                  }}
                  style={{ background: "none", border: "none", padding: 0, fontSize: "0.75rem", color: "var(--primary-hover)", cursor: "pointer", fontWeight: 500 }}
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "0.875rem",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.boxShadow = "0 0 0 2px var(--primary-glow)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-subtle)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "4px",
            width: "100%",
            padding: "10px 16px",
            backgroundColor: "var(--primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.35)",
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget.style.backgroundColor = "var(--primary-hover)");
          }}
          onMouseLeave={(e) => {
            if (!loading) (e.currentTarget.style.backgroundColor = "var(--primary)");
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = "2px solid var(--primary-bright)";
            e.currentTarget.style.outlineOffset = "2px";
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = "none";
          }}
        >
          {loading ? (
            "Processing..."
          ) : (
            <span>
              {activeTab === "login" && "Sign In"}
              {activeTab === "signup" && "Create Account"}
              {activeTab === "2fa" && "Verify OTP"}
              {activeTab === "forgot_request" && "Send Reset Code"}
              {activeTab === "forgot_confirm" && "Update Password"}
            </span>
          )}
        </button>
      </form>

      <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)", textAlign: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
        {activeTab === "login" && registrationOpen && (
          <>
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setActiveTab("signup");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              style={{ background: "none", border: "none", padding: 0, color: "var(--primary-hover)", fontWeight: 600, cursor: "pointer", marginLeft: "4px", fontSize: "0.8rem" }}
            >
              Sign Up now
            </button>
          </>
        )}
        {activeTab === "login" && !registrationOpen && (
          <span style={{ color: "var(--text-muted)" }}>
            New registrations are currently closed.
          </span>
        )}
        {activeTab !== "login" && (
          <button
            type="button"
            onClick={() => {
              setActiveTab("login");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            style={{ background: "none", border: "none", padding: 0, color: "var(--primary-hover)", fontWeight: 600, cursor: "pointer", fontSize: "0.8rem" }}
          >
            ← Back to Sign In
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "14px", color: "var(--text-muted)", fontSize: "0.725rem", fontFamily: "var(--font-primary)" }}>
        <ShieldCheck size={13} color="var(--primary)" />
        <span>Protected by AlgoPath Security & 256-bit JWT Encryption</span>
      </div>
    </div>
  );
};
