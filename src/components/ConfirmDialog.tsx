import {
  useEffect,
  useId,
  useRef,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  /** Optional destructive warning line shown under the description. */
  warning?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  /** Destructive styling for confirm (default). */
  confirmVariant?: "danger" | "primary";
  confirming?: boolean;
  confirmingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Accessible confirmation dialog matching the platform note-modal pattern
 * (overlay + card, Escape / backdrop dismiss, Cancel as safe default).
 */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  warning,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  confirming = false,
  confirmingLabel = "Resetting…",
  onCancel,
  onConfirm,
}) => {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!confirming) onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, confirming, onCancel]);

  if (!open) return null;

  const onOverlayClick = (e: ReactMouseEvent) => {
    if (e.target === e.currentTarget && !confirming) onCancel();
  };

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="lc-confirm-overlay"
      role="presentation"
      onClick={onOverlayClick}
    >
      <div
        ref={panelRef}
        className="lc-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        <h3 id={titleId} className="lc-confirm-title">
          {title}
        </h3>
        <div id={descId} className="lc-confirm-desc">
          {typeof description === "string" ? <p>{description}</p> : description}
          {warning ? (
            <p className="lc-confirm-warning" role="note">
              {warning}
            </p>
          ) : null}
        </div>
        <div className="lc-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="lc-confirm-btn lc-confirm-cancel"
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`lc-confirm-btn lc-confirm-confirm ${
              confirmVariant === "danger" ? "danger" : "primary"
            }`}
            onClick={onConfirm}
            disabled={confirming}
            aria-busy={confirming}
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
