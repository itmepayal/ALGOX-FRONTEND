import { useEffect, useState, type FC } from "react";
import { X } from "lucide-react";
import { authApi } from "../api/authApi";

interface Announcement {
  _id: string;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  actionUrl?: string;
}

export const AnnouncementBanner: FC = () => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("accessToken")) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authApi.listAnnouncements();
        const list = (res.data as Announcement[]) || [];
        const active = list.find((a) => a.title && a.message);
        if (!cancelled && active) setAnnouncement(active);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || dismissed) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "rgba(99, 102, 241, 0.12)",
        borderBottom: "1px solid rgba(99, 102, 241, 0.25)",
        fontSize: "0.9rem",
      }}
      role="status"
    >
      <div style={{ flex: 1 }}>
        <strong>{announcement.title}</strong>
        <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>
          {announcement.message}
        </span>
        {announcement.actionUrl && (
          <a
            href={announcement.actionUrl}
            style={{ marginLeft: 8, color: "var(--primary-hover)" }}
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a>
        )}
      </div>
      <button
        type="button"
        className="platform-icon-btn"
        aria-label="Dismiss announcement"
        onClick={() => setDismissed(true)}
      >
        <X size={16} />
      </button>
    </div>
  );
};
