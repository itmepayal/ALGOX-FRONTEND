import type { FC } from "react";
import { Crown } from "lucide-react";
import { Button } from "../ui/button";
import { PremiumBadge } from "./PremiumBadge";
import { FEATURE_META, isKnownFeature, type FeatureId } from "../../access/features";
import { cn } from "../../lib/cn";

interface UpgradePromptProps {
  feature?: string;
  title?: string;
  description?: string;
  className?: string;
  ctaLabel?: string;
  onUpgradeClick?: () => void;
}

/** Soft upsell surface for locked premium features (UI only). */
export const UpgradePrompt: FC<UpgradePromptProps> = ({
  feature,
  title,
  description,
  className,
  ctaLabel = "Upgrade",
  onUpgradeClick,
}) => {
  const meta =
    feature && isKnownFeature(feature) ? FEATURE_META[feature as FeatureId] : null;
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4",
        className
      )}
      role="status"
    >
      <div className="flex items-center gap-2">
        <Crown size={16} strokeWidth={1.75} className="text-warning" aria-hidden />
        <PremiumBadge feature={feature} />
      </div>
      <div>
        <p className="font-primary text-sm font-semibold text-foreground">
          {title || "Premium feature"}
        </p>
        <p className="mt-1 font-primary text-xs text-muted-foreground">
          {description ||
            meta?.description ||
            "Upgrade to Premium to unlock this feature."}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onUpgradeClick}
        disabled={!onUpgradeClick}
      >
        {ctaLabel}
      </Button>
    </div>
  );
};
