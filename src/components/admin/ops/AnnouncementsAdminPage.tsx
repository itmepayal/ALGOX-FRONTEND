import { useCallback, useEffect, useState, type FC } from "react";
import {
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Archive,
  Clock,
  Loader2,
} from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { WidgetError } from "../shared/WidgetError";
import { PageHeader } from "../shared/PageHeader";
import {
  adminAnnouncementApi,
  type AdminAnnouncement,
} from "../../../api/adminAnnouncementApi";
import { useToast } from "../../../context/ToastContext";
import { normalizeApiError } from "../../../lib/apiError";
import "./announcements.css";

const TYPES = [
  "INFO",
  "SUCCESS",
  "WARNING",
  "MAINTENANCE",
  "CONTEST",
  "PLATFORM_UPDATE",
] as const;

const AUDIENCES = [
  { id: "ALL_USERS", label: "All users" },
  { id: "ONLINE_USERS", label: "Online users" },
] as const;

export const AnnouncementsAdminPage: FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<string>("INFO");
  const [audience, setAudience] = useState("ALL_USERS");
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAnnouncementApi.list({ page: 1, limit: 50 });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      const n = normalizeApiError(err);
      setError({ title: n.title, message: n.message });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!title.trim() || !message.trim()) {
      toast.warning("Title and message are required");
      return;
    }
    try {
      setSaving(true);
      await adminAnnouncementApi.create({
        title: title.trim(),
        message: message.trim(),
        type,
        audience,
        status: "DRAFT",
      });
      setTitle("");
      setMessage("");
      setType("INFO");
      setAudience("ALL_USERS");
      toast.success("Announcement draft saved");
      await load();
    } catch (err: unknown) {
      toast.apiError(err, "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    id: string,
    action: "publish" | "expire" | "archive",
    label: string
  ) => {
    try {
      setActionId(id);
      if (action === "publish") await adminAnnouncementApi.publish(id);
      else if (action === "expire") await adminAnnouncementApi.expire(id);
      else await adminAnnouncementApi.archive(id);
      toast.success(label);
      await load();
    } catch (err: unknown) {
      toast.apiError(err, `Failed to ${action}`);
    } finally {
      setActionId(null);
    }
  };

  return (
    <PermissionGuard permission="announcements:view">
      <div className="ann-page">
        <PageHeader
          title="Announcements"
          description="Draft, schedule, and publish platform-wide messages to AlgoPath users."
          actions={
            <button
              type="button"
              className="admin-btn"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          }
        />

        <div className="ann-layout">
          <PermissionGuard permission="announcements:create">
            <section className="ann-composer" aria-label="Create announcement">
              <div className="ann-composer-head">
                <div className="ann-composer-icon" aria-hidden>
                  <Megaphone size={18} />
                </div>
                <div>
                  <h3>New announcement</h3>
                  <p>Saved as draft until you publish.</p>
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="ann-title">Title</label>
                <input
                  id="ann-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled maintenance tonight"
                  maxLength={120}
                />
              </div>

              <div className="admin-field">
                <label htmlFor="ann-message">Message</label>
                <textarea
                  id="ann-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write a clear message for your audience…"
                  rows={5}
                />
              </div>

              <div className="ann-composer-row">
                <div className="admin-field">
                  <label htmlFor="ann-type">Type</label>
                  <select
                    id="ann-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="ann-audience">Audience</label>
                  <select
                    id="ann-audience"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  >
                    {AUDIENCES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ann-composer-actions">
                <button
                  type="button"
                  className="admin-btn primary"
                  disabled={saving || !title.trim() || !message.trim()}
                  onClick={() => void create()}
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {saving ? "Saving…" : "Save draft"}
                </button>
              </div>
            </section>
          </PermissionGuard>

          <section className="ann-list" aria-label="Announcement list">
            <div className="ann-list-head">
              <h3>All announcements</h3>
              <span className="ann-count">
                {loading ? "…" : `${rows.length} total`}
              </span>
            </div>

            {error ? (
              <WidgetError
                title={error.title}
                message={error.message}
                onRetry={() => void load()}
                compact
              />
            ) : !loading && rows.length === 0 ? (
              <EmptyState
                icon={<Megaphone size={22} />}
                title="No announcements yet"
                hint="Create a draft on the left, then publish when you're ready."
              />
            ) : (
              <DataTable
                loading={loading}
                emptyTitle="No announcements yet."
                columns={[
                  {
                    key: "title",
                    header: "Announcement",
                    render: (r) => (
                      <div className="ann-title-cell">
                        <strong>{r.title}</strong>
                        <span>{r.message?.slice(0, 72)}{r.message && r.message.length > 72 ? "…" : ""}</span>
                      </div>
                    ),
                  },
                  {
                    key: "type",
                    header: "Type",
                    render: (r) => (
                      <span className={`ann-type ann-type-${String(r.type || "").toLowerCase()}`}>
                        {String(r.type || "").replace(/_/g, " ")}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => <StatusBadge status={r.status} />,
                  },
                  {
                    key: "audience",
                    header: "Audience",
                    render: (r) => (
                      <span className="ann-audience">
                        {String(r.audience || "").replace(/_/g, " ")}
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (r) => (
                      <PermissionGuard permission="announcements:publish">
                        <div className="ann-actions">
                          {r.status !== "PUBLISHED" ? (
                            <button
                              type="button"
                              className="admin-btn"
                              disabled={actionId === r._id}
                              title="Publish"
                              onClick={() =>
                                void runAction(
                                  r._id,
                                  "publish",
                                  "Announcement published"
                                )
                              }
                            >
                              <Send size={13} />
                              Publish
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="admin-btn"
                            disabled={actionId === r._id}
                            title="Expire"
                            onClick={() =>
                              void runAction(
                                r._id,
                                "expire",
                                "Announcement expired"
                              )
                            }
                          >
                            <Clock size={13} />
                          </button>
                          <button
                            type="button"
                            className="admin-btn"
                            disabled={actionId === r._id}
                            title="Archive"
                            onClick={() =>
                              void runAction(
                                r._id,
                                "archive",
                                "Announcement archived"
                              )
                            }
                          >
                            <Archive size={13} />
                          </button>
                        </div>
                      </PermissionGuard>
                    ),
                  },
                ]}
                rows={rows}
                rowKey={(r) => r._id}
              />
            )}
          </section>
        </div>
      </div>
    </PermissionGuard>
  );
};
