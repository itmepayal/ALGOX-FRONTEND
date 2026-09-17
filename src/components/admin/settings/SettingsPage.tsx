import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  Code2,
  Flag,
  Gauge,
  ListOrdered,
  Loader2,
  Lock,
  MessageSquare,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Terminal,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  adminSettingsApi,
  DEFAULT_FEATURE_FLAGS,
  type JudgeLanguage,
  type PlatformSettings,
} from "../../../api/adminSettingsApi";
import { usePermission } from "../../../rbac/usePermission";
import { ConfirmDialog } from "../../ConfirmDialog";
import { PermissionGuard } from "../shared/PermissionGuard";
import { useToast } from "../../../context/ToastContext";
import { normalizeApiError } from "../../../lib/apiError";
import { WidgetError } from "../shared/WidgetError";
import { Button } from "../../ui/button";
import { cn } from "../../../lib/cn";
import "./settings-page.css";

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
  | "feature-flags"
  | "security"
  | "danger";

const LANG_OPTIONS: JudgeLanguage[] = ["cpp", "python", "javascript", "java"];

const LANG_LABELS: Record<JudgeLanguage, string> = {
  cpp: "C++",
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
};

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: ReactNode;
  danger?: boolean;
  panelDesc: string;
}> = [
  {
    id: "branding",
    label: "Branding",
    description: "Platform identity",
    panelDesc: "Configure AlgoPath's public identity and platform presentation.",
    icon: <Palette size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "languages",
    label: "Languages",
    description: "Judge languages",
    panelDesc: "Choose the default and supported programming languages.",
    icon: <Code2 size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "pagination",
    label: "Pagination",
    description: "List page sizes",
    panelDesc: "Control default and maximum page sizes across admin lists.",
    icon: <ListOrdered size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "limits",
    label: "Submission Limits",
    description: "Rate & size caps",
    panelDesc: "Configure submission quotas and payload limits.",
    icon: <Gauge size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "execution",
    label: "Code Execution",
    description: "Timeouts & memory",
    panelDesc: "Soft ops defaults for code execution behavior.",
    icon: <Terminal size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Access restriction",
    panelDesc: "Temporarily restrict platform access during maintenance.",
    icon: <Wrench size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "registration",
    label: "Registration",
    description: "Account creation",
    panelDesc: "Control public registration and verification requirements.",
    icon: <UserPlus size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "discussions",
    label: "Discussions",
    description: "Community posts",
    panelDesc: "Manage discussion availability and posting rules.",
    icon: (
      <MessageSquare size={15} strokeWidth={2} className="size-[15px]" aria-hidden />
    ),
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Announcements",
    panelDesc: "Configure platform notification and announcement behavior.",
    icon: <Bell size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "feature-flags",
    label: "Feature Flags",
    description: "Product toggles",
    panelDesc: "Enable or disable product capabilities. Changes are audited.",
    icon: <Flag size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "security",
    label: "Security",
    description: "Access policies",
    panelDesc: "Authentication and registration security controls.",
    icon: <Shield size={15} strokeWidth={2} className="size-[15px]" aria-hidden />,
  },
  {
    id: "danger",
    label: "Danger Zone",
    description: "Irreversible actions",
    panelDesc: "Actions that can significantly impact the platform.",
    icon: (
      <AlertTriangle size={15} strokeWidth={2} className="size-[15px]" aria-hidden />
    ),
    danger: true,
  },
];

function formatUpdatedAt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const Toggle: FC<{
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}> = ({ checked, disabled, onChange, label }) => (
  <button
    type="button"
    className="sp-switch"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  >
    <span className="sp-switch-knob" aria-hidden />
  </button>
);

const SettingRow: FC<{
  label: string;
  hint?: string;
  stack?: boolean;
  control: ReactNode;
}> = ({ label, hint, stack, control }) => (
  <div className={cn("sp-row", stack && "stack")}>
    <div>
      <p className="sp-row-label">{label}</p>
      {hint ? <p className="sp-row-hint">{hint}</p> : null}
    </div>
    <div className="sp-row-control">{control}</div>
  </div>
);

