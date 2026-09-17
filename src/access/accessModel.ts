/**
 * Client-side access model helpers.
 * Source of truth remains AuthService; these only interpret safe API fields.
 */

export type AccessTier = "GUEST" | "FREE" | "PREMIUM";
export type SubscriptionPlanId = "FREE" | "PREMIUM";
export type EntitlementStatus =
  | "none"
  | "active"
  | "canceled"
  | "past_due"
  | "expired"
  | "grace";

export interface PublicSubscription {
  plan: SubscriptionPlanId;
  status: EntitlementStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  gracePeriodEnd?: string | null;
  source?: string;
}

export interface AccessUser {
  role?: string | null;
  subscription?: PublicSubscription | null;
  accessTier?: AccessTier | null;
}

/** Guest = unauthenticated. Never trust a client-invented premium flag. */
export function resolveAccessTier(user: AccessUser | null | undefined): AccessTier {
  if (!user) return "GUEST";
  if (user.accessTier === "PREMIUM" || user.accessTier === "FREE") {
    return user.accessTier;
  }
  const sub = user.subscription;
  if (!sub || sub.plan !== "PREMIUM") return "FREE";
  const now = Date.now();
  if (sub.status === "grace") {
    const grace = sub.gracePeriodEnd ? Date.parse(sub.gracePeriodEnd) : NaN;
    if (Number.isFinite(grace) && grace >= now) return "PREMIUM";
  }
  if (sub.status !== "active" && sub.status !== "grace") return "FREE";
  if (sub.currentPeriodEnd) {
    const end = Date.parse(sub.currentPeriodEnd);
    if (Number.isFinite(end) && end < now) {
      const grace = sub.gracePeriodEnd ? Date.parse(sub.gracePeriodEnd) : NaN;
      return Number.isFinite(grace) && grace >= now ? "PREMIUM" : "FREE";
    }
  }
  return "PREMIUM";
}

export function isGuest(user: AccessUser | null | undefined): boolean {
  return resolveAccessTier(user) === "GUEST";
}

export function isPremium(user: AccessUser | null | undefined): boolean {
  return resolveAccessTier(user) === "PREMIUM";
}

export function isFree(user: AccessUser | null | undefined): boolean {
  return resolveAccessTier(user) === "FREE";
}
