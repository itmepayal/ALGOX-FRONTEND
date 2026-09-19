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
    formatDate(sub?.gracePeriodEnd) ||
    formatDate(sub?.currentPeriodEnd);

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
    } catch (err: any) {
      setMsg(
        err?.response?.data?.message ||
          err?.message ||
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
    } catch (err: any) {
      setMsg(
        err?.response?.data?.message ||
          err?.message ||
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
          <Crown size={16} className="text-warning" aria-hidden />
          <strong>{statusLabel(sub)}</strong>
          {premium ? <PremiumBadge /> : null}
        </div>
        <p className="free-home-muted">
          {premium
            ? expiry
              ? `Access through ${expiry}${
                  sub?.cancelAtPeriodEnd ? " · cancels then" : ""
                }`
              : "Open-ended Premium grant"
            : "Upgrade for editorials, company prep, analytics, and AI assist."}
        </p>
        {msg ? (
          <p className="free-home-muted" role="status">
            {msg}
          </p>
        ) : null}
      </div>
      <div className="free-home-subbar-actions">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void refreshEntitlement()}
          disabled={busy}
        >
          Refresh entitlement
        </Button>
        {premium ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleManage()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ExternalLink size={14} />
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
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Upgrade to Premium
          </Button>
        )}
      </div>
    </section>
  );
};
