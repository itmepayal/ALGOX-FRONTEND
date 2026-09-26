import { useEffect, useState, useCallback, type FC } from "react";
import {
  ScrollText,
  Search,
  ShieldCheck,
  Eye,
  X,
  RotateCcw,
  User,
  Clock,
  Activity,
  HardDrive,
  FileCode,
} from "lucide-react";
import { adminAuthApi, type AuditLog } from "../../../api/adminAuthApi";
import { DataTable } from "../shared/DataTable";
import { PermissionGuard } from "../shared/PermissionGuard";
import { Button } from "../../ui/button";
import "./audit-log.css";

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return { date, time };
  } catch {
    return { date: dateStr, time: "" };
  }
}

function getActionBadgeClass(action: string): string {
  const act = action.toLowerCase();
  if (act.includes("create") || act.includes("publish") || act.includes("add")) {
    return "action-create";
  }
  if (
    act.includes("update") ||
    act.includes("edit") ||
    act.includes("patch") ||
    act.includes("change")
  ) {
    return "action-update";
  }
  if (
    act.includes("delete") ||
    act.includes("remove") ||
    act.includes("ban") ||
    act.includes("revoke")
  ) {
    return "action-delete";
  }
  if (
    act.includes("login") ||
    act.includes("auth") ||
    act.includes("reset") ||
    act.includes("password")
  ) {
    return "action-auth";
  }
  return "action-default";
}

function formatChangePreview(r: AuditLog): string {
  if (r.after && Object.keys(r.after).length > 0) {
    const keys = Object.keys(r.after);
    if (keys.length === 1) return `Updated ${keys[0]}`;
    return `Updated ${keys.length} fields (${keys.slice(0, 2).join(", ")})...`;
  }
  if (r.before && Object.keys(r.before).length > 0) {
    return `Before state (${Object.keys(r.before).length} fields)`;
  }
  return "No delta parameters";
}

