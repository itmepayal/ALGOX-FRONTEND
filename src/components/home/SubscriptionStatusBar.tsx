import { useState, type FC } from "react";
import { Crown, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isPremium, type PublicSubscription } from "../../access/accessModel";
import { authApi } from "../../api/authApi";
import { billingApi } from "../../api/billingApi";
import { Button } from "../ui/button";
import { PremiumBadge } from "../access/PremiumBadge";

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(sub?: PublicSubscription | null): string {
  if (!sub || sub.plan !== "PREMIUM") return "Free";
  if (sub.status === "grace") return "Premium (grace)";
  if (sub.status === "canceled" && sub.cancelAtPeriodEnd) {
    return "Premium (cancels at period end)";
  }
  if (sub.status === "active") return "Premium";
  return `Premium (${sub.status})`;
}

/**
 * Compact entitlement strip — plan/expiry from AuthService snapshot only.
 * Uses existing free-home card + PremiumBadge language (no new Premium theme).
 */
export const SubscriptionStatusBar: FC<{
  onUpgraded?: () => void;
}> = ({ onUpgraded }) => {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const premium = isPremium(user);
  const sub = user?.subscription;

  const expiry =
    formatDate(sub?.gracePeriodEnd) || formatDate(sub?.currentPeriodEnd);

  const refreshEntitlement = async () => {
    try {
      const res = await authApi.getProfile();
      if (res.data) {
        setUser(res.data as typeof user);
        localStorage.setItem("user", JSON.stringify(res.data));
        onUpgraded?.();
      }
    } catch {
      /* ignore */
    }
  };

  const handleUpgrade = async () => {
    setMsg("");
    setBusy(true);
    try {
      const { startPremiumCheckout } = await import(
        "../../billing/startPremiumCheckout"
      );
      const result = await startPremiumCheckout();
      if (!result.ok) setMsg(result.message);
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setMsg(
        anyErr?.response?.data?.message ||
          anyErr?.message ||
          "Unable to start checkout"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleManage = async () => {
    setMsg("");
    setBusy(true);
    try {
      if (sub?.cancelAtPeriodEnd) {
        await billingApi.resume();
        setMsg("Cancellation removed — subscription resumed.");
      } else {
        await billingApi.cancel();
        setMsg("Cancellation scheduled at period end.");
      }
      await refreshEntitlement();
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setMsg(
        anyErr?.response?.data?.message ||
          anyErr?.message ||
          "Unable to update subscription"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="free-home-card free-home-subbar"
      aria-label="Subscription status"
    >
      <div className="free-home-subbar-main">
        <div className="free-home-subbar-title">
          <Crown size={16} strokeWidth={1.75} className="text-warning" aria-hidden />
          <strong>{statusLabel(sub)}</strong>
          {premium ? <PremiumBadge /> : null}
        </div>
        <p className="free-home-muted">
          {premium
            ? expiry
              ? `Access through ${expiry}${
                  sub?.cancelAtPeriodEnd ? " · cancels then" : ""
                }`
              : "Your advanced preparation features are unlocked."
            : "Upgrade for editorials, company prep, analytics, and AI assist."}
        </p>
        {msg ? (
          <p className="free-home-muted" role="status">
            {msg}
          </p>
        ) : null}
      </div>
      <div className="free-home-subbar-actions">
        {premium ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleManage()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <ExternalLink size={14} aria-hidden />
            )}
            {sub?.cancelAtPeriodEnd ? "Resume plan" : "Manage subscription"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => void handleUpgrade()}
            disabled={busy}
          >
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            Upgrade to Premium
          </Button>
        )}
      </div>
    </section>
  );
};
