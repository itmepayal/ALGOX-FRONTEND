/** Client-side learning state (planner / study sessions / goals). No secrets. */

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
  /** Manual complete vs auto from ACCEPTED */
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
  /** Wall clock when current running segment started */
  segmentStartedAt: number | null;
  /** Accumulated active ms while paused / before current segment */
  accumulatedMs: number;
  endedAt?: number;
  attemptedProblemIds: string[];
  solvedProblemIds: string[];
  updatedAt: number;
}

const GOALS_PREFIX = "algox:daily-goals:";
const PLAN_PREFIX = "algox:daily-plan:";
const SESSIONS_PREFIX = "algox:study-sessions:";
const ACTIVE_SESSION_KEY = "algox:active-study-session:";

export const DEFAULT_GOALS: DailyGoalConfig = {
  problemsPerDay: 8,
  studyMinutes: 120,
  revisionTopics: 1,
  sessionsPerDay: 1,
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

export function loadDailyGoals(userId: string | undefined): DailyGoalConfig {
  try {
    const raw = localStorage.getItem(`${GOALS_PREFIX}${userId || "guest"}`);
    if (!raw) return { ...DEFAULT_GOALS };
    return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GOALS };
  }
}

export function saveDailyGoals(
  userId: string | undefined,
  goals: DailyGoalConfig
): void {
  try {
    localStorage.setItem(
      `${GOALS_PREFIX}${userId || "guest"}`,
      JSON.stringify(goals)
    );
  } catch {
    // ignore
  }
}

export function loadDailyPlan(
  userId: string | undefined,
  dateKey: string
): DailyPlan {
  try {
    const raw = localStorage.getItem(
      `${PLAN_PREFIX}${userId || "guest"}:${dateKey}`
    );
    if (!raw) {
      return { date: dateKey, tasks: [], updatedAt: Date.now() };
    }
    const parsed = JSON.parse(raw) as DailyPlan;
    return {
      date: dateKey,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      notes: parsed.notes,
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return { date: dateKey, tasks: [], updatedAt: Date.now() };
  }
}

export function saveDailyPlan(
  userId: string | undefined,
  plan: DailyPlan
): void {
  try {
    localStorage.setItem(
      `${PLAN_PREFIX}${userId || "guest"}:${plan.date}`,
      JSON.stringify({ ...plan, updatedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

export function addPlannerProblem(
  userId: string | undefined,
  dateKey: string,
  problem: { id: string; title: string; slug?: string }
): DailyPlan {
  const plan = loadDailyPlan(userId, dateKey);
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
  saveDailyPlan(userId, plan);
  return plan;
}

export function loadAllSessions(userId: string | undefined): StudySession[] {
  try {
    const raw = localStorage.getItem(`${SESSIONS_PREFIX}${userId || "guest"}`);
    if (!raw) return [];
    const list = JSON.parse(raw) as StudySession[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAllSessions(
  userId: string | undefined,
  sessions: StudySession[]
): void {
  try {
    localStorage.setItem(
      `${SESSIONS_PREFIX}${userId || "guest"}`,
      JSON.stringify(sessions.slice(0, 200))
    );
  } catch {
    // ignore
  }
}

export function loadActiveSession(
  userId: string | undefined
): StudySession | null {
  try {
    const raw = localStorage.getItem(
      `${ACTIVE_SESSION_KEY}${userId || "guest"}`
    );
    if (!raw) return null;
    return JSON.parse(raw) as StudySession;
  } catch {
    return null;
  }
}

function saveActiveSession(
  userId: string | undefined,
  session: StudySession | null
): void {
  try {
    const key = `${ACTIVE_SESSION_KEY}${userId || "guest"}`;
    if (!session) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(session));
  } catch {
    // ignore
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

export function startStudySession(
  userId: string | undefined,
  topic: string
): StudySession {
  const existing = loadActiveSession(userId);
  if (existing && existing.status !== "completed") {
    return existing;
  }
  const now = Date.now();
  const session: StudySession = {
    id: uid(),
    topic: topic || "General",
    status: "running",
    startedAt: now,
    segmentStartedAt: now,
    accumulatedMs: 0,
    attemptedProblemIds: [],
    solvedProblemIds: [],
    updatedAt: now,
  };
  saveActiveSession(userId, session);
  return session;
}

export function pauseStudySession(
  userId: string | undefined
): StudySession | null {
  const s = loadActiveSession(userId);
  if (!s || s.status !== "running") return s;
  const now = Date.now();
  const next: StudySession = {
    ...s,
    status: "paused",
    accumulatedMs: getSessionActiveMs(s, now),
    segmentStartedAt: null,
    updatedAt: now,
  };
  saveActiveSession(userId, next);
  return next;
}

export function resumeStudySession(
  userId: string | undefined
): StudySession | null {
  const s = loadActiveSession(userId);
  if (!s || s.status !== "paused") return s;
  const now = Date.now();
  const next: StudySession = {
    ...s,
    status: "running",
    segmentStartedAt: now,
    updatedAt: now,
  };
  saveActiveSession(userId, next);
  return next;
}

export function endStudySession(
  userId: string | undefined
): StudySession | null {
  const s = loadActiveSession(userId);
  if (!s) return null;
  const now = Date.now();
  const completed: StudySession = {
    ...s,
    status: "completed",
    accumulatedMs: getSessionActiveMs(s, now),
    segmentStartedAt: null,
    endedAt: now,
    updatedAt: now,
  };
  const all = loadAllSessions(userId);
  all.unshift(completed);
  saveAllSessions(userId, all);
  saveActiveSession(userId, null);
  return completed;
}

/** Record attempt/solve into active session (idempotent per problem id). */
export function recordSessionProblemActivity(
  userId: string | undefined,
  problemId: string,
  solved: boolean
): StudySession | null {
  const s = loadActiveSession(userId);
  if (!s || s.status === "completed") return null;
  const attempted = new Set(s.attemptedProblemIds);
  const solvedSet = new Set(s.solvedProblemIds);
  attempted.add(problemId);
  if (solved) solvedSet.add(problemId);
  const next: StudySession = {
    ...s,
    attemptedProblemIds: [...attempted],
    solvedProblemIds: [...solvedSet],
    updatedAt: Date.now(),
  };
  saveActiveSession(userId, next);
  return next;
}

/** Mark planned problems complete when ACCEPTED submissions exist. */
export function syncPlannerWithAccepted(
  userId: string | undefined,
  dateKey: string,
  acceptedProblemIds: Set<string>
): DailyPlan {
  const plan = loadDailyPlan(userId, dateKey);
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
  const next = { ...plan, tasks, updatedAt: Date.now() };
  saveDailyPlan(userId, next);
  return next;
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
