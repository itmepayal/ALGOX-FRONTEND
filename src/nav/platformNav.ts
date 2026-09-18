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
 */
export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "problems", label: "Sheets", icon: BookOpen },
  { id: "favourites", label: "My Favourites", icon: Heart },
  { id: "companies", label: "Companies", icon: Building2 },
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
  { id: "calendar", label: "Roadmap", icon: Route },
  { id: "sessions", label: "Sessions", icon: Timer },
  { id: "planner", label: "Planner", icon: CalendarDays },
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
