import { useCallback, useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import {
  adminSettingsApi,
  type JudgeLanguage,
  type PlatformSettings,
} from "../../../api/adminSettingsApi";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../rbac/permissions";
import { ConfirmDialog } from "../../ConfirmDialog";
import { PermissionGuard } from "../shared/PermissionGuard";
import { useToast } from "../../../context/ToastContext";
import { normalizeApiError } from "../../../lib/apiError";
import { WidgetError } from "../shared/WidgetError";

type SettingsSection =
  | "branding"
  | "languages"
  | "pagination"
  | "limits"
  | "execution"
  | "maintenance"
  | "registration"
  | "discussions"
  | "notifications"
  | "security"
  | "danger";

const LANG_OPTIONS: JudgeLanguage[] = ["cpp", "python", "javascript", "java"];

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: "branding", label: "Branding" },
  { id: "languages", label: "Languages" },
  { id: "pagination", label: "Pagination" },
  { id: "limits", label: "Submission limits" },
  { id: "execution", label: "Code execution" },
  { id: "maintenance", label: "Maintenance" },
  { id: "registration", label: "Registration" },
  { id: "discussions", label: "Discussions" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "danger", label: "Danger zone" },
];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="admin-field">
      <label>{label}</label>
      {children}
      {hint ? (
        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{hint}</span>
      ) : null}
    </div>
  );
}

