import type { Problem } from "../api/problemApi";
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
