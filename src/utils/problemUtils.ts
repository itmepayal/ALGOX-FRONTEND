import type { Problem, Testcase } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";

export type Difficulty = "easy" | "medium" | "hard";

export function normalizeDifficulty(d?: string): Difficulty {
  const v = (d || "easy").toLowerCase();
  if (v === "medium" || v === "hard") return v;
  return "easy";
}

/** True only for official submit ACCEPTED — Run ACCEPTED never counts as Solved. */
export function isOfficialAccept(s: Submission): boolean {
  if (s.status !== "ACCEPTED") return false;
  return s.source !== "run";
}

function submissionEffectiveTime(s: Submission): number {
  const raw = s.updatedAt || s.createdAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Submissions that count toward a specific DSA sheet.
 * When `resetAt` is set, only official accepts at/after that boundary count —
 * older ACCEPTED submissions still exist globally but do not complete the sheet.
 */
export function sheetCountingSubmissions(
  submissions: Submission[],
  resetAt?: string | null
): Submission[] {
  if (!resetAt) {
    return submissions.filter(isOfficialAccept);
  }
  const boundary = new Date(resetAt).getTime();
  if (!Number.isFinite(boundary)) {
    return submissions.filter(isOfficialAccept);
  }
  return submissions.filter(
    (s) => isOfficialAccept(s) && submissionEffectiveTime(s) >= boundary
  );
}

export function isSolved(problemId: string | undefined, submissions: Submission[]): boolean {
  if (!problemId) return false;
  return submissions.some(
    (s) =>
      (s.problemId === problemId || s.problemId?.toString() === problemId) &&
      isOfficialAccept(s)
  );
}

/** Sheet-scoped completion (respects reset boundary). Global solved uses `isSolved`. */
export function isSheetCompleted(
  problemId: string | undefined,
  submissions: Submission[],
  resetAt?: string | null
): boolean {
  if (!problemId) return false;
  return sheetCountingSubmissions(submissions, resetAt).some(
    (s) => s.problemId === problemId || s.problemId?.toString() === problemId
  );
}

/** Any Run or Submit record for this problem (Attempted). */
export function hasAttempted(
  problemId: string | undefined,
  submissions: Submission[]
): boolean {
  if (!problemId) return false;
  return submissions.some(
    (s) => s.problemId === problemId || s.problemId?.toString() === problemId
  );
}

export function groupByCategory(problems: Problem[]): Record<string, Problem[]> {
  return problems.reduce<Record<string, Problem[]>>((acc, p) => {
    const cat = p.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});
}

export function computeProgress(
  problems: Problem[],
  submissions: Submission[],
  resetAt?: string | null
) {
  const solvedIds = new Set(
    sheetCountingSubmissions(submissions, resetAt).map((s) =>
      s.problemId?.toString()
    )
  );

  const byDiff = {
    easy: { total: 0, solved: 0 },
    medium: { total: 0, solved: 0 },
    hard: { total: 0, solved: 0 },
  };

  for (const p of problems) {
    const d = normalizeDifficulty(p.difficulty);
    byDiff[d].total++;
    const pid = p.id || p._id;
    if (pid && solvedIds.has(pid.toString())) byDiff[d].solved++;
  }

  const total = problems.length;
  const solved = [...solvedIds].filter((id) =>
    problems.some((p) => (p.id || p._id)?.toString() === id)
  ).length;
  const pct = total ? Math.round((solved / total) * 100) : 0;

  return { total, solved, pct, byDiff };
}

/** Safe string for JSX — never returns a plain object/array React child. */
export function formatJudgeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Turn a testcase input into labeled rows for the LeetCode-style panel.
 * Supports object inputs like `{ nums: [...] }` and legacy string inputs.
 */
export function getTestCaseInputEntries(
  input: unknown
): Array<{ name: string; value: string }> {
  if (input === null || input === undefined) {
    return [{ name: "input", value: "[]" }];
  }

  if (typeof input === "object" && !Array.isArray(input)) {
    const entries = Object.entries(input as Record<string, unknown>);
    if (entries.length === 0) {
      return [{ name: "input", value: "{}" }];
    }
    return entries.map(([name, value]) => ({
      name,
      value: formatJudgeValue(value),
    }));
  }

  if (Array.isArray(input)) {
    return [{ name: "input", value: formatJudgeValue(input) }];
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return [{ name: "input", value: "[]" }];
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return getTestCaseInputEntries(parsed);
      }
    } catch {
      // keep as raw string (legacy newline-separated inputs)
    }
    return [{ name: "input", value: trimmed }];
  }

  return [{ name: "input", value: formatJudgeValue(input) }];
}

export function formatTestCaseInputSummary(input: unknown): string {
  const entries = getTestCaseInputEntries(input);
  if (entries.length === 1 && entries[0].name === "input") {
    return entries[0].value;
  }
  return entries.map((e) => `${e.name} = ${e.value}`).join(", ");
}

export function getTestCaseExpectedOutput(
  tc: Pick<Testcase, "output" | "expectedOutput">
): string {
  return formatJudgeValue(tc.expectedOutput ?? tc.output ?? "");
}

/**
 * Convert DB/API testcase input into stdin for the judge (same contract as EvaluationService).
 * { nums: [1,2] } → "[1,2]"
 * { nums: [...], target: 9 } → "[...]\n9"
 */
export function formatJudgeInput(input: unknown): string {
  if (input === null || input === undefined) return "";

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return formatJudgeInput(parsed);
      }
    } catch {
      // legacy raw stdin
    }
    return trimmed;
  }

  if (Array.isArray(input)) {
    return JSON.stringify(input);
  }

  if (typeof input === "object") {
    return Object.values(input as Record<string, unknown>)
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join("\n");
  }

  return String(input);
}

/** Type/JSON-aware judge comparison (matches EvaluationService). */
export function outputsMatch(actual: string, expected: string): boolean {
  const strip = (s: string) =>
    s
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim()
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n");

  const a = strip(actual ?? "");
  const e = strip(expected ?? "");
  if (a === e) return true;
  if (a.replace(/\s+/g, "") === e.replace(/\s+/g, "")) return true;

  const tryParse = (s: string): unknown => {
    const t = s.trim();
    if (!t) return undefined;
    try {
      return JSON.parse(
        t
          .replace(/\bTrue\b/g, "true")
          .replace(/\bFalse\b/g, "false")
          .replace(/\bNone\b/g, "null")
      );
    } catch {
      if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
      if (t === "true" || t === "True") return true;
      if (t === "false" || t === "False") return false;
      return undefined;
    }
  };

  const deepEqual = (x: unknown, y: unknown): boolean => {
    if (Object.is(x, y)) return true;
    if (typeof x === "number" && typeof y === "number") {
      return Math.abs(x - y) < 1e-6;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      return x.length === y.length && x.every((v, i) => deepEqual(v, y[i]));
    }
    if (typeof x === "boolean" || typeof y === "boolean") {
      return String(x).toLowerCase() === String(y).toLowerCase();
    }
    return String(x) === String(y);
  };

  const pa = tryParse(a);
  const pe = tryParse(e);
  if (pa !== undefined && pe !== undefined) return deepEqual(pa, pe);
  return false;
}

