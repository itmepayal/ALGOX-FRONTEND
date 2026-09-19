import type { FC } from "react";
import { Lock } from "lucide-react";
import { Button } from "../ui/button";
import { PremiumBadge } from "./PremiumBadge";
import {
  FEATURE_BENEFITS,
  FEATURE_META,
  isKnownFeature,
  type FeatureId,
} from "../../access/features";
import { cn } from "../../lib/cn";

export interface PremiumFeatureLockProps {
  feature: string;
  title?: string;
  description?: string;
  benefits?: readonly string[];
  ctaLabel?: string;
  onUpgradeClick?: () => void;
  className?: string;
}

/**
 * Polished SaaS upsell surface for locked Premium features (UI only).
 * Never use as authorization — APIs must enforce requireFeature.
 */
export const PremiumFeatureLock: FC<PremiumFeatureLockProps> = ({
  feature,
  title,
  description,
  benefits,
  ctaLabel = "Upgrade to Premium",
  onUpgradeClick,
  className,
}) => {
  const meta =
    feature && isKnownFeature(feature) ? FEATURE_META[feature as FeatureId] : null;
  const benefitList =
    benefits ||
    (isKnownFeature(feature)
      ? FEATURE_BENEFITS[feature as FeatureId]
      : undefined) ||
    [];

  return (
    <section
      className={cn(
        "relative mx-auto flex w-full max-w-lg flex-col items-center gap-5 overflow-hidden rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-sm",
        className
      )}
      role="region"
      aria-label="Premium feature locked"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.08),_transparent_60%)]"
        aria-hidden
      />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background">
        <Lock
          size={22}
          strokeWidth={1.75}
          className="text-warning"
          aria-hidden
        />
      </div>
      <div className="relative flex flex-col items-center gap-2">
        <PremiumBadge feature={feature} />
        <h2 className="font-primary text-xl font-semibold tracking-tight text-foreground">
          {title || meta?.label || "Premium Feature"}
        </h2>
        <p className="max-w-sm font-primary text-sm leading-relaxed text-muted-foreground">
          {description ||
            meta?.description ||
            "Unlock advanced learning tools designed for serious preparation."}
        </p>
      </div>
      {benefitList.length > 0 ? (
        <ul className="relative w-full max-w-xs space-y-2 text-left">
          {benefitList.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 font-primary text-sm text-foreground/90"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        size="md"
        className="relative min-w-[12rem]"
        onClick={onUpgradeClick}
        disabled={!onUpgradeClick}
        aria-label={ctaLabel}
      >
        {ctaLabel}
      </Button>
    </section>
  );
};
