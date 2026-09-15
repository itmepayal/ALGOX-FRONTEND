import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

export const AUTH_API_URL = "http://localhost:3001/api/v1";

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

/** Exchange httpOnly refresh cookie for a new access token. */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post(
      `${AUTH_API_URL}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 8000 }
    );
    const token =
      res.data?.data?.accessToken || res.data?.data?.token || null;
    if (typeof token === "string" && token) {
      localStorage.setItem("accessToken", token);
      return token;
    }
  } catch {
    /* session expired */
  }
  return null;
}

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
}

/** Attach Bearer token from localStorage on every request. */
export function attachAccessToken(client: AxiosInstance) {
  if (tokenAttached.has(client)) return;
  tokenAttached.add(client);

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

/**
 * On 401, try one refresh via cookie then retry the request.
 * Only clears the session if refresh also fails.
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

      if (
        status === 401 &&
        original &&
        !original._retry &&
        !url.includes("/auth/refresh")
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

attachAccessToken(authClient);
attachAuthRefresh(authClient);
