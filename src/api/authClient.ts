import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { SERVICE_URLS } from "./serviceUrls";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "./accessToken";

export const AUTH_API_URL = SERVICE_URLS.auth;

/** Dispatched when refresh fails so AuthContext can drop in-memory user. */
export const SESSION_CLEARED_EVENT = "algopath:session-cleared";

export const authClient = axios.create({
  baseURL: AUTH_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;
const tokenAttached = new WeakSet<AxiosInstance>();
const refreshAttached = new WeakSet<AxiosInstance>();

/** Exchange httpOnly refresh cookie for a new access token (memory only). */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    // Standalone axios call — never go through service interceptors (no refresh loop).
    const res = await axios.post(
      `${AUTH_API_URL}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 8000 }
    );
    const token =
      res.data?.data?.accessToken || res.data?.data?.token || null;
    if (typeof token === "string" && token) {
      setAccessToken(token);
      return token;
    }
  } catch {
    /* session expired */
  }
  clearAccessToken();
  return null;
}

function clearSession() {
  clearAccessToken();
  try {
    localStorage.removeItem("user");
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  } catch {
    /* ignore (SSR / non-browser) */
  }
}

/** Attach Bearer token from in-memory store on every request. */
export function attachAccessToken(client: AxiosInstance) {
  if (tokenAttached.has(client)) return;
  tokenAttached.add(client);

  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

/** Paths that must never trigger a silent refresh (public / credential flows). */
const NO_REFRESH_URL_RE =
  /\/auth\/(login|signup|register|refresh|forgot-password|reset-password|login\/2fa)(\?|$|\/)/i;

/**
 * On 401, try one refresh via cookie then retry the request exactly once.
 * Only clears the session if refresh also fails.
 * Skips public auth endpoints and requests that never sent a Bearer token.
 */
export function attachAuthRefresh(client: AxiosInstance) {
  if (refreshAttached.has(client)) return;
  refreshAttached.add(client);

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as RetryConfig | undefined;
      const status = error.response?.status;
      const url = String(original?.url || "");
      const fullUrl = String(original?.baseURL || "") + url;
      const hadBearer = Boolean(
        original?.headers?.Authorization ||
          (original?.headers as any)?.authorization
      );

      if (
        status === 401 &&
        original &&
        !original._retry &&
        hadBearer &&
        !NO_REFRESH_URL_RE.test(url) &&
        !NO_REFRESH_URL_RE.test(fullUrl)
      ) {
        original._retry = true;
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const token = await refreshPromise;
        if (token) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
          return client.request(original);
        }
        clearSession();
      }

      return Promise.reject(error);
    }
  );
}

/**
 * Shared factory for microservice clients: Bearer + single 401→refresh→retry.
 * Public endpoints still work when no token is present (header omitted).
 * withCredentials enabled so cookie refresh stays consistent with authClient.
 */
export function createServiceClient(
  baseURL: string,
  opts?: Pick<AxiosRequestConfig, "timeout" | "withCredentials">
): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: opts?.timeout,
    withCredentials: opts?.withCredentials ?? true,
    headers: {
      "Content-Type": "application/json",
    },
  });
  attachAccessToken(client);
  attachAuthRefresh(client);
  return client;
}

attachAccessToken(authClient);
attachAuthRefresh(authClient);
