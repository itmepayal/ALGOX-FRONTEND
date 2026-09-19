import { useState, type FC, type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { canAccess } from "../../access/canAccess";
import { FEATURE_META, isKnownFeature, type FeatureId } from "../../access/features";
import { PremiumFeatureLock } from "./PremiumFeatureLock";
import { PremiumUpgradeModal } from "./PremiumUpgradeModal";
import { setPendingPremiumNav } from "../../access/pendingPremiumNav";
import { getPlatformNavItem, type PlatformNavId } from "../../nav/platformNav";

function featureToNavTab(feature: string): string | null {
  const match = (
    [
      "calendar",
      "sessions",
      "planner",
      "companies",
      "interview",
      "ai",
      "analytics",
      "reviews",
    ] as PlatformNavId[]
  ).find((id) => getPlatformNavItem(id)?.premiumFeature === feature);
  return match || null;
}

interface PremiumGateProps {
  feature: string;
  children: ReactNode;
  /** Optional fallback instead of default PremiumFeatureLock */
  fallback?: ReactNode;
  /** Optional loading UI while auth revalidates */
  loadingFallback?: ReactNode;
  title?: string;
  description?: string;
  benefits?: readonly string[];
}

/**
 * UI gate — hides children when local entitlement snapshot lacks the feature.
 * Shows a checking state while auth revalidates to avoid premium content flash.
 * Never treat this as authorization; APIs must use requireFeature / requireEntitlement.
 */
export const PremiumGate: FC<PremiumGateProps> = ({
  feature,
  children,
  fallback,
  loadingFallback,
  title,
  description,
  benefits,
}) => {
  const { user, loading } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (loading) {
    if (loadingFallback !== undefined) return <>{loadingFallback}</>;
    return (
      <div
        className="flex min-h-[12rem] items-center justify-center font-primary text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        Checking access…
      </div>
    );
  }

  if (canAccess(user, feature)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) return <>{fallback}</>;

  const label = isKnownFeature(feature)
    ? FEATURE_META[feature as FeatureId].label
    : "Premium";
  const meta = isKnownFeature(feature)
    ? FEATURE_META[feature as FeatureId]
    : null;

  return (
    <>
      <PremiumFeatureLock
        feature={feature}
        title={title || label}
        description={description || meta?.description}
        benefits={benefits}
        onUpgradeClick={() => {
          const tab = featureToNavTab(feature);
          if (tab) setPendingPremiumNav(tab, feature);
          setUpgradeOpen(true);
        }}
      />
      <PremiumUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={feature}
        title={`${label} is a Premium feature`}
        description={
          description ||
          meta?.description ||
          "Upgrade to Premium to unlock this feature."
        }
        benefits={benefits}
      />
    </>
  );
};
