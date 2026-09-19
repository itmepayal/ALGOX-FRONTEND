/**
 * Phase 06 — Guest experience smoke checks.
 * Run: cd client && node scripts/guest-experience.selftest.mjs
 */
import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");

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

const required = [
  "components/guest/GuestApp.tsx",
  "components/guest/GuestNavbar.tsx",
  "components/guest/GuestHome.tsx",
  "components/guest/AuthPromptOverlay.tsx",
  "context/AuthPromptContext.tsx",
  "styles/guest.css",
];

for (const rel of required) {
  check(`file ${rel}`, fs.existsSync(path.join(src, rel)));
}

const app = fs.readFileSync(path.join(src, "App.tsx"), "utf8");
check("App renders GuestApp when logged out", app.includes("<GuestApp"));
check("App waits on auth loading", app.includes("loading"));
check("AuthPromptProvider wraps app", app.includes("AuthPromptProvider"));

const guestApp = fs.readFileSync(
  path.join(src, "components/guest/GuestApp.tsx"),
  "utf8"
);
check("guest problems browse", guestApp.includes("ProblemsSheet"));
check("guest problem preview", guestApp.includes("ProblemWorkspace"));
check(
  "contextual save prompt",
  guestApp.includes("Sign in to save this problem")
);
check(
  "contextual progress prompt",
  guestApp.includes("track your progress")
);
check("no fake streak chip in guest shell", !guestApp.includes("Day Streak"));

const workspace = fs.readFileSync(
  path.join(src, "components/ProblemWorkspace.tsx"),
  "utf8"
);
check("run requires auth", workspace.includes("Sign in to run code"));
check(
  "submit requires auth",
  workspace.includes("Sign in to submit solutions")
);
check("editorial premium gate", workspace.includes("premium.editorial"));

const css = fs.readFileSync(path.join(src, "styles/guest.css"), "utf8");
check("mobile drawer styles", css.includes("guest-navbar-drawer"));
check("mobile breakpoint", css.includes("max-width: 768px"));

function request(port, pathName) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: "localhost", port, path: pathName, method: "GET" },
      (res) => {
        res.resume();
        resolve({ code: res.statusCode || 0 });
      }
    );
    req.on("error", () => resolve({ code: 0 }));
    req.end();
  });
}

const vite = await request(5173, "/");
if (vite.code === 200) {
  check("logged-out client shell reachable", true);
} else {
  console.log("SKIP live Vite — not running on :5173");
}

console.log(`\n${passed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
