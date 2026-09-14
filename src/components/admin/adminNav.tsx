import type { ReactNode } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FileCode2,
  Users,
  Radio,
  Trophy,
  GraduationCap,
  MessagesSquare,
  Flag,
  Megaphone,
  BarChart3,
  Cpu,
  HeartPulse,
  ScrollText,
  Settings,
  List,
  Pencil,
  FlaskConical,
  LineChart,
  Upload,
  Activity,
  AlertTriangle,
  ShieldAlert,
  UserCheck,
  Wifi,
  Layers,
  History,
  MonitorSmartphone,
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
  | "learning-sheets"
  | "learning-topics"
  | "learning-difficulty"
  | "learning-revision"
  | "learning-progress"
  | "discussions"
  | "reports"
  | "announcements"
  | "analytics"
  | "code-execution"
  | "health"
  | "audit"
  | "settings";

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

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={16} />,
    tab: "dashboard",
    permission: "analytics:view",
    section: "Overview",
  },
  {
    id: "problems",
    label: "Problems",
    icon: <BookOpen size={16} />,
    permission: "problems:view",
    section: "Problem Management",
    children: [
      { id: "problems", label: "All Problems", permission: "problems:view" },
      { id: "problem-editor", label: "Problem Editor", permission: "problems:create" },
      { id: "problem-test-cases", label: "Test Cases", permission: "testcases:view" },
      { id: "problem-analytics", label: "Problem Analytics", permission: "analytics:view" },
      { id: "problem-bulk-import", label: "Bulk Import", permission: "problems:create" },
    ],
  },
  {
    id: "submissions",
    label: "Submissions",
    icon: <FileCode2 size={16} />,
    permission: "submissions:view",
    section: "Submissions",
    children: [
      { id: "submissions", label: "Live Submissions", permission: "submissions:view" },
      { id: "submission-analytics", label: "Submission Analytics", permission: "analytics:view" },
      { id: "submission-failed", label: "Failed Executions", permission: "submissions:view" },
      { id: "submission-suspicious", label: "Suspicious Submissions", permission: "suspicious:view" },
    ],
  },
  {
    id: "users",
    label: "Users",
    icon: <Users size={16} />,
    permission: "users:view",
    section: "Users",
    children: [
      { id: "users", label: "All Users", permission: "users:view" },
      { id: "user-activity", label: "User Activity", permission: "users:view" },
      { id: "user-online", label: "Online Users", permission: "realtime:view" },
      { id: "user-progress", label: "User Progress", permission: "users:view" },
      { id: "user-sessions", label: "User Sessions", permission: "users:view" },
    ],
  },
  {
    id: "realtime",
    label: "Real-Time Center",
    icon: <Radio size={16} />,
    permission: "realtime:view",
    section: "Real-Time",
    children: [
      { id: "realtime", label: "WebSocket Dashboard", permission: "realtime:view" },
      { id: "realtime-users", label: "Live Users", permission: "realtime:view" },
      { id: "realtime-submissions", label: "Live Submissions", permission: "submissions:view" },
      { id: "realtime-executions", label: "Active Executions", permission: "health:view" },
      { id: "realtime-leaderboard", label: "Live Leaderboard", permission: "analytics:view" },
      { id: "realtime-connections", label: "Connection Monitor", permission: "realtime:connections" },
      { id: "realtime-rooms", label: "Room Monitor", permission: "realtime:rooms" },
      { id: "realtime-events", label: "Event Stream", permission: "realtime:events" },
      { id: "realtime-broadcast", label: "Broadcast Center", permission: "realtime:broadcast" },
    ],
  },
  {
    id: "leaderboards",
    label: "Leaderboards",
    icon: <Trophy size={16} />,
    permission: "analytics:view",
    section: "Competition",
    children: [
      { id: "leaderboards", label: "Global", permission: "analytics:view" },
      { id: "leaderboards-daily", label: "Daily", permission: "analytics:view" },
      { id: "leaderboards-weekly", label: "Weekly", permission: "analytics:view" },
      { id: "leaderboards-monthly", label: "Monthly", permission: "analytics:view" },
      { id: "leaderboards-contest", label: "Contest", permission: "contests:manage" },
    ],
  },
  {
    id: "learning",
    label: "Learning",
    icon: <GraduationCap size={16} />,
    permission: "problems:view",
    section: "Learning",
    children: [
      { id: "learning-sheets", label: "Sheets", permission: "sheets:manage" },
      { id: "learning-topics", label: "Topics", permission: "problems:view" },
      { id: "learning-difficulty", label: "Difficulty", permission: "analytics:view" },
      { id: "learning-revision", label: "Revision", permission: "problems:view" },
      { id: "learning-progress", label: "Progress", permission: "analytics:view" },
    ],
  },
  {
    id: "discussions",
    label: "Discussions",
    icon: <MessagesSquare size={16} />,
    tab: "discussions",
    permission: "discussions:view",
    section: "Community",
  },
  {
    id: "reports",
    label: "Reports",
    icon: <Flag size={16} />,
    tab: "reports",
    permission: "reports:view",
    section: "Community",
  },
  {
    id: "announcements",
    label: "Announcements",
    icon: <Megaphone size={16} />,
    tab: "announcements",
    permission: "announcements:view",
    section: "Community",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart3 size={16} />,
    tab: "analytics",
    permission: "analytics:view",
    section: "Analytics",
  },
  {
    id: "code-execution",
    label: "Code Execution",
    icon: <Cpu size={16} />,
    tab: "code-execution",
    permission: "health:view",
    section: "Infrastructure",
  },
  {
    id: "health",
    label: "System Health",
    icon: <HeartPulse size={16} />,
    tab: "health",
    permission: "health:view",
    section: "Infrastructure",
  },
  {
    id: "audit",
    label: "Audit Logs",
    icon: <ScrollText size={16} />,
    tab: "audit",
    permission: "audit:view",
    section: "Security",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings size={16} />,
    tab: "settings",
    permission: "settings:view",
    section: "System",
  },
];

