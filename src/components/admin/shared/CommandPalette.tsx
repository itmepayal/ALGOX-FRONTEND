import { useEffect, useMemo, useState, type FC } from "react";
import { Search, FileCode2, Users, BookOpen, LayoutDashboard } from "lucide-react";
import { adminProblemApi } from "../../../api/adminProblemApi";
import { adminAuthApi } from "../../../api/adminAuthApi";
import { adminSubmissionApi } from "../../../api/adminSubmissionApi";
import type { AdminTab } from "../adminNav";
import { ADMIN_NAV, ADMIN_SECONDARY_NAV, ADMIN_TITLE } from "../adminNav";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: AdminTab, id?: string) => void;
  canView: (perm?: string) => boolean;
}

type Hit = {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  tab: AdminTab;
  entityId?: string;
  icon: "problem" | "user" | "submission" | "nav";
};

export const CommandPalette: FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
  canView,
}) => {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);

  const navHits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query || query.length < 1) return [] as Hit[];
    const out: Hit[] = [];
    for (const g of ADMIN_NAV) {
      if (g.permission && !canView(g.permission)) continue;
      if (g.tab && g.label.toLowerCase().includes(query)) {
        out.push({
          id: `nav-${g.tab}`,
          group: "Navigation",
          title: g.label,
          subtitle: g.section,
          tab: g.tab,
          icon: "nav",
        });
      }
      for (const c of g.children || []) {
        if (c.permission && !canView(c.permission)) continue;
        if (c.label.toLowerCase().includes(query)) {
          out.push({
            id: `nav-${c.id}`,
            group: "Navigation",
            title: c.label,
            subtitle: g.label,
            tab: c.id,
            icon: "nav",
          });
        }
      }
    }
    for (const leaf of ADMIN_SECONDARY_NAV) {
      if (leaf.permission && !canView(leaf.permission)) continue;
      if (
        leaf.label.toLowerCase().includes(query) ||
        leaf.id.toLowerCase().includes(query)
      ) {
        out.push({
          id: `nav-sec-${leaf.id}`,
          group: "More",
          title: leaf.label,
          tab: leaf.id,
          icon: "nav",
        });
      }
    }
    return out.slice(0, 10);
  }, [q, canView]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const tasks: Promise<Hit[]>[] = [];
        if (canView("problems:view")) {
          tasks.push(
            adminProblemApi
              .list({ page: 1, limit: 8, search: query })
              .then((res) =>
                (res.data || []).map((p: any) => ({
                  id: `p-${p.id || p._id}`,
                  group: "Problems",
                  title: p.title || p.slug || "Problem",
                  subtitle: p.difficulty,
                  tab: "problem-editor" as AdminTab,
                  entityId: String(p.id || p._id),
                  icon: "problem" as const,
                }))
              )
              .catch(() => [])
          );
        }
        if (canView("users:view")) {
          tasks.push(
            adminAuthApi
              .listUsers({ page: 1, limit: 8, search: query })
              .then((res) =>
                (res.data || []).map((u: any) => ({
                  id: `u-${u.id}`,
                  group: "Users",
                  title: u.name || u.email,
                  subtitle: u.email,
                  tab: "user-detail" as AdminTab,
                  entityId: String(u.id),
                  icon: "user" as const,
                }))
              )
              .catch(() => [])
          );
        }
        if (canView("submissions:view") && /^[a-f0-9]{6,}$/i.test(query)) {
          tasks.push(
            adminSubmissionApi
              .getById(query)
              .then((res) => {
                const s = res.data;
                if (!s) return [];
                return [
                  {
                    id: `s-${s.id || (s as any)._id}`,
                    group: "Submissions",
                    title: `Submission ${String(s.id || (s as any)._id).slice(0, 10)}`,
                    subtitle: s.status,
                    tab: "submission-detail" as AdminTab,
                    entityId: String(s.id || (s as any)._id),
                    icon: "submission" as const,
                  },
                ];
              })
              .catch(() => [])
          );
        }
        const parts = await Promise.all(tasks);
        if (!cancelled) setHits(parts.flat().slice(0, 20));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, open, canView]);

  const all = useMemo(() => [...navHits, ...hits], [navHits, hits]);

  useEffect(() => {
    setActive(0);
  }, [all.length, q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(all.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && all[active]) {
        e.preventDefault();
        const h = all[active];
        onNavigate(h.tab, h.entityId);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, all, active, onClose, onNavigate]);

  if (!open) return null;

  const grouped = all.reduce<Record<string, Hit[]>>((acc, h) => {
    (acc[h.group] ||= []).push(h);
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <div className="admin-cmd-backdrop" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="admin-cmd">
        <div className="admin-cmd-input-wrap">
          <Search size={16} aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search problems, users, submissions, pages…"
            aria-label="Global search"
          />
          <kbd>esc</kbd>
        </div>
        <div className="admin-cmd-body">
          {loading ? (
            <p className="admin-muted" style={{ padding: 12 }}>
              Searching…
            </p>
          ) : null}
          {!loading && q.trim().length >= 1 && all.length === 0 ? (
            <p className="admin-muted" style={{ padding: 12 }}>
              No matches for “{q.trim()}”.
            </p>
          ) : null}
          {!q.trim() ? (
            <p className="admin-muted" style={{ padding: 12 }}>
              Type to search. Tip: open anytime with <kbd>/</kbd> or{" "}
              <kbd>Ctrl</kbd>+<kbd>K</kbd>.
            </p>
          ) : null}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="admin-cmd-group">
              <div className="admin-cmd-group-label">{group}</div>
              {items.map((h) => {
                flatIndex += 1;
                const idx = flatIndex;
                const Icon =
                  h.icon === "problem"
                    ? BookOpen
                    : h.icon === "user"
                      ? Users
                      : h.icon === "submission"
                        ? FileCode2
                        : LayoutDashboard;
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`admin-cmd-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => {
                      onNavigate(h.tab, h.entityId);
                      onClose();
                    }}
                  >
                    <Icon size={14} />
                    <span className="admin-cmd-item-text">
                      <strong>{h.title}</strong>
                      {h.subtitle ? <span>{h.subtitle}</span> : null}
                    </span>
                    <span className="admin-cmd-item-meta">
                      {ADMIN_TITLE[h.tab] || h.tab}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="admin-cmd-scrim"
        aria-label="Close search"
        onClick={onClose}
      />
    </div>
  );
};
