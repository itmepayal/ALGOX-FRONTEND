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
  "premium.daily_planner",
  "premium.study_sessions",
  "premium.learning_calendar",
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
    label: "Company Preparation",
    description:
      "Prepare with focused practice designed around your target companies.",
  },
  "premium.study_plans": {
    label: "Study plans",
    description: "Structured premium study plans",
  },
  "premium.mock_interview": {
    label: "Mock Interviews",
    description:
      "Practice realistic technical interviews with real problems, timing, and judge-backed results.",
  },
  "premium.ai": {
    label: "AlgoPath AI",
    description:
      "Get intelligent support throughout your DSA learning journey.",
  },
  "premium.analytics": {
    label: "Analytics",
    description:
      "Understand your solving progress and learning performance with detailed insights.",
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
    label: "Virtual Practice",
    description:
      "Replay the contest under timed conditions and test your problem-solving speed.",
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
    label: "Revision Queue",
    description:
      "Keep important problems organized and maintain a consistent revision routine.",
  },
  "premium.daily_planner": {
    label: "Daily Planner",
    description:
      "Plan your DSA journey with an intelligent daily schedule.",
  },
  "premium.study_sessions": {
    label: "Sessions",
    description:
      "Organize focused coding and study sessions around your learning goals.",
  },
  "premium.learning_calendar": {
    label: "Your Learning Calendar",
    description:
      "Organize your learning journey with a structured calendar and study schedule.",
  },
};

/** Benefit bullets for PremiumFeatureLock (UI only). */
export const FEATURE_BENEFITS: Partial<Record<FeatureId, readonly string[]>> = {
  "premium.ai": [
    "Progressive smart hints without full solutions",
    "Code analysis for bugs and complexity",
    "Personalized learning and interview coaching",
  ],
  "premium.daily_planner": [
    "Create personalized daily plans",
    "Track planned problems and revisions",
    "Monitor daily completion and streaks",
  ],
  "premium.study_sessions": [
    "Start, pause, and complete focus study timers",
    "Review session history, duration, and topic logs",
    "Analyze study productivity and consistency metrics",
  ],
  "premium.learning_calendar": [
    "Plan problems and topics on a monthly calendar",
    "Schedule review cards and focus sessions",
    "Track daily DSA activity and completion milestones",
  ],
  "premium.company_questions": [
    "Company-specific interview problem sets",
    "Difficulty and topic distribution insights",
    "Track preparation progress per company",
  ],
  "premium.mock_interview": [
    "Realistic timed technical interview sessions",
    "Targeted company and topic interview sets",
    "Comprehensive performance and timing analytics",
  ],
  "premium.analytics": [
    "Deep submission history and acceptance rate trends",
    "Topic strength and weakness diagnostic metrics",
    "Solving consistency and streak tracking",
  ],
  "premium.spaced_repetition": [
    "Spaced-repetition card scheduling and review queues",
    "Custom reschedule controls and mastery tracking",
    "Automatic review recommendations from accepted solves",
  ],
  "premium.virtual_contest": [
    "Replay contests under timed conditions",
    "Practice without affecting original ranking",
    "Test and improve problem-solving speed",
  ],
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
