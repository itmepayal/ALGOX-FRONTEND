import { useState, type FC } from "react";
import { Crown, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isPremium } from "../../access/accessModel";
import { authApi } from "../../api/authApi";
import { billingApi } from "../../api/billingApi";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

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
      className={`free-home-card free-home-subbar ${premium ? "is-premium" : "is-free"}`}
      aria-label="Account and subscription status"
    >
      <div className="free-home-subbar-main">
        <div className="free-home-subbar-title">
          <Crown size={15} strokeWidth={2} className={premium ? "text-warning" : "text-muted"} aria-hidden />
          <Badge variant={premium ? "warning" : "default"}>
            {premium ? "PREMIUM" : "FREE"}
          </Badge>
        </div>
        <strong className="free-home-subbar-label">
          {premium ? "Your premium learning experience is active." : "Upgrade for editorials, company preparation, analytics and AI assist."}
        </strong>
        {expiry && premium ? (
          <p className="free-home-muted" style={{ marginTop: 2 }}>
            Access through {expiry}{sub?.cancelAtPeriodEnd ? " · cancels at period end" : ""}
          </p>
        ) : null}
        {msg ? (
          <p className="free-home-muted" role="status">
            {msg}
          </p>
        ) : null}
      </div>
      <div className="free-home-subbar-actions">
        {premium ? (
          sub?.cancelAtPeriodEnd ? (
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
              Resume plan
            </Button>
          ) : null
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
