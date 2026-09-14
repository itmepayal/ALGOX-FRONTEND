/** Normalize problem ids so bookmark/revision Sets compare consistently. */
export function normalizeProblemId(
  id: string | { toString(): string } | null | undefined
): string {
  if (id == null) return "";
  return String(id).trim();
}

export function updateIdSet(
  prev: Set<string>,
  problemId: string,
  enabled: boolean
): Set<string> {
  const id = normalizeProblemId(problemId);
  if (!id) return prev;
  const next = new Set(prev);
  if (enabled) next.add(id);
  else next.delete(id);
  return next;
}
