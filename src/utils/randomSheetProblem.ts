import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import { normalizeProblemId } from "./engagementIds";
import { hasAttempted, isSheetCompleted } from "./problemUtils";

const RECENT_KEY_PREFIX = "algox:sheet-random-recent:";
const MAX_RECENT = 8;

export type RandomPickMode = "smart" | "any" | "solved-only";

export interface RandomPickResult {
  problem: Problem | null;
  reason:
    | "ok"
    | "empty"
    | "sheet-complete"
    | "filtered-complete";
  poolSize: number;
}

function cryptoRandomIndex(length: number): number {
  if (length <= 0) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % length;
  }
  return Math.floor(Math.random() * length);
}

function pickOne<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[cryptoRandomIndex(items.length)] ?? null;
}

export function loadRecentRandomIds(sheetId: string): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY_PREFIX + sheetId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function pushRecentRandomId(sheetId: string, problemId: string): void {
  try {
    const prev = loadRecentRandomIds(sheetId).filter((id) => id !== problemId);
    const next = [problemId, ...prev].slice(0, MAX_RECENT);
    sessionStorage.setItem(RECENT_KEY_PREFIX + sheetId, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

function withoutRecent(problems: Problem[], recentIds: string[]): Problem[] {
  if (problems.length <= 1 || recentIds.length === 0) return problems;
  const recent = new Set(recentIds);
  const filtered = problems.filter((p) => {
    const id = normalizeProblemId(p.id || p._id);
    return id && !recent.has(id);
  });
  return filtered.length > 0 ? filtered : problems;
}

/**
 * Smart random from sheet-scoped eligible problems (already filter-matched).
 * Prefer: not started → attempted → completed (only if nothing else left).
 * Does not mutate progress / submissions / bookmarks.
 */
export function pickRandomSheetProblem(
  eligible: Problem[],
  submissions: Submission[],
  resetAt: string | null | undefined,
  options?: {
    mode?: RandomPickMode;
    recentIds?: string[];
    sheetAllComplete?: boolean;
  }
): RandomPickResult {
  const mode = options?.mode ?? "smart";
  const recentIds = options?.recentIds ?? [];

  if (!eligible.length) {
    return { problem: null, reason: "empty", poolSize: 0 };
  }

  const notStarted: Problem[] = [];
  const attempted: Problem[] = [];
  const completed: Problem[] = [];

  for (const p of eligible) {
    const pid = normalizeProblemId(p.id || p._id);
    if (!pid) continue;
    if (isSheetCompleted(pid, submissions, resetAt)) {
      completed.push(p);
    } else if (hasAttempted(pid, submissions)) {
      attempted.push(p);
    } else {
      notStarted.push(p);
    }
  }

  if (mode === "solved-only") {
    const pool = withoutRecent(completed, recentIds);
    return {
      problem: pickOne(pool),
      reason: pool.length ? "ok" : "empty",
      poolSize: pool.length,
    };
  }

  if (mode === "any") {
    const pool = withoutRecent(eligible, recentIds);
    return {
      problem: pickOne(pool),
      reason: pool.length ? "ok" : "empty",
      poolSize: pool.length,
    };
  }

  // smart
  const incomplete = [...notStarted, ...attempted];
  if (incomplete.length === 0) {
    if (options?.sheetAllComplete) {
      return { problem: null, reason: "sheet-complete", poolSize: completed.length };
    }
    return {
      problem: null,
      reason: "filtered-complete",
      poolSize: completed.length,
    };
  }

  // Prefer not-started over attempted when both exist
  const preferred =
    notStarted.length > 0
      ? notStarted
      : attempted.length > 0
        ? attempted
        : incomplete;

  const pool = withoutRecent(preferred, recentIds);
  return {
    problem: pickOne(pool),
    reason: "ok",
    poolSize: pool.length,
  };
}
