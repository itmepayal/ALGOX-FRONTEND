import { problemClient, type ApiResponse } from "./problemApi";

export type ChallengeTier = "standard" | "advanced";

export interface DailyChallengePublic {
  dateKey: string;
  tier: ChallengeTier;
  isPublished: boolean;
  accessLocked: boolean;
  problemId: string | null;
  problemSlug: string | null;
  title: string | null;
  difficulty: string | null;
  category: string | null;
  completed?: boolean;
}

export interface TodayChallengeResponse {
  dateKey: string;
  timezone: string;
  completed: boolean;
  challenge: DailyChallengePublic;
  rules: Record<string, string>;
}

export interface StreakView {
  timezone: string;
  todayKey: string;
  currentStreak: number;
  longestStreak: number;
  lastQualifiedDateKey: string | null;
  freezeBalance: number;
  weeklyGoal: { target: number; completed: number; met: boolean };
  monthlyGoal: { target: number; completed: number; met: boolean };
  badges: Array<{ id: string; label: string; earnedAt: string }>;
}

export interface ChallengeCalendarDay {
  dateKey: string;
  kind: "completed" | "frozen";
  problemId: string;
  completedAt: string;
  challengeTitle: string | null;
  tier: ChallengeTier;
}

/**
 * Daily challenge + streak — ProblemService `/challenges/*` (server SoT).
 * Client timestamps are never accepted for qualifying activity.
 */
export const challengeApi = {
  getToday: async () => {
    const res = await problemClient.get<ApiResponse<TodayChallengeResponse>>(
      "/challenges/today"
    );
    return res.data;
  },

  getHistory: async (from: string, to: string) => {
    const res = await problemClient.get<
      ApiResponse<{
        from: string;
        to: string;
        historyLocked: boolean;
        freeWindowDays: number;
        items: DailyChallengePublic[];
      }>
    >("/challenges/history", { params: { from, to } });
    return res.data;
  },

  getByDate: async (dateKey: string) => {
    const res = await problemClient.get<
      ApiResponse<{
        dateKey: string;
        completed: boolean;
        challenge: DailyChallengePublic;
      }>
    >(`/challenges/date/${encodeURIComponent(dateKey)}`);
    return res.data;
  },

  complete: async (submissionId?: string) => {
    const res = await problemClient.post<
      ApiResponse<{
        duplicate: boolean;
        dateKey: string;
        completion: unknown;
        streak: StreakView;
      }>
    >("/challenges/complete", submissionId ? { submissionId } : {});
    return res.data;
  },

  getStreak: async () => {
    const res = await problemClient.get<ApiResponse<StreakView>>(
      "/challenges/streak"
    );
    return res.data;
  },

  setTimezone: async (timezone: string) => {
    const res = await problemClient.put<ApiResponse<StreakView>>(
      "/challenges/streak/timezone",
      { timezone }
    );
    return res.data;
  },

  setGoals: async (goals: {
    weeklyGoalTarget?: number;
    monthlyGoalTarget?: number;
  }) => {
    const res = await problemClient.put<ApiResponse<StreakView>>(
      "/challenges/streak/goals",
      goals
    );
    return res.data;
  },

  useFreeze: async () => {
    const res = await problemClient.post<ApiResponse<StreakView>>(
      "/challenges/streak/freeze",
      {}
    );
    return res.data;
  },

  getCalendar: async (from: string, to: string) => {
    const res = await problemClient.get<
      ApiResponse<{ from: string; to: string; days: ChallengeCalendarDay[] }>
    >("/challenges/calendar", { params: { from, to } });
    return res.data;
  },
};
