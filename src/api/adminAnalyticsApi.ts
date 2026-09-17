import axios from "axios";
import { authClient, createServiceClient } from "./authClient";
import { problemClient } from "./problemApi";
import { submissionClient } from "./submissionApi";
import { SERVICE_URLS } from "./serviceUrls";

export { HEALTH_ENDPOINTS } from "./serviceUrls";

export const ANALYTICS_API_URL = SERVICE_URLS.analytics;
export const EVALUATION_API_URL = SERVICE_URLS.evaluation;
export const LEADERBOARD_API_URL = SERVICE_URLS.leaderboard;

export const analyticsClient = createServiceClient(ANALYTICS_API_URL, {
  timeout: 10000,
});

export type DashboardRange = "today" | "7d" | "30d" | "90d" | "1y";

export function rangeToDays(range: string): number {
  switch (range) {
    case "today":
      return 1;
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "1y":
    case "365d":
      return 365;
    case "30d":
    default:
      return 30;
  }
}

function composeOverview(
  range: string,
  users: any,
  problems: any,
  submissions: any,
  meta: { source: "analytics" | "fallback"; degraded: boolean }
) {
  const unavailableSources: string[] = [];
  if (!users) unavailableSources.push("users");
  if (!problems) unavailableSources.push("problems");
  if (!submissions) unavailableSources.push("submissions");

  const degraded = meta.degraded || unavailableSources.length > 0;
  const dataQuality =
    unavailableSources.length === 3
      ? "unavailable"
      : degraded
        ? "degraded"
        : "real";

  return {
    range,
    source: meta.source,
    degraded,
    dataQuality,
    unavailableSources,
    sources: {
      users: Boolean(users),
      problems: Boolean(problems),
      submissions: Boolean(submissions),
    },
    users: users ?? null,
    problems: problems ?? null,
    submissions: submissions ?? null,
    kpis: {
      totalUsers: users?.totalUsers ?? null,
      dau: users?.dau ?? null,
      wau: users?.wau ?? null,
      mau: users?.mau ?? null,
      activeUsers: users?.activeUsers ?? users?.dau ?? null,
      totalProblems: problems?.total ?? null,
      publishedProblems: problems?.published ?? null,
      draftProblems: problems?.draft ?? null,
      totalSubmissions: submissions?.total ?? null,
      todaySubmissions: submissions?.today ?? null,
      successRate: submissions?.successRate ?? null,
      solvedProblems: submissions?.solvedProblems ?? null,
      acceptedSubmissions: submissions?.accepted ?? null,
      newUsersTrendPct: users?.newUsersTrendPct ?? null,
    },
  };
}

function composeCharts(overview: ReturnType<typeof composeOverview>) {
  return {
    userGrowth: overview.users?.growth || [],
    submissionsByStatus: overview.submissions?.byStatus || {},
    submissionSeries: overview.submissions?.series || [],
    difficultyDistribution: overview.problems?.byDifficulty || {},
    topicDistribution: overview.problems?.byTopic || {},
    languageUsage: overview.submissions?.byLanguage || {},
    topProblems: overview.submissions?.topProblems || [],
    mostActiveUsers: overview.submissions?.mostActiveUsers || [],
    avgExecutionTime: overview.submissions?.avgExecutionTime ?? null,
    avgMemory: overview.submissions?.avgMemory ?? null,
    source: overview.source,
    degraded: overview.degraded,
    dataQuality: overview.dataQuality,
    unavailableSources: overview.unavailableSources,
    sources: overview.sources,
  };
}

function hasUsefulKpis(data: any): boolean {
  if (!data?.kpis && !data?.users && !data?.problems && !data?.submissions) {
    return false;
  }
  const k = data.kpis || {};
  return (
    Number(k.totalUsers || 0) > 0 ||
    Number(k.totalProblems || k.publishedProblems || 0) > 0 ||
    Number(k.totalSubmissions || 0) > 0 ||
    Number(data?.users?.totalUsers || 0) > 0 ||
    Number(data?.problems?.total || 0) > 0 ||
    Number(data?.submissions?.total || 0) > 0
  );
}

