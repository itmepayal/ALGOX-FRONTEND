import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import { isSolved, normalizeDifficulty } from "./problemUtils";
import {
  formatDurationMs,
  toDateKey,
  type StudySession,
} from "./learningPersistence";

/**
 * Calendar day activity levels (documented product rule):
 *
 * - none:      no accepted submits and no completed study sessions
 * - planned:   daily planner has problem tasks, but no qualifying activity yet
 * - partial:   some activity (accepted and/or completed session) but planner
 *              target for the day is not fully met (when a plan exists)
 * - completed: ≥1 accepted official submit OR ≥1 completed study session;
 *              if a planner target exists, also require enough unique solved
 *              problems to cover planned problem tasks
 *
 * Qualifying “active day” for streaks: acceptedCount > 0 OR sessionsCompleted > 0.
 * Opening the app alone never qualifies.
 */

export type DayActivityLevel = "none" | "planned" | "partial" | "completed";

export interface DayActivity {
  dateKey: string;
  /** Unique problem IDs with an official ACCEPTED that day (source ≠ run). */
  solvedProblemIds: string[];
  /** Unique problem IDs with any official submit that day (source ≠ run). */
  attemptedProblemIds: string[];
  attemptedCount: number;
  acceptedCount: number;
  studyMs: number;
  sessionsCompleted: number;
  /** Topics from completed study sessions ending that day. */
  topics: string[];
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
  /** Sum of completed study-session duration for this topic (ms). */
  studyMs: number;
}

const CANONICAL_ROADMAP = [
  "Array",
  "Two Pointers",
  "Sliding Window",
  "Binary Search",
  "Strings",
  "Stack",
  "Linked List",
  "HashMap / HashSet",
  "Trees (Binary Tree / BST)",
  "Trie",
  "Heap / Priority Queue",
  "Backtracking",
  "Graphs",
  "Advanced Graphs",
  "1-D Dynamic Programming",
  "2-D Dynamic Programming",
  "Greedy",
  "Intervals",
  "Math & Geometry",
  "Bit Manipulation",
  "Basics",
  "Sorting",
  "Queue",
  "Recursion",
  "Advanced Topics",
];

const CATEGORY_ALIASES: Record<string, string> = {
  Array: "Array",
  Arrays: "Array",
  String: "Strings",
  Strings: "Strings",
  Tree: "Trees (Binary Tree / BST)",
  Trees: "Trees (Binary Tree / BST)",
  "Trees (Binary Tree / BST)": "Trees (Binary Tree / BST)",
  Graphs: "Graphs",
  Graph: "Graphs",
  DP: "1-D Dynamic Programming",
  "Dynamic Programming": "1-D Dynamic Programming",
  HashMap: "HashMap / HashSet",
  HashSet: "HashMap / HashSet",
  Heap: "Heap / Priority Queue",
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

function isOfficialSubmit(s: Submission): boolean {
  return s.source !== "run";
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
        attemptedProblemIds: [],
        attemptedCount: 0,
        acceptedCount: 0,
        studyMs: 0,
        sessionsCompleted: 0,
        topics: [],
        level: "none",
      };
      map.set(key, row);
    }
    return row;
  };

  for (const s of submissions) {
    if (!isOfficialSubmit(s)) continue;
    const key = submissionDayKey(s);
    if (!key) continue;
    const row = ensure(key);
    const pid = s.problemId?.toString();
    if (pid && !row.attemptedProblemIds.includes(pid)) {
      row.attemptedProblemIds.push(pid);
    }
    if (s.status === "ACCEPTED") {
      if (pid && !row.solvedProblemIds.includes(pid)) {
        row.solvedProblemIds.push(pid);
      }
    }
  }

  for (const row of map.values()) {
    row.attemptedCount = row.attemptedProblemIds.length;
    row.acceptedCount = row.solvedProblemIds.length;
  }

  for (const sess of sessions) {
    if (sess.status !== "completed" || !sess.endedAt) continue;
    const key = toDateKey(new Date(sess.endedAt));
    const row = ensure(key);
    row.sessionsCompleted += 1;
    row.studyMs += Math.max(0, sess.accumulatedMs);
    const topic = (sess.topic || "").trim();
    if (topic && !row.topics.includes(topic)) {
      row.topics.push(topic);
    }
  }

  if (plannedByDate) {
    for (const [key, count] of Object.entries(plannedByDate)) {
      if (count > 0) ensure(key);
    }
  }

  for (const row of map.values()) {
    const planned = plannedByDate?.[row.dateKey] || 0;
    const hasQualifying =
      row.acceptedCount > 0 || row.sessionsCompleted > 0;
    if (hasQualifying) {
      if (planned > 0 && row.solvedProblemIds.length >= planned) {
        row.level = "completed";
      } else if (planned > 0) {
        row.level = "partial";
      } else {
        row.level = "completed";
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
  submissions: Submission[],
  sessions: StudySession[] = []
): RoadmapTopic[] {
  const byCat = new Map<string, Problem[]>();
  for (const name of CANONICAL_ROADMAP) byCat.set(name, []);

  for (const p of problems) {
    const cat = canonicalizeCategory(p.category || "Basics");
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(p);
  }

  const studyByTopic = new Map<string, number>();
  for (const sess of sessions) {
    if (sess.status !== "completed") continue;
    const topic = canonicalizeCategory(sess.topic || "General");
    studyByTopic.set(
      topic,
      (studyByTopic.get(topic) || 0) + Math.max(0, sess.accumulatedMs)
    );
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
      studyMs: studyByTopic.get(name) || 0,
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
    if (s.status !== "ACCEPTED" || s.source === "run") continue;
    if (submissionDayKey(s) !== dateKey) continue;
    const pid = s.problemId?.toString();
    if (pid) set.add(pid);
  }
  return set;
}

export function everAcceptedProblemIds(submissions: Submission[]): Set<string> {
  const set = new Set<string>();
  for (const s of submissions) {
    // Run ACCEPTED must not count toward solved / planner sync
    if (s.status !== "ACCEPTED" || s.source === "run") continue;
    const pid = s.problemId?.toString();
    if (pid) set.add(pid);
  }
  return set;
}

export { formatDurationMs };
