/**
 * In-memory access JWT store.
 *
 * Access tokens are never persisted to localStorage/sessionStorage (XSS-readable).
 * Session continuity uses the AuthService httpOnly `refreshToken` cookie + withCredentials.
 *
 * Full httpOnly *access* cookies are not used: the SPA calls multiple microservice
 * origins directly with Authorization: Bearer; an Auth-host cookie would not be sent.
 */

let accessToken: string | null = null;

/** One-time migration: drop any legacy localStorage access JWT. */
function purgeLegacyStoredAccessToken(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("accessToken");
    }
  } catch {
    /* ignore quota / private mode */
  }
}

purgeLegacyStoredAccessToken();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = typeof token === "string" && token.length > 0 ? token : null;
  // Ensure we never leave a durable copy behind after login/refresh.
  purgeLegacyStoredAccessToken();
}

export function clearAccessToken(): void {
  accessToken = null;
  purgeLegacyStoredAccessToken();
}

export function hasAccessToken(): boolean {
  return Boolean(accessToken);
}
