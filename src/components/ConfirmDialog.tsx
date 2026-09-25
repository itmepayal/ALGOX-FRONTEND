import {
  useEffect,
  useId,
  useRef,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";
import { Button } from "./ui/button";

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
 * Accessible confirmation dialog (overlay + card, Escape / backdrop dismiss).
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
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(15,23,42,0.45)] p-4"
      role="presentation"
      onClick={onOverlayClick}
    >
      <div
        ref={panelRef}
        className={cn(
          "w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-[0_20px_50px_rgba(15,23,42,0.15)]",
          "font-primary text-foreground",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        <h3 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <div
          id={descId}
          className="mt-2 space-y-2 text-sm text-muted-foreground"
        >
          {typeof description === "string" ? <p>{description}</p> : description}
          {warning ? (
            <p className="font-medium text-danger" role="note">
              {warning}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant === "danger" ? "destructive" : "primary"}
            onClick={onConfirm}
            disabled={confirming}
            aria-busy={confirming}
          >
            {confirming ? confirmingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
