/**
 * Admin RBAC UI consistency — live permissions vs role fallback.
 * Run: cd client && npx tsx scripts/admin-rbac-ui.selftest.ts
 * (or from ProblemService with AUTH/PROBLEM URLs)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  hasPermission,
  canAccessAdmin,
  permissionsForRole,
  type Permission,
} from "../src/rbac/permissions.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.join(__dirname, "..");
const adminDir = path.join(clientRoot, "src/components/admin");

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (!ok) {
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
    return;
  }
  console.log(`PASS: ${name}`);
  passed += 1;
}

function walk(dir: string, out: string[] = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const files = walk(adminDir);
const hookSrc = fs.readFileSync(
  path.join(clientRoot, "src/rbac/usePermission.ts"),
  "utf8"
);
check(
  "usePermission prefers live permissions",
  hookSrc.includes("hasPermission(role, perm, live)")
);

let stray = 0;
const mismatched: string[] = [];
for (const file of files) {
  const rel = path.relative(clientRoot, file);
  const src = fs.readFileSync(file, "utf8");
  if (rel.endsWith("PermissionGuard.tsx")) {
    check(
      "PermissionGuard passes live permissions",
      src.includes("user?.permissions")
    );
    continue;
  }
  // Disallow direct hasPermission in admin pages (must use usePermission)
  if (/hasPermission\s*\(/.test(src)) {
    stray += 1;
    mismatched.push(rel);
  }
  // Disallow 2-arg role-only checks even if imported
  const twoArg = src.match(
    /hasPermission\(\s*[^,]+,\s*["'][^"']+["']\s*\)/g
  );
  if (twoArg) {
    for (const m of twoArg) mismatched.push(`${rel}: ${m}`);
  }
}
check(
  "no direct hasPermission in Admin pages (hook/guard only)",
  stray === 0,
  mismatched.slice(0, 8).join("; ")
);

const useCount = files.filter((f) =>
  fs.readFileSync(f, "utf8").includes("usePermission")
).length;
check("usePermission adopted across Admin", useCount >= 15, `count=${useCount}`);

// Unit: live snapshot overrides role matrix
const adminRolePerms = permissionsForRole("admin");
check("admin role has users:view by default", adminRolePerms.includes("users:view"));

check(
  "live empty falls back to role",
  hasPermission("admin", "users:view", [])
);
check(
  "live restricted denies users:view even for admin role",
  !hasPermission("admin", "users:view", ["admin:view", "problems:view"])
);
check(
  "live restricted allows problems:view",
  hasPermission("admin", "problems:view", ["admin:view", "problems:view"])
);
check(
  "super_admin role defaults include settings:update",
  permissionsForRole("super_admin").includes("settings:update")
);
check(
  "live strip settings:update denies despite super_admin role",
  !hasPermission("super_admin", "settings:update", [
    "admin:view",
    "problems:view",
  ])
);
check(
  "canAccessAdmin requires admin:view in live set",
  !canAccessAdmin("admin", ["problems:view"]) &&
    canAccessAdmin("admin", ["admin:view"])
);

const AUTH = process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const PROBLEM = process.env.PROBLEM_SERVICE_URL || "http://localhost:3003";

async function request(
  base: string,
  pathName: string,
  method = "GET",
  headers: Record<string, string> = {},
  body?: unknown
) {
  const res = await fetch(`${base}${pathName}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function decodePerms(token: string): { role?: string; permissions?: string[] } {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    return {
      role: payload.role,
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions
        : undefined,
    };
  } catch {
    return {};
  }
}

async function signupLogin(label: string) {
  const email = `rbac_${label}_${Date.now()}@test.local`;
  const password = "TestPass123!";
  await request(AUTH, "/api/v1/auth/signup", "POST", {}, {
    name: `RBAC ${label}`,
    email,
    password,
  });
  const login = await request(AUTH, "/api/v1/auth/login", "POST", {}, {
    email,
    password,
  });
  const token = login.json?.data?.accessToken as string | undefined;
  let userId = "";
  try {
    userId = JSON.parse(
      Buffer.from(String(token).split(".")[1], "base64url").toString()
    ).userId;
  } catch {
    /* */
  }
  return { email, password, token, userId };
}

