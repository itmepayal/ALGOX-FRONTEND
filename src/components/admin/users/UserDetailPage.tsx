import { useEffect, useState, type FC } from "react";
import { adminAuthApi, type AdminUser } from "../../../api/adminAuthApi";
import { StatusBadge } from "../shared/StatusBadge";
import { PermissionGuard } from "../shared/PermissionGuard";
import { ConfirmDialog } from "../../ConfirmDialog";
import { hasPermission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";

interface Props {
  id: string;
  onBack: () => void;
}

export const UserDetailPage: FC<Props> = ({ id, onBack }) => {
  const { user } = useAuth();
  const [row, setRow] = useState<AdminUser | null>(null);
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmStatus, setConfirmStatus] = useState<"suspended" | "banned" | "active" | null>(
    null
  );

  const load = async () => {
    const res = await adminAuthApi.getUser(id);
    setRow(res.data);
    setRole(res.data.role);
  };

  useEffect(() => {
    load().catch((err: any) =>
      setError(err?.response?.data?.message || err.message)
    );
  }, [id]);

  const canUpdate = hasPermission(user?.role, "users:update");

  return (
    <PermissionGuard
      permission="users:view"
      fallback={<div className="admin-denied">No users permission.</div>}
    >
      <div className="admin-toolbar">
        <button type="button" className="admin-btn" onClick={onBack}>
          ← Back
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {msg ? <p className="admin-muted">{msg}</p> : null}
      {!row ? (
        <p className="admin-muted">Loading…</p>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>{row.name}</h2>
          <p className="admin-muted">{row.email}</p>
          <p>
            Status: <StatusBadge status={row.status} />
          </p>
          <div className="admin-field">
            <label>Role</label>
            <select
              value={role}
              disabled={!canUpdate}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="user">user</option>
              <option value="moderator">moderator</option>
              <option value="content_manager">content_manager</option>
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
            </select>
          </div>
          {canUpdate && (
            <div className="admin-toolbar">
              <button
                type="button"
                className="admin-btn primary"
                onClick={async () => {
                  try {
                    await adminAuthApi.updateRole(id, role);
                    setMsg("Role updated");
                    await load();
                  } catch (err: any) {
                    setError(err?.response?.data?.message || err.message);
                  }
                }}
              >
                Save role
              </button>
              {row.status === "active" ? (
                <>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setConfirmStatus("suspended")}
                  >
                    Suspend
                  </button>
                  <button
                    type="button"
                    className="admin-btn danger"
                    onClick={() => setConfirmStatus("banned")}
                  >
                    Ban
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setConfirmStatus("active")}
                >
                  Reactivate
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirmStatus)}
        title={`${confirmStatus} user?`}
        description="This change is audited and takes effect immediately."
        confirmLabel="Confirm"
        confirmVariant={confirmStatus === "banned" ? "danger" : "primary"}
        onCancel={() => setConfirmStatus(null)}
        onConfirm={async () => {
          if (!confirmStatus) return;
          try {
            await adminAuthApi.updateStatus(id, confirmStatus);
            setConfirmStatus(null);
            setMsg("Status updated");
            await load();
          } catch (err: any) {
            setError(err?.response?.data?.message || err.message);
            setConfirmStatus(null);
          }
        }}
      />
    </PermissionGuard>
  );
};
