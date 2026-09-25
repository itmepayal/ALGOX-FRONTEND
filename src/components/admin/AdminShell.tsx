import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  LogOut,
  Menu,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import { BrandMark } from "../BrandLogo";
import {
  ADMIN_NAV,
  ADMIN_TITLE,
  resolveActiveGroup,
  type AdminTab,
} from "./adminNav";
import { CommandPalette } from "./shared/CommandPalette";
import { OfflineBanner } from "./shared/OfflineBanner";
import "./shared/admin.css";

interface AdminShellProps {
  tab: AdminTab;
  title: string;
  crumb?: string;
  canView: (perm?: string) => boolean;
  onNavigate: (tab: AdminTab, id?: string) => void;
  onBackToUserView: () => void;
  onSignOut: () => void;
  onRefresh?: () => void;
  lastUpdatedLabel?: string;
  adminName?: string;
  adminEmail?: string;
  adminRole?: string;
  children: ReactNode;
}

function buildBreadcrumb(tab: AdminTab, title: string): string {
  const groupId = resolveActiveGroup(tab);
  const group = ADMIN_NAV.find((g) => g.id === groupId);
  const parts = ["AlgoPath"];
  if (group?.section) parts.push(group.section);
  const leaf = title || ADMIN_TITLE[tab] || "Admin";
  if (group && group.label !== leaf && group.tab !== tab) {
    parts.push(group.label);
  }
  parts.push(leaf);
  return parts.filter((p, i, arr) => i === 0 || p !== arr[i - 1]).join(" / ");
}

export type { AdminTab };

