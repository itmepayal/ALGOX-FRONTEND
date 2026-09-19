import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Heart,
  Home,
  Medal,
  MessageSquareText,
  MessagesSquare,
  Route,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";
import type { FeatureId } from "../access/features";

export type PlatformNavId =
  | "home"
  | "problems"
  | "favourites"
  | "companies"
  | "interview"
  | "ai"
  | "analytics"
  | "reviews"
  | "calendar"
  | "sessions"
  | "planner"
  | "contests"
  | "discuss"
  | "learn"
  | "ranks";

export type PlatformNavFlag = "contests" | "discussions" | "submissions";

export interface PlatformNavItem {
  id: PlatformNavId;
  label: string;
  icon: LucideIcon;
  /** When set, free users see a premium affordance (UI only). */
  premiumFeature?: FeatureId;
  /** Hide item when this platform feature flag is off. */
  featureFlag?: PlatformNavFlag;
}

/**
 * Single source of truth for authenticated platform navigation.
 * Order matches the existing product nav.
 *
 * Premium badges derive ONLY from `premiumFeature` (Auth FEATURE_IDS).
 * Do not add ad-hoc crown markup outside this config + PremiumNavIndicator.
 */
export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "problems", label: "Sheets", icon: BookOpen },
  { id: "favourites", label: "My Favourites", icon: Heart },
  {
    id: "companies",
    label: "Companies",
    icon: Building2,
    premiumFeature: "premium.company_questions",
  },
  {
    id: "interview",
    label: "Interview",
    icon: ClipboardCheck,
    premiumFeature: "premium.mock_interview",
  },
  { id: "ai", label: "AI", icon: Sparkles, premiumFeature: "premium.ai" },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    premiumFeature: "premium.analytics",
  },
  {
    id: "reviews",
    label: "Reviews",
    icon: MessageSquareText,
    premiumFeature: "premium.spaced_repetition",
  },
  {
    id: "calendar",
    label: "Roadmap",
    icon: Route,
    premiumFeature: "premium.learning_calendar",
  },
  {
    id: "sessions",
    label: "Sessions",
    icon: Timer,
    premiumFeature: "premium.study_sessions",
  },
  {
    id: "planner",
    label: "Planner",
    icon: CalendarDays,
    premiumFeature: "premium.daily_planner",
  },
  { id: "contests", label: "Contest", icon: Trophy, featureFlag: "contests" },
  {
    id: "discuss",
    label: "Discuss",
    icon: MessagesSquare,
    featureFlag: "discussions",
  },
  { id: "learn", label: "Learn", icon: GraduationCap },
  { id: "ranks", label: "Ranks", icon: Medal, featureFlag: "submissions" },
];

/** Nav items that must show the shared Premium indicator. */
export function isPlatformNavPremium(item: PlatformNavItem): boolean {
  return Boolean(item.premiumFeature);
}

export function platformNavPremiumTooltip(
  item: PlatformNavItem,
  locked: boolean
): string {
  if (!item.premiumFeature) return item.label;
  if (locked) {
    return `${item.label} — Premium feature — Upgrade to unlock`;
  }
  return `${item.label} — Premium feature — Included in your plan`;
}

export function getPlatformNavItem(
  id: PlatformNavId
): PlatformNavItem | undefined {
  return PLATFORM_NAV_ITEMS.find((item) => item.id === id);
}