export const AuditLogPage: FC = () => {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [resource, setResource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const load = useCallback(
    async (overrideResource?: string) => {
      try {
        setLoading(true);
        setError("");
        const resVal =
          overrideResource !== undefined ? overrideResource : resource;
        const res = await adminAuthApi.listAuditLogs({
          page,
          limit: 25,
          resource: resVal || undefined,
        });
        setRows(res.data || []);
        setMeta({
          total: res.meta?.total || 0,
          totalPages: res.meta?.totalPages || 1,
        });
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err.message || "Failed to load audit logs"
        );
      } finally {
        setLoading(false);
      }
    },
    [page, resource]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleFilter = () => {
    setPage(1);
    void load();
  };

  const handleClear = () => {
    setResource("");
    setPage(1);
    void load("");
  };

  return (
    <PermissionGuard
      permission="audit:view"
      fallback={<div className="admin-denied">No audit permission.</div>}
    >
      <div className="admin-audit-log-page">
        <div className="admin-audit-header">
          <div>
            <p className="admin-page-lead">
              Security activity and immutable administrative change history.
            </p>
          </div>
        </div>

        <div className="admin-audit-toolbar">
          <div className="admin-audit-search-group">
            <div className="admin-audit-search-input-wrap">
              <Search size={14} />
              <input
                placeholder="Filter resource (user, problem…)"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFilter()}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleFilter}
              disabled={loading}
            >
              Filter
            </Button>
            {resource && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={loading}
              >
                <RotateCcw size={13} style={{ marginRight: 4 }} />
                Clear
              </Button>
            )}
          </div>

          <div className="admin-audit-immutable-tag">
            <ShieldCheck size={14} style={{ color: "#10b981" }} />
            <span>Immutable · View only</span>
          </div>
        </div>

        {error ? <p className="admin-error">{error}</p> : null}

        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
          minWidth="860px"
          emptyTitle="No audit logs found"
          emptyDescription="Admin actions will appear here as an immutable trail."
          emptyIcon={<ScrollText size={20} strokeWidth={1.75} />}
          columns={[
            {
              key: "time",
              header: "TIME",
              width: "160px",
              render: (r) => {
                const { date, time } = formatDate(r.createdAt);
                return (
                  <div className="admin-audit-time-cell">
                    <span className="admin-audit-time-main">{date}</span>
                    <span className="admin-audit-time-sub">{time}</span>
                  </div>
                );
              },
            },
            {
              key: "actor",
              header: "ACTOR",
              width: "220px",
              render: (r) => {
                const label = r.actorEmail || r.actorId;
                const initial = label.charAt(0).toUpperCase();
                return (
                  <div className="admin-audit-actor-cell" title={label}>
                    <div className="admin-audit-actor-avatar">{initial}</div>
                    <span className="admin-audit-actor-email">{label}</span>
                  </div>
                );
              },
            },
            {
              key: "action",
              header: "ACTION",
              width: "170px",
              render: (r) => {
                const cls = getActionBadgeClass(r.action);
                return (
                  <span className={`admin-audit-action-badge ${cls}`}>
                    {r.action}
                  </span>
                );
              },
            },
            {
              key: "resource",
              header: "RESOURCE",
              width: "130px",
              render: (r) => (
                <span className="admin-audit-resource-tag">{r.resource}</span>
              ),
            },
            {
              key: "rid",
              header: "RESOURCE ID",
              width: "140px",
              technical: true,
              render: (r) => (
                <span className="admin-audit-id-cell" title={r.resourceId || ""}>
                  {r.resourceId
                    ? r.resourceId.length > 12
                      ? `${r.resourceId.slice(0, 10)}...`
                      : r.resourceId
                    : "—"}
                </span>
              ),
            },
            {
              key: "diff",
              header: "CHANGE",
              render: (r) => (
                <div className="admin-audit-change-cell">
                  <span className="admin-audit-change-text" title={formatChangePreview(r)}>
                    {formatChangePreview(r)}
                  </span>
                  <button
                    type="button"
                    className="admin-audit-view-btn"
                    onClick={() => setSelectedLog(r)}
                  >
                    <Eye size={12} /> Details
                  </button>
                </div>
              ),
            },
          ]}
        />

        {/* Audit Log Details Modal */}
        {selectedLog && (
          <div
            className="admin-audit-modal-backdrop"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="admin-audit-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-audit-modal-head">
                <h3 className="admin-audit-modal-title">
                  <FileCode size={18} style={{ color: "var(--primary)" }} />
                  Audit Event Details
                </h3>
                <button
                  type="button"
                  className="admin-audit-modal-close"
                  onClick={() => setSelectedLog(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="admin-audit-modal-body">
                <div className="admin-audit-grid">
                  <div className="admin-audit-grid-item">
                    <span className="admin-audit-grid-label">
                      <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                      Time (UTC)
                    </span>
                    <span className="admin-audit-grid-val">
                      {new Date(selectedLog.createdAt).toUTCString()}
                    </span>
                  </div>

                  <div className="admin-audit-grid-item">
                    <span className="admin-audit-grid-label">
                      <User size={12} style={{ display: "inline", marginRight: 4 }} />
                      Actor
                    </span>
                    <span className="admin-audit-grid-val">
                      {selectedLog.actorEmail || selectedLog.actorId}
                    </span>
                  </div>

                  <div className="admin-audit-grid-item">
                    <span className="admin-audit-grid-label">
                      <Activity size={12} style={{ display: "inline", marginRight: 4 }} />
                      Action
                    </span>
                    <span className="admin-audit-grid-val">
                      <span
                        className={`admin-audit-action-badge ${getActionBadgeClass(
                          selectedLog.action
                        )}`}
                      >
                        {selectedLog.action}
                      </span>
                    </span>
                  </div>

                  <div className="admin-audit-grid-item">
                    <span className="admin-audit-grid-label">
                      <HardDrive size={12} style={{ display: "inline", marginRight: 4 }} />
                      Resource
                    </span>
                    <span className="admin-audit-grid-val">
                      {selectedLog.resource}{" "}
                      {selectedLog.resourceId ? `(${selectedLog.resourceId})` : ""}
                    </span>
                  </div>

                  {selectedLog.ip && (
                    <div className="admin-audit-grid-item" style={{ gridColumn: "span 2" }}>
                      <span className="admin-audit-grid-label">IP Address</span>
                      <span className="admin-audit-grid-val">{selectedLog.ip}</span>
                    </div>
                  )}
                </div>

                {selectedLog.before && Object.keys(selectedLog.before).length > 0 && (
                  <div className="admin-audit-json-box">
                    <span className="admin-audit-json-title">Before State</span>
                    <pre className="admin-audit-json-code">
                      {JSON.stringify(selectedLog.before, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.after && Object.keys(selectedLog.after).length > 0 && (
                  <div className="admin-audit-json-box">
                    <span className="admin-audit-json-title">After State</span>
                    <pre className="admin-audit-json-code">
                      {JSON.stringify(selectedLog.after, null, 2)}
                    </pre>
                  </div>
                )}

                {(!selectedLog.before || Object.keys(selectedLog.before).length === 0) &&
                  (!selectedLog.after || Object.keys(selectedLog.after).length === 0) && (
                    <div className="admin-muted" style={{ fontStyle: "italic", fontSize: "0.8125rem" }}>
                      No parameters recorded for this change event.
                    </div>
                  )}
              </div>

              <div className="admin-audit-modal-foot">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};
