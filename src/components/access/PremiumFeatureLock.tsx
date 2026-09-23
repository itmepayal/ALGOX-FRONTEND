import { useState, type FC } from "react";
import { Crown, Check, ArrowRight, Loader2 } from "lucide-react";
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
  onUpgradeClick?: () => void | Promise<void>;
  className?: string;
  isUpgrading?: boolean;
}

/**
 * Single Unified SaaS Premium Gate / Lock UI system for AlgoPath.
 * Master reference: Daily Planner Premium design standard.
 */
export const PremiumFeatureLock: FC<PremiumFeatureLockProps> = ({
  feature,
  title,
  description,
  benefits,
  ctaLabel = "Upgrade to Premium",
  onUpgradeClick,
  className,
  isUpgrading: externalUpgrading = false,
}) => {
  const [internalUpgrading, setInternalUpgrading] = useState(false);
  const isUpgrading = externalUpgrading || internalUpgrading;

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

  const handleUpgrade = async () => {
    if (!onUpgradeClick || isUpgrading) return;
    try {
      setInternalUpgrading(true);
      const res = onUpgradeClick();
      if (res && typeof (res as Promise<void>).then === "function") {
        await res;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
    } finally {
      setInternalUpgrading(false);
    }
  };

  return (
    <div className="flex w-full flex-1 min-h-[calc(100vh-5rem)] items-center justify-center p-4 sm:p-6 md:p-8">
      <section
        className={cn(
          "relative mx-auto flex w-full max-w-[540px] flex-col items-center gap-6 overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 sm:p-9 text-center shadow-2xl shadow-primary/10 transition-all",
          className
        )}
        role="region"
        aria-label="Premium feature locked"
      >
        {/* Ambient Top Glow */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.14),_transparent_75%)]"
          aria-hidden
        />

        {/* 1. TOP PREMIUM ICON */}
        <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 shadow-inner">
          <Crown
            size={28}
            strokeWidth={2}
            className="text-warning"
            aria-hidden
          />
        </div>

        {/* 2. PREMIUM BADGE & 3. PAGE TITLE & 4. DESCRIPTION */}
        <div className="relative flex flex-col items-center gap-2.5 max-w-md">
          <PremiumBadge feature={feature} />
          <h2 className="font-primary text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {titleText}
          </h2>
          <p className="font-primary text-sm leading-relaxed text-muted-foreground max-w-sm">
            {descText}
          </p>
        </div>

        {/* 5. FEATURE BENEFITS BOX */}
        {benefitList.length > 0 ? (
          <div className="relative w-full max-w-md rounded-xl border border-border/70 bg-background/60 p-4 sm:p-5 text-left shadow-sm">
            <ul className="space-y-3">
              {benefitList.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 font-primary text-sm font-medium text-foreground/90"
                >
                  <span
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-warning/15 text-warning"
                    aria-hidden
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 6. PRIMARY CTA & 7. SUPPORTING TEXT */}
        <div className="relative flex flex-col items-center gap-2.5 pt-1 w-full">
          <Button
            type="button"
            size="lg"
            className="w-full max-w-[280px] font-semibold gap-2 shadow-lg shadow-primary/20 h-11 sm:h-12"
            onClick={handleUpgrade}
            disabled={isUpgrading || !onUpgradeClick}
            aria-label={ctaLabel}
            aria-busy={isUpgrading}
          >
            {isUpgrading ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <span>{ctaLabel}</span>
                <ArrowRight size={16} strokeWidth={2.2} aria-hidden />
              </>
            )}
          </Button>
          <span className="font-primary text-xs text-muted-foreground/80 max-w-xs">
            Unlock {titleText} and build a focused interview practice routine.
          </span>
        </div>
      </section>
    </div>
  );
};