export const SettingsPage: FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const canUpdate = hasPermission(user?.role, "settings:update");
  const isSuper = user?.role === "super_admin";

  const [section, setSection] = useState<SettingsSection>("branding");
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [saved, setSaved] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await adminSettingsApi.get();
      setDraft(res.data);
      setSaved(res.data);
    } catch (err: unknown) {
      const n = normalizeApiError(err);
      setLoadError({ title: n.title, message: n.message });
      toast.apiError(err, "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!draft || !saved) return false;
    return JSON.stringify(draft) !== JSON.stringify(saved);
  }, [draft, saved]);

  const patch = <K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K]
  ) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleLang = (lang: JudgeLanguage) => {
    if (!draft) return;
    const has = draft.supportedLanguages.includes(lang);
    let next = has
      ? draft.supportedLanguages.filter((l) => l !== lang)
      : [...draft.supportedLanguages, lang];
    if (!next.length) next = [lang];
    const defaultLanguage = next.includes(draft.defaultLanguage)
      ? draft.defaultLanguage
      : next[0];
    setDraft({ ...draft, supportedLanguages: next, defaultLanguage });
  };

  const save = async () => {
    if (!draft || !canUpdate) return;
    try {
      setSaving(true);
      const res = await adminSettingsApi.update(draft);
      setDraft(res.data);
      setSaved(res.data);
      toast.success("Settings saved successfully");
    } catch (err: unknown) {
      toast.apiError(err, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const confirmReset = async () => {
    try {
      setResetting(true);
      const res = await adminSettingsApi.reset();
      setDraft(res.data);
      setSaved(res.data);
      setResetOpen(false);
      toast.success("Settings reset to defaults");
    } catch (err: unknown) {
      toast.apiError(err, "Failed to reset settings");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-denied" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Loader2 size={18} className="animate-spin" /> Loading settings…
      </div>
    );
  }

  if (!draft) {
    return (
      <WidgetError
        title={loadError?.title || "Unable to load settings"}
        message={
          loadError?.message ||
          "Platform settings could not be retrieved."
        }
        onRetry={() => void load()}
      />
    );
  }

  const disabled = !canUpdate || saving;

  return (
    <PermissionGuard permission="settings:view">
      <div className="admin-settings">
        <div className="admin-page-title-bar" style={{ padding: 0 }}>
          <h1>Settings</h1>
        </div>
        <div className="admin-toolbar" style={{ marginBottom: 14 }}>
          <div>
            <p className="admin-page-lead" style={{ marginBottom: 0 }}>
              Platform configuration for AlgoPath. Sensitive fields require super_admin.
            </p>
            {saved?.updatedAt ? (
              <p style={{ margin: "4px 0 0", color: "var(--admin-muted)", fontSize: "0.75rem" }}>
                Last updated {new Date(saved.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="admin-btn"
              disabled={!dirty || saving}
              onClick={() => saved && setDraft(saved)}
            >
              Discard
            </button>
            <button
              type="button"
              className="admin-btn primary"
              disabled={!dirty || disabled}
              onClick={() => void save()}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save changes
            </button>
          </div>
        </div>

        {dirty ? (
          <p className="admin-form-banner" role="status">
            ● Unsaved changes — save before leaving this page.
          </p>
        ) : null}

        <div className="admin-settings-layout">
          <nav className="admin-settings-nav" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={section === s.id ? "active" : ""}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="admin-settings-panel">
            {section === "branding" && (
              <>
                <h3>Branding</h3>
                <Field label="Platform name">
                  <input
                    value={draft.platformName}
                    disabled={disabled}
                    onChange={(e) => patch("platformName", e.target.value)}
                  />
                </Field>
                <Field label="Tagline">
                  <input
                    value={draft.tagline}
                    disabled={disabled}
                    onChange={(e) => patch("tagline", e.target.value)}
                  />
                </Field>
                <Field label="Logo URL">
                  <input
                    value={draft.logoUrl}
                    disabled={disabled}
                    placeholder="https://…"
                    onChange={(e) => patch("logoUrl", e.target.value)}
                  />
                </Field>
                <Field label="Favicon URL">
                  <input
                    value={draft.faviconUrl}
                    disabled={disabled}
                    onChange={(e) => patch("faviconUrl", e.target.value)}
                  />
                </Field>
                <Field label="Support email">
                  <input
                    type="email"
                    value={draft.supportEmail}
                    disabled={disabled}
                    onChange={(e) => patch("supportEmail", e.target.value)}
                  />
                </Field>
              </>
            )}

            {section === "languages" && (
              <>
                <h3>Languages</h3>
                <Field label="Default language">
                  <select
                    value={draft.defaultLanguage}
                    disabled={disabled}
                    onChange={(e) =>
                      patch("defaultLanguage", e.target.value as JudgeLanguage)
                    }
                  >
                    {draft.supportedLanguages.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Supported languages" hint="At least one must stay enabled.">
                  <div className="admin-chip-row">
                    {LANG_OPTIONS.map((l) => {
                      const on = draft.supportedLanguages.includes(l);
                      return (
                        <button
                          key={l}
                          type="button"
                          className={`admin-chip ${on ? "on" : ""}`}
                          disabled={disabled}
                          onClick={() => toggleLang(l)}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </>
            )}

            {section === "pagination" && (
              <>
                <h3>Pagination & UX</h3>
                <Field label="Default page size">
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={draft.defaultPageSize}
                    disabled={disabled}
                    onChange={(e) => patch("defaultPageSize", Number(e.target.value))}
                  />
                </Field>
                <Field label="Max page size">
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={draft.maxPageSize}
                    disabled={disabled}
                    onChange={(e) => patch("maxPageSize", Number(e.target.value))}
                  />
                </Field>
              </>
            )}

            {section === "limits" && (
              <>
                <h3>Submission limits</h3>
                {!isSuper && (
                  <p className="admin-settings-note">
                    Super_admin only — you can view these values.
                  </p>
                )}
                <Field label="Max submissions / hour">
                  <input
                    type="number"
                    value={draft.maxSubmissionsPerHour}
                    disabled={disabled || !isSuper}
                    onChange={(e) =>
                      patch("maxSubmissionsPerHour", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Max runs / hour">
                  <input
                    type="number"
                    value={draft.maxRunPerHour}
                    disabled={disabled || !isSuper}
                    onChange={(e) => patch("maxRunPerHour", Number(e.target.value))}
                  />
                </Field>
                <Field label="Max code length (chars)">
                  <input
                    type="number"
                    value={draft.maxCodeLength}
                    disabled={disabled || !isSuper}
                    onChange={(e) => patch("maxCodeLength", Number(e.target.value))}
                  />
                </Field>
                <Field label="Concurrent submission cap">
                  <input
                    type="number"
                    value={draft.concurrentSubmissionCap}
                    disabled={disabled || !isSuper}
                    onChange={(e) =>
                      patch("concurrentSubmissionCap", Number(e.target.value))
                    }
                  />
                </Field>
              </>
            )}

            {section === "execution" && (
              <>
                <h3>Code execution</h3>
                {!isSuper && (
                  <p className="admin-settings-note">
                    Soft ops config. Judge workers still use service env limits.
                  </p>
                )}
                <Field label="Default timeout (ms)">
                  <input
                    type="number"
                    value={draft.defaultTimeoutMs}
                    disabled={disabled || !isSuper}
                    onChange={(e) =>
                      patch("defaultTimeoutMs", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Default memory (MB)">
                  <input
                    type="number"
                    value={draft.defaultMemoryMb}
                    disabled={disabled || !isSuper}
                    onChange={(e) =>
                      patch("defaultMemoryMb", Number(e.target.value))
                    }
                  />
                </Field>
              </>
            )}

            {section === "maintenance" && (
              <>
                <h3>Maintenance</h3>
                {!isSuper && (
                  <p className="admin-settings-note">Super_admin only to toggle.</p>
                )}
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.maintenanceMode}
                    disabled={disabled || !isSuper}
                    onChange={(e) => patch("maintenanceMode", e.target.checked)}
                  />
                  Maintenance mode
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.allowAdminBypass}
                    disabled={disabled || !isSuper}
                    onChange={(e) => patch("allowAdminBypass", e.target.checked)}
                  />
                  Allow staff to bypass maintenance
                </label>
                <Field label="Maintenance message">
                  <textarea
                    value={draft.maintenanceMessage}
                    disabled={disabled || !isSuper}
                    onChange={(e) => patch("maintenanceMessage", e.target.value)}
                  />
                </Field>
              </>
            )}

            {section === "registration" && (
              <>
                <h3>Registration</h3>
                {!isSuper && (
                  <p className="admin-settings-note">Super_admin only to toggle.</p>
                )}
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.registrationEnabled}
                    disabled={disabled || !isSuper}
                    onChange={(e) =>
                      patch("registrationEnabled", e.target.checked)
                    }
                  />
                  Registration enabled
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.requireEmailVerification}
                    disabled={disabled || !isSuper}
                    onChange={(e) =>
                      patch("requireEmailVerification", e.target.checked)
                    }
                  />
                  Require email verification
                </label>
              </>
            )}

            {section === "discussions" && (
              <>
                <h3>Discussions</h3>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.discussionsEnabled}
                    disabled={disabled}
                    onChange={(e) =>
                      patch("discussionsEnabled", e.target.checked)
                    }
                  />
                  Discussions enabled
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.requireAuthToPost}
                    disabled={disabled}
                    onChange={(e) =>
                      patch("requireAuthToPost", e.target.checked)
                    }
                  />
                  Require auth to post
                </label>
              </>
            )}

            {section === "notifications" && (
              <>
                <h3>Notifications</h3>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.emailNotificationsEnabled}
                    disabled={disabled}
                    onChange={(e) =>
                      patch("emailNotificationsEnabled", e.target.checked)
                    }
                  />
                  Email notifications enabled
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.announceNewSheets}
                    disabled={disabled}
                    onChange={(e) =>
                      patch("announceNewSheets", e.target.checked)
                    }
                  />
                  Announce new sheets
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.announceMaintenance}
                    disabled={disabled}
                    onChange={(e) =>
                      patch("announceMaintenance", e.target.checked)
                    }
                  />
                  Announce maintenance
                </label>
              </>
            )}

            {section === "security" && (
              <>
                <h3>Security</h3>
                <p className="admin-settings-note">
                  Auth tokens and secrets are never shown here. Role changes and
                  destructive actions are enforced by the Auth service and audited.
                </p>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.requireEmailVerification}
                    disabled={disabled || !isSuper}
                    onChange={(e) =>
                      patch("requireEmailVerification", e.target.checked)
                    }
                  />
                  Require email verification
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.registrationEnabled}
                    disabled={disabled || !isSuper}
                    onChange={(e) =>
                      patch("registrationEnabled", e.target.checked)
                    }
                  />
                  Public registration enabled
                </label>
                <p className="admin-settings-note">
                  Review staff actions in Audit Logs. JWT / API keys cannot be
                  exported from this panel.
                </p>
              </>
            )}

            {section === "danger" && (
              <>
                <h3>Danger zone</h3>
                <p className="admin-settings-note">
                  Reset restores factory defaults. This is audited and cannot be
                  undone except by re-saving.
                </p>
                <button
                  type="button"
                  className="admin-btn danger"
                  disabled={!isSuper || saving || resetting}
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw size={14} /> Reset to defaults
                </button>
              </>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={resetOpen}
          title="Reset platform settings?"
          description="All branding, limits, and feature flags will return to AlgoPath defaults."
          warning="This action is audited and requires super_admin."
          confirmLabel="Reset settings"
          confirmVariant="danger"
          confirming={resetting}
          confirmingLabel="Resetting…"
          onCancel={() => !resetting && setResetOpen(false)}
          onConfirm={() => void confirmReset()}
        />
      </div>
    </PermissionGuard>
  );
};
