import { load } from "@cashfreepayments/cashfree-js";
import { billingApi, type CheckoutSessionResult } from "../api/billingApi";

export type StartPremiumCheckoutResult =
  | { ok: true; provider: string; orderId?: string }
  | { ok: false; message: string };

/**
 * Start Premium checkout.
 * Cashfree: Create Order on backend → Cashfree.js checkout(paymentSessionId).
 * Stripe/sandbox: redirect to returned URL.
 * Never opens Cashfree /pg/view/sessions/checkout via raw window.location —
 * that path is not a valid browser Create Order / checkout entrypoint.
 */
export async function startPremiumCheckout(): Promise<StartPremiumCheckoutResult> {
  const cfg = await billingApi.getConfig();
  if (!cfg.data?.enabled) {
    return {
      ok: false,
      message:
        "Billing checkout is not enabled yet. Contact support or try again later.",
    };
  }

  const session = await billingApi.createCheckout();
  const data = session.data as CheckoutSessionResult | undefined;
  if (!data) {
    return { ok: false, message: "Could not start checkout. Please try again." };
  }

  if (data.provider === "cashfree" && data.paymentSessionId) {
    const mode =
      cfg.data.cashfreeEnv === "production" ? "production" : "sandbox";
    const cashfree = await load({ mode });
    if (!cashfree) {
      return {
        ok: false,
        message: "Cashfree checkout SDK failed to load. Please try again.",
      };
    }
    const result = await cashfree.checkout({
      paymentSessionId: data.paymentSessionId,
      redirectTarget: "_self",
    });
    if (result?.error) {
      return {
        ok: false,
        message:
          result.error.message ||
          "Cashfree checkout could not be opened. Please try again.",
      };
    }
    return { ok: true, provider: "cashfree", orderId: data.sessionId };
  }

  if (data.url) {
    window.location.assign(data.url);
    return { ok: true, provider: data.provider || "unknown" };
  }

  return { ok: false, message: "Could not start checkout. Please try again." };
}
