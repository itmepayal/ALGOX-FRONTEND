import { useState, type FC } from "react";
import {
  ArrowRight,
  Briefcase,
  Brain,
  Code2,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { PremiumBadge } from "./access/PremiumBadge";
import { PremiumUpgradeModal } from "./access/PremiumUpgradeModal";
import { useAuth } from "../context/AuthContext";
import { setPendingPremiumNav } from "../access/pendingPremiumNav";
import { cn } from "../lib/cn";
import "./algopath-ai-premium.css";

type LandingState = "loading" | "locked" | "error";

interface Props {
  state?: LandingState;
  onRetry?: () => void;
  className?: string;
}

const FEATURES = [
  {
    id: "hints",
    icon: Lightbulb,
    title: "Smart Hints",
    description:
      "Get progressive hints without revealing the full solution.",
  },
  {
    id: "analysis",
    icon: Code2,
    title: "Code Analysis",
    description:
      "Understand bugs, complexity, and opportunities to improve your solution.",
  },
  {
    id: "learning",
    icon: Brain,
    title: "Personalized Learning",
    description:
      "Receive recommendations based on your progress, strengths, and weak areas.",
  },
  {
    id: "interview",
    icon: Briefcase,
    title: "Interview Preparation",
    description:
      "Practice explanations, reasoning, and technical interview scenarios with AI.",
  },
] as const;

/**
 * Centered premium landing for locked AlgoPath AI (UI only).
 * Entitlement remains server-authoritative via PremiumGate / requireFeature.
 */
export const AlgoPathAiPremiumLanding: FC<Props> = ({
  state = "locked",
  onRetry,
  className,
}) => {
  const { refreshEntitlements } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const openUpgrade = () => {
    setPendingPremiumNav("ai", "premium.ai");
    setUpgradeOpen(true);
  };

  const startCheckout = async () => {
    setCheckoutBusy(true);
    setActionError("");
    try {
      setPendingPremiumNav("ai", "premium.ai");
      const { startPremiumCheckout } = await import(
        "../billing/startPremiumCheckout"
      );
      const result = await startPremiumCheckout();
      if (!result.ok) {
        setActionError(
          "Could not start checkout. Please try again or contact support."
        );
        openUpgrade();
      }
    } catch {
      setActionError("Could not start checkout. Please try again.");
      openUpgrade();
    } finally {
      setCheckoutBusy(false);
    }
  };

  const refreshAccess = async () => {
    setRefreshBusy(true);
    setActionError("");
    try {
      await refreshEntitlements();
    } catch {
      setActionError("Could not refresh access. Please try again.");
    } finally {
      setRefreshBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <div
        className={cn("ai-prem", className)}
        aria-busy="true"
        aria-label="Loading AlgoPath AI"
      >
        <div className="ai-prem-inner">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="mt-6 h-24 w-24 rounded-2xl" />
          <Skeleton className="mt-6 h-10 w-64 max-w-full" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          <div className="ai-prem-features ai-prem-features--skel">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="mt-8 h-10 w-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={cn("ai-prem", className)} role="alert">
        <div className="ai-prem-inner ai-prem-inner--narrow">
          <div className="ai-prem-emblem" aria-hidden>
            <Sparkles size={22} />
          </div>
          <h1 className="ai-prem-title">Something went wrong</h1>
          <p className="ai-prem-desc">
            We couldn&apos;t verify your Premium access.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={() => onRetry?.()}
            disabled={!onRetry}
          >
            <RefreshCw size={16} aria-hidden />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("ai-prem", className)}>
      <div className="ai-prem-glow" aria-hidden />
      <div className="ai-prem-inner">
        <div className="ai-prem-badge-row">
          <span className="ai-prem-pill">
            <Sparkles size={12} aria-hidden />
            Premium
          </span>
          <PremiumBadge feature="premium.ai" />
        </div>

        <div className="ai-prem-emblem" aria-hidden>
          <span className="ai-prem-emblem-glow" />
          <Sparkles size={26} className="ai-prem-emblem-icon" />
          <span className="ai-prem-emblem-brand">AlgoPath</span>
          <span className="ai-prem-emblem-ai">AI</span>
          <span className="ai-prem-dots">
            <i />
            <i />
            <i />
          </span>
        </div>

        <header className="ai-prem-hero">
          <h1 className="ai-prem-title">AlgoPath AI</h1>
          <p className="ai-prem-headline">
            Your intelligent DSA learning companion.
          </p>
          <p className="ai-prem-desc">
            Get personalized hints, code analysis, explanations, learning
            recommendations, and interview guidance without leaving AlgoPath.
          </p>
        </header>

        <section className="ai-prem-section" aria-labelledby="ai-prem-features">
          <h2 id="ai-prem-features" className="ai-prem-section-title">
            Everything you need to learn smarter
          </h2>
          <p className="ai-prem-section-meta">
            Unlock AI-powered tools designed around your problem-solving
            journey.
          </p>
          <ul className="ai-prem-features">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.id} className="ai-prem-card">
                  <span className="ai-prem-card-icon" aria-hidden>
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className="ai-prem-lock"
          aria-labelledby="ai-prem-lock-title"
        >
          <p className="ai-prem-lock-kicker">
            <Sparkles size={12} aria-hidden /> Premium feature
          </p>
          <h2 id="ai-prem-lock-title" className="ai-prem-lock-title">
            AlgoPath AI is available with Premium
          </h2>
          <p className="ai-prem-desc">
            Unlock AI-powered learning assistance and accelerate your
            problem-solving journey.
          </p>

          <Button
            type="button"
            size="lg"
            className="ai-prem-cta"
            disabled={checkoutBusy}
            onClick={() => void startCheckout()}
            aria-label="Upgrade to Premium"
          >
            {checkoutBusy ? "Starting checkout…" : "Upgrade to Premium"}
            <ArrowRight size={16} className="ai-prem-cta-arrow" aria-hidden />
          </Button>

          <p className="ai-prem-cta-note">
            Unlock AlgoPath AI and all Premium learning features.
          </p>

          {actionError ? (
            <p className="ai-prem-action-error" role="status">
              {actionError}
            </p>
          ) : null}

          <button
            type="button"
            className="ai-prem-refresh"
            disabled={refreshBusy}
            onClick={() => void refreshAccess()}
          >
            <RefreshCw
              size={14}
              aria-hidden
              className={refreshBusy ? "ai-prem-spin" : undefined}
            />
            {refreshBusy
              ? "Refreshing access…"
              : "Already Premium? Refresh access"}
          </button>
        </section>
      </div>

      <PremiumUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="premium.ai"
        title="AlgoPath AI is a Premium feature"
        description="Upgrade to Premium to unlock AI hints, code analysis, explanations, and interview coaching."
      />
    </div>
  );
};