const SettingCard: FC<{
  title: string;
  description?: string;
  danger?: boolean;
  lockNote?: boolean;
  children: ReactNode;
}> = ({ title, description, danger, lockNote, children }) => (
  <section className={cn("sp-card", danger && "danger")}>
    <div className="sp-card-head">
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {lockNote ? (
        <p className="sp-lock">
          <Lock size={12} strokeWidth={2} className="size-3" aria-hidden />
          Only super_admin users can modify this configuration.
        </p>
      ) : null}
    </div>
    {children}
  </section>
);

export const SettingsPage: FC = () => {
  const { can, role } = usePermission();
  const toast = useToast();
  const canUpdate = can("settings:update");
  const isSuper = role === "super_admin";

  const [section, setSection] = useState<SettingsSection>("branding");
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [saved, setSaved] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loadError, setLoadError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await adminSettingsApi.get();
      setDraft(res.data);
      setSaved(res.data);
      setFieldErrors({});
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

  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(false), 2500);
    return () => window.clearTimeout(t);
  }, [justSaved]);

  const dirty = useMemo(() => {
    if (!draft || !saved) return false;
    return JSON.stringify(draft) !== JSON.stringify(saved);
  }, [draft, saved]);

  const patch = <K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K],
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: PlatformSettings = { ...prev, [key]: value };
      // Keep overlapping legacy toggles ↔ featureFlags in sync in the draft
      if (key === "maintenanceMode") {
        next.featureFlags = {
          ...(prev.featureFlags || DEFAULT_FEATURE_FLAGS),
          maintenance: Boolean(value),
        };
      } else if (key === "registrationEnabled") {
        next.featureFlags = {
          ...(prev.featureFlags || DEFAULT_FEATURE_FLAGS),
          registration: Boolean(value),
        };
      } else if (key === "discussionsEnabled") {
        next.featureFlags = {
          ...(prev.featureFlags || DEFAULT_FEATURE_FLAGS),
          discussions: Boolean(value),
        };
      } else if (key === "featureFlags" && value && typeof value === "object") {
        const ff = value as PlatformSettings["featureFlags"];
        if (ff) {
          if (typeof ff.maintenance === "boolean") {
            next.maintenanceMode = ff.maintenance;
          }
          if (typeof ff.registration === "boolean") {
            next.registrationEnabled = ff.registration;
          }
          if (typeof ff.discussions === "boolean") {
            next.discussionsEnabled = ff.discussions;
          }
        }
      }
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
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

  const validate = (data: PlatformSettings): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!data.platformName.trim()) {
      errors.platformName = "This field is required.";
    }
    if (data.defaultPageSize < 5 || data.defaultPageSize > 100) {
      errors.defaultPageSize = "Value must be within the allowed range (5–100).";
    }
    if (data.maxPageSize < 10 || data.maxPageSize > 500) {
      errors.maxPageSize = "Value must be within the allowed range (10–500).";
    }
    if (data.defaultPageSize > data.maxPageSize) {
      errors.defaultPageSize = "Default page size cannot exceed max page size.";
    }
    if (data.logoUrl && !/^https?:\/\//i.test(data.logoUrl) && data.logoUrl.trim()) {
      errors.logoUrl = "Enter a valid URL.";
    }
    if (
      data.faviconUrl &&
      !/^https?:\/\//i.test(data.faviconUrl) &&
      data.faviconUrl.trim()
    ) {
      errors.faviconUrl = "Enter a valid URL.";
    }
    return errors;
  };

  const save = async () => {
    if (!draft || !saved || !canUpdate) return;
    const errors = validate(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.warning("Fix validation errors before saving");
      return;
    }
    try {
      setSaving(true);
      // Dirty-field patch only — avoids overwriting unrelated flags/legacy toggles
      const patchBody: Partial<PlatformSettings> = {};
      (Object.keys(draft) as Array<keyof PlatformSettings>).forEach((key) => {
        if (JSON.stringify(draft[key]) !== JSON.stringify(saved[key])) {
          (patchBody as any)[key] = draft[key];
        }
      });
      const res = await adminSettingsApi.update(patchBody);
      setDraft(res.data);
      setSaved(res.data);
      setJustSaved(true);
      toast.success("Settings saved successfully");
    } catch (err: unknown) {
      toast.apiError(err, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!saved) return;
    setDraft(saved);
    setFieldErrors({});
  };

  const confirmReset = async () => {
    try {
      setResetting(true);
      const res = await adminSettingsApi.reset();
      setDraft(res.data);
      setSaved(res.data);
      setResetOpen(false);
      setFieldErrors({});
      toast.success("Settings reset to defaults");
    } catch (err: unknown) {
      toast.apiError(err, "Failed to reset settings");
    } finally {
      setResetting(false);
    }
  };

  const active = SECTIONS.find((s) => s.id === section) || SECTIONS[0]!;
  const disabled = !canUpdate || saving;
  const superLocked = disabled || !isSuper;

  if (loading) {
    return (
      <PermissionGuard permission="settings:view">
        <div className="sp-page" aria-busy>
          <div className="sp-header">
            <div style={{ flex: 1 }}>
              <div className="sp-skel" style={{ height: 28, width: 160 }} />
              <div
                className="sp-skel"
                style={{ height: 14, width: "55%", marginTop: 10 }}
              />
            </div>
          </div>
          <div className="sp-layout">
            <div className="sp-nav" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="sp-skel"
                  style={{ height: 36, margin: 4 }}
                />
              ))}
            </div>
            <div className="sp-panel">
              <div className="sp-card">
                <div className="sp-skel" style={{ height: 18, width: "40%" }} />
                <div className="sp-skel" style={{ height: 12, width: "70%" }} />
                <div className="sp-skel" style={{ height: 36, marginTop: 8 }} />
                <div className="sp-skel" style={{ height: 36 }} />
              </div>
            </div>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  if (!draft) {
    return (
      <PermissionGuard permission="settings:view">
        <WidgetError
          title={loadError?.title || "Unable to load settings"}
          message={
            loadError?.message ||
            "The platform configuration could not be retrieved from the server."
          }
          onRetry={() => void load()}
        />
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="settings:view">
      <div className="sp-page">
        <header className="sp-header">
          <div>
            <h2>Settings</h2>
            <p className="sp-header-sub">
              Configure AlgoPath platform behavior, services, and administrative
              controls.
            </p>
            <div className="sp-pills">
              <span className="sp-pill">Platform configuration</span>
              <span className="sp-pill">Sensitive settings require super admin</span>
            </div>
            <div className="sp-meta">
              <span>
                Last updated · {formatUpdatedAt(saved?.updatedAt)}
              </span>
              <button
                type="button"
                className="sp-meta-refresh"
                onClick={() => void load()}
                disabled={saving || loading}
                aria-label="Refresh settings"
                title="Refresh"
              >
                <RefreshCw size={12} strokeWidth={2} className="size-3" aria-hidden />
              </button>
              {justSaved ? (
                <span className="sp-saved-flash">
                  <Check size={14} strokeWidth={2.5} className="size-3.5" aria-hidden />
                  Changes saved
                </span>
              ) : null}
            </div>
          </div>
          <div className="sp-header-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!dirty || saving}
              onClick={discard}
            >
              Discard changes
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!dirty || disabled}
              onClick={() => void save()}
            >
              {saving ? (
                <Loader2
                  size={14}
                  strokeWidth={2}
                  className="size-3.5 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <Save
                  size={14}
                  strokeWidth={2}
                  className="size-3.5 shrink-0"
                  aria-hidden
                />
              )}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </header>

        {dirty ? (
          <div className="sp-dirty-bar" role="status">
            <div>
              <strong>Unsaved changes</strong>
              <p>Your configuration has not been saved.</p>
            </div>
            <div className="sp-dirty-actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={discard}
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={disabled}
                onClick={() => void save()}
              >
                {saving ? (
                  <Loader2
                    size={14}
                    strokeWidth={2}
                    className="size-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <Save
                    size={14}
                    strokeWidth={2}
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                )}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="sp-layout">
          <nav className="sp-nav" aria-label="Settings sections">
            <div className="sp-nav-label">Settings</div>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={cn(
                  "sp-nav-btn",
                  section === s.id && "active",
                  s.danger && "danger",
                )}
                onClick={() => setSection(s.id)}
                aria-current={section === s.id ? "page" : undefined}
              >
                <span className="sp-nav-icon">{s.icon}</span>
                <span className="sp-nav-copy">
                  <span className="sp-nav-title">{s.label}</span>
                  <span className="sp-nav-desc">{s.description}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="sp-panel">
            <select
              className="sp-nav-mobile"
              value={section}
              onChange={(e) => setSection(e.target.value as SettingsSection)}
              aria-label="Settings section"
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="sp-panel-head">
              <h3>{active.label}</h3>
              <p>{active.panelDesc}</p>
            </div>

            {section === "branding" && (
              <>
                <SettingCard
                  title="Platform Identity"
                  description="The name and presentation shown throughout AlgoPath."
                >
                  <SettingRow
                    label="Platform name"
                    hint={
                      fieldErrors.platformName ||
                      "The name displayed throughout AlgoPath."
                    }
                    stack
                    control={
                      <input
                        className="sp-input"
                        value={draft.platformName}
                        disabled={disabled}
                        onChange={(e) => patch("platformName", e.target.value)}
                        aria-invalid={Boolean(fieldErrors.platformName)}
                      />
                    }
                  />
                  <SettingRow
                    label="Tagline"
                    hint="Short supporting line for public surfaces."
                    stack
                    control={
                      <input
                        className="sp-input"
                        value={draft.tagline}
                        disabled={disabled}
                        onChange={(e) => patch("tagline", e.target.value)}
                      />
                    }
                  />
                  <SettingRow
                    label="Support email"
                    hint="Contact address for user support."
                    stack
                    control={
                      <input
                        className="sp-input"
                        type="email"
                        value={draft.supportEmail}
                        disabled={disabled}
                        onChange={(e) => patch("supportEmail", e.target.value)}
                      />
                    }
                  />
                </SettingCard>
                <SettingCard
                  title="Brand Assets"
                  description="Optional logo and favicon URLs."
                >
                  <SettingRow
                    label="Logo URL"
                    hint={fieldErrors.logoUrl || "HTTPS URL to the platform logo."}
                    stack
                    control={
                      <input
                        className="sp-input mono"
                        value={draft.logoUrl}
                        disabled={disabled}
                        placeholder="https://…"
                        onChange={(e) => patch("logoUrl", e.target.value)}
                        aria-invalid={Boolean(fieldErrors.logoUrl)}
                      />
                    }
                  />
                  <SettingRow
                    label="Favicon URL"
                    hint={
                      fieldErrors.faviconUrl || "HTTPS URL to the browser favicon."
                    }
                    stack
                    control={
                      <input
                        className="sp-input mono"
                        value={draft.faviconUrl}
                        disabled={disabled}
                        onChange={(e) => patch("faviconUrl", e.target.value)}
                        aria-invalid={Boolean(fieldErrors.faviconUrl)}
                      />
                    }
                  />
                </SettingCard>
              </>
            )}

            {section === "languages" && (
              <>
                <SettingCard
                  title="Default Language"
                  description="Used when a user has not selected a preferred language."
                >
                  <SettingRow
                    label="Default language"
                    stack
                    control={
                      <select
                        className="sp-select"
                        value={draft.defaultLanguage}
                        disabled={disabled}
                        onChange={(e) =>
                          patch(
                            "defaultLanguage",
                            e.target.value as JudgeLanguage,
                          )
                        }
                      >
                        {draft.supportedLanguages.map((l) => (
                          <option key={l} value={l}>
                            {LANG_LABELS[l] || l}
                          </option>
                        ))}
                      </select>
                    }
                  />
                </SettingCard>
                <SettingCard
                  title="Supported Languages"
                  description="At least one language must remain enabled."
                >
                  <div className="sp-lang-grid">
                    {LANG_OPTIONS.map((l) => {
                      const on = draft.supportedLanguages.includes(l);
                      return (
                        <button
                          key={l}
                          type="button"
                          className={cn("sp-lang-btn", on && "on")}
                          disabled={disabled}
                          onClick={() => toggleLang(l)}
                          aria-pressed={on}
                        >
                          <span>{LANG_LABELS[l]}</span>
                          <span aria-hidden>{on ? "✓" : "○"}</span>
                        </button>
                      );
                    })}
                  </div>
                </SettingCard>
              </>
            )}

            {section === "pagination" && (
              <SettingCard
                title="List Pagination"
                description="Applies to admin tables and paginated surfaces."
              >
                <SettingRow
                  label="Default page size"
                  hint={
                    fieldErrors.defaultPageSize ||
                    "Rows shown by default in paginated lists."
                  }
                  stack
                  control={
                    <input
                      className="sp-input"
                      type="number"
                      min={5}
                      max={100}
                      value={draft.defaultPageSize}
                      disabled={disabled}
                      onChange={(e) =>
                        patch("defaultPageSize", Number(e.target.value))
                      }
                      aria-invalid={Boolean(fieldErrors.defaultPageSize)}
                    />
                  }
                />
                <SettingRow
                  label="Maximum page size"
                  hint={
                    fieldErrors.maxPageSize ||
                    "Upper bound users can request per page."
                  }
                  stack
                  control={
                    <input
                      className="sp-input"
                      type="number"
                      min={10}
                      max={500}
                      value={draft.maxPageSize}
                      disabled={disabled}
                      onChange={(e) =>
                        patch("maxPageSize", Number(e.target.value))
                      }
                      aria-invalid={Boolean(fieldErrors.maxPageSize)}
                    />
                  }
                />
              </SettingCard>
            )}

            {section === "limits" && (
              <SettingCard
                title="Submission Quotas"
                description="Rate and size limits for user submissions."
                lockNote={!isSuper}
              >
                <SettingRow
                  label="Max submissions / hour"
                  hint="Maximum submissions allowed within one hour."
                  stack
                  control={
                    <input
                      className="sp-input"
                      type="number"
                      value={draft.maxSubmissionsPerHour}
                      disabled={superLocked}
                      onChange={(e) =>
                        patch("maxSubmissionsPerHour", Number(e.target.value))
                      }
                    />
                  }
                />
                <SettingRow
                  label="Max runs / hour"
                  hint="Maximum code runs allowed within one hour."
                  stack
                  control={
                    <input
                      className="sp-input"
                      type="number"
                      value={draft.maxRunPerHour}
                      disabled={superLocked}
                      onChange={(e) =>
                        patch("maxRunPerHour", Number(e.target.value))
                      }
                    />
                  }
                />
                <SettingRow
                  label="Max code length (chars)"
                  hint="Maximum source length accepted per submission."
                  stack
                  control={
                    <input
                      className="sp-input"
                      type="number"
                      value={draft.maxCodeLength}
                      disabled={superLocked}
                      onChange={(e) =>
                        patch("maxCodeLength", Number(e.target.value))
                      }
                    />
                  }
                />
                <SettingRow
                  label="Concurrent submission cap"
                  hint="Maximum in-flight submissions per user."
                  stack
                  control={
                    <input
                      className="sp-input"
                      type="number"
                      value={draft.concurrentSubmissionCap}
                      disabled={superLocked}
                      onChange={(e) =>
                        patch("concurrentSubmissionCap", Number(e.target.value))
                      }
                    />
                  }
                />
              </SettingCard>
            )}

            {section === "execution" && (
              <SettingCard
                title="Execution Defaults"
                description="Soft ops configuration. Judge workers may still enforce service environment limits."
                lockNote={!isSuper}
              >
                <SettingRow
                  label="Default timeout (ms)"
                  hint="Default execution timeout in milliseconds."
                  stack
                  control={
                    <input
                      className="sp-input mono"
                      type="number"
                      value={draft.defaultTimeoutMs}
                      disabled={superLocked}
                      onChange={(e) =>
                        patch("defaultTimeoutMs", Number(e.target.value))
                      }
                    />
                  }
                />
                <SettingRow
                  label="Default memory (MB)"
                  hint="Default memory allowance in megabytes."
                  stack
                  control={
                    <input
                      className="sp-input mono"
                      type="number"
                      value={draft.defaultMemoryMb}
                      disabled={superLocked}
                      onChange={(e) =>
                        patch("defaultMemoryMb", Number(e.target.value))
                      }
                    />
                  }
                />
              </SettingCard>
            )}

            {section === "maintenance" && (
              <SettingCard
                title="Maintenance Mode"
                description="Temporarily restrict platform access."
                lockNote={!isSuper}
              >
                <SettingRow
                  label="Maintenance mode"
                  hint="When enabled, non-bypass users see the maintenance message."
                  control={
                    <Toggle
                      label="Maintenance mode"
                      checked={draft.maintenanceMode}
                      disabled={superLocked}
                      onChange={(v) => patch("maintenanceMode", v)}
                    />
                  }
                />
                <SettingRow
                  label="Allow staff bypass"
                  hint="Allow staff roles to access the platform during maintenance."
                  control={
                    <Toggle
                      label="Allow staff to bypass maintenance"
                      checked={draft.allowAdminBypass}
                      disabled={superLocked}
                      onChange={(v) => patch("allowAdminBypass", v)}
                    />
                  }
                />
                <SettingRow
                  label="Maintenance message"
                  hint="Shown to users while maintenance mode is active."
                  stack
                  control={
                    <textarea
                      className="sp-textarea"
                      value={draft.maintenanceMessage}
                      disabled={superLocked}
                      onChange={(e) =>
                        patch("maintenanceMessage", e.target.value)
                      }
                    />
                  }
                />
              </SettingCard>
            )}

            {section === "registration" && (
              <SettingCard
                title="Account Registration"
                description="Control whether new users can create accounts."
                lockNote={!isSuper}
              >
                <SettingRow
                  label="Registration enabled"
                  hint="Allow new users to register accounts on the platform."
                  control={
                    <Toggle
                      label="Registration enabled"
                      checked={draft.registrationEnabled}
                      disabled={superLocked}
                      onChange={(v) => patch("registrationEnabled", v)}
                    />
                  }
                />
                <SettingRow
                  label="Require email verification"
                  hint="Require users to verify email before full access."
                  control={
                    <Toggle
                      label="Require email verification"
                      checked={draft.requireEmailVerification}
                      disabled={superLocked}
                      onChange={(v) => patch("requireEmailVerification", v)}
                    />
                  }
                />
              </SettingCard>
            )}

            {section === "discussions" && (
              <SettingCard
                title="Community Discussions"
                description="Discussion and posting configuration."
              >
                <SettingRow
                  label="Discussions enabled"
                  hint="Enable discussion features across the platform."
                  control={
                    <Toggle
                      label="Discussions enabled"
                      checked={draft.discussionsEnabled}
                      disabled={disabled}
                      onChange={(v) => patch("discussionsEnabled", v)}
                    />
                  }
                />
                <SettingRow
                  label="Require auth to post"
                  hint="Users must be signed in to create discussion posts."
                  control={
                    <Toggle
                      label="Require auth to post"
                      checked={draft.requireAuthToPost}
                      disabled={disabled}
                      onChange={(v) => patch("requireAuthToPost", v)}
                    />
                  }
                />
              </SettingCard>
            )}

            {section === "notifications" && (
              <SettingCard
                title="Platform Notifications"
                description="Email and announcement notification controls."
              >
                <SettingRow
                  label="Email notifications"
                  hint="Enforced: when off, outbound OTP and email notifications are not sent."
                  control={
                    <Toggle
                      label="Email notifications enabled"
                      checked={draft.emailNotificationsEnabled}
                      disabled={disabled}
                      onChange={(v) => patch("emailNotificationsEnabled", v)}
                    />
                  }
                />
                <SettingRow
                  label="Announce new sheets"
                  hint="Enforced: publishes a platform announcement when a sheet is published."
                  control={
                    <Toggle
                      label="Announce new sheets"
                      checked={draft.announceNewSheets}
                      disabled={disabled}
                      onChange={(v) => patch("announceNewSheets", v)}
                    />
                  }
                />
                <SettingRow
                  label="Announce maintenance"
                  hint="Enforced: publishes a maintenance announcement when maintenance mode is enabled."
                  control={
                    <Toggle
                      label="Announce maintenance"
                      checked={draft.announceMaintenance}
                      disabled={disabled}
                      onChange={(v) => patch("announceMaintenance", v)}
                    />
                  }
                />
              </SettingCard>
            )}

            {section === "feature-flags" && (
              <SettingCard
                title="Feature Flags"
                description="Super admins only. Overlapping flags sync with maintenance, registration, and discussions settings."
                lockNote={!isSuper}
              >
                <div className="sp-flag-list">
                  {(
                    [
                      ["contests", "Contests", "Enable contest features."],
                      [
                        "discussions",
                        "Discussions",
                        "Enable discussion functionality.",
                      ],
                      [
                        "submissions",
                        "Submissions",
                        "Allow code submissions on the platform.",
                      ],
                      [
                        "registration",
                        "Registration",
                        "Allow public account registration.",
                      ],
                      [
                        "maintenance",
                        "Maintenance mode",
                        "Feature-flag mirror for maintenance mode.",
                      ],
                      [
                        "newEditor",
                        "New editor features",
                        "Enable newer editor capabilities.",
                      ],
                      [
                        "notifications",
                        "Notifications",
                        "Enable notification delivery features.",
                      ],
                    ] as const
                  ).map(([key, label, hint]) => (
                    <SettingRow
                      key={key}
                      label={label}
                      hint={hint}
                      control={
                        <Toggle
                          label={label}
                          checked={Boolean(
                            draft.featureFlags?.[key] ??
                              DEFAULT_FEATURE_FLAGS[key],
                          )}
                          disabled={superLocked}
                          onChange={(v) =>
                            patch("featureFlags", {
                              ...(draft.featureFlags || DEFAULT_FEATURE_FLAGS),
                              [key]: v,
                            })
                          }
                        />
                      }
                    />
                  ))}
                </div>
              </SettingCard>
            )}

            {section === "security" && (
              <SettingCard
                title="Authentication & Access"
                description="Auth tokens and secrets are never shown here. Role changes and destructive actions are enforced by AuthService and audited."
                lockNote={!isSuper}
              >
                <SettingRow
                  label="Require email verification"
                  hint="Users must verify email before full access."
                  control={
                    <Toggle
                      label="Require email verification"
                      checked={draft.requireEmailVerification}
                      disabled={superLocked}
                      onChange={(v) => patch("requireEmailVerification", v)}
                    />
                  }
                />
                <SettingRow
                  label="Public registration enabled"
                  hint="Allow new accounts to be created publicly."
                  control={
                    <Toggle
                      label="Public registration enabled"
                      checked={draft.registrationEnabled}
                      disabled={superLocked}
                      onChange={(v) => patch("registrationEnabled", v)}
                    />
                  }
                />
                <p className="sp-row-hint" style={{ marginTop: 4 }}>
                  Review staff actions in Audit Logs. JWT / API keys cannot be
                  exported from this panel.
                </p>
              </SettingCard>
            )}

            {section === "danger" && (
              <SettingCard
                title="Danger Zone"
                description="These settings can have significant platform-wide impact."
                danger
                lockNote={!isSuper}
              >
                <SettingRow
                  label="Reset to defaults"
                  hint="Restores factory defaults. This is audited and cannot be undone except by re-saving."
                  control={
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={!isSuper || saving || resetting}
                      onClick={() => setResetOpen(true)}
                    >
                      <RotateCcw
                        size={14}
                        strokeWidth={2}
                        className="size-3.5 shrink-0"
                        aria-hidden
                      />
                      Reset to defaults
                    </Button>
                  }
                />
              </SettingCard>
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
