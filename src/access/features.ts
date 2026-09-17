/**
 * Canonical feature ids — keep in sync with AuthService subscription/features.ts.
 * Client uses these for UI only; backend enforceEntitlement is the security boundary.
 */

export const FEATURE_IDS = [
  "premium.problems",
  "premium.editorial",
  "premium.hints",
  "premium.company_questions",
  "premium.study_plans",
  "premium.mock_interview",
  "premium.ai",
  "premium.analytics",
  "premium.code_analysis",
  "premium.debugger",
  "premium.virtual_contest",
  "premium.priority_judge",
  "premium.daily_challenge_advanced",
  "premium.challenge_history",
  "premium.streak_freeze",
  "premium.spaced_repetition",
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export const FEATURE_META: Record<
  FeatureId,
  { label: string; description: string }
> = {
  "premium.problems": {
    label: "Premium problems",
    description: "Access premium-locked problem sets",
  },
  "premium.editorial": {
    label: "Editorials",
    description: "Official solution write-ups",
  },
  "premium.hints": {
    label: "Hints",
    description: "Guided problem hints",
  },
  "premium.company_questions": {
    label: "Company questions",
    description: "Company-tagged interview questions",
  },
  "premium.study_plans": {
    label: "Study plans",
    description: "Structured premium study plans",
  },
  "premium.mock_interview": {
    label: "Mock interview",
    description: "Timed mock interview sessions",
  },
  "premium.ai": {
    label: "AI assist",
    description:
      "AlgoPath AI learning assistant (Premium allowance; Free has limited daily credits)",
  },
  "premium.analytics": {
    label: "Advanced analytics",
    description: "Deeper personal performance analytics",
  },
  "premium.code_analysis": {
    label: "Code analysis",
    description: "Static analysis and insights",
  },
  "premium.debugger": {
    label: "Debugger",
    description: "Interactive debugging tools",
  },
  "premium.virtual_contest": {
    label: "Virtual contest",
    description: "Virtual contest participation",
  },
  "premium.priority_judge": {
    label: "Priority judge",
    description: "Higher-priority code execution queue",
  },
  "premium.daily_challenge_advanced": {
    label: "Advanced daily challenges",
    description: "Access advanced-tier daily challenges",
  },
  "premium.challenge_history": {
    label: "Challenge history",
    description: "Browse full historical daily challenges",
  },
  "premium.streak_freeze": {
    label: "Streak freeze",
    description: "Preserve streaks across a missed day",
  },
  "premium.spaced_repetition": {
    label: "Spaced repetition",
    description:
      "Advanced revision scheduling, reschedule controls, and personalized review recommendations",
  },
};

const FEATURE_SET = new Set<string>(FEATURE_IDS);

export function isKnownFeature(feature: string): feature is FeatureId {
  return FEATURE_SET.has(feature);
}

/** FREE has none; PREMIUM has all catalog features. */
export const PLAN_FEATURES: Record<"FREE" | "PREMIUM", readonly FeatureId[]> = {
  FREE: [],
  PREMIUM: [...FEATURE_IDS],
};
