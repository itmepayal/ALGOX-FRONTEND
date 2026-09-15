import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type FormEvent,
} from "react";
import {
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ConfirmDialog } from "../../ConfirmDialog";
import {
  adminNotificationApi,
  type AdminNotification,
} from "../../../api/adminNotificationApi";
import { useToast } from "../../../context/ToastContext";
import { hasPermission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";
import { cn } from "../../../lib/cn";
import "../problems/problem-editor.css";

type TargetMode = "broadcast" | "role" | "user";

/** Roles used by existing admin notification UI / AuthService. */
const ROLES = [
  { value: "user", label: "User" },
  { value: "moderator", label: "Moderator" },
  { value: "content_manager", label: "Content Manager" },
  { value: "admin", label: "Admin" },
] as const;

/**
 * Free-string `type` on notifications (max 64). Presets used by this admin UI —
 * not a strict backend enum.
 */
const TYPE_PRESETS = [
  { id: "admin", label: "Admin" },
  { id: "info", label: "Info" },
  { id: "success", label: "Success" },
  { id: "warning", label: "Warning" },
  { id: "system", label: "System" },
] as const;

type CampaignRow = {
  id: string;
  title: string;
  message: string;
  status: string;
  target: string;
  scheduledAt?: string;
  sentAt?: string | null;
  recipientCount?: number;
};

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
    full: d.toLocaleString(),
  };
}

const DateCell: FC<{ iso?: string | null }> = ({ iso }) => {
  const formatted = formatDate(iso);
  if (!formatted) {
    return <span className="font-primary text-muted-foreground">—</span>;
  }
  return (
    <span className="block min-w-0" title={formatted.full}>
      <span className="font-primary block text-sm text-foreground">
        {formatted.date}
      </span>
      <span className="font-technical mt-0.5 block text-[0.7rem] text-muted-foreground tabular-nums">
        {formatted.time}
      </span>
    </span>
  );
};

export const NotificationTypeBadge: FC<{ type?: string }> = ({ type }) => {
  const label =
    TYPE_PRESETS.find((t) => t.id === type)?.label ||
    String(type || "unknown").replace(/_/g, " ");
  return (
    <Badge variant="default" className="max-w-full truncate" title={label}>
      {label}
    </Badge>
  );
};

/** Campaign status: scheduled | sent | cancelled (+ safe fallback). */
export const NotificationStatusBadge: FC<{ status?: string }> = ({
  status,
}) => {
  const raw = String(status || "unknown").trim().toLowerCase();
  const mapped =
    raw === "scheduled"
      ? "scheduled"
      : raw === "sent"
        ? "published"
        : raw === "cancelled" || raw === "canceled"
          ? "cancelled"
          : raw === "pending"
            ? "pending"
            : raw || "unknown";
  return <StatusBadge status={mapped} />;
};

