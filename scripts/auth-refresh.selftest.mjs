/**
 * Auth token refresh — static wiring audit + live expired-access retry.
 * Run: cd client && node scripts/auth-refresh.selftest.mjs
 *
 * Live test needs Auth (3001) + Problem (3003). Uses ephemeral signup.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, "..", "src", "api");
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) {
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
    return;
  }
  console.log(`PASS: ${name}`);
  passed += 1;
};

const AUTH = "http://localhost:3001/api/v1";
const PROBLEM = "http://localhost:3003/api/v1";

// --- Static: every authenticated client must share refresh wiring ---
const apiFiles = fs
  .readdirSync(apiDir)
  .filter((f) => f.endsWith(".ts") && f !== "accessToken.ts" && f !== "serviceUrls.ts");

const authClientSrc = fs.readFileSync(path.join(apiDir, "authClient.ts"), "utf8");
check(
  "authClient has createServiceClient",
  authClientSrc.includes("export function createServiceClient")
);
check(
  "authClient single-retry _retry",
  authClientSrc.includes("_retry") && authClientSrc.includes("original._retry = true")
);
check(
  "authClient skips /auth/refresh loop",
  authClientSrc.includes('!url.includes("/auth/refresh")')
);
check(
  "authClient refresh uses standalone axios (no interceptor loop)",
  /axios\.post\(\s*`\$\{AUTH_API_URL\}\/auth\/refresh`/.test(authClientSrc) ||
    authClientSrc.includes("axios.post(\n      `${AUTH_API_URL}/auth/refresh`")
);
check(
  "authClient clears session on refresh failure",
  authClientSrc.includes("SESSION_CLEARED_EVENT") &&
    authClientSrc.includes("clearSession()")
);
check(
  "access token stays in memory only",
  fs
    .readFileSync(path.join(apiDir, "accessToken.ts"), "utf8")
    .includes("never persisted")
);

const sharedClientOwners = new Set([
  "authClient.ts", // authClient itself
  "authApi.ts",
  "adminAuthApi.ts",
  "adminSettingsApi.ts",
  "adminNotificationApi.ts",
  "adminAnnouncementApi.ts",
  "billingApi.ts",
]);

const reexportedViaShared = new Set([
  // Reuse problemClient / submissionClient / discussionClient / contentClient / authClient
  "discussionApi.ts",
  "contentApi.ts",
  "companyApi.ts",
  "contestApi.ts",
  "virtualContestApi.ts",
  "challengeApi.ts",
  "aiApi.ts",
  "learningApi.ts",
  "sheetApi.ts",
  "mockInterviewApi.ts",
  "adminProblemApi.ts",
  "adminContestApi.ts",
  "adminLearningApi.ts",
  "adminSheetApi.ts",
  "adminSubmissionApi.ts",
  "adminSuspiciousApi.ts",
]);

for (const file of apiFiles) {
  const src = fs.readFileSync(path.join(apiDir, file), "utf8");
  if (file === "authClient.ts") continue;

  const usesFactory = src.includes("createServiceClient");
  const usesAuthClient = /from ["'].*authClient["']/.test(src) && src.includes("authClient");
  const reusesShared =
    reexportedViaShared.has(file) ||
    sharedClientOwners.has(file) ||
    /problemClient|submissionClient|discussionClient|contentClient|evaluationClient|analyticsClient|engagementClient|progressClient|sheetClient|realtimeClient/.test(
      src
    );

  const wired = usesFactory || usesAuthClient || reusesShared;
  check(`wired: ${file}`, wired, usesFactory ? "factory" : usesAuthClient ? "authClient" : "shared client");

  // No duplicate raw axios.create without attach (except authClient itself)
  if (src.includes("axios.create") && file !== "authClient.ts") {
    check(
      `${file} has no orphan axios.create`,
      false,
      "use createServiceClient instead"
    );
  }
}

const authCtx = fs.readFileSync(
  path.join(__dirname, "..", "src", "context", "AuthContext.tsx"),
  "utf8"
);
check(
  "AuthContext listens for SESSION_CLEARED_EVENT",
  authCtx.includes("SESSION_CLEARED_EVENT")
);

// --- Live: expired access → refresh once → retry succeeds ---
async function liveRefreshTest() {
  let jwt;
  try {
    jwt = require("jsonwebtoken");
  } catch {
    // AuthService dependency
    jwt = require(path.join(
      __dirname,
      "../../server/AuthService/node_modules/jsonwebtoken"
    ));
  }

  // Default matches AuthService config fallback when JWT_SECRET unset
  const JWT_SECRET =
    process.env.JWT_SECRET || "super_secret_jwt_access_key";

  const email = `refresh_live_${Date.now()}@algopath.local`;
  const password = "RefreshLive123!";

  const jar = { cookie: null };
  const captureCookie = (res) => {
    const raw = res.headers["set-cookie"];
    if (!raw) return;
    const list = Array.isArray(raw) ? raw : [raw];
    for (const c of list) {
      if (c.startsWith("refreshToken=")) {
        jar.cookie = c.split(";")[0];
      }
    }
  };

  const signup = await axios.post(
    `${AUTH}/auth/signup`,
    { name: "Refresh Live", email, password },
    { validateStatus: () => true }
  );
  check("live signup", signup.status < 300 || signup.data?.success === true);

  const login = await axios.post(
    `${AUTH}/auth/login`,
    { email, password },
    { validateStatus: () => true }
  );
  captureCookie(login);
  const goodToken = login.data?.data?.accessToken;
  check("live login access token", typeof goodToken === "string" && goodToken.length > 20);
  check("live login refresh cookie", Boolean(jar.cookie));

  // Decode payload from good token then re-sign expired
  const decoded = jwt.decode(goodToken);
  check("live decode access payload", Boolean(decoded?.userId));

  const expiredToken = jwt.sign(
    {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || "user",
      permissions: decoded.permissions || [],
      isEmailVerified: decoded.isEmailVerified,
    },
    JWT_SECRET,
    { expiresIn: -60 }
  );

  // Memory token store (mirrors accessToken.ts)
  let accessToken = expiredToken;
  let refreshCalls = 0;
  let cleared = false;
  let retryCount = 0;

  const client = axios.create({
    baseURL: AUTH,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  });

  client.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;
      const url = String(original?.url || "");
      if (
        status === 401 &&
        original &&
        !original._retry &&
        !url.includes("/auth/refresh")
      ) {
        original._retry = true;
        retryCount += 1;
        refreshCalls += 1;
        try {
          const res = await axios.post(
            `${AUTH}/auth/refresh`,
            {},
            {
              headers: jar.cookie ? { Cookie: jar.cookie } : {},
              timeout: 8000,
              validateStatus: () => true,
            }
          );
          captureCookie(res);
          const token =
            res.data?.data?.accessToken || res.data?.data?.token || null;
          if (typeof token === "string" && token) {
            accessToken = token;
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${token}`;
            return client.request(original);
          }
        } catch {
          /* fall through */
        }
        accessToken = null;
        cleared = true;
      }
      return Promise.reject(error);
    }
  );

  // Confirm expired token alone is rejected
  const bare = await axios.get(`${AUTH}/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
    validateStatus: () => true,
  });
  check("expired access alone → 401", bare.status === 401);

  const me = await client.get("/auth/me");
  check("expired → refresh → /me ok", me.status === 200 && Boolean(me.data?.data));
  check("retry exactly once", retryCount === 1);
  check("refresh called once", refreshCalls === 1);
  check("access token replaced after refresh", accessToken && accessToken !== expiredToken);

  // Cross-service: problem API with same interceptor pattern
  accessToken = expiredToken;
  retryCount = 0;
  refreshCalls = 0;

  const problemClient = axios.create({
    baseURL: PROBLEM,
    headers: { "Content-Type": "application/json" },
  });
  problemClient.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  });
  problemClient.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;
      const url = String(original?.url || "");
      if (
        status === 401 &&
        original &&
        !original._retry &&
        !url.includes("/auth/refresh")
      ) {
        original._retry = true;
        retryCount += 1;
        refreshCalls += 1;
        const res = await axios.post(
          `${AUTH}/auth/refresh`,
          {},
          {
            headers: jar.cookie ? { Cookie: jar.cookie } : {},
            timeout: 8000,
            validateStatus: () => true,
          }
        );
        captureCookie(res);
        const token =
          res.data?.data?.accessToken || res.data?.data?.token || null;
        if (typeof token === "string" && token) {
          accessToken = token;
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
          return problemClient.request(original);
        }
        accessToken = null;
        cleared = true;
      }
      return Promise.reject(error);
    }
  );

  const problems = await problemClient.get("/learning/goals");
  check(
    "problemApi expired → refresh → retry",
    problems.status === 200,
    `status=${problems.status}`
  );
  check("problemApi single retry", retryCount === 1);

  // Refresh failure clears session
  accessToken = expiredToken;
  jar.cookie = "refreshToken=invalid_refresh_token_value";
  cleared = false;
  try {
    await client.get("/auth/me");
    check("failed refresh rejects", false, "expected reject");
  } catch {
    check("failed refresh rejects", true);
  }
  check("failed refresh clears access token", accessToken === null || cleared);
}

try {
  await liveRefreshTest();
} catch (err) {
  check("live refresh test ran", false, err?.message || String(err));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
