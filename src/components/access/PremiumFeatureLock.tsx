import type { FC } from "react";
import { Lock, Check, ArrowRight } from "lucide-react";
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

  const titleText = title || meta?.label || "Premium Feature";
  const descText =
    description ||
    meta?.description ||
    "Unlock advanced learning tools designed for serious preparation.";

  return (
    <div className="flex w-full flex-1 items-center justify-center py-8 px-4 sm:px-6">
      <section
        className={cn(
          "relative mx-auto flex w-full max-w-2xl flex-col items-center gap-6 overflow-hidden rounded-2xl border border-border/80 bg-card px-8 py-12 text-center shadow-xl shadow-primary/5",
          className
        )}
        role="region"
        aria-label="Premium feature locked"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.12),_transparent_70%)]"
          aria-hidden
        />

        {/* LOCK ICON CONTAINER */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-inner">
          <Lock
            size={26}
            strokeWidth={2}
            className="text-warning"
            aria-hidden
          />
        </div>

        {/* HEADER & TITLE */}
        <div className="relative flex flex-col items-center gap-2 max-w-lg">
          <PremiumBadge feature={feature} />
          <h2 className="font-primary text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {titleText}
          </h2>
          <p className="font-primary text-sm sm:text-base leading-relaxed text-muted-foreground max-w-md">
            {descText}
          </p>
        </div>

        {/* BENEFIT LIST */}
        {benefitList.length > 0 ? (
          <div className="relative w-full max-w-md rounded-xl border border-border/60 bg-background/50 p-4 sm:p-5 text-left">
            <ul className="space-y-3">
              {benefitList.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 font-primary text-sm font-medium text-foreground/90"
                >
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* CTA BUTTON */}
        <div className="relative flex flex-col items-center gap-3 pt-2">
          <Button
            type="button"
            size="lg"
            className="min-w-[14rem] font-semibold gap-2 shadow-lg shadow-primary/20"
            onClick={onUpgradeClick}
            disabled={!onUpgradeClick}
            aria-label={ctaLabel}
          >
            <span>{ctaLabel}</span>
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Button>
          <span className="font-primary text-xs text-muted-foreground/80">
            Unlock {titleText} and build a consistent DSA practice routine.
          </span>
        </div>
      </section>
    </div>
  );
};
