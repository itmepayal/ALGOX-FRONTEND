/**
 * Preserve the Premium feature / platform tab the user tried to open
 * so post-checkout entitlement refresh can return them there.
 * UI only — never grants access.
 */

const KEY = "algopath.pendingPremiumNav";

export type PendingPremiumNav = {
  tab: string;
  feature?: string;
  savedAt: number;
};

const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2h

export function setPendingPremiumNav(tab: string, feature?: string): void {
  try {
    const payload: PendingPremiumNav = {
      tab,
      feature,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumePendingPremiumNav(): PendingPremiumNav | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as PendingPremiumNav;
    if (!parsed?.tab || typeof parsed.tab !== "string") return null;
    if (
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function peekPendingPremiumNav(): PendingPremiumNav | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPremiumNav;
    if (!parsed?.tab) return null;
    if (
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
