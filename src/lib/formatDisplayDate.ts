/**
 * Presentational date formatter for published/updated timestamps.
 * Returns null when input is missing/invalid — callers omit the field.
 */
export function formatDisplayDate(
  iso: string | null | undefined
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
