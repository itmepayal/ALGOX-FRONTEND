/**
 * Learning planner / study sessions / goals.
 *
 * Server (ProblemService `/learning/*`) is authoritative for authenticated users.
 * In-memory cache is a read-through optimization only — never treated as durable store.
 * Guests get empty/default state; mutations require login and throw on network failure
 * so callers cannot silently claim persistence succeeded.
 */

import { learningApi } from "../api/learningApi";

export interface DailyGoalConfig {
  problemsPerDay: number;
  studyMinutes: number;
  revisionTopics: number;
  sessionsPerDay: number;
}

export interface PlannerTask {
  id: string;
  type: "problem" | "revision" | "session" | "custom";
  title: string;
  problemId?: string;
  problemSlug?: string;
  completed: boolean;
  completedSource?: "manual" | "submission";
  createdAt: number;
}

export interface DailyPlan {
  date: string; // YYYY-MM-DD
  tasks: PlannerTask[];
  notes?: string;
  updatedAt: number;
}

export type StudySessionStatus = "running" | "paused" | "completed";

export interface StudySession {
  id: string;
  topic: string;
  status: StudySessionStatus;
  startedAt: number;
  segmentStartedAt: number | null;
  accumulatedMs: number;
  endedAt?: number;
  attemptedProblemIds: string[];
  solvedProblemIds: string[];
  updatedAt: number;
}

export const DEFAULT_GOALS: DailyGoalConfig = {
  problemsPerDay: 8,
  studyMinutes: 120,
  revisionTopics: 1,
  sessionsPerDay: 1,
};

export class LearningPersistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearningPersistError";
  }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requireAuth(userId: string | undefined): asserts userId is string {
  if (!userId) {
    throw new LearningPersistError("Sign in to sync learning data across devices");
  }
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const ax = err as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return ax?.response?.data?.message || ax?.message || fallback;
}

export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Ephemeral read-through cache (not durable / not authoritative). */
const goalsCache = new Map<string, DailyGoalConfig>();
const planCache = new Map<string, DailyPlan>();
const sessionsCache = new Map<string, StudySession[]>();
const activeCache = new Map<string, StudySession | null>();

function planCacheKey(userId: string, dateKey: string) {
  return `${userId}:${dateKey}`;
}

export async function loadDailyGoals(
  userId: string | undefined
): Promise<DailyGoalConfig> {
  if (!userId) return { ...DEFAULT_GOALS };
  try {
    const res = await learningApi.getGoals();
    const goals = { ...DEFAULT_GOALS, ...(res.data || {}) };
    goalsCache.set(userId, goals);
    return goals;
  } catch (err) {
    const cached = goalsCache.get(userId);
    if (cached) return { ...cached };
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to load learning goals")
    );
  }
}

export async function saveDailyGoals(
  userId: string | undefined,
  goals: DailyGoalConfig
): Promise<DailyGoalConfig> {
  requireAuth(userId);
  try {
    const res = await learningApi.putGoals(goals);
    const saved = { ...DEFAULT_GOALS, ...(res.data || goals) };
    goalsCache.set(userId, saved);
    return saved;
  } catch (err) {
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to save learning goals")
    );
  }
}

export async function loadDailyPlan(
  userId: string | undefined,
  dateKey: string
): Promise<DailyPlan> {
  const empty: DailyPlan = { date: dateKey, tasks: [], updatedAt: Date.now() };
  if (!userId) return empty;
  try {
    const res = await learningApi.getPlan(dateKey);
    const plan: DailyPlan = {
      date: dateKey,
      tasks: Array.isArray(res.data?.tasks) ? res.data!.tasks : [],
      notes: res.data?.notes,
      updatedAt: res.data?.updatedAt || Date.now(),
    };
    planCache.set(planCacheKey(userId, dateKey), plan);
    return plan;
  } catch (err) {
    const cached = planCache.get(planCacheKey(userId, dateKey));
    if (cached) return cached;
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to load daily plan")
    );
  }
}

export async function saveDailyPlan(
  userId: string | undefined,
  plan: DailyPlan
): Promise<DailyPlan> {
  requireAuth(userId);
  try {
    const res = await learningApi.putPlan(plan.date, plan);
    const saved: DailyPlan = {
      date: plan.date,
      tasks: Array.isArray(res.data?.tasks) ? res.data!.tasks : plan.tasks,
      notes: res.data?.notes ?? plan.notes,
      updatedAt: res.data?.updatedAt || Date.now(),
    };
    planCache.set(planCacheKey(userId, plan.date), saved);
    return saved;
  } catch (err) {
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to save daily plan")
    );
  }
}

