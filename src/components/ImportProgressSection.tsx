import { useCallback, useEffect, useState, type FC } from "react";
import { Loader2, RefreshCw, Upload } from "lucide-react";
import {
  progressApi,
  type ProgressImportPreview,
  type ProgressImportStatus,
} from "../api/progressApi";
import { ConfirmDialog } from "./ConfirmDialog";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export interface ImportProgressSectionProps {
  /** Called after a successful import so Dashboard can refresh submissions/stats. */
  onImported?: () => void | Promise<void>;
}

export const ImportProgressSection: FC<ImportProgressSectionProps> = ({
  onImported,
}) => {
  const [status, setStatus] = useState<ProgressImportStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ProgressImportPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const loadStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const res = await progressApi.getStatus();
      setStatus(res.data);
    } catch (err: any) {
      setMsg({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to load import status",
      });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const openPreview = async () => {
    try {
      setMsg(null);
      setPreviewing(true);
      const res = await progressApi.previewImport();
      setPreview(res.data);
      setDialogOpen(true);
    } catch (err: any) {
      setMsg({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to preview import",
      });
    } finally {
      setPreviewing(false);
    }
  };

  const confirmImport = async () => {
    try {
      setImporting(true);
      setMsg(null);
      const res = await progressApi.importProgress();
      setDialogOpen(false);
      setPreview(null);
      await loadStatus();
      await onImported?.();
      const d = res.data;
      setMsg({
        type: "success",
        text: `Imported ${d.uniqueProblems} problems (${d.solvedProblems} solved, ${d.attemptedProblems} attempted). ${d.affectedSheets} sheet(s) synced.`,
      });
    } catch (err: any) {
      setMsg({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Import failed",
      });
    } finally {
      setImporting(false);
    }
  };

  const primaryLabel = status?.hasImportedBefore
    ? "Sync Latest Progress"
    : "Import Progress";

  return (
    <section className="import-progress-section" style={{ marginTop: 8 }}>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 4 }}>
        Import Progress
      </h3>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8, fontWeight: 500 }}>
        Automatically restore your progress from your previous submissions.
      </p>
      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.45 }}>
        Restore your solved, attempted, revision, sheet and activity progress
        from your previous submissions.
      </p>

      {msg && (
        <p
          style={{
            marginBottom: 12,
            color: msg.type === "success" ? "var(--success)" : "var(--error)",
            fontSize: "0.85rem",
          }}
          role="status"
        >
          {msg.text}
        </p>
      )}

      <div
        style={{
          padding: 14,
          backgroundColor: "var(--bg-secondary)",
          borderRadius: 10,
          border: "1px solid var(--border-subtle)",
          marginBottom: 14,
        }}
      >
        {loadingStatus ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: "0.85rem" }}>
            <Loader2 size={16} className="animate-spin" /> Loading progress info…
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              fontSize: "0.82rem",
            }}
          >
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Total submissions</div>
              <div style={{ fontWeight: 700 }}>{status?.totalSubmissions ?? 0}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Problems attempted</div>
              <div style={{ fontWeight: 700 }}>{status?.problemsAttempted ?? 0}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Problems solved</div>
              <div style={{ fontWeight: 700 }}>{status?.problemsSolved ?? 0}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Last submission</div>
              <div style={{ fontWeight: 600 }}>{formatDate(status?.lastSubmissionDate)}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Last sync</div>
              <div style={{ fontWeight: 600 }}>{formatDate(status?.lastSyncDate)}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={openPreview}
          disabled={previewing || importing}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          {previewing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : status?.hasImportedBefore ? (
            <RefreshCw size={16} />
          ) : (
            <Upload size={16} />
          )}
          {previewing ? "Analyzing…" : primaryLabel}
        </button>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title="Import Progress"
        confirmVariant="primary"
        confirmLabel="Import"
        confirmingLabel="Importing…"
        confirming={importing}
        cancelLabel="Nah, Not now"
        onCancel={() => {
          if (!importing) {
            setDialogOpen(false);
            setPreview(null);
          }
        }}
        onConfirm={confirmImport}
        description={
          preview ? (
            <div style={{ fontSize: "0.88rem", lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 8px" }}>
                Auto-fill progress from past submissions
              </p>
              <p style={{ margin: "0 0 10px" }}>
                <strong>{preview.totalSubmissions}</strong> submissions found
              </p>
              <p style={{ margin: "0 0 10px" }}>
                <strong>{preview.uniqueProblems}</strong> unique problems detected
              </p>
              <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                <li>✓ {preview.solvedProblems} Solved</li>
                <li>🟡 {preview.attemptedProblems} Attempted</li>
              </ul>
              <p style={{ margin: "0 0 8px" }}>
                {preview.affectedSheets} learning sheet
                {preview.affectedSheets === 1 ? "" : "s"} will be synchronized
              </p>
              <p style={{ margin: "0 0 8px" }}>
                {preview.revisionItemsAffected} revision/weak-problem records may
                be updated
              </p>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                Activity and streak information will also be synchronized.
                {preview.newProblems > 0
                  ? ` ${preview.newProblems} new problem progress record(s) will be created.`
                  : " Existing progress will be refreshed idempotently."}
              </p>
            </div>
          ) : (
            "Preparing preview…"
          )
        }
      />
    </section>
  );
};
