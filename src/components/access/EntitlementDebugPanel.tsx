import type { FC } from "react";
import { useAuth } from "../../context/AuthContext";
import { entitledFeatures } from "../../access/canAccess";
import { resolveAccessTier } from "../../access/accessModel";
import { FEATURE_IDS } from "../../access/features";

/**
 * Dev-only entitlement snapshot. No billing secrets.
 * Renders nothing in production builds.
 */
export const EntitlementDebugPanel: FC = () => {
  const { user } = useAuth();
  if (!import.meta.env.DEV) return null;
  if (!user) return null;

  const tier = resolveAccessTier(user);
  const entitled = new Set(entitledFeatures(user));

  return (
    <details className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono">
      <summary className="cursor-pointer font-primary text-sm font-semibold">
        Entitlement debug (dev only)
      </summary>
      <p className="mt-2">Current plan / tier: {tier}</p>
      <ul className="mt-2 space-y-0.5 text-muted-foreground">
        {FEATURE_IDS.filter((f) => f.startsWith("premium.")).map((f) => (
          <li key={f}>
            {f}: {entitled.has(f) ? "true" : "false"}
          </li>
        ))}
      </ul>
    </details>
  );
};
