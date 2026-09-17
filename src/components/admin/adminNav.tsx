import type { ReactNode } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FileCode2,
  Users,
  Radio,
  Trophy,
  Newspaper,
  CalendarDays,
  MessagesSquare,
  Flag,
  Megaphone,
  Bell,
  BarChart3,
  Cpu,
  HeartPulse,
  ScrollText,
  Settings,
  ShieldAlert,
  List,
  Pencil,
  FlaskConical,
  LineChart,
  Upload,
  Activity,
  AlertTriangle,
  UserCheck,
  Wifi,
  Layers,
  History,
  MonitorSmartphone,
  GraduationCap,
} from "lucide-react";

/** Leaf / detail tabs for AdminApp routing. */
export type AdminTab =
  | "dashboard"
  | "problems"
  | "problem-editor"
  | "problem-test-cases"
  | "problem-analytics"
  | "problem-bulk-import"
  | "submissions"
  | "submission-detail"
  | "submission-analytics"
  | "submission-failed"
  | "submission-suspicious"
  | "users"
  | "user-detail"
  | "user-create"
  | "user-activity"
  | "user-online"
  | "user-progress"
  | "user-sessions"
  | "realtime"
  | "realtime-users"
  | "realtime-submissions"
  | "realtime-executions"
  | "realtime-leaderboard"
  | "realtime-connections"
  | "realtime-rooms"
  | "realtime-events"
  | "realtime-broadcast"
  | "leaderboards"
  | "leaderboards-daily"
  | "leaderboards-weekly"
  | "leaderboards-monthly"
  | "leaderboards-contest"
  | "contests"
  | "contest-detail"
  | "challenges"
  | "learning-sheets"
  | "learning-topics"
  | "learning-difficulty"
  | "learning-revision"
  | "learning-progress"
  | "discussions"
  | "reports"
  | "announcements"
  | "notifications"
  | "content-articles"
  | "content-tutorials"
  | "content-study-plans"
  | "content-companies"
  | "content-notes"
  | "content-editorials"
  | "analytics"
  | "analytics-users"
  | "analytics-languages"
  | "code-execution"
  | "health"
  | "audit"
  | "settings"
  | "roles";

export interface AdminNavLeaf {
  id: AdminTab;
  label: string;
  permission?: string;
  /** When true, page explains missing infra (e.g. no WebSocket gateway yet). */
  infraPending?: boolean;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  icon: ReactNode;
  permission?: string;
  /** Sidebar section heading above this group (shown once per consecutive section). */
  section?: string;
  /** Direct leaf (no children). */
  tab?: AdminTab;
  children?: AdminNavLeaf[];
}

