import type { Problem } from "../api/problemApi";

const PENDING_SLUG_KEY = "algox:pending-problem-slug";

/** Build a shareable URL for this problem using current origin (never hardcode localhost). */
export function getProblemShareUrl(
  problem: Pick<Problem, "slug" | "id" | "_id">
): string {
  const slug = (problem.slug || "").trim();
  const id = (problem.id || problem._id || "").toString();
  const key = slug || id;
  if (!key) {
    return typeof window !== "undefined" ? window.location.href : "";
  }
  if (typeof window === "undefined") return `/problems/${encodeURIComponent(key)}`;

  const url = new URL(window.location.href);
  url.searchParams.set("problem", key);
  // Drop hash noise; keep path as the SPA entry
  url.hash = "";
  return url.toString();
}

export function getProblemShareText(
  problem: Pick<Problem, "title" | "slug">,
  shareUrl: string
): string {
  const title = problem.title || problem.slug || "this problem";
  return `Try this DSA problem:\n${title}\n\nSolve it here:\n${shareUrl}`;
}

export function getProblemShareTitle(
  problem: Pick<Problem, "title" | "slug">
): string {
  return problem.title || problem.slug || "DSA Problem";
}

export function whatsappShareHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function linkedInShareHref(shareUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
}

export function xShareHref(text: string, shareUrl: string): string {
  const tweet = `${text}\n${shareUrl}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function rememberPendingProblemSlug(slug: string): void {
  try {
    sessionStorage.setItem(PENDING_SLUG_KEY, slug);
  } catch {
    // ignore
  }
}

export function consumePendingProblemSlug(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_SLUG_KEY);
    if (v) sessionStorage.removeItem(PENDING_SLUG_KEY);
    return v;
  } catch {
    return null;
  }
}

export function readProblemSlugFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("problem");
  if (fromQuery?.trim()) return fromQuery.trim();

  // Optional hash form: #/problems/slug
  const hash = window.location.hash.replace(/^#/, "");
  const m = hash.match(/^\/?problems\/([^/?#]+)/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export function setProblemInLocation(slug: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (slug) url.searchParams.set("problem", slug);
  else url.searchParams.delete("problem");
  url.hash = "";
  window.history.replaceState({}, "", url.toString());
}
