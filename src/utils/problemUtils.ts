import type { Problem, Testcase } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";

export type Difficulty = "easy" | "medium" | "hard";

export function normalizeDifficulty(d?: string): Difficulty {
  const v = (d || "easy").toLowerCase();
  if (v === "medium" || v === "hard") return v;
  return "easy";
}

export function isSolved(problemId: string | undefined, submissions: Submission[]): boolean {
  if (!problemId) return false;
  return submissions.some(
    (s) => (s.problemId === problemId || s.problemId?.toString() === problemId) && s.status === "ACCEPTED"
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

export function computeProgress(problems: Problem[], submissions: Submission[]) {
  const solvedIds = new Set(
    submissions.filter((s) => s.status === "ACCEPTED").map((s) => s.problemId?.toString())
  );

  const byDiff = { easy: { total: 0, solved: 0 }, medium: { total: 0, solved: 0 }, hard: { total: 0, solved: 0 } };

  for (const p of problems) {
    const d = normalizeDifficulty(p.difficulty);
    byDiff[d].total++;
    const pid = p.id || p._id;
    if (pid && solvedIds.has(pid.toString())) byDiff[d].solved++;
  }

  const total = problems.length;
  const solved = [...solvedIds].filter((id) => problems.some((p) => (p.id || p._id)?.toString() === id)).length;
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