/**
 * Primary sidebar navigation — production SaaS structure.
 * Secondary routes remain reachable via in-page actions + command palette.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={16} strokeWidth={1.75} />,
    tab: "dashboard",
    permission: "analytics:view",
    section: "Overview",
  },
  {
    id: "problems",
    label: "Problems",
    icon: <BookOpen size={16} strokeWidth={1.75} />,
    tab: "problems",
    permission: "problems:view",
    section: "Problem Management",
  },
  {
    id: "submissions",
    label: "Submissions",
    icon: <FileCode2 size={16} strokeWidth={1.75} />,
    tab: "submissions",
    permission: "submissions:view",
    section: "Submissions",
  },
  {
    id: "users",
    label: "Users",
    icon: <Users size={16} strokeWidth={1.75} />,
    permission: "users:view",
    section: "Users",
    children: [
      { id: "users", label: "All Users", permission: "users:view" },
      { id: "user-activity", label: "Activity", permission: "users:view" },
      { id: "user-progress", label: "Progress", permission: "users:view" },
      { id: "user-sessions", label: "Sessions", permission: "users:view" },
    ],
  },
  {
    id: "realtime",
    label: "Centers",
    icon: <Radio size={16} strokeWidth={1.75} />,
    permission: "realtime:view",
    section: "Real-Time",
    children: [
      { id: "realtime", label: "WebSocket Dashboard", permission: "realtime:view" },
      { id: "realtime-users", label: "Live Users", permission: "realtime:view" },
      {
        id: "realtime-submissions",
        label: "Live Submissions",
        permission: "submissions:view",
      },
      {
        id: "realtime-executions",
        label: "Active Executions",
        permission: "health:view",
      },
      {
        id: "realtime-leaderboard",
        label: "Live Leaderboard",
        permission: "analytics:view",
      },
      {
        id: "realtime-connections",
        label: "Connection Monitor",
        permission: "realtime:connections",
      },
      { id: "realtime-rooms", label: "Room Monitor", permission: "realtime:rooms" },
      { id: "realtime-events", label: "Event Stream", permission: "realtime:events" },
      {
        id: "realtime-broadcast",
        label: "Broadcast Center",
        permission: "realtime:broadcast",
      },
    ],
  },
  {
    id: "contests",
    label: "Contests",
    icon: <Trophy size={16} strokeWidth={1.75} />,
    tab: "contests",
    permission: "contests:manage",
    section: "Competition",
  },
  {
    id: "challenges",
    label: "Daily Challenges",
    icon: <CalendarDays size={16} strokeWidth={1.75} />,
    tab: "challenges",
    permission: "problems:view",
    section: "Competition",
  },
  {
    id: "leaderboards",
    label: "Leaderboard",
    icon: <Trophy size={16} strokeWidth={1.75} />,
    tab: "leaderboards",
    permission: "analytics:view",
    section: "Competition",
  },
  {
    id: "content",
    label: "Content",
    icon: <Newspaper size={16} strokeWidth={1.75} />,
    permission: "content:view",
    section: "Learning",
    children: [
      { id: "content-articles", label: "Articles", permission: "content:view" },
      { id: "content-tutorials", label: "Tutorials", permission: "content:view" },
      {
        id: "content-study-plans",
        label: "Study Plans",
        permission: "content:view",
      },
      {
        id: "content-companies",
        label: "Companies",
        permission: "content:view",
      },
      {
        id: "content-editorials",
        label: "Editorials",
        permission: "content:view",
      },
      { id: "content-notes", label: "Notes", permission: "content:view" },
    ],
  },
  {
    id: "discussions",
    label: "Discussions",
    icon: <MessagesSquare size={16} strokeWidth={1.75} />,
    tab: "discussions",
    permission: "discussions:view",
    section: "Community",
  },
  {
    id: "reports",
    label: "Reports",
    icon: <Flag size={16} strokeWidth={1.75} />,
    tab: "reports",
    permission: "reports:view",
    section: "Reports",
  },
  {
    id: "announcements",
    label: "Announcements",
    icon: <Megaphone size={16} strokeWidth={1.75} />,
    tab: "announcements",
    permission: "announcements:view",
    section: "Reports",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <Bell size={16} strokeWidth={1.75} />,
    tab: "notifications",
    permission: "notifications:view",
    section: "Reports",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart3 size={16} strokeWidth={1.75} />,
    tab: "analytics",
    permission: "analytics:view",
    section: "Analytics",
  },
  {
    id: "code-execution",
    label: "Code Execution",
    icon: <Cpu size={16} strokeWidth={1.75} />,
    tab: "code-execution",
    permission: "health:view",
    section: "Infrastructure",
  },
  {
    id: "health",
    label: "System Health",
    icon: <HeartPulse size={16} strokeWidth={1.75} />,
    tab: "health",
    permission: "health:view",
    section: "Infrastructure",
  },
  {
    id: "roles",
    label: "Roles & Permissions",
    icon: <ShieldAlert size={16} strokeWidth={1.75} />,
    tab: "roles",
    permission: "admin:view",
    section: "Security",
  },
  {
    id: "audit",
    label: "Audit Logs",
    icon: <ScrollText size={16} strokeWidth={1.75} />,
    tab: "audit",
    permission: "audit:view",
    section: "Security",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings size={16} strokeWidth={1.75} />,
    tab: "settings",
    permission: "settings:view",
    section: "System",
  },
];

/**
 * Secondary destinations kept out of the primary sidebar but searchable
 * in the command palette and reachable from page actions.
 */
export const ADMIN_SECONDARY_NAV: AdminNavLeaf[] = [
  { id: "problem-editor", label: "Problem Editor", permission: "problems:create" },
  { id: "problem-test-cases", label: "Test Cases", permission: "testcases:view" },
  { id: "problem-analytics", label: "Problem Analytics", permission: "analytics:view" },
  { id: "problem-bulk-import", label: "Bulk Import", permission: "problems:create" },
  {
    id: "submission-analytics",
    label: "Submission Analytics",
    permission: "analytics:view",
  },
  {
    id: "submission-failed",
    label: "Failed Executions",
    permission: "submissions:view",
  },
  {
    id: "submission-suspicious",
    label: "Suspicious Submissions",
    permission: "suspicious:view",
  },
  { id: "user-create", label: "Create User", permission: "users:create" },
  { id: "user-activity", label: "User Activity", permission: "users:view" },
  { id: "user-progress", label: "User Progress", permission: "users:view" },
  { id: "user-sessions", label: "User Sessions", permission: "users:view" },
  { id: "user-online", label: "Online Users", permission: "realtime:view" },
  { id: "leaderboards-daily", label: "Daily Leaderboard", permission: "analytics:view" },
  {
    id: "leaderboards-weekly",
    label: "Weekly Leaderboard",
    permission: "analytics:view",
  },
  {
    id: "leaderboards-monthly",
    label: "Monthly Leaderboard",
    permission: "analytics:view",
  },
  {
    id: "leaderboards-contest",
    label: "Contest Leaderboard",
    permission: "contests:manage",
  },
  { id: "learning-sheets", label: "Learning Sheets", permission: "sheets:manage" },
  { id: "learning-topics", label: "Learning Topics", permission: "problems:view" },
  {
    id: "learning-difficulty",
    label: "Difficulty Insights",
    permission: "analytics:view",
  },
  { id: "learning-revision", label: "Revision", permission: "problems:view" },
  {
    id: "learning-progress",
    label: "Learning Progress",
    permission: "analytics:view",
  },
  { id: "analytics-users", label: "User Analytics", permission: "analytics:view" },
  {
    id: "analytics-languages",
    label: "Language Analytics",
    permission: "analytics:view",
  },
];