/** Map detail tabs to parent group highlight. */
export function resolveActiveGroup(tab: AdminTab): string {
  if (tab === "problem-editor" || tab.startsWith("problem-")) return "problems";
  if (tab === "submission-detail" || tab.startsWith("submission-")) return "submissions";
  if (tab === "user-detail" || tab.startsWith("user-")) return "users";
  if (tab.startsWith("realtime")) return "realtime";
  if (tab.startsWith("leaderboards")) return "leaderboards";
  if (tab.startsWith("learning-")) return "learning";
  return tab;
}

export const ADMIN_TITLE: Partial<Record<AdminTab, string>> = {
  dashboard: "Dashboard",
  problems: "All Problems",
  "problem-editor": "Problem Editor",
  "problem-test-cases": "Test Cases",
  "problem-analytics": "Problem Analytics",
  "problem-bulk-import": "Bulk Import",
  submissions: "Live Submissions",
  "submission-detail": "Submission Detail",
  "submission-analytics": "Submission Analytics",
  "submission-failed": "Failed Executions",
  "submission-suspicious": "Suspicious Submissions",
  users: "All Users",
  "user-detail": "User Detail",
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
  leaderboards: "Global Leaderboard",
  "leaderboards-daily": "Daily Leaderboard",
  "leaderboards-weekly": "Weekly Leaderboard",
  "leaderboards-monthly": "Monthly Leaderboard",
  "leaderboards-contest": "Contest Leaderboard",
  "learning-sheets": "Sheets",
  "learning-topics": "Topics",
  "learning-difficulty": "Difficulty",
  "learning-revision": "Revision",
  "learning-progress": "Learning Progress",
  discussions: "Discussions",
  reports: "Reports",
  announcements: "Announcements",
  analytics: "Analytics",
  "code-execution": "Code Execution",
  health: "System Health",
  audit: "Audit Logs",
  settings: "Settings",
};

/** Icons unused by groups but available for leaf labels in future. */
export const LEAF_ICONS = {
  list: <List size={14} />,
  pencil: <Pencil size={14} />,
  flask: <FlaskConical size={14} />,
  chart: <LineChart size={14} />,
  upload: <Upload size={14} />,
  activity: <Activity size={14} />,
  alert: <AlertTriangle size={14} />,
  shield: <ShieldAlert size={14} />,
  userCheck: <UserCheck size={14} />,
  wifi: <Wifi size={14} />,
  layers: <Layers size={14} />,
  history: <History size={14} />,
  device: <MonitorSmartphone size={14} />,
};
