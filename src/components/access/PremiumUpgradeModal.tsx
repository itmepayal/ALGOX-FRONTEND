import {
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { PremiumBadge } from "./PremiumBadge";
import { cn } from "../../lib/cn";

const DEFAULT_BENEFITS = [
  "AI Hints",
  "Explain Error",
  "Find Bug",
  "Test Case Guidance",
  "Interview Mode",
  "Other premium AI tools",
] as const;

export interface PremiumUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  benefits?: readonly string[];
  feature?: string;
}

/**
 * Shared Premium upsell dialog for locked product features (UI only).
 * Authorization remains server-side.
 */
export const PremiumUpgradeModal: FC<PremiumUpgradeModalProps> = ({
  open,
  onClose,
  title = "Premium Feature",
  description = "AlgoPath AI is available to Premium members only.",
  benefits = DEFAULT_BENEFITS,
  feature = "premium.ai",
}) => {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  useEffect(() => {
    if (!open) return;
    setUpgradeError("");
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!upgradeBusy) onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, upgradeBusy, onClose]);

  if (!open) return null;

  const onOverlayClick = (e: ReactMouseEvent) => {
    if (e.target === e.currentTarget && !upgradeBusy) onClose();
  };

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const startUpgrade = async () => {
    setUpgradeBusy(true);
    setUpgradeError("");
    try {
      if (feature) {
        const { setPendingPremiumNav } = await import(
          "../../access/pendingPremiumNav"
        );
        const { getPlatformNavItem } = await import("../../nav/platformNav");
        const ids = [
          "calendar",
          "sessions",
          "planner",
          "companies",
          "interview",
          "ai",
          "analytics",
          "reviews",
        ] as const;
        const tab =
          ids.find((id) => getPlatformNavItem(id)?.premiumFeature === feature) ||
          undefined;
        if (tab) setPendingPremiumNav(tab, feature);
      }
      const { startPremiumCheckout } = await import(
        "../../billing/startPremiumCheckout"
      );
      const result = await startPremiumCheckout();
      if (!result.ok) {
        setUpgradeError(result.message);
      }
    } catch (err: any) {
      setUpgradeError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not start checkout."
      );
    } finally {
      setUpgradeBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onOverlayClick}
    >
      <div
        ref={panelRef}
        className={cn(
          "w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg",
          "font-primary text-foreground"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        <div className="flex items-center gap-2">
          <span
            className="grid size-9 place-items-center rounded-full bg-warning/15 text-warning"
            aria-hidden
          >
            <Sparkles size={18} strokeWidth={1.75} />
          </span>
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-warning" aria-hidden />
            <PremiumBadge feature={feature} />
          </div>
        </div>

        <h3 id={titleId} className="mt-4 text-lg font-semibold tracking-tight">
          {title}
        </h3>
        <p id={descId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Upgrade to Premium to unlock
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-0.5 text-success" aria-hidden>
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {upgradeError ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {upgradeError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={upgradeBusy}
          >
            Not now
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void startUpgrade()}
            disabled={upgradeBusy}
            aria-busy={upgradeBusy}
          >
            {upgradeBusy ? "Starting…" : "Upgrade to Premium"}
          </Button>
        </div>
      </div>
    </div>
  );
};
