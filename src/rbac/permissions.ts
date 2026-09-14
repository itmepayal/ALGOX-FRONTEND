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
  | "users:update"
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

const ALL: Permission[] = [
  "admin:view",
  "users:view",
  "users:update",
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

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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
  ],
  admin: [
    "admin:view",
    "users:view",
    "users:update",
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

export function hasPermission(role: string | undefined | null, perm: Permission): boolean {
  return permissionsForRole(role).includes(perm);
}

export function canAccessAdmin(role?: string | null): boolean {
  return hasPermission(role, "admin:view");
}
