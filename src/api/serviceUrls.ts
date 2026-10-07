/** Frontend API URLs all resolve through the public gateway. */
function env(key: string, fallback: string): string {
  const v = (import.meta as any).env?.[key];
  return typeof v === "string" && v.trim() ? v.replace(/\/$/, "") : fallback;
}

const API_URL = env("VITE_API_URL", "http://localhost:3000");

export const SERVICE_URLS = {
  auth: `${API_URL}/api/auth/api/v1`,
  problem: `${API_URL}/api/problems/api/v1`,
  submission: `${API_URL}/api/submissions/api/v1`,
  leaderboard: `${API_URL}/api/leaderboard/api/v1`,
  evaluation: `${API_URL}/api/evaluation/api/v1`,
  analytics: `${API_URL}/api/analytics/api/v1`,
  discussion: `${API_URL}/api/discussion/api/v1`,
  content: `${API_URL}/api/content/api/v1`,
  realtime: `${API_URL}/api/realtime`,
} as const;

export function discussionHealthUrl(): string {
  return `${SERVICE_URLS.discussion}/health`;
}

export function contentHealthUrl(): string {
  return `${API_URL}/api/content/health`;
}

/** Health URLs also go through the public gateway. */
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
