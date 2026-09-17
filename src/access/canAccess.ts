import type { AccessUser } from "./accessModel";
import { resolveAccessTier } from "./accessModel";
import {
  FEATURE_IDS,
  PLAN_FEATURES,
  isKnownFeature,
  type FeatureId,
} from "./features";

export interface EntitlementUser extends AccessUser {
  features?: string[] | null;
}

/**
 * UI-only access check. Backend must still enforce requireEntitlement.
 * Prefer server-provided `user.features` when present; otherwise derive from tier.
 * Unknown features fail closed.
 *
 * SECURITY: Never treat this as authorization. Forged localStorage / React state
 * only changes UI chrome — premium APIs deny via Auth SoT.
 */
export function canAccess(
  user: EntitlementUser | null | undefined,
  feature: string
): boolean {
  if (!user) return false;
  if (!isKnownFeature(feature)) return false;

  if (Array.isArray(user.features)) {
    return user.features.includes(feature);
  }

  const tier = resolveAccessTier(user);
  if (tier === "PREMIUM") {
    return PLAN_FEATURES.PREMIUM.includes(feature as FeatureId);
  }
  return PLAN_FEATURES.FREE.includes(feature as FeatureId);
}

export function entitledFeatures(
  user: EntitlementUser | null | undefined
): FeatureId[] {
  if (!user) return [];
  if (Array.isArray(user.features)) {
    return FEATURE_IDS.filter((f) => user.features!.includes(f));
  }
  const tier = resolveAccessTier(user);
  return tier === "PREMIUM" ? [...PLAN_FEATURES.PREMIUM] : [...PLAN_FEATURES.FREE];
}
