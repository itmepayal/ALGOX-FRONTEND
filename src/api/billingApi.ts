import { authClient } from "./authClient";

export type PublicBillingConfig = {
  enabled: boolean;
  provider: string;
  publishableKey?: string | null;
};

export type CheckoutSessionResult = {
  sessionId: string;
  url: string;
  provider: string;
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

  cancel: async () => {
    const res = await authClient.post("/auth/subscription/cancel", {});
    return res.data;
  },

  resume: async () => {
    const res = await authClient.post("/auth/subscription/resume", {});
    return res.data;
  },
};
