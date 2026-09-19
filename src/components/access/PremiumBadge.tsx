import type { FC } from "react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/cn";
import { FEATURE_META, isKnownFeature, type FeatureId } from "../../access/features";

interface PremiumBadgeProps {
  feature?: string;
  className?: string;
  label?: string;
}

/** Small badge for premium-locked surfaces. Not a security control. */
export const PremiumBadge: FC<PremiumBadgeProps> = ({
  feature,
  className,
  label,
}) => {
  const meta =
    feature && isKnownFeature(feature) ? FEATURE_META[feature as FeatureId] : null;
  const title =
    meta?.description ||
    (feature ? "Premium Feature" : "Premium Feature");
  return (
    <Badge
      variant="warning"
      className={cn("uppercase tracking-wide", className)}
      title={title}
      aria-label={title}
    >
      {label || "Premium"}
    </Badge>
  );
};
