/**
 * Centralized API error normalization for AlgoPath Admin.
 * Never surfaces secrets, stack traces, or internal URLs.
 */

export type ApiErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT_ERROR"
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND_ERROR"
  | "CONFLICT_ERROR"
  | "RATE_LIMIT_ERROR"
  | "SERVER_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR";

export type ApiErrorSeverity = "info" | "warning" | "error" | "critical";

export interface NormalizedApiError {
  success: false;
  code: ApiErrorCode;
  title: string;
  message: string;
  status?: number;
  severity: ApiErrorSeverity;
  retryable: boolean;
  /** Field-level validation map when available */
  fieldErrors?: Record<string, string>;
  /** Sanitized details for staff debugging (no secrets) */
  details?: string;
}

const SENSITIVE =
  /\b(password|token|secret|authorization|bearer|api[_-]?key|jwt|mongo|casterror|econnrefused|stack|at\s+\S+\s+\(|redis|sql|localhost:\d+|127\.0\.0\.1)\b/i;

const INTERNAL_URL = /https?:\/\/(localhost|127\.0\.0\.1|10\.\d+|192\.168\.)[^\s]*/gi;

function sanitizeText(raw: unknown, fallback: string): string {
  if (raw == null) return fallback;
  let text = String(raw).trim();
  if (!text) return fallback;
  text = text.replace(INTERNAL_URL, "[internal service]");
  if (SENSITIVE.test(text) || text.length > 280) {
    return fallback;
  }
  // Strip common Node/Axios prefixes
  text = text
    .replace(/^AxiosError:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .replace(/^Request failed with status code \d+\s*/i, "");
  if (SENSITIVE.test(text) || !text) return fallback;
  return text;
}

function pickMessage(data: any): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const candidates = [data.message, data.error, data.msg, data.title];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function extractFieldErrors(data: any): Record<string, string> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const out: Record<string, string> = {};

  const errors = data.errors ?? data.fieldErrors ?? data.details;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    for (const [key, val] of Object.entries(errors)) {
      if (typeof val === "string" && val.trim()) {
        out[key] = sanitizeText(val, "Invalid value");
      } else if (Array.isArray(val) && typeof val[0] === "string") {
        out[key] = sanitizeText(val[0], "Invalid value");
      } else if (val && typeof val === "object" && typeof (val as any).message === "string") {
        out[key] = sanitizeText((val as any).message, "Invalid value");
      }
    }
  }

  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (item && typeof item === "object") {
        const field = (item as any).path || (item as any).field || (item as any).param;
        const msg = (item as any).msg || (item as any).message;
        if (field && msg) out[String(field)] = sanitizeText(msg, "Invalid value");
      }
    }
  }

  return Object.keys(out).length ? out : undefined;
}

const CATALOG: Record<
  ApiErrorCode,
  Omit<NormalizedApiError, "success" | "code" | "status" | "fieldErrors" | "details" | "message"> & {
    message: string;
  }
> = {
  NETWORK_ERROR: {
    title: "Unable to connect",
    message: "Please check your internet connection and try again.",
    severity: "error",
    retryable: true,
  },
  TIMEOUT_ERROR: {
    title: "Request timed out",
    message: "The server took too long to respond. Please try again.",
    severity: "error",
    retryable: true,
  },
  VALIDATION_ERROR: {
    title: "Please correct the highlighted fields",
    message: "Some values are invalid or missing.",
    severity: "warning",
    retryable: false,
  },
  AUTHENTICATION_ERROR: {
    title: "Session expired",
    message: "Please sign in again to continue.",
    severity: "critical",
    retryable: false,
  },
  AUTHORIZATION_ERROR: {
    title: "Access denied",
    message: "You don't have permission to perform this action.",
    severity: "error",
    retryable: false,
  },
  NOT_FOUND_ERROR: {
    title: "Not found",
    message: "The requested resource could not be found.",
    severity: "warning",
    retryable: false,
  },
  CONFLICT_ERROR: {
    title: "Conflict",
    message: "This action conflicts with the current state of the resource.",
    severity: "warning",
    retryable: true,
  },
  RATE_LIMIT_ERROR: {
    title: "Too many requests",
    message: "Please wait a moment and try again.",
    severity: "warning",
    retryable: true,
  },
  SERVER_ERROR: {
    title: "Server error",
    message: "Something went wrong on the server. Please try again.",
    severity: "error",
    retryable: true,
  },
  SERVICE_UNAVAILABLE: {
    title: "Service unavailable",
    message: "This service is temporarily unavailable. Please try again shortly.",
    severity: "error",
    retryable: true,
  },
  UNEXPECTED_RESPONSE: {
    title: "Unexpected response",
    message: "Received an unexpected response from the server.",
    severity: "error",
    retryable: true,
  },
  UNKNOWN_ERROR: {
    title: "Something unexpected happened",
    message: "Please try again.",
    severity: "error",
    retryable: true,
  },
};

