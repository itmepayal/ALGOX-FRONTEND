/**
 * Presentational duration formatter.
 * Never invents values — returns "Unavailable" for null/invalid input.
 * Does not alter underlying backend millisecond values.
 */
export function formatHumanDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "Unavailable";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  return `${s}s`;
}

/** Replace raw millisecond tokens in backend detail strings for display. */
export function formatScoreDetailMs(detail?: string): string | undefined {
  if (!detail) return undefined;
  return detail.replace(/(\d+(?:\.\d+)?)\s*ms\b/gi, (_, raw: string) =>
    formatHumanDuration(Number(raw))
  );
}
