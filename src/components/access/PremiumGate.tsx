import type { FC, ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { canAccess } from "../../access/canAccess";
import { FEATURE_META, isKnownFeature, type FeatureId } from "../../access/features";
import { UpgradePrompt } from "./UpgradePrompt";

interface PremiumGateProps {
  feature: string;
  children: ReactNode;
  /** Optional fallback instead of default UpgradePrompt */
  fallback?: ReactNode;
}

/**
 * UI gate — hides children when local entitlement snapshot lacks the feature.
 * Never treat this as authorization; APIs must use requireEntitlement.
 */
export const PremiumGate: FC<PremiumGateProps> = ({
  feature,
  children,
  fallback,
}) => {
  const { user } = useAuth();
  if (canAccess(user, feature)) {
    return <>{children}</>;
  }
  if (fallback !== undefined) return <>{fallback}</>;
  const label = isKnownFeature(feature)
    ? FEATURE_META[feature as FeatureId].label
    : "Premium";
  return <UpgradePrompt feature={feature} title={`${label} requires Premium`} />;
};
