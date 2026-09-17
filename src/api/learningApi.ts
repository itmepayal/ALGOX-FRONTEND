import { problemClient, type ApiResponse } from "./problemApi";
import type {
  DailyGoalConfig,
  DailyPlan,
  StudySession,
} from "../utils/learningPersistence";

/**
 * User learning planner / goals / study sessions.
 * Authoritative store: ProblemService `/learning/*` (JWT).
 */
export const learningApi = {
  getGoals: async () => {
    const res = await problemClient.get<ApiResponse<DailyGoalConfig>>(
      "/learning/goals"
    );
    return res.data;
  },

  putGoals: async (goals: DailyGoalConfig) => {
    const res = await problemClient.put<ApiResponse<DailyGoalConfig>>(
      "/learning/goals",
      goals
    );
    return res.data;
  },

  getPlan: async (dateKey: string) => {
    const res = await problemClient.get<ApiResponse<DailyPlan>>(
      `/learning/plans/${encodeURIComponent(dateKey)}`
    );
    return res.data;
  },

  listPlans: async (from: string, to: string) => {
    const res = await problemClient.get<ApiResponse<DailyPlan[]>>(
      "/learning/plans",
      { params: { from, to } }
    );
    return res.data;
  },

  putPlan: async (dateKey: string, plan: Omit<DailyPlan, "updatedAt"> & { updatedAt?: number }) => {
    const res = await problemClient.put<ApiResponse<DailyPlan>>(
      `/learning/plans/${encodeURIComponent(dateKey)}`,
      {
        date: dateKey,
        tasks: plan.tasks,
        notes: plan.notes,
      }
    );
    return res.data;
  },

  listSessions: async (limit = 100) => {
    const res = await problemClient.get<ApiResponse<StudySession[]>>(
      "/learning/sessions",
      { params: { limit } }
    );
    return res.data;
  },

  getActiveSession: async () => {
    const res = await problemClient.get<ApiResponse<StudySession | null>>(
      "/learning/sessions/active"
    );
    return res.data;
  },

  startSession: async (topic: string) => {
    const res = await problemClient.post<ApiResponse<StudySession>>(
      "/learning/sessions",
      { topic }
    );
    return res.data;
  },

  pauseSession: async () => {
    const res = await problemClient.post<ApiResponse<StudySession | null>>(
      "/learning/sessions/active/pause"
    );
    return res.data;
  },

  resumeSession: async () => {
    const res = await problemClient.post<ApiResponse<StudySession | null>>(
      "/learning/sessions/active/resume"
    );
    return res.data;
  },

  endSession: async () => {
    const res = await problemClient.post<ApiResponse<StudySession | null>>(
      "/learning/sessions/active/end"
    );
    return res.data;
  },

  recordActivity: async (problemId: string, solved: boolean) => {
    const res = await problemClient.patch<ApiResponse<StudySession | null>>(
      "/learning/sessions/active/activity",
      { problemId, solved }
    );
    return res.data;
  },
};
