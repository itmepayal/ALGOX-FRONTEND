import { authClient } from "./authClient";

export type PublicBillingConfig = {
  enabled: boolean;
  provider: string;
  publishableKey?: string | null;
  cashfreeEnv?: "sandbox" | "production" | null;
};

export type CheckoutSessionResult = {
  sessionId: string;
  url: string;
  provider: string;
  paymentSessionId?: string;
};

export const billingApi = {
  getConfig: async () => {
    const res = await authClient.get("/auth/subscription/billing");
    return res.data as {
      success: boolean;
      data: PublicBillingConfig;
    };
  },

  createCheckout: async () => {
    const res = await authClient.post("/auth/subscription/checkout", {});
    return res.data as {
      success: boolean;
      message?: string;
      data: CheckoutSessionResult;
      code?: string;
    };
  },

  /** Confirm Cashfree return_url — server re-checks order status. */
  confirmCashfreeOrder: async (orderId: string) => {
    const res = await authClient.post("/auth/subscription/cashfree/confirm", {
      orderId,
    });
    return res.data as {
      success: boolean;
      message?: string;
      data: { granted: boolean; duplicate: boolean; status: string };
    };
  },

  cancel: async () => {
    const res = await authClient.post("/auth/subscription/cancel", {});
    return res.data;
  },

  resume: async () => {
    const res = await authClient.post("/auth/subscription/resume", {});
    return res.data;
  },
};
