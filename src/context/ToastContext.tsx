import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { normalizeApiError } from "../lib/apiError";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs: number;
  sticky?: boolean;
}

interface ToastApi {
  push: (toast: Omit<ToastItem, "id" | "durationMs"> & { durationMs?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string, sticky?: boolean) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  /** Normalize any thrown API error into a single deduped toast. */
  apiError: (err: unknown, fallbackTitle?: string) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const DEFAULT_MS: Record<ToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 5500,
  error: 7000,
};

export const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const recentKeys = useRef<Map<string, number>>(new Map());
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id" | "durationMs"> & { durationMs?: number }) => {
      const key = `${toast.tone}:${toast.title}:${toast.description || ""}`;
      const now = Date.now();
      const last = recentKeys.current.get(key) || 0;
      if (now - last < 2500) return; // dedupe identical toasts
      recentKeys.current.set(key, now);

      const id = `t-${now}-${Math.random().toString(36).slice(2, 7)}`;
      const durationMs =
        toast.durationMs ??
        (toast.sticky ? 0 : DEFAULT_MS[toast.tone]);

      const item: ToastItem = {
        id,
        tone: toast.tone,
        title: toast.title,
        description: toast.description,
        durationMs,
        sticky: toast.sticky,
      };

      setItems((prev) => [...prev.slice(-4), item]);

      if (durationMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) =>
        push({ tone: "success", title, description }),
      error: (title, description, sticky) =>
        push({ tone: "error", title, description, sticky, durationMs: sticky ? 0 : undefined }),
      warning: (title, description) =>
        push({ tone: "warning", title, description }),
      info: (title, description) => push({ tone: "info", title, description }),
      apiError: (err, fallbackTitle) => {
        const n = normalizeApiError(err);
        push({
          tone: n.severity === "warning" ? "warning" : "error",
          title: fallbackTitle || n.title,
          description: n.message,
          sticky: n.severity === "critical",
          durationMs: n.severity === "critical" ? 0 : undefined,
        });
      },
      dismiss,
      clear: () => {
        timers.current.forEach((h) => window.clearTimeout(h));
        timers.current.clear();
        setItems([]);
      },
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="admin-toast-host" aria-live="polite" aria-relevant="additions">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              className={`admin-toast admin-toast-${t.tone}`}
              role={t.tone === "error" ? "alert" : "status"}
            >
              <div className="admin-toast-icon" aria-hidden>
                <Icon size={16} />
              </div>
              <div className="admin-toast-body">
                <strong>{t.title}</strong>
                {t.description ? <p>{t.description}</p> : null}
              </div>
              <button
                type="button"
                className="admin-toast-dismiss"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback outside provider (non-admin routes)
    return {
      push: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      apiError: () => {},
      dismiss: () => {},
      clear: () => {},
    };
  }
  return ctx;
}
