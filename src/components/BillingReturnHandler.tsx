import { useEffect, useRef, useState, type FC } from "react";
import { billingApi } from "../api/billingApi";
import { useAuth } from "../context/AuthContext";

/**
 * Handles Cashfree (and generic) return_url query params.
 * Confirms payment server-side — never trusts URL alone for Premium.
 */
export const BillingReturnHandler: FC = () => {
  const { user, refreshEntitlements } = useAuth();
  const ran = useRef(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!user || ran.current) return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    const orderId = params.get("order_id") || params.get("orderId");
    if (billing !== "success" || !orderId) return;

    ran.current = true;
    void (async () => {
      try {
        const res = await billingApi.confirmCashfreeOrder(orderId);
        if (res.data?.granted) {
          setNote("Premium activated. Enjoy AlgoPath Premium!");
          await refreshEntitlements();
        } else {
          setNote(
            `Payment status: ${res.data?.status || "pending"}. If you paid, Premium will unlock shortly via webhook.`
          );
        }
      } catch (err: any) {
        setNote(
          err?.response?.data?.message ||
            "Could not confirm payment yet. Refresh in a moment."
        );
      } finally {
        // Clean query params without full reload
        params.delete("billing");
        params.delete("order_id");
        params.delete("orderId");
        const next = params.toString();
        const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", url);
      }
    })();
  }, [user, refreshEntitlements]);

  if (!note) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[180] max-w-md -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg"
    >
      <p className="text-foreground">{note}</p>
      <button
        type="button"
        className="mt-2 text-xs text-muted-foreground underline"
        onClick={() => setNote(null)}
      >
        Dismiss
      </button>
    </div>
  );
};
