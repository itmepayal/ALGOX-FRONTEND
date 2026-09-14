import type { FC, ReactNode } from "react";
import { hasPermission, type Permission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";

interface PermissionGuardProps {
  permission: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const PermissionGuard: FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { user } = useAuth();
  const perms = Array.isArray(permission) ? permission : [permission];
  const ok = perms.some((p) => hasPermission(user?.role, p));
  if (!ok) return <>{fallback}</>;
  return <>{children}</>;
};
