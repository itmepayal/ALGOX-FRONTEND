import { useEffect, useState, type FC } from "react";
import { X } from "lucide-react";
import { authApi } from "../api/authApi";
import { hasAccessToken } from "../api/accessToken";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  actionUrl?: string;
}

/**
 * Hide internal/E2E/diagnostic announcements from the product shell.
 * Admin tooling still manages them; end users should never see smoke-test copy.
 */
function isPublicAnnouncement(a: Announcement): boolean {
  if (!a.title?.trim() || !a.message?.trim()) return false;
  const type = String(a.type || "").toLowerCase();
  // Platform maintenance is owned by App.tsx + feature flags — never duplicate
  // it as a dismissible banner when maintenanceMode is off (or on).
  if (type === "maintenance") return false;
  if (
    type === "e2e" ||
    type === "internal" ||
    type === "debug" ||
    type === "test" ||
    type === "ops"
  ) {
    return false;
  }
  const hay = `${a.title} ${a.message}`.toLowerCase();
  if (
    /\be2e\b/.test(hay) ||
    /sched\s*e2e/.test(hay) ||
    /visibility check/.test(hay) ||
    /smoke test/.test(hay) ||
    /scheduled publish visibility/.test(hay) ||
    /\bcypress\b/.test(hay) ||
    /\bplaywright\b/.test(hay)
  ) {
    return false;
  }
  // Stale maintenance announcements must not appear while the platform is live.
  if (
    /under maintenance/.test(hay) ||
    /^platform maintenance$/.test(a.title.trim().toLowerCase())
  ) {
    return false;
  }
  return true;
}

export const AnnouncementBanner: FC = () => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!hasAccessToken()) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authApi.listAnnouncements();
        const list = (res.data as Announcement[]) || [];
        const active = list.find((a) => isPublicAnnouncement(a));
        if (!cancelled && active) setAnnouncement(active);
      } catch {
        // ignore — banner must never break the shell
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || dismissed) return null;

  return (
    <div className="platform-announcement" role="status">
      <div className="platform-announcement-body">
        <strong>{announcement.title}</strong>
        <span className="platform-announcement-msg">{announcement.message}</span>
        {announcement.actionUrl ? (
          <a
            href={announcement.actionUrl}
            className="platform-announcement-link"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a>
        ) : null}
      </div>
      <button
        type="button"
        className="platform-icon-btn"
        aria-label="Dismiss announcement"
        onClick={() => setDismissed(true)}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
};
