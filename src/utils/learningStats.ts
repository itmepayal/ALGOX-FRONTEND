import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import { isSolved, normalizeDifficulty } from "./problemUtils";
import { toDateKey, type StudySession } from "./learningPersistence";

export type DayActivityLevel = "none" | "planned" | "partial" | "completed";

export interface DayActivity {
  dateKey: string;
  solvedProblemIds: string[];
  attemptedCount: number;
  acceptedCount: number;
  studyMs: number;
  sessionsCompleted: number;
  level: DayActivityLevel;
}

export interface RoadmapTopic {
  name: string;
  total: number;
  solved: number;
  pct: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  easy: number;
  medium: number;
  hard: number;
  problemIds: string[];
}

const CANONICAL_ROADMAP = [
  "Basics",
  "Arrays",
  "Strings",
  "Sorting",
  "Binary Search",
  "Two Pointers",
  "Sliding Window",
  "Linked List",
  "Stack",
  "Queue",
  "Recursion",
  "Backtracking",
  "Trees",
  "BST",
  "Heap",
  "Greedy",
  "Graph",
  "Dynamic Programming",
  "Trie",
  "Advanced Topics",
];

const CATEGORY_ALIASES: Record<string, string> = {
  Array: "Arrays",
  Arrays: "Arrays",
  String: "Strings",
  Strings: "Strings",
  Tree: "Trees",
  Trees: "Trees",
  Graphs: "Graph",
  Graph: "Graph",
  DP: "Dynamic Programming",
  "Dynamic Programming": "Dynamic Programming",
};

function canonicalizeCategory(raw: string): string {
  const trimmed = raw.trim();
  if (CATEGORY_ALIASES[trimmed]) return CATEGORY_ALIASES[trimmed];
  const hit = CANONICAL_ROADMAP.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  return hit || trimmed;
}

function submissionDayKey(s: Submission): string | null {
  const raw = s.createdAt || s.updatedAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return toDateKey(d);
}

export function buildDayActivityMap(
  submissions: Submission[],
  sessions: StudySession[],
  plannedByDate?: Record<string, number>
): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();

  const ensure = (key: string): DayActivity => {
    let row = map.get(key);
    if (!row) {
      row = {
        dateKey: key,
        solvedProblemIds: [],
        attemptedCount: 0,
        acceptedCount: 0,
        studyMs: 0,
        sessionsCompleted: 0,
        level: "none",
      };
      map.set(key, row);
    }
    return row;
  };

  for (const s of submissions) {
    const key = submissionDayKey(s);
    if (!key) continue;
    const row = ensure(key);
    row.attemptedCount += 1;
    if (s.status === "ACCEPTED") {
      row.acceptedCount += 1;
      const pid = s.problemId?.toString();
      if (pid && !row.solvedProblemIds.includes(pid)) {
        row.solvedProblemIds.push(pid);
      }
    }
  }

  for (const sess of sessions) {
    if (sess.status !== "completed" || !sess.endedAt) continue;
    const key = toDateKey(new Date(sess.endedAt));
    const row = ensure(key);
    row.sessionsCompleted += 1;
    row.studyMs += Math.max(0, sess.accumulatedMs);
  }

  if (plannedByDate) {
    for (const [key, count] of Object.entries(plannedByDate)) {
      if (count > 0) ensure(key);
    }
  }

  for (const row of map.values()) {
    const planned = plannedByDate?.[row.dateKey] || 0;
    if (row.acceptedCount > 0 || row.sessionsCompleted > 0) {
      if (planned > 0 && row.solvedProblemIds.length >= planned) {
        row.level = "completed";
      } else if (row.acceptedCount > 0 || row.sessionsCompleted > 0) {
        row.level = planned > 0 ? "partial" : "completed";
      }
    } else if (planned > 0) {
      row.level = "planned";
    } else {
      row.level = "none";
    }
  }

  return map;
}

export function computeStreaks(
  activity: Map<string, DayActivity>
): { current: number; longest: number } {
  const activeDays = [...activity.values()]
    .filter((d) => d.acceptedCount > 0 || d.sessionsCompleted > 0)
    .map((d) => d.dateKey)
    .sort();

  if (activeDays.length === 0) return { current: 0, longest: 0 };

  const set = new Set(activeDays);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < activeDays.length; i++) {
    const prev = parseDateOnly(activeDays[i - 1]);
    const cur = parseDateOnly(activeDays[i]);
    const diff = (cur.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  let current = 0;
  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - 86400000));
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  while (cursor && set.has(cursor)) {
    current += 1;
    const d = parseDateOnly(cursor);
    d.setDate(d.getDate() - 1);
    cursor = toDateKey(d);
  }

  return { current, longest: Math.max(longest, current) };
}

function parseDateOnly(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function buildRoadmap(
  problems: Problem[],
  submissions: Submission[]
): RoadmapTopic[] {
  const byCat = new Map<string, Problem[]>();
  for (const name of CANONICAL_ROADMAP) byCat.set(name, []);

  for (const p of problems) {
    const cat = canonicalizeCategory(p.category || "Basics");
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(p);
  }

  const topics: RoadmapTopic[] = [];
  for (const [name, list] of byCat) {
    let solved = 0;
    let easy = 0;
    let medium = 0;
    let hard = 0;
    const problemIds: string[] = [];
    for (const p of list) {
      const pid = (p.id || p._id || "").toString();
      problemIds.push(pid);
      const diff = normalizeDifficulty(p.difficulty);
      if (diff === "easy") easy++;
      else if (diff === "hard") hard++;
      else medium++;
      if (isSolved(pid, submissions)) solved++;
    }
    const total = list.length;
    const pct = total ? Math.round((solved / total) * 100) : 0;
    const status =
      total === 0
        ? "NOT_STARTED"
        : solved === 0
          ? "NOT_STARTED"
          : solved >= total
            ? "COMPLETED"
            : "IN_PROGRESS";
    topics.push({
      name,
      total,
      solved,
      pct,
      status,
      easy,
      medium,
      hard,
      problemIds,
    });
  }

  topics.sort((a, b) => {
    const ia = CANONICAL_ROADMAP.findIndex(
      (x) => x.toLowerCase() === a.name.toLowerCase()
    );
    const ib = CANONICAL_ROADMAP.findIndex(
      (x) => x.toLowerCase() === b.name.toLowerCase()
    );
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  return topics;
}

export function acceptedProblemIdsOnDate(
  submissions: Submission[],
  dateKey: string
): Set<string> {
  const set = new Set<string>();
  for (const s of submissions) {
    if (s.status !== "ACCEPTED") continue;
    if (submissionDayKey(s) !== dateKey) continue;
    const pid = s.problemId?.toString();
    if (pid) set.add(pid);
  }
  return set;
}

export function everAcceptedProblemIds(submissions: Submission[]): Set<string> {
  const set = new Set<string>();
  for (const s of submissions) {
    if (s.status !== "ACCEPTED") continue;
    const pid = s.problemId?.toString();
    if (pid) set.add(pid);
  }
  return set;
}
