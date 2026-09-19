import type { FC } from "react";
import { Crown } from "lucide-react";
import { cn } from "../../lib/cn";

export type PremiumNavIndicatorProps = {
  /** True when the current user lacks entitlement (upgrade affordance). */
  locked?: boolean;
  /** Compact mark for top navbar; default suits sidebar / rail. */
  variant?: "sidebar" | "navbar" | "inline";
  className?: string;
};

/**
 * Single Premium affordance for platform navigation / settings rails.
 * UI only — backend requireFeature / requireEntitlement remain authoritative.
 */
export const PremiumNavIndicator: FC<PremiumNavIndicatorProps> = ({
  locked = false,
  variant = "sidebar",
  className,
}) => {
  const label = locked
    ? "Premium feature — Upgrade to unlock"
    : "Premium feature — Included in your plan";

  const size = variant === "navbar" ? 10 : variant === "inline" ? 12 : 9;

  return (
    <span
      className={cn(
        "platform-nav-premium-mark",
        variant === "navbar" && "platform-nav-premium-mark--navbar",
        variant === "inline" && "platform-nav-premium-mark--inline",
        locked && "platform-nav-premium-mark--locked",
        className
      )}
      title={label}
      aria-label={label}
    >
      <Crown size={size} strokeWidth={2.25} aria-hidden />
    </span>
  );
};