function codeFromStatus(status?: number): ApiErrorCode {
  if (!status) return "UNKNOWN_ERROR";
  if (status === 400 || status === 422) return "VALIDATION_ERROR";
  if (status === 401) return "AUTHENTICATION_ERROR";
  if (status === 403) return "AUTHORIZATION_ERROR";
  if (status === 404) return "NOT_FOUND_ERROR";
  if (status === 409) return "CONFLICT_ERROR";
  if (status === 429) return "RATE_LIMIT_ERROR";
  if (status === 502 || status === 503 || status === 504) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN_ERROR";
}

/** Normalize any thrown Axios/fetch/unknown error into a safe UI shape. */
export function normalizeApiError(err: unknown): NormalizedApiError {
  const axiosLike = err as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: any };
    request?: unknown;
    isAxiosError?: boolean;
  };

  // Offline / no response
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const base = CATALOG.NETWORK_ERROR;
    return {
      success: false,
      code: "NETWORK_ERROR",
      title: base.title,
      message: "You appear to be offline. Reconnect and try again.",
      severity: base.severity,
      retryable: true,
    };
  }

  const status = axiosLike?.response?.status;
  const data = axiosLike?.response?.data;
  const axiosCode = axiosLike?.code;

  if (
    axiosCode === "ECONNABORTED" ||
    /timeout/i.test(String(axiosLike?.message || ""))
  ) {
    const base = CATALOG.TIMEOUT_ERROR;
    return {
      success: false,
      code: "TIMEOUT_ERROR",
      ...base,
      status,
    };
  }

  if (!axiosLike?.response && (axiosLike?.request || axiosLike?.isAxiosError)) {
    const base = CATALOG.NETWORK_ERROR;
    return {
      success: false,
      code: "NETWORK_ERROR",
      ...base,
    };
  }

  const code = codeFromStatus(status);
  const base = CATALOG[code];
  const fieldErrors = extractFieldErrors(data);
  const rawMsg = pickMessage(data);
  const message =
    code === "VALIDATION_ERROR" && fieldErrors
      ? base.message
      : sanitizeText(rawMsg, base.message);

  return {
    success: false,
    code,
    title: base.title,
    message,
    status,
    severity: base.severity,
    retryable: base.retryable,
    fieldErrors,
    details:
      status != null
        ? `HTTP ${status}${data?.code ? ` · ${sanitizeText(data.code, "")}` : ""}`.trim()
        : undefined,
  };
}

/** Short single-line message for toasts / compact alerts. */
export function getErrorToastMessage(err: unknown): string {
  const n = normalizeApiError(err);
  if (n.code === "VALIDATION_ERROR" && n.fieldErrors) {
    return n.title;
  }
  return `${n.title}: ${n.message}`;
}

/** Assert API envelope looks successful when callers expect `success` + `data`. */
export function assertApiSuccess<T extends { success?: boolean; data?: unknown }>(
  res: T,
  label = "operation"
): T {
  if (res && typeof res === "object" && res.success === false) {
    throw {
      response: {
        status: 400,
        data: { message: (res as any).message || `Failed to complete ${label}` },
      },
    };
  }
  return res;
}