function truncateId(id?: string) {
  const s = String(id || "").trim();
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function targetLabel(target?: string) {
  if (target === "broadcast") return "Broadcast";
  if (target === "role") return "By role";
  if (target === "user") return "Single user";
  return String(target || "—");
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const RowActions: FC<{
  onDelete: () => void;
  canDelete: boolean;
  busy: boolean;
}> = ({ onDelete, canDelete, busy }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canDelete) return null;

  return (
    <div className="relative flex justify-end" ref={rootRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={busy}
        aria-label="Notification actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal
          size={16}
          strokeWidth={1.75}
          className="size-4"
          aria-hidden
        />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="font-primary flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-muted focus-visible:outline-none disabled:opacity-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2
              size={14}
              strokeWidth={1.75}
              className="size-3.5 shrink-0"
              aria-hidden
            />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const NotificationsAdminPage: FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const canCreate = hasPermission(user?.role, "notifications:create");
  const canManage = hasPermission(user?.role, "notifications:manage");

  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "true" | "false">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState("admin");
  const [target, setTarget] = useState<TargetMode>("broadcast");
  const [role, setRole] = useState("user");
  const [userId, setUserId] = useState("");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [confirmDelete, setConfirmDelete] = useState<AdminNotification | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (manual = false) => {
      try {
        if (manual) setRefreshing(true);
        else setLoading(true);
        setError("");
        const [res, camp] = await Promise.all([
          adminNotificationApi.list({
            page,
            limit: 20,
            search: debouncedSearch || undefined,
            type: typeFilter === "all" ? undefined : typeFilter,
            read: readFilter === "all" ? undefined : readFilter,
          }),
          adminNotificationApi.listCampaigns({ page: 1, limit: 20 }),
        ]);
        setRows(res.data || []);
        setMeta({
          total: res.meta?.total || 0,
          totalPages: res.meta?.totalPages || 1,
        });
        setCampaigns(camp.data || []);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Unable to load notifications",
        );
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch, typeFilter, readFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const unread = rows.filter((r) => !r.read).length;
    const read = rows.filter((r) => r.read).length;
    const scheduled = campaigns.filter((c) => c.status === "scheduled").length;
    return {
      total: meta.total,
      unread,
      read,
      scheduled,
    };
  }, [rows, campaigns, meta.total]);

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    readFilter !== "all" ||
    typeFilter !== "all";

  const validate = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required.";
    else if (title.trim().length > 200) {
      next.title = "Title must be at most 200 characters.";
    }
    if (!message.trim()) next.message = "Message is required.";
    else if (message.trim().length > 2000) {
      next.message = "Message must be at most 2000 characters.";
    }
    if (target === "user" && !userId.trim()) {
      next.userId = "User ID is required.";
    }
    if (scheduleMode) {
      if (!scheduledAt) next.scheduledAt = "Schedule time is required.";
      else {
        const when = new Date(scheduledAt).getTime();
        if (Number.isNaN(when) || when <= Date.now()) {
          next.scheduledAt = "Schedule time must be in the future.";
        }
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!validate() || sending) return;
    try {
      setSending(true);
      const res = await adminNotificationApi.create({
        title: title.trim(),
        message: message.trim(),
        target,
        userId: target === "user" ? userId.trim() : undefined,
        roles: target === "role" ? [role] : undefined,
        type: notifType || "admin",
        scheduledAt:
          scheduleMode && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
      });
      if (res.data?.scheduled) {
        toast.success(
          `Scheduled for ${
            res.data.scheduledAt
              ? new Date(res.data.scheduledAt).toLocaleString()
              : scheduledAt
          }`,
        );
      } else {
        toast.success(
          `Sent to ${res.data?.recipientCount ?? 0} recipient(s)`,
        );
      }
      setTitle("");
      setMessage("");
      setScheduledAt("");
      setScheduleMode(false);
      setFieldErrors({});
      await load(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const selectWrap =
    "relative inline-flex w-full min-w-0 sm:w-auto sm:flex-none";
  const selectClass = cn(
    "peer flex h-9 w-full appearance-none rounded-lg border border-border bg-background py-0 pr-9 pl-3",
    "font-primary text-sm text-foreground",
    "transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  );

  const recipientHint =
    target === "broadcast"
      ? "Delivered to active users (last 30 days activity)."
      : target === "role"
        ? `Active users with role “${role}”.`
        : "Delivered to the specified user ID.";

  return (
    <PermissionGuard permission="notifications:view">
      <div className="pe-page mx-auto w-full gap-5">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <span
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
              aria-hidden
            >
              <Bell size={16} strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="pe-title">Notifications</h2>
              <p className="pe-sub">
                Send, schedule, and manage targeted notifications across
                AlgoPath.
              </p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || refreshing}
              onClick={() => void load(true)}
              aria-label={refreshing ? "Refreshing" : "Refresh notifications"}
            >
              {refreshing ? (
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
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </header>

        <div className="admin-stats-grid !mb-0">
          <div className="admin-stat-card">
            <div className="label">Total</div>
            <div className="value">{stats.total}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Unread (page)</div>
            <div className="value">{stats.unread}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Read (page)</div>
            <div className="value">{stats.read}</div>
          </div>
          <div className="admin-stat-card">
            <div className="label">Scheduled campaigns</div>
            <div className="value">{stats.scheduled}</div>
          </div>
        </div>

        {canCreate ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <section className="pe-card !p-5">
              <div className="pe-card-head">
                <h3>
                  <Send size={15} strokeWidth={1.75} aria-hidden />
                  Send notification
                </h3>
                <p>
                  Create and deliver a notification to users or schedule it for
                  later.
                </p>
              </div>

              <form
                onSubmit={(e) => void send(e)}
                className="flex flex-col gap-4"
                noValidate
              >
                <fieldset className="m-0 border-0 p-0">
                  <legend className="font-primary mb-2 text-sm font-medium text-foreground">
                    Recipient
                  </legend>
                  <div
                    className="grid gap-2 sm:grid-cols-3"
                    role="radiogroup"
                    aria-label="Recipient type"
                  >
                    {(
                      [
                        {
                          id: "broadcast" as const,
                          label: "Broadcast",
                          hint: "Active users",
                          icon: Radio,
                        },
                        {
                          id: "role" as const,
                          label: "By role",
                          hint: "Target a role",
                          icon: Users,
                        },
                        {
                          id: "user" as const,
                          label: "Single user",
                          hint: "Specific user ID",
                          icon: User,
                        },
                      ] as const
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const selected = target === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            selected
                              ? "border-primary/40 bg-primary/10"
                              : "border-border bg-background hover:bg-muted",
                          )}
                          onClick={() => setTarget(opt.id)}
                        >
                          <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                            <Icon
                              size={14}
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          </span>
                          <span className="font-primary block text-sm font-semibold text-foreground">
                            {opt.label}
                          </span>
                          <span className="font-primary mt-0.5 block text-xs text-muted-foreground">
                            {opt.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {target === "role" ? (
                  <div className="admin-field">
                    <label htmlFor="notif-role">Role</label>
                    <div className="relative max-w-xs">
                      <select
                        id="notif-role"
                        className={cn(selectClass, "w-full")}
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        strokeWidth={1.75}
                        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                  </div>
                ) : null}

                {target === "user" ? (
                  <div
                    className={cn(
                      "admin-field",
                      fieldErrors.userId && "has-error",
                    )}
                  >
                    <label htmlFor="notif-user">User ID</label>
                    <Input
                      id="notif-user"
                      value={userId}
                      placeholder="MongoDB ObjectId"
                      error={Boolean(fieldErrors.userId)}
                      onChange={(e) => setUserId(e.target.value)}
                      className="bg-background font-code max-w-md"
                    />
                    {fieldErrors.userId ? (
                      <span className="pe-field-hint text-danger">
                        {fieldErrors.userId}
                      </span>
                    ) : (
                      <span className="pe-field-hint">
                        Enter the recipient user ID.
                      </span>
                    )}
                  </div>
                ) : null}

                <div
                  className={cn(
                    "admin-field",
                    fieldErrors.title && "has-error",
                  )}
                >
                  <label htmlFor="notif-title">Title</label>
                  <Input
                    id="notif-title"
                    value={title}
                    maxLength={200}
                    placeholder="Enter notification title…"
                    error={Boolean(fieldErrors.title)}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-background"
                  />
                  {fieldErrors.title ? (
                    <span className="pe-field-hint text-danger">
                      {fieldErrors.title}
                    </span>
                  ) : (
                    <span className="pe-field-hint">{title.length}/200</span>
                  )}
                </div>

                <div
                  className={cn(
                    "admin-field",
                    fieldErrors.message && "has-error",
                  )}
                >
                  <label htmlFor="notif-message">Message</label>
                  <textarea
                    id="notif-message"
                    value={message}
                    maxLength={2000}
                    rows={5}
                    placeholder="Write your notification message…"
                    onChange={(e) => setMessage(e.target.value)}
                    className="font-primary min-h-[120px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  {fieldErrors.message ? (
                    <span className="pe-field-hint text-danger">
                      {fieldErrors.message}
                    </span>
                  ) : (
                    <span className="pe-field-hint">{message.length}/2000</span>
                  )}
                </div>

                <fieldset className="m-0 border-0 p-0">
                  <legend className="font-primary mb-2 text-sm font-medium text-foreground">
                    Type
                  </legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Notification type">
                    {TYPE_PRESETS.map((t) => {
                      const selected = notifType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={cn(
                            "font-primary inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            selected
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                          onClick={() => setNotifType(t.id)}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="m-0 border-0 p-0">
                  <legend className="font-primary mb-2 text-sm font-medium text-foreground">
                    Delivery
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Delivery mode">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!scheduleMode}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        !scheduleMode
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-background hover:bg-muted",
                      )}
                      onClick={() => setScheduleMode(false)}
                    >
                      <span className="font-primary block text-sm font-semibold text-foreground">
                        Send now
                      </span>
                      <span className="font-primary mt-0.5 block text-xs text-muted-foreground">
                        Deliver immediately
                      </span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={scheduleMode}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        scheduleMode
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-background hover:bg-muted",
                      )}
                      onClick={() => {
                        setScheduleMode(true);
                        if (!scheduledAt) {
                          setScheduledAt(
                            toLocalInput(
                              new Date(Date.now() + 60 * 60 * 1000),
                            ),
                          );
                        }
                      }}
                    >
                      <span className="font-primary block text-sm font-semibold text-foreground">
                        Schedule for later
                      </span>
                      <span className="font-primary mt-0.5 block text-xs text-muted-foreground">
                        Create a campaign
                      </span>
                    </button>
                  </div>
                  {scheduleMode ? (
                    <div
                      className={cn(
                        "admin-field mt-3",
                        fieldErrors.scheduledAt && "has-error",
                      )}
                    >
                      <label htmlFor="notif-schedule">Schedule at</label>
                      <Input
                        id="notif-schedule"
                        type="datetime-local"
                        value={scheduledAt}
                        error={Boolean(fieldErrors.scheduledAt)}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="bg-background max-w-xs"
                      />
                      {fieldErrors.scheduledAt ? (
                        <span className="pe-field-hint text-danger">
                          {fieldErrors.scheduledAt}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </fieldset>

                <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={sending}
                  >
                    {sending ? (
                      <Loader2
                        size={14}
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0 animate-spin"
                        aria-hidden
                      />
                    ) : scheduleMode ? (
                      <CalendarClock
                        size={14}
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0"
                        aria-hidden
                      />
                    ) : (
                      <Send
                        size={14}
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0"
                        aria-hidden
                      />
                    )}
                    {sending
                      ? scheduleMode
                        ? "Scheduling…"
                        : "Sending…"
                      : scheduleMode
                        ? "Schedule notification"
                        : "Send notification"}
                  </Button>
                </div>
              </form>
            </section>

            <aside className="pe-card !p-5 h-fit">
              <div className="pe-card-head">
                <h3>Preview</h3>
                <p>Updates as you type.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                    <Bell size={14} strokeWidth={1.75} aria-hidden />
                  </span>
                  <NotificationTypeBadge type={notifType} />
                </div>
                <p className="font-primary m-0 text-sm font-semibold text-foreground">
                  {title.trim() || "Notification title"}
                </p>
                <p className="font-primary mt-2 mb-0 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {message.trim() || "Your notification message…"}
                </p>
                <p className="font-primary mt-4 mb-0 text-xs text-muted-foreground">
                  {recipientHint}
                </p>
                <p className="font-primary mt-1 mb-0 text-xs text-muted-foreground">
                  {scheduleMode ? "Scheduled delivery" : "Send now"}
                </p>
              </div>
            </aside>
          </div>
        ) : null}

        {campaigns.length > 0 ? (
          <section className="pe-card !p-0 overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="pe-card-head !mb-0">
                <h3>Scheduled / campaign history</h3>
                <p>Campaigns created via schedule delivery.</p>
              </div>
            </div>
            <div className="p-0 [&_.admin-table-wrap]:rounded-none [&_.admin-table-wrap]:border-0 [&_.admin-table-wrap]:shadow-none">
              <DataTable
                minWidth="720px"
                rows={campaigns}
                rowKey={(r) => r.id}
                emptyTitle="No campaigns yet"
                emptyDescription="Scheduled campaigns will appear here."
                emptyIcon={
                  <CalendarClock size={18} strokeWidth={1.75} aria-hidden />
                }
                columns={[
                  {
                    key: "title",
                    header: "Title",
                    width: "220px",
                    skeletonWidth: "10rem",
                    render: (r) => (
                      <div className="min-w-0 max-w-[220px]">
                        <span
                          className="font-primary block truncate text-sm font-semibold text-foreground"
                          title={r.title}
                        >
                          {r.title}
                        </span>
                        <span className="font-primary line-clamp-1 text-[0.75rem] text-muted-foreground">
                          {r.message}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "target",
                    header: "Target",
                    width: "110px",
                    skeletonWidth: "4rem",
                    render: (r) => (
                      <span className="font-primary text-sm text-muted-foreground">
                        {targetLabel(r.target)}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "120px",
                    skeletonWidth: "4.5rem",
                    render: (r) => (
                      <NotificationStatusBadge status={r.status} />
                    ),
                  },
                  {
                    key: "when",
                    header: "Scheduled",
                    width: "120px",
                    skeletonWidth: "5rem",
                    render: (r) => <DateCell iso={r.scheduledAt} />,
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    width: "100px",
                    align: "right",
                    skeletonWidth: "3rem",
                    render: (r) =>
                      r.status === "scheduled" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void adminNotificationApi
                              .cancelCampaign(r.id)
                              .then(() => {
                                toast.success("Campaign cancelled");
                                return load(true);
                              })
                              .catch((err: any) =>
                                toast.error(
                                  err?.response?.data?.message ||
                                    "Cancel failed",
                                ),
                              )
                          }
                        >
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      ),
                  },
                ]}
              />
            </div>
          </section>
        ) : null}

        <section className="pe-card !p-0 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="pe-card-head mb-4">
              <h3>Notification history</h3>
              <p>View recently created and delivered notifications.</p>
            </div>
            <div
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
              role="search"
              aria-label="Notification filters"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  size={15}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notifications…"
                  aria-label="Search notifications"
                  className="bg-background pr-9 pl-9"
                />
                {search ? (
                  <button
                    type="button"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X size={14} strokeWidth={1.75} aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className={cn(selectWrap, "lg:w-[140px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={typeFilter}
                  onChange={(e) => {
                    setPage(1);
                    setTypeFilter(e.target.value);
                  }}
                  aria-label="Filter by type"
                >
                  <option value="all">All types</option>
                  {TYPE_PRESETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div className={cn(selectWrap, "lg:w-[140px]")}>
                <select
                  className={cn(selectClass, "lg:w-full")}
                  value={readFilter}
                  onChange={(e) => {
                    setPage(1);
                    setReadFilter(e.target.value as "all" | "true" | "false");
                  }}
                  aria-label="Filter by read status"
                >
                  <option value="all">All read</option>
                  <option value="false">Unread</option>
                  <option value="true">Read</option>
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="p-5" role="alert">
              <p className="font-primary mb-1 text-sm font-semibold text-foreground">
                Unable to load notifications
              </p>
              <p className="font-primary mb-3 text-sm text-muted-foreground">
                {error}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void load(true)}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              <div className="p-0 [&_.admin-table-wrap]:max-h-[min(70vh,640px)] [&_.admin-table-wrap]:rounded-none [&_.admin-table-wrap]:border-0 [&_.admin-table-wrap]:shadow-none">
                <DataTable
                  loading={loading}
                  minWidth="800px"
                  rows={rows}
                  rowKey={(r) => r.id}
                  emptyTitle={
                    hasActiveFilters
                      ? "No matching notifications"
                      : "No notifications yet"
                  }
                  emptyDescription={
                    hasActiveFilters
                      ? "Try changing your search or filters."
                      : "Send a broadcast or targeted message to populate this list."
                  }
                  emptyIcon={
                    <Bell size={18} strokeWidth={1.75} aria-hidden />
                  }
                  emptyAction={
                    hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setDebouncedSearch("");
                          setTypeFilter("all");
                          setReadFilter("all");
                          setPage(1);
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                  columns={[
                    {
                      key: "title",
                      header: "Title",
                      width: "260px",
                      skeletonWidth: "11rem",
                      render: (r) => (
                        <div className="flex min-w-0 max-w-[260px] flex-col gap-0.5">
                          <span
                            className="font-primary truncate text-sm font-semibold text-foreground"
                            title={r.title}
                          >
                            {r.title}
                          </span>
                          <span
                            className="font-primary line-clamp-2 text-[0.75rem] text-muted-foreground"
                            title={r.message}
                          >
                            {r.message}
                          </span>
                        </div>
                      ),
                    },
                    {
                      key: "user",
                      header: "Recipient",
                      width: "140px",
                      skeletonWidth: "5rem",
                      render: (r) => (
                        <span
                          className="font-code block max-w-[140px] truncate text-xs text-muted-foreground"
                          title={String(r.userId || "")}
                        >
                          {truncateId(r.userId)}
                        </span>
                      ),
                    },
                    {
                      key: "type",
                      header: "Type",
                      width: "100px",
                      skeletonWidth: "4rem",
                      render: (r) => <NotificationTypeBadge type={r.type} />,
                    },
                    {
                      key: "read",
                      header: "Read",
                      width: "100px",
                      skeletonWidth: "3.5rem",
                      render: (r) =>
                        r.read ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                            <Check
                              size={13}
                              strokeWidth={2}
                              className="text-success"
                              aria-hidden
                            />
                            Read
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <EyeOff
                              size={13}
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            Unread
                          </span>
                        ),
                    },
                    {
                      key: "created",
                      header: "Created",
                      width: "120px",
                      skeletonWidth: "5rem",
                      render: (r) => <DateCell iso={r.createdAt} />,
                    },
                    {
                      key: "actions",
                      header: "Actions",
                      width: "64px",
                      align: "right",
                      skeletonWidth: "2rem",
                      render: (r) => (
                        <RowActions
                          canDelete={canManage}
                          busy={busyId === r.id}
                          onDelete={() => setConfirmDelete(r)}
                        />
                      ),
                    },
                  ]}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <span className="font-primary text-xs text-muted-foreground tabular-nums">
                  {meta.total === 0
                    ? "0 total"
                    : `Page ${page} of ${meta.totalPages} · ${meta.total} total`}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page >= meta.totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete notification?"
        description={
          <>
            Permanently delete{" "}
            <strong className="text-foreground">
              {confirmDelete?.title || "this notification"}
            </strong>
            ?
          </>
        }
        warning="This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmVariant="danger"
        confirming={confirming}
        confirmingLabel="Deleting…"
        onCancel={() => {
          if (!confirming) setConfirmDelete(null);
        }}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            setConfirming(true);
            setBusyId(confirmDelete.id);
            await adminNotificationApi.remove(confirmDelete.id);
            toast.success("Notification deleted");
            setConfirmDelete(null);
            await load(true);
          } catch (err: any) {
            toast.error(err?.response?.data?.message || "Delete failed");
          } finally {
            setConfirming(false);
            setBusyId(null);
          }
        }}
      />
    </PermissionGuard>
  );
};
