/** Client-side mirror of AuthService RBAC. Backend still enforces. */
export type UserRole =
  | "user"
  | "moderator"
  | "content_manager"
  | "admin"
  | "super_admin";

export type Permission =
  | "admin:view"
  | "users:view"
  | "users:create"
  | "users:update"
  | "users:delete"
  | "problems:view"
  | "problems:create"
  | "problems:update"
  | "problems:delete"
  | "problems:publish"
  | "testcases:view"
  | "testcases:create"
  | "testcases:update"
  | "testcases:delete"
  | "submissions:view"
  | "submissions:update"
  | "submissions:delete"
  | "analytics:view"
  | "audit:view"
  | "health:view"
  | "settings:view"
  | "settings:update"
  | "discussions:view"
  | "discussions:moderate"
  | "discussions:delete"
  | "reports:view"
  | "reports:review"
  | "reports:resolve"
  | "announcements:create"
  | "announcements:publish"
  | "announcements:view"
  | "notifications:view"
  | "notifications:create"
  | "notifications:manage"
  | "content:view"
  | "content:create"
  | "content:update"
  | "content:delete"
  | "contests:create"
  | "contests:manage"
  | "sheets:create"
  | "sheets:manage"
  | "suspicious:view"
  | "suspicious:review"
  | "realtime:view"
  | "realtime:connections"
  | "realtime:rooms"
  | "realtime:events"
  | "realtime:broadcast"
  | "realtime:disconnect"
  | "realtime:debug"
  | "realtime:analytics"
  | "realtime:security";

export const ALL: Permission[] = [
  "admin:view",
  "users:view",
  "users:create",
  "users:update",
  "users:delete",
  "problems:view",
  "problems:create",
  "problems:update",
  "problems:delete",
  "problems:publish",
  "testcases:view",
  "testcases:create",
  "testcases:update",
  "testcases:delete",
  "submissions:view",
  "submissions:update",
  "submissions:delete",
  "analytics:view",
  "audit:view",
  "health:view",
  "settings:view",
  "settings:update",
  "discussions:view",
  "discussions:moderate",
  "discussions:delete",
  "reports:view",
  "reports:review",
  "reports:resolve",
  "announcements:create",
  "announcements:publish",
  "announcements:view",
  "notifications:view",
  "notifications:create",
  "notifications:manage",
  "content:view",
  "content:create",
  "content:update",
  "content:delete",
  "contests:create",
  "contests:manage",
  "sheets:create",
  "sheets:manage",
  "suspicious:view",
  "suspicious:review",
  "realtime:view",
  "realtime:connections",
  "realtime:rooms",
  "realtime:events",
  "realtime:broadcast",
  "realtime:disconnect",
  "realtime:debug",
  "realtime:analytics",
  "realtime:security",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [],
  moderator: [
    "admin:view",
    "users:view",
    "submissions:view",
    "audit:view",
    "health:view",
    "discussions:view",
    "discussions:moderate",
    "discussions:delete",
    "reports:view",
    "reports:review",
    "reports:resolve",
  ],
  content_manager: [
    "admin:view",
    "problems:view",
    "problems:create",
    "problems:update",
    "problems:publish",
    "testcases:view",
    "testcases:create",
    "testcases:update",
    "testcases:delete",
    "submissions:view",
    "analytics:view",
    "health:view",
    "content:view",
    "content:create",
    "content:update",
    "content:delete",
  ],
  admin: [
    "admin:view",
    "users:view",
    "users:create",
    "users:update",
    "users:delete",
    "problems:view",
    "problems:create",
    "problems:update",
    "problems:delete",
    "problems:publish",
    "testcases:view",
    "testcases:create",
    "testcases:update",
    "testcases:delete",
    "submissions:view",
    "submissions:update",
    "submissions:delete",
    "analytics:view",
    "audit:view",
    "health:view",
    "settings:view",
    "settings:update",
    "discussions:view",
    "discussions:moderate",
    "discussions:delete",
    "reports:view",
    "reports:review",
    "reports:resolve",
    "announcements:create",
    "announcements:publish",
    "announcements:view",
    "notifications:view",
    "notifications:create",
    "notifications:manage",
    "content:view",
    "content:create",
    "content:update",
    "content:delete",
    "sheets:create",
    "sheets:manage",
    "suspicious:view",
    "suspicious:review",
    "realtime:view",
    "realtime:connections",
    "realtime:rooms",
    "realtime:events",
    "realtime:broadcast",
    "realtime:disconnect",
    "realtime:debug",
    "realtime:analytics",
    "realtime:security",
    "contests:create",
    "contests:manage",
  ],
  super_admin: [...ALL],
};

export function normalizeRole(role?: string | null): UserRole {
  if (!role) return "user";
  if (role in ROLE_PERMISSIONS) return role as UserRole;
  return "user";
}

export function permissionsForRole(role?: string | null): Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)] || [];
}

export function hasPermission(
  role: string | undefined | null,
  perm: Permission,
  livePermissions?: string[] | null
): boolean {
  if (livePermissions && livePermissions.length > 0) {
    return livePermissions.includes(perm);
  }
  return permissionsForRole(role).includes(perm);
}

export function canAccessAdmin(
  role?: string | null,
  livePermissions?: string[] | null
): boolean {
  return hasPermission(role, "admin:view", livePermissions);
}

const STAFF: UserRole[] = [
  "moderator",
  "content_manager",
  "admin",
  "super_admin",
];

export function isStaffRole(role?: string | null): boolean {
  return STAFF.includes(normalizeRole(role));
}
