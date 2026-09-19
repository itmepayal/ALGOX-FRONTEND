/**
 * Safe user-facing text from API values.
 * Never renders `[object Object]` or arrays-as-children.
 * Does not rewrite legitimate content strings.
 */

/** Coerce unknown API fields into a single display string. */
export function asDisplayText(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") {
    const t = value.trim();
    return t || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => asDisplayText(v, ""))
      .map((v) => v.trim())
      .filter(Boolean);
    return parts.join(" ") || fallback;
  }
  return fallback;
}