async function fetchInternalStats(range: string) {
  const days = rangeToDays(range);
  const results = await Promise.allSettled([
    authClient.get(`/auth/admin/internal/user-stats`, {
      params: { days },
      timeout: 12000,
    }),
    problemClient.get(`/problems/admin/internal-stats`, { timeout: 12000 }),
    submissionClient.get(`/submissions/admin/internal-stats`, {
      params: { days },
      timeout: 15000,
    }),
  ]);

  const users =
    results[0].status === "fulfilled"
      ? results[0].value.data?.data ?? results[0].value.data
      : null;
  const problems =
    results[1].status === "fulfilled"
      ? results[1].value.data?.data ?? results[1].value.data
      : null;
  const submissions =
    results[2].status === "fulfilled"
      ? results[2].value.data?.data ?? results[2].value.data
      : null;

  const okCount = [users, problems, submissions].filter(Boolean).length;
  if (okCount === 0) {
    const err = new Error(
      "Unable to load dashboard stats from Auth, Problem, or Submission services"
    );
    (err as any).code = "DASHBOARD_STATS_UNAVAILABLE";
    throw err;
  }

  return {
    users,
    problems,
    submissions,
    degraded: okCount < 3,
  };
}

async function tryAnalyticsBundle(range: string) {
  try {
    const [o, c] = await Promise.all([
      analyticsClient.get("/analytics/admin/overview", {
        params: { range },
        timeout: 9000,
      }),
      analyticsClient.get("/analytics/admin/charts", {
        params: { range },
        timeout: 9000,
      }),
    ]);
    const overview = {
      ...(o.data?.data ?? o.data),
      source: "analytics" as const,
    };
    const charts = {
      ...(c.data?.data ?? c.data),
      source: "analytics" as const,
    };
    return { overview, charts, ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

/**
 * Prefer AnalyticsService when it returns real data; otherwise fan-in
 * Auth/Problem/Submission internal-stats so the dashboard stays usable.
 */
export const adminAnalyticsApi = {
  loadDashboard: async (range: DashboardRange | string = "30d") => {
    // Run Analytics + direct fan-in in parallel. Use whichever returns useful data.
    const [analyticsResult, directResult] = await Promise.all([
      tryAnalyticsBundle(range),
      fetchInternalStats(range).then(
        (fan) => ({ ok: true as const, fan }),
        (err) => ({ ok: false as const, err })
      ),
    ]);

    if (
      analyticsResult.ok &&
      hasUsefulKpis(analyticsResult.overview) &&
      !analyticsResult.overview.degraded
    ) {
      return {
        overview: analyticsResult.overview,
        charts: analyticsResult.charts,
        fallback: false,
      };
    }

    if (directResult.ok) {
      const overview = composeOverview(
        range,
        directResult.fan.users,
        directResult.fan.problems,
        directResult.fan.submissions,
        {
          source: "fallback",
          degraded: directResult.fan.degraded || analyticsResult.ok === false,
        }
      );
      return {
        overview,
        charts: composeCharts(overview),
        fallback: true,
      };
    }

    // Analytics returned empty/degraded zeros — still better than a hard crash
    if (analyticsResult.ok) {
      return {
        overview: {
          ...analyticsResult.overview,
          degraded: true,
          source: "analytics" as const,
        },
        charts: {
          ...analyticsResult.charts,
          degraded: true,
          source: "analytics" as const,
        },
        fallback: false,
        softWarning:
          "Some platform services timed out. Metrics may be incomplete.",
      };
    }

    throw (
      (directResult.ok === false && directResult.err) ||
      new Error("Unable to load platform analytics")
    );
  },

  executionHealth: async () => {
    const res = await axios.get(`${EVALUATION_API_URL}/health`, {
      timeout: 5000,
    });
    return res.data as {
      success: boolean;
      message?: string;
      data?: {
        service?: string;
        redis?: string;
        queue?: Record<string, unknown>;
      };
    };
  },

  topUsers: async (period: "global" | "weekly" | "monthly" = "global") => {
    const res = await axios.get(`${LEADERBOARD_API_URL}/leaderboard/`, {
      params: { page: 1, limit: 10, period },
      timeout: 8000,
    });
    const raw = res.data?.data ?? res.data ?? [];
    const rows = Array.isArray(raw) ? raw : raw.rankings || [];
    return { success: true, data: rows };
  },
};

export async function pingHealth(
  url: string,
  timeoutMs = 4000
): Promise<"healthy" | "offline" | "warning"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) return "healthy";
    return "warning";
  } catch {
    clearTimeout(timer);
    return "offline";
  }
}

export async function pingHealthDetailed(
  url: string,
  timeoutMs = 4000
): Promise<{
  status: "healthy" | "offline" | "warning";
  ms: number | null;
  error?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const ms = Math.round(performance.now() - started);
    if (res.ok) return { status: "healthy", ms };
    return { status: "warning", ms, error: `HTTP ${res.status}` };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      status: "offline",
      ms: null,
      error: err?.name === "AbortError" ? "Timeout" : "Unreachable",
    };
  }
}