/** Map detail tabs to parent group highlight. */
export function resolveActiveGroup(tab: AdminTab): string {
  if (tab === "problem-editor" || tab.startsWith("problem-")) return "problems";
  if (tab === "submission-detail" || tab.startsWith("submission-")) return "submissions";
  if (tab === "user-detail" || tab.startsWith("user-")) return "users";
  if (tab.startsWith("realtime")) return "realtime";
  if (tab.startsWith("leaderboards")) return "leaderboards";
  if (tab === "contest-detail" || tab.startsWith("contest")) return "contests";
  if (tab.startsWith("learning-")) return "content";
  if (tab.startsWith("content-")) return "content";
  if (tab.startsWith("analytics")) return "analytics";
  return tab;
}

export const ADMIN_TITLE: Partial<Record<AdminTab, string>> = {
  dashboard: "Dashboard",
  problems: "Problems",
  "problem-editor": "Problem Editor",
  "problem-test-cases": "Test Cases",
  "problem-analytics": "Problem Analytics",
  "problem-bulk-import": "Bulk Import",
  submissions: "Submissions",
  "submission-detail": "Submission Detail",
  "submission-analytics": "Submission Analytics",
  "submission-failed": "Failed Executions",
  "submission-suspicious": "Suspicious Submissions",
  users: "Users",
  "user-detail": "User Detail",
  "user-create": "Create User",
  "user-activity": "User Activity",
  "user-online": "Online Users",
  "user-progress": "User Progress",
  "user-sessions": "User Sessions",
  realtime: "WebSocket Dashboard",
  "realtime-users": "Live Users",
  "realtime-submissions": "Live Submissions",
  "realtime-executions": "Active Executions",
  "realtime-leaderboard": "Live Leaderboard",
  "realtime-connections": "Connection Monitor",
  "realtime-rooms": "Room Monitor",
  "realtime-events": "Event Stream",
  "realtime-broadcast": "Broadcast Center",
  leaderboards: "Leaderboard",
  "leaderboards-daily": "Daily Leaderboard",
  "leaderboards-weekly": "Weekly Leaderboard",
  "leaderboards-monthly": "Monthly Leaderboard",
  "leaderboards-contest": "Contest Leaderboard",
  contests: "Contests",
  challenges: "Daily Challenges",
  "contest-detail": "Contest Detail",
  "learning-sheets": "Sheets",
  "learning-topics": "Topics",
  "learning-difficulty": "Difficulty",
  "learning-revision": "Revision",
  "learning-progress": "Learning Progress",
  discussions: "Discussions",
  reports: "Reports",
  announcements: "Announcements",
  notifications: "Notifications",
  "content-articles": "Articles",
  "content-tutorials": "Tutorials",
  "content-study-plans": "Study Plans",
  "content-companies": "Companies",
  "content-editorials": "Editorials",
  "content-notes": "Notes",
  analytics: "Analytics",
  "analytics-users": "User Analytics",
  "analytics-languages": "Language Analytics",
  "code-execution": "Code Execution",
  health: "System Health",
  audit: "Audit Logs",
  settings: "Settings",
  roles: "Roles & Permissions",
};

/** Icons unused by groups but available for leaf labels in future. */
export const LEAF_ICONS = {
  list: <List size={14} strokeWidth={1.75} />,
  pencil: <Pencil size={14} strokeWidth={1.75} />,
  flask: <FlaskConical size={14} strokeWidth={1.75} />,
  chart: <LineChart size={14} strokeWidth={1.75} />,
  upload: <Upload size={14} strokeWidth={1.75} />,
  activity: <Activity size={14} strokeWidth={1.75} />,
  alert: <AlertTriangle size={14} strokeWidth={1.75} />,
  shield: <ShieldAlert size={14} strokeWidth={1.75} />,
  userCheck: <UserCheck size={14} strokeWidth={1.75} />,
  wifi: <Wifi size={14} strokeWidth={1.75} />,
  layers: <Layers size={14} strokeWidth={1.75} />,
  history: <History size={14} strokeWidth={1.75} />,
  device: <MonitorSmartphone size={14} strokeWidth={1.75} />,
  learning: <GraduationCap size={14} strokeWidth={1.75} />,
};
