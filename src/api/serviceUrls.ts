/**
 * Centralized microservice base URLs for the client.
 * Override via Vite env (VITE_*). Defaults target local microservices.
 */
function env(key: string, fallback: string): string {
  const v = (import.meta as any).env?.[key];
  return typeof v === "string" && v.trim() ? v.replace(/\/$/, "") : fallback;
}

export const SERVICE_URLS = {
  auth: env("VITE_AUTH_API_URL", "http://localhost:3001/api/v1"),
  problem: env("VITE_PROBLEM_API_URL", "http://localhost:3003/api/v1"),
  submission: env("VITE_SUBMISSION_API_URL", "http://localhost:3004/api/v1"),
  leaderboard: env("VITE_LEADERBOARD_API_URL", "http://localhost:3005/api/v1"),
  evaluation: env("VITE_EVALUATION_API_URL", "http://localhost:3006/api/v1"),
  analytics: env("VITE_ANALYTICS_API_URL", "http://localhost:3007/api/v1"),
  discussion: env("VITE_DISCUSSION_API_URL", "http://localhost:3008/api/v1"),
  content: env("VITE_CONTENT_API_URL", "http://localhost:3009/api/v1"),
  realtime: env("VITE_REALTIME_URL", "http://localhost:3010"),
} as const;

// Allow Discussion/Content health overrides when API base includes /api/v1
export function discussionHealthUrl(): string {
  return env(
    "VITE_DISCUSSION_HEALTH_URL",
    `${SERVICE_URLS.discussion}/health`
  );
}

export function contentHealthUrl(): string {
  return env("VITE_CONTENT_HEALTH_URL", "http://localhost:3009/health");
}

/** Absolute health URLs used by System Health / Code Execution. */
export const HEALTH_ENDPOINTS = [
  { name: "Auth", url: `${SERVICE_URLS.auth}/health` },
  { name: "Problem", url: `${SERVICE_URLS.problem}/health` },
  { name: "Submission", url: `${SERVICE_URLS.submission}/health` },
  { name: "Leaderboard", url: `${SERVICE_URLS.leaderboard}/health` },
  { name: "Evaluation", url: `${SERVICE_URLS.evaluation}/health` },
  { name: "Analytics", url: `${SERVICE_URLS.analytics}/health` },
  { name: "Discussion", url: discussionHealthUrl() },
  { name: "Content", url: contentHealthUrl() },
  { name: "Realtime", url: `${SERVICE_URLS.realtime}/health` },
] as const;
