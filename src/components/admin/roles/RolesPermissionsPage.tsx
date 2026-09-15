import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import {
  Check,
  Crown,
  KeyRound,
  Loader2,
  Minus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { EmptyState } from "../shared/EmptyState";
import { WidgetError } from "../shared/WidgetError";
import { StatusBadge } from "../shared/StatusBadge";
import { adminAuthApi } from "../../../api/adminAuthApi";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import type { Permission, UserRole } from "../../../rbac/permissions";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { cn } from "../../../lib/cn";
import "./roles-permissions.css";

const EDITABLE_ROLES: UserRole[] = [
  "moderator",
  "content_manager",
  "admin",
];

const ROLE_ORDER: UserRole[] = [
  "user",
  "moderator",
  "content_manager",
  "admin",
  "super_admin",
];

type ViewTab = "matrix" | "mine";
type GrantFilter = "all" | "granted" | "denied";

function normalizePerm(raw: string): string {
  return String(raw || "")
    .replace(/\\:/g, ":")
    .replace(/\\/g, "")
    .trim();
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    user: "User",
    moderator: "Moderator",
    content_manager: "Content Manager",
    admin: "Admin",
    super_admin: "Super Admin",
  };
  return (
    map[role] ||
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function roleIcon(role: string): ReactNode {
  const props = {
    size: 14,
    strokeWidth: 2,
    className: "size-3.5",
    "aria-hidden": true as const,
  };
  switch (role) {
    case "user":
      return <User {...props} />;
    case "moderator":
      return <Shield {...props} />;
    case "content_manager":
      return <Users {...props} />;
    case "admin":
      return <ShieldCheck {...props} />;
    case "super_admin":
      return <Crown {...props} />;
    default:
      return <KeyRound {...props} />;
  }
}

function splitPerm(perm: string): { resource: string; action: string } {
  const clean = normalizePerm(perm);
  const idx = clean.indexOf(":");
  if (idx === -1) return { resource: clean || "other", action: "" };
  return {
    resource: clean.slice(0, idx) || "other",
    action: clean.slice(idx + 1),
  };
}

function groupKey(perm: string): string {
  return splitPerm(perm).resource.toUpperCase();
}

const PermissionCell: FC<{
  granted: boolean;
  pending?: boolean;
  roleLabelText: string;
  permission: string;
  highlight?: boolean;
  colHover?: boolean;
}> = ({
  granted,
  pending,
  roleLabelText,
  permission,
  highlight,
  colHover,
}) => {
  const label = pending
    ? "Permission pending"
    : granted
      ? "Permission granted"
      : "Permission not granted";
  return (
    <td
      className={cn(
        "rpm-cell",
        highlight && "is-you",
        colHover && "col-hover",
      )}
      data-role={roleLabelText}
    >
      <span
        className={cn(
          "rpm-cell-btn",
          pending ? "denied" : granted ? "granted" : "denied",
        )}
        title={`${label} — ${normalizePerm(permission)} for ${roleLabelText}`}
        aria-label={`${label}: ${normalizePerm(permission)} for ${roleLabelText}`}
        role="img"
      >
        {pending ? (
          <span aria-hidden>○</span>
        ) : granted ? (
          <Check size={14} strokeWidth={2.5} className="size-3.5" aria-hidden />
        ) : (
          <Minus size={14} strokeWidth={2} className="size-3.5" aria-hidden />
        )}
      </span>
    </td>
  );
};

const PermId: FC<{ perm: string }> = ({ perm }) => {
  const { resource, action } = splitPerm(perm);
  return (
    <span className="rpm-perm-id" title={normalizePerm(perm)}>
      <span className="rpm-perm-resource">{resource}</span>
      {action ? (
        <>
          <span className="rpm-perm-sep">:</span>
          <span className="rpm-perm-action">{action}</span>
        </>
      ) : null}
    </span>
  );
};

/** Permission matrix from AuthService. Super admins can edit non-super roles. */
export const RolesPermissionsPage: FC = () => {
  const { user, refreshPermissions } = useAuth();
  const toast = useToast();
  const isSuper = user?.role === "super_admin";

  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [allPerms, setAllPerms] = useState<string[]>([]);
  const [myPerms, setMyPerms] = useState<string[]>([]);
  const [serverRole, setServerRole] = useState("");
  const [matrixError, setMatrixError] = useState("");
  const [meError, setMeError] = useState("");
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [grantFilter, setGrantFilter] = useState<GrantFilter>("all");
  const [tab, setTab] = useState<ViewTab>("matrix");
  const [editRole, setEditRole] = useState<UserRole>("moderator");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMatrixError("");
    setMeError("");
    const [matrixSettled, meSettled] = await Promise.allSettled([
      adminAuthApi.getRoleMatrix(),
      adminAuthApi.getMyPermissions(),
    ]);

    if (matrixSettled.status === "fulfilled") {
      const data = matrixSettled.value.data;
      const perms = (data?.permissions || []).map(normalizePerm);
      const rawMatrix = data?.matrix || {};
      const nextMatrix: Record<string, string[]> = {};
      for (const [role, list] of Object.entries(rawMatrix)) {
        nextMatrix[role] = (list || []).map(normalizePerm);
      }
      setMatrix(nextMatrix);
      setAllPerms([...new Set(perms)]);
    } else {
      const err = matrixSettled.reason as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setMatrixError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load permission matrix",
      );
      setMatrix({});
      setAllPerms([]);
    }

    if (meSettled.status === "fulfilled") {
      const data = meSettled.value.data;
      setMyPerms((data?.permissions || []).map(normalizePerm));
      setServerRole(data?.role || "");
    } else {
      const err = meSettled.reason as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setMeError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load your permissions",
      );
      setMyPerms([]);
      setServerRole("");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDraft(new Set((matrix[editRole] || []).map(normalizePerm)));
  }, [editRole, matrix]);

  const roles = useMemo(() => {
    const keys = Object.keys(matrix) as UserRole[];
    const ordered = ROLE_ORDER.filter((r) => keys.includes(r));
    const extras = keys.filter((r) => !ROLE_ORDER.includes(r));
    return ordered.length || extras.length
      ? [...ordered, ...extras]
      : ROLE_ORDER;
  }, [matrix]);

  const currentRole = (serverRole || user?.role || "").trim();

  const visibleRoles = useMemo(() => {
    if (roleFilter === "all") return roles;
    return roles.filter((r) => r === roleFilter);
  }, [roles, roleFilter]);

  const filteredPerms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return allPerms.filter((raw) => {
      const p = normalizePerm(raw).toLowerCase();
      if (q && !p.includes(q)) return false;

      if (grantFilter === "all") return true;

      const roleScope =
        roleFilter === "all" ? roles : roles.filter((r) => r === roleFilter);
      const anyGranted = roleScope.some((r) =>
        (matrix[r] || []).map(normalizePerm).includes(normalizePerm(raw)),
      );

      if (grantFilter === "granted") return anyGranted;
      return !anyGranted;
    });
  }, [allPerms, filter, grantFilter, roleFilter, roles, matrix]);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of filteredPerms) {
      const key = groupKey(p);
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPerms]);

  const myGrouped = useMemo(() => {
    const map = new Map<string, string[]>();
    const q = filter.trim().toLowerCase();
    for (const raw of myPerms) {
      const p = normalizePerm(raw);
      if (q && !p.toLowerCase().includes(q)) continue;
      const key = groupKey(p);
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [myPerms, filter]);

  const toggleDraft = (perm: string) => {
    const clean = normalizePerm(perm);
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) next.delete(clean);
      else next.add(clean);
      next.add("admin:view");
      return next;
    });
  };

  const save = async () => {
    try {
      setSaving(true);
      await adminAuthApi.updateRolePermissions(editRole, [...draft]);
      toast.success(`Updated ${roleLabel(editRole)} permissions`);
      await load();
      await refreshPermissions();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    try {
      setSaving(true);
      await adminAuthApi.resetRolePermissions(editRole);
      toast.success(`Reset ${roleLabel(editRole)} to defaults`);
      await load();
      await refreshPermissions();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  const hasGrant = (role: string, perm: string) =>
    (matrix[role] || []).map(normalizePerm).includes(normalizePerm(perm));

  return (
    <PermissionGuard
      permission="admin:view"
      fallback={<div className="admin-denied">No admin access.</div>}
    >
      <div className="rpm-page">
        <header className="rpm-header">
          <div>
            <h2>Roles &amp; Permissions</h2>
            <p className="rpm-header-sub">
              Role-based access control and permission visibility
            </p>
            <div className="rpm-header-meta">
              <span className="rpm-pill">Role → permission matrix</span>
              <span className="rpm-pill">Backend enforced</span>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh roles and permissions"
          >
            {loading ? (
              <Loader2
                size={14}
                strokeWidth={2}
                className="size-3.5 shrink-0 animate-spin"
                aria-hidden
              />
            ) : (
              <RefreshCw
                size={14}
                strokeWidth={2}
                className="size-3.5 shrink-0"
                aria-hidden
              />
            )}
            Refresh
          </Button>
        </header>

        <section className="rpm-session" aria-label="Current session">
          <div>
            <p className="rpm-session-label">Current session</p>
            <p className="rpm-session-email">{user?.email || "—"}</p>
            <div className="rpm-session-meta">
              {currentRole ? (
                <StatusBadge status={currentRole} showIcon={false} />
              ) : (
                <StatusBadge status="unknown" showIcon={false} />
              )}
              <span className="rpm-pill">
                {meError ? "—" : `${myPerms.length} permissions`}
              </span>
              {!meError ? (
                <span className="rpm-session-live">
                  Permissions loaded from server
                </span>
              ) : (
                <span className="rpm-session-live" style={{ opacity: 0.8 }}>
                  Session permissions unavailable
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="rpm-tabs" role="tablist" aria-label="Permission views">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "matrix"}
            className={tab === "matrix" ? "active" : ""}
            onClick={() => setTab("matrix")}
          >
            Role Matrix
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            className={tab === "mine" ? "active" : ""}
            onClick={() => setTab("mine")}
          >
            My Permissions
          </button>
        </div>

        {tab === "matrix" ? (
          <section className="rpm-card" aria-label="Permission matrix">
            <div className="rpm-card-head">
              <h3>Permission Matrix</h3>
              <p>Review permissions assigned to each platform role</p>
            </div>

            {matrixError ? (
              <WidgetError
                title="Unable to load permission matrix"
                message={
                  matrixError ||
                  "We couldn't retrieve the role permissions from the server."
                }
                onRetry={() => void load()}
              />
            ) : (
              <>
                <div className="rpm-toolbar">
                  <label className="rpm-search">
                    <Search
                      size={14}
                      strokeWidth={2}
                      className="size-3.5"
                      aria-hidden
                    />
                    <span className="sr-only">Search permissions</span>
                    <Input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Search permissions…"
                      aria-label="Search permissions"
                    />
                  </label>
                  <select
                    className="rpm-select"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    aria-label="Filter by role"
                  >
                    <option value="all">All Roles</option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rpm-select"
                    value={grantFilter}
                    onChange={(e) =>
                      setGrantFilter(e.target.value as GrantFilter)
                    }
                    aria-label="Filter by grant status"
                  >
                    <option value="all">All Permissions</option>
                    <option value="granted">Granted</option>
                    <option value="denied">Not Granted</option>
                  </select>
                </div>

                {loading ? (
                  <div className="rpm-matrix-scroll" aria-hidden>
                    <div style={{ padding: 12, display: "grid", gap: 8 }}>
                      <div className="rpm-skel" style={{ height: 40 }} />
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="rpm-skel"
                          style={{ height: 28 }}
                        />
                      ))}
                    </div>
                  </div>
                ) : filteredPerms.length === 0 ? (
                  <EmptyState
                    compact
                    icon={
                      <KeyRound size={18} strokeWidth={1.75} aria-hidden />
                    }
                    title="No permissions found"
                    description="Try searching for another resource or action."
                    action={
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setFilter("");
                          setRoleFilter("all");
                          setGrantFilter("all");
                        }}
                      >
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <div className="rpm-matrix-scroll">
                    <table className="rpm-table">
                      <thead>
                        <tr>
                          <th className="rpm-perm" scope="col">
                            Permission
                          </th>
                          {visibleRoles.map((role) => {
                            const isYou = role === currentRole;
                            return (
                              <th
                                key={role}
                                className={cn(
                                  "rpm-role",
                                  isYou && "is-you",
                                  hoveredRole === role && "col-hover",
                                )}
                                scope="col"
                                onMouseEnter={() => setHoveredRole(role)}
                                onMouseLeave={() => setHoveredRole(null)}
                              >
                                <div className="rpm-role-head">
                                  <span className="rpm-role-icon">
                                    {roleIcon(role)}
                                  </span>
                                  <span className="rpm-role-name">
                                    {roleLabel(role)}
                                  </span>
                                  {isYou ? (
                                    <span className="rpm-role-you">YOU</span>
                                  ) : null}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {grouped.map(([group, perms]) => (
                          <FragmentGroup
                            key={group}
                            group={group}
                            perms={perms}
                            visibleRoles={visibleRoles}
                            currentRole={currentRole}
                            hoveredRole={hoveredRole}
                            hasGrant={hasGrant}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          <section className="rpm-card" aria-label="My permissions">
            <div className="rpm-card-head">
              <h3>My Permissions</h3>
              <p>
                Effective permissions for your authenticated session
                {meError
                  ? ""
                  : ` · ${myPerms.length} permission${
                      myPerms.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>

            {meError ? (
              <WidgetError
                title="Unable to load your permissions"
                message={meError}
                onRetry={() => void load()}
              />
            ) : loading ? (
              <div style={{ display: "grid", gap: 8 }} aria-hidden>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rpm-skel" style={{ height: 64 }} />
                ))}
              </div>
            ) : myGrouped.length === 0 ? (
              <EmptyState
                compact
                icon={<KeyRound size={18} strokeWidth={1.75} aria-hidden />}
                title="No permissions found"
                description="Try clearing search or refresh your session permissions."
                action={
                  filter ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setFilter("")}
                    >
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="rpm-toolbar">
                  <label className="rpm-search">
                    <Search
                      size={14}
                      strokeWidth={2}
                      className="size-3.5"
                      aria-hidden
                    />
                    <span className="sr-only">Search my permissions</span>
                    <Input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Search permissions…"
                      aria-label="Search my permissions"
                    />
                  </label>
                </div>
                <div className="rpm-my-grid">
                  {myGrouped.map(([group, perms]) => (
                    <div key={group} className="rpm-my-group">
                      <div className="rpm-my-group-head">
                        <span>{group}</span>
                        <span className="rpm-group-count">
                          {perms.length} permission
                          {perms.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <ul className="rpm-my-list">
                        {perms.map((p) => (
                          <li key={p}>
                            <Check
                              size={14}
                              strokeWidth={2.5}
                              className="rpm-my-check size-3.5"
                              aria-hidden
                            />
                            <PermId perm={p} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {isSuper ? (
          <section
            className="rpm-card rpm-edit"
            aria-label="Edit role permissions"
          >
            <div className="rpm-card-head">
              <h3>Edit role permissions</h3>
              <p>
                Super Admin can update non–Super Admin roles. Backend remains
                authoritative.
              </p>
            </div>
            <select
              className="rpm-select"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              aria-label="Role to edit"
            >
              {EDITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
            <div className="rpm-edit-grid">
              {(allPerms as Permission[]).map((p) => {
                const clean = normalizePerm(p);
                return (
                  <label key={clean} className="admin-check">
                    <input
                      type="checkbox"
                      checked={draft.has(clean)}
                      disabled={clean === "admin:view"}
                      onChange={() => toggleDraft(clean)}
                    />
                    <PermId perm={clean} />
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={saving || !!matrixError}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save role"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving || !!matrixError}
                onClick={() => void reset()}
              >
                Reset to defaults
              </Button>
            </div>
          </section>
        ) : (
          <p className="admin-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
            Only Super Admin can edit the matrix. Change user roles on User
            Detail.
          </p>
        )}
      </div>
    </PermissionGuard>
  );
};

const FragmentGroup: FC<{
  group: string;
  perms: string[];
  visibleRoles: UserRole[];
  currentRole: string;
  hoveredRole: string | null;
  hasGrant: (role: string, perm: string) => boolean;
}> = ({
  group,
  perms,
  visibleRoles,
  currentRole,
  hoveredRole,
  hasGrant,
}) => (
  <>
    <tr className="rpm-group-row">
      <td className="rpm-perm">
        <div className="rpm-group-inner">
          <span>{group}</span>
          <span className="rpm-group-count">
            {perms.length} permission{perms.length === 1 ? "" : "s"}
          </span>
        </div>
      </td>
      {visibleRoles.map((role) => (
        <td
          key={`${group}-${role}`}
          className={cn(
            "rpm-cell rpm-group-fill",
            role === currentRole && "is-you",
            hoveredRole === role && "col-hover",
          )}
          aria-hidden
        />
      ))}
    </tr>
    {perms.map((perm) => (
      <tr key={perm}>
        <td className="rpm-perm">
          <PermId perm={perm} />
        </td>
        {visibleRoles.map((role) => (
          <PermissionCell
            key={`${perm}-${role}`}
            granted={hasGrant(role, perm)}
            roleLabelText={roleLabel(role)}
            permission={perm}
            highlight={role === currentRole}
            colHover={hoveredRole === role}
          />
        ))}
      </tr>
    ))}
  </>
);

export default RolesPermissionsPage;
