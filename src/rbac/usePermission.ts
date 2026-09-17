/**
 * Admin UI permission checks — always prefer Auth's live permission snapshot.
 * Backend still enforces independently; this only drives visibility/disabled state.
 */
import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  canAccessAdmin,
  hasPermission,
  type Permission,
} from "./permissions";

export function usePermission() {
  const { user } = useAuth();
  const role = user?.role;
  const live = user?.permissions;

  const can = useCallback(
    (perm: Permission) => hasPermission(role, perm, live),
    [role, live]
  );

  const canAny = useCallback(
    (perms: Permission[]) => perms.some((p) => hasPermission(role, p, live)),
    [role, live]
  );

  const canAdmin = useMemo(
    () => canAccessAdmin(role, live),
    [role, live]
  );

  return { can, canAny, canAdmin, user, role, permissions: live };
}