export async function addPlannerProblem(
  userId: string | undefined,
  dateKey: string,
  problem: { id: string; title: string; slug?: string }
): Promise<DailyPlan> {
  const plan = await loadDailyPlan(userId, dateKey);
  if (plan.tasks.some((t) => t.problemId === problem.id)) return plan;
  plan.tasks.push({
    id: uid(),
    type: "problem",
    title: problem.title,
    problemId: problem.id,
    problemSlug: problem.slug,
    completed: false,
    createdAt: Date.now(),
  });
  return saveDailyPlan(userId, { ...plan, updatedAt: Date.now() });
}

export async function loadAllSessions(
  userId: string | undefined
): Promise<StudySession[]> {
  if (!userId) return [];
  try {
    const res = await learningApi.listSessions(200);
    const list = Array.isArray(res.data) ? res.data : [];
    sessionsCache.set(userId, list);
    return list;
  } catch (err) {
    const cached = sessionsCache.get(userId);
    if (cached) return cached;
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to load study sessions")
    );
  }
}

export async function loadActiveSession(
  userId: string | undefined
): Promise<StudySession | null> {
  if (!userId) return null;
  try {
    const res = await learningApi.getActiveSession();
    const session = res.data ?? null;
    activeCache.set(userId, session);
    return session;
  } catch (err) {
    if (activeCache.has(userId)) return activeCache.get(userId) ?? null;
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to load active study session")
    );
  }
}

export function getSessionActiveMs(
  session: StudySession,
  now = Date.now()
): number {
  if (session.status === "running" && session.segmentStartedAt != null) {
    return Math.max(
      0,
      session.accumulatedMs + (now - session.segmentStartedAt)
    );
  }
  return Math.max(0, session.accumulatedMs);
}

export async function startStudySession(
  userId: string | undefined,
  topic: string
): Promise<StudySession> {
  requireAuth(userId);
  try {
    const res = await learningApi.startSession(topic || "General");
    if (!res.data) {
      throw new LearningPersistError("Server did not return a study session");
    }
    activeCache.set(userId, res.data);
    return res.data;
  } catch (err) {
    if (err instanceof LearningPersistError) throw err;
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to start study session")
    );
  }
}

export async function pauseStudySession(
  userId: string | undefined
): Promise<StudySession | null> {
  requireAuth(userId);
  try {
    const res = await learningApi.pauseSession();
    const session = res.data ?? null;
    activeCache.set(userId, session);
    return session;
  } catch (err) {
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to pause study session")
    );
  }
}

export async function resumeStudySession(
  userId: string | undefined
): Promise<StudySession | null> {
  requireAuth(userId);
  try {
    const res = await learningApi.resumeSession();
    const session = res.data ?? null;
    activeCache.set(userId, session);
    return session;
  } catch (err) {
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to resume study session")
    );
  }
}

export async function endStudySession(
  userId: string | undefined
): Promise<StudySession | null> {
  requireAuth(userId);
  try {
    const res = await learningApi.endSession();
    activeCache.set(userId, null);
    if (res.data) {
      const prev = sessionsCache.get(userId) || [];
      sessionsCache.set(userId, [res.data, ...prev].slice(0, 200));
    }
    return res.data ?? null;
  } catch (err) {
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to end study session")
    );
  }
}

export async function recordSessionProblemActivity(
  userId: string | undefined,
  problemId: string,
  solved: boolean
): Promise<StudySession | null> {
  if (!userId || !problemId) return null;
  try {
    const res = await learningApi.recordActivity(problemId, solved);
    const session = res.data ?? null;
    if (session) activeCache.set(userId, session);
    return session;
  } catch (err) {
    throw new LearningPersistError(
      apiErrorMessage(err, "Failed to record study session activity")
    );
  }
}

/** Mark planned problems complete when ACCEPTED submissions exist. */
export async function syncPlannerWithAccepted(
  userId: string | undefined,
  dateKey: string,
  acceptedProblemIds: Set<string>
): Promise<DailyPlan> {
  const plan = await loadDailyPlan(userId, dateKey);
  let changed = false;
  const tasks = plan.tasks.map((t) => {
    if (
      t.type === "problem" &&
      t.problemId &&
      acceptedProblemIds.has(t.problemId) &&
      !t.completed
    ) {
      changed = true;
      return {
        ...t,
        completed: true,
        completedSource: "submission" as const,
      };
    }
    return t;
  });
  if (!changed) return plan;
  return saveDailyPlan(userId, { ...plan, tasks, updatedAt: Date.now() });
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatHMS(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Clear ephemeral caches (e.g. on logout). */
export function clearLearningCache(userId?: string): void {
  if (!userId) {
    goalsCache.clear();
    planCache.clear();
    sessionsCache.clear();
    activeCache.clear();
    return;
  }
  goalsCache.delete(userId);
  sessionsCache.delete(userId);
  activeCache.delete(userId);
  for (const key of [...planCache.keys()]) {
    if (key.startsWith(`${userId}:`)) planCache.delete(key);
  }
}
