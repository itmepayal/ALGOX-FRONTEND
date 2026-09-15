import { useState, type FC, type FormEvent } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  Eye,
  EyeOff,
  UserPlus,
  Copy,
  Check,
} from "lucide-react";
import { adminAuthApi } from "../../../api/adminAuthApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import "../problems/problem-editor.css";
import "./user-create.css";

interface Props {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

const ROLES: Array<{ value: string; label: string }> = [
  { value: "user", label: "User" },
  { value: "moderator", label: "Moderator" },
  { value: "content_manager", label: "Content Manager" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

const STATUSES: Array<{ value: string; label: string }> = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
];

export const UserCreatePage: FC<Props> = ({ onCreated, onCancel }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("user");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tempPassword, setTempPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (password && password.length < 8) {
      next.password = "Password must be at least 8 characters";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const clearFieldError = (key: string) => {
    if (!fieldErrors[key]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSaving(true);
      setError("");
      const res = await adminAuthApi.createUser({
        name,
        email,
        password: password || undefined,
        role,
        status,
      });
      if (res.data.temporaryPassword) {
        setTempPassword(res.data.temporaryPassword);
      }
      const id = res.data.user?.id;
      if (id && !res.data.temporaryPassword) onCreated(id);
      else if (id) {
        // Keep page open so admin can copy temp password
        setTimeout(() => onCreated(id), 2500);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyTempPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <PermissionGuard
      permission="users:create"
      fallback={<div className="admin-denied">No create-user permission.</div>}
    >
      <div className="pe-page uc-page">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <button type="button" className="admin-btn" onClick={onCancel}>
              <ArrowLeft size={14} strokeWidth={1.75} /> Back
            </button>
            <div>
              <h2 className="pe-title">Create User</h2>
              <p className="pe-sub">
                Provision a platform account. Temporary passwords are shown once
                only.
              </p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            {saving ? <span className="pe-save-hint">Creating…</span> : null}
            <button
              type="button"
              className="admin-btn"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="uc-form"
              className="admin-btn primary"
              disabled={saving}
            >
              <UserPlus size={14} strokeWidth={1.75} />
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="admin-form-banner" role="alert">
            <AlertTriangle size={16} aria-hidden />
            <div>
              <strong>Unable to create user</strong>
              <div>{error}</div>
            </div>
          </div>
        ) : null}

        {tempPassword ? (
          <div className="uc-temp-banner" role="status">
            <div>
              <strong>Temporary password (copy now)</strong>
              <code className="uc-temp-code">{tempPassword}</code>
            </div>
            <button
              type="button"
              className="admin-btn"
              onClick={() => void copyTempPassword()}
            >
              {copied ? (
                <Check size={14} strokeWidth={1.75} />
              ) : (
                <Copy size={14} strokeWidth={1.75} />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}

        <form id="uc-form" className="uc-layout" onSubmit={submit} noValidate>
          <section className="pe-card uc-card">
            <div className="pe-card-head">
              <h3>User Information</h3>
              <p>Identity and sign-in credentials</p>
            </div>
            <div className="uc-fields">
              <div
                className={`admin-field ${fieldErrors.name ? "has-error" : ""}`}
              >
                <label htmlFor="cu-name">Display name</label>
                <input
                  id="cu-name"
                  required
                  value={name}
                  placeholder="e.g. Ada Lovelace"
                  autoComplete="name"
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                />
                {fieldErrors.name ? (
                  <span className="admin-field-error">
                    ⚠ {fieldErrors.name}
                  </span>
                ) : null}
              </div>

              <div
                className={`admin-field ${fieldErrors.email ? "has-error" : ""}`}
              >
                <label htmlFor="cu-email">Login and notification email</label>
                <input
                  id="cu-email"
                  type="email"
                  required
                  value={email}
                  placeholder="user@example.com"
                  autoComplete="email"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                />
                {fieldErrors.email ? (
                  <span className="admin-field-error">
                    ⚠ {fieldErrors.email}
                  </span>
                ) : null}
              </div>

              <div
                className={`admin-field ${
                  fieldErrors.password ? "has-error" : ""
                }`}
              >
                <label htmlFor="cu-pass">Password</label>
                <div className="uc-password">
                  <input
                    id="cu-pass"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    value={password}
                    placeholder="Leave empty to auto-generate"
                    autoComplete="new-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError("password");
                    }}
                  />
                  <button
                    type="button"
                    className="uc-password-toggle"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOff size={16} strokeWidth={1.75} />
                    ) : (
                      <Eye size={16} strokeWidth={1.75} />
                    )}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <span className="admin-field-error">
                    ⚠ {fieldErrors.password}
                  </span>
                ) : (
                  <span className="pe-field-hint">
                    Optional. Auto-generated when empty.
                  </span>
                )}
              </div>
            </div>
          </section>

          <aside className="pe-card uc-card uc-side">
            <div className="pe-card-head">
              <h3>Access & Account</h3>
              <p>Role permissions and account availability</p>
            </div>
            <div className="uc-access-grid">
              <div className="admin-field">
                <label htmlFor="cu-role">Role</label>
                <select
                  id="cu-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <label htmlFor="cu-status">Status</label>
                <select
                  id="cu-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="pe-field-hint uc-access-hint">
              Active accounts can sign in immediately.
            </p>
          </aside>
        </form>
      </div>
    </PermissionGuard>
  );
};