export const AdminShell: FC<AdminShellProps> = ({
  tab,
  title,
  crumb,
  canView,
  onNavigate,
  onBackToUserView,
  onSignOut,
  onRefresh,
  lastUpdatedLabel = "Just now",
  adminName,
  adminEmail,
  adminRole,
  children,
}) => {
  const activeGroup = resolveActiveGroup(tab);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    [activeGroup]: true,
    realtime: true,
    content: true,
    users: true,
  }));

  useEffect(() => {
    setOpenGroups((prev) => ({ ...prev, [activeGroup]: true }));
    setMobileOpen(false);
  }, [activeGroup, tab]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const sync = () => {
      if (mq.matches) setCollapsed(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }
      if (e.key === "/" && !editing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleNav = useMemo(
    () =>
      ADMIN_NAV.filter((g) => !g.permission || canView(g.permission)).map(
        (g) => ({
          ...g,
          children: g.children?.filter(
            (c) => !c.permission || canView(c.permission)
          ),
        })
      ),
    [canView]
  );

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const breadcrumb = crumb || buildBreadcrumb(tab, title);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      onRefresh();
    } finally {
      window.setTimeout(() => setRefreshing(false), 450);
    }
  }, [onRefresh]);

  const displayName = adminName || adminEmail || "Admin";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  let lastSection: string | undefined;

  return (
    <div
      className={`admin-root theme-light ${collapsed ? "sidebar-collapsed" : ""} ${
        mobileOpen ? "sidebar-mobile-open" : ""
      }`}
    >
      <button
        type="button"
        className="admin-sidebar-scrim"
        aria-label="Close navigation"
        onClick={() => setMobileOpen(false)}
      />
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-brand">
          <BrandMark size={28} className="admin-brand-mark" />
          {!collapsed ? (
            <div className="admin-brand-text">
              <div className="admin-brand-name">AlgoPath</div>
              <div className="admin-brand-sub">Admin</div>
            </div>
          ) : null}
          <button
            type="button"
            className="admin-icon-btn admin-collapse-btn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <PanelLeft size={15} strokeWidth={1.75} />
            ) : (
              <PanelLeftClose size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          {visibleNav.map((group) => {
            const hasChildren = Boolean(group.children?.length);
            const expanded = openGroups[group.id] ?? activeGroup === group.id;
            const groupActive = activeGroup === group.id;
            const showSection =
              !collapsed &&
              Boolean(group.section) &&
              group.section !== lastSection;
            if (group.section) lastSection = group.section;

            const sectionEl = showSection ? (
              <div className="admin-nav-section" key={`sec-${group.section}`}>
                {group.section}
              </div>
            ) : null;

            if (!hasChildren && group.tab) {
              const isActive = tab === group.tab || activeGroup === group.id;
              return (
                <div key={group.id} className="admin-nav-item-wrap">
                  {sectionEl}
                  <button
                    type="button"
                    className={`admin-nav-leaf ${isActive ? "active" : ""}`}
                    onClick={() => onNavigate(group.tab!)}
                    title={group.label}
                    aria-label={group.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="admin-nav-icon" aria-hidden>
                      {group.icon}
                    </span>
                    {!collapsed ? (
                      <span className="label">{group.label}</span>
                    ) : null}
                    {collapsed ? (
                      <span className="admin-nav-tooltip" role="tooltip">
                        {group.label}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            }

            return (
              <div key={group.id} className="admin-nav-group">
                {sectionEl}
                <button
                  type="button"
                  className={`admin-nav-group-btn ${
                    groupActive ? "active-group" : ""
                  }`}
                  onClick={() => {
                    if (collapsed) {
                      setCollapsed(false);
                      setOpenGroups((p) => ({ ...p, [group.id]: true }));
                      if (group.children?.[0]) onNavigate(group.children[0].id);
                      return;
                    }
                    toggleGroup(group.id);
                  }}
                  title={group.label}
                  aria-label={group.label}
                  aria-expanded={expanded}
                >
                  <span className="admin-nav-icon" aria-hidden>
                    {group.icon}
                  </span>
                  {!collapsed ? (
                    <span className="label">{group.label}</span>
                  ) : null}
                  {!collapsed ? (
                    <ChevronDown
                      size={14}
                      strokeWidth={1.75}
                      className={`admin-nav-chevron ${expanded ? "open" : ""}`}
                      aria-hidden
                    />
                  ) : null}
                  {collapsed ? (
                    <span className="admin-nav-tooltip" role="tooltip">
                      {group.label}
                    </span>
                  ) : null}
                </button>
                {expanded && !collapsed ? (
                  <div className="admin-nav-children">
                    {group.children?.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        className={tab === child.id ? "active" : ""}
                        onClick={() => onNavigate(child.id)}
                        title={child.label}
                        aria-current={tab === child.id ? "page" : undefined}
                      >
                        <span className="label">{child.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-profile-card" title={adminEmail || displayName}>
            <div className="admin-avatar" aria-hidden>
              {initials}
            </div>
            {!collapsed ? (
              <div className="admin-profile-meta">
                <div className="admin-profile-name">{displayName}</div>
                <div className="admin-profile-role">
                  {adminRole || "Staff"}
                  <span className="admin-status-dot" title="Signed in" />
                </div>
              </div>
            ) : null}
          </div>
          <div className="admin-sidebar-actions">
            {canView("settings:view") ? (
              <button
                type="button"
                className="admin-btn admin-sidebar-action"
                onClick={() => onNavigate("settings")}
                title="Settings"
                aria-label="Settings"
              >
                <Settings size={14} strokeWidth={1.75} />
                {!collapsed ? <span>Settings</span> : null}
              </button>
            ) : null}
            <button
              type="button"
              className="admin-btn admin-sidebar-action"
              onClick={onBackToUserView}
              title="Back to app"
              aria-label="Back to app"
            >
              <ArrowLeft size={14} strokeWidth={1.75} />
              {!collapsed ? <span>Back to app</span> : null}
            </button>
            <button
              type="button"
              className="admin-btn admin-sidebar-action"
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={14} strokeWidth={1.75} />
              {!collapsed ? <span>Sign out</span> : null}
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <OfflineBanner />
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-icon-btn admin-mobile-toggle"
              aria-label="Open navigation"
              title="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={15} strokeWidth={1.75} />
            </button>
            <p className="admin-crumb">{breadcrumb}</p>
          </div>

          <button
            type="button"
            className="admin-global-search"
            onClick={() => setCmdOpen(true)}
            aria-label="Open global search"
          >
            <Search size={14} strokeWidth={1.75} aria-hidden />
            <span>Search problems, users, submissions…</span>
            <kbd>/</kbd>
          </button>

          <div className="admin-topbar-right">
            <span className="admin-updated" aria-live="polite">
              Last updated: {lastUpdatedLabel}
            </span>
            <button
              type="button"
              className={`admin-icon-btn ${refreshing ? "spinning" : ""}`}
              aria-label="Refresh"
              title="Refresh"
              onClick={handleRefresh}
              disabled={!onRefresh}
            >
              <RefreshCw size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="admin-icon-btn"
              aria-label="Help"
              title="In-app help is not configured"
              disabled
            >
              <CircleHelp size={15} strokeWidth={1.75} />
            </button>
            <div
              className="admin-topbar-profile"
              title={adminEmail || displayName}
            >
              <div className="admin-avatar sm" aria-hidden>
                {initials}
              </div>
            </div>
          </div>
        </header>

        {tab !== "dashboard" &&
        tab !== "analytics" &&
        tab !== "health" &&
        tab !== "roles" &&
        tab !== "problem-editor" &&
        tab !== "user-create" &&
        tab !== "realtime" &&
        tab !== "realtime-events" &&
        tab !== "realtime-broadcast" &&
        tab !== "realtime-leaderboard" &&
        !String(tab).startsWith("leaderboards") &&
        tab !== "contests" &&
        tab !== "contest-detail" &&
        tab !== "content-articles" &&
        tab !== "content-tutorials" &&
        tab !== "content-study-plans" &&
        tab !== "announcements" &&
        tab !== "notifications" &&
        tab !== "settings" ? (
          <div className="admin-page-title-bar">
            <h1>{title}</h1>
          </div>
        ) : null}

        <main className="admin-content">{children}</main>
      </div>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={onNavigate}
        canView={canView}
      />
    </div>
  );
};