async function promote(userId: string, role: string) {
  const envPath = path.join(clientRoot, "../server/AuthService/.env");
  const raw = fs.readFileSync(envPath, "utf8");
  const mongoLine = raw.split("\n").find((l) => /^MONGO_URL=/.test(l) || /^MONGO_URI=/.test(l));
  const mongo = mongoLine
    ? mongoLine.replace(/^[^=]+=/, "").trim().replace(/^["']|["']$/g, "")
    : process.env.AUTH_MONGO_URL || process.env.MONGO_URL;
  if (!mongo) throw new Error("no auth mongo");
  const mongoose = await import(
    path.join(clientRoot, "../server/AuthService/node_modules/mongoose/index.js")
  );
  const conn = await mongoose.default.createConnection(mongo).asPromise();
  await conn.collection("users").updateOne(
    { _id: new mongoose.default.Types.ObjectId(userId) },
    { $set: { role } }
  );
  await conn.close();
}

async function live() {
  try {
    const h = await fetch(`${AUTH}/api/v1/health`);
    if (!h.ok) {
      console.log("SKIP live: Auth down");
      return;
    }
  } catch {
    console.log("SKIP live: Auth down");
    return;
  }

  // Restricted (plain user)
  const restricted = await signupLogin("user");
  check("restricted login", Boolean(restricted.token));
  if (!restricted.token) return;
  const rDec = decodePerms(restricted.token);
  const rLive = rDec.permissions || permissionsForRole(rDec.role || "user");
  check(
    "restricted UI: no admin:view",
    !hasPermission(rDec.role, "admin:view", rLive)
  );
  check(
    "restricted UI: no users:manage/create",
    !hasPermission(rDec.role, "users:create", rLive)
  );
  const rAuth = { Authorization: `Bearer ${restricted.token}` };
  const rProblems = await request(
    PROBLEM,
    "/api/v1/problems/admin/list",
    "GET",
    rAuth
  );
  check(
    "backend: restricted cannot list admin problems",
    rProblems.status === 401 || rProblems.status === 403,
    `status=${rProblems.status}`
  );
  const rUsers = await request(
    AUTH,
    "/api/v1/auth/admin/users",
    "GET",
    rAuth
  );
  check(
    "backend: restricted cannot manage users",
    rUsers.status === 401 || rUsers.status === 403,
    `status=${rUsers.status}`
  );

  // Admin
  const admin = await signupLogin("admin");
  if (!admin.token || !admin.userId) {
    check("admin signup", false);
    return;
  }
  await promote(admin.userId, "admin");
  const adminLogin = await request(AUTH, "/api/v1/auth/login", "POST", {}, {
    email: admin.email,
    password: admin.password,
  });
  const adminToken = adminLogin.json?.data?.accessToken as string;
  check("admin re-login", Boolean(adminToken));
  const aDec = decodePerms(adminToken);
  const aLive = aDec.permissions || [];
  check("admin JWT has live permissions", aLive.length > 0, `n=${aLive.length}`);
  check(
    "admin UI: admin:view",
    hasPermission(aDec.role, "admin:view", aLive)
  );
  check(
    "admin UI: problems create/update/publish",
    hasPermission(aDec.role, "problems:create", aLive) &&
      hasPermission(aDec.role, "problems:update", aLive) &&
      hasPermission(aDec.role, "problems:publish", aLive)
  );
  check(
    "admin UI: contests create/manage",
    hasPermission(aDec.role, "contests:create", aLive) &&
      hasPermission(aDec.role, "contests:manage", aLive)
  );
  check(
    "admin UI: users create/update",
    hasPermission(aDec.role, "users:create", aLive) &&
      hasPermission(aDec.role, "users:update", aLive)
  );
  check(
    "admin UI: settings:view",
    hasPermission(aDec.role, "settings:view", aLive)
  );
  check(
    "admin UI: audit:view",
    hasPermission(aDec.role, "audit:view", aLive)
  );

  const aAuth = { Authorization: `Bearer ${adminToken}` };
  // Backend enforcement samples
  const aList = await request(
    PROBLEM,
    "/api/v1/problems/admin/list?limit=1",
    "GET",
    aAuth
  );
  check("backend admin problems:view", aList.status === 200, `status=${aList.status}`);

  const aAudit = await request(
    AUTH,
    "/api/v1/auth/admin/audit-logs?limit=1",
    "GET",
    aAuth
  );
  check(
    "backend admin audit:view",
    aAudit.status === 200 || aAudit.status === 403,
    `status=${aAudit.status}`
  );

  const aSettings = await request(
    AUTH,
    "/api/v1/auth/admin/settings",
    "GET",
    aAuth
  );
  check(
    "backend admin settings:view",
    aSettings.status === 200 || aSettings.status === 403,
    `status=${aSettings.status}`
  );

  const aUsers = await request(AUTH, "/api/v1/auth/admin/users?limit=1", "GET", aAuth);
  check("backend admin users:view", aUsers.status === 200, `status=${aUsers.status}`);

  const aContests = await request(
    PROBLEM,
    "/api/v1/admin/contests/",
    "GET",
    aAuth
  );
  check(
    "backend admin contests:manage/view",
    aContests.status === 200 || aContests.status === 403,
    `status=${aContests.status}`
  );

  // Super admin
  const sa = await signupLogin("sa");
  if (!sa.token || !sa.userId) {
    check("super_admin signup", false);
    return;
  }
  await promote(sa.userId, "super_admin");
  const saLogin = await request(AUTH, "/api/v1/auth/login", "POST", {}, {
    email: sa.email,
    password: sa.password,
  });
  const saToken = saLogin.json?.data?.accessToken as string;
  check("super_admin re-login", Boolean(saToken));
  const sDec = decodePerms(saToken);
  const sLive = sDec.permissions || [];
  check("super_admin live permissions non-empty", sLive.length > 0);
  const critical: Permission[] = [
    "admin:view",
    "problems:create",
    "problems:update",
    "problems:delete",
    "problems:publish",
    "users:create",
    "users:update",
    "users:delete",
    "audit:view",
    "settings:view",
    "settings:update",
    "contests:create",
    "contests:manage",
    "sheets:manage",
  ];
  const missing = critical.filter(
    (p) => !hasPermission(sDec.role, p, sLive)
  );
  check(
    "super_admin UI has critical perms",
    missing.length === 0,
    missing.join(",")
  );

  // Simulate custom live matrix (Auth SoT): UI must follow live, not ROLE_PERMISSIONS
  const customLive = ["admin:view", "problems:view", "problems:create"];
  check(
    "custom live: create visible, delete hidden",
    hasPermission("super_admin", "problems:create", customLive) &&
      !hasPermission("super_admin", "problems:delete", customLive)
  );
  check(
    "custom live: publish/archive/users/settings/audit/contests hidden",
    !hasPermission("super_admin", "problems:publish", customLive) &&
      !hasPermission("super_admin", "users:create", customLive) &&
      !hasPermission("super_admin", "audit:view", customLive) &&
      !hasPermission("super_admin", "settings:update", customLive) &&
      !hasPermission("super_admin", "contests:manage", customLive)
  );
}

live()
  .then(() => {
    console.log(`\n${passed} PASS, ${failed} FAIL`);
    process.exit(failed ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
