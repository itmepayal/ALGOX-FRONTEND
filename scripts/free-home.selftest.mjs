/**
 * Phase 07 — Free home dashboard smoke checks.
 * Run: cd client && node scripts/free-home.selftest.mjs
 */
import fs from "fs";
import path from "path";
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

const home = fs.readFileSync(
  path.join(src, "components/home/FreeHomeDashboard.tsx"),
  "utf8"
);
const dash = fs.readFileSync(path.join(src, "components/Dashboard.tsx"), "utf8");
const lb = fs.readFileSync(path.join(src, "api/leaderboardApi.ts"), "utf8");

check("FreeHomeDashboard exists", fs.existsSync(path.join(src, "components/home/FreeHomeDashboard.tsx")));
check("free-home.css exists", fs.existsSync(path.join(src, "styles/free-home.css")));
check("Dashboard default tab is home", dash.includes('useState<PlatformTab>("home")'));
check("Dashboard renders FreeHomeDashboard", dash.includes("<FreeHomeDashboard"));
check("leaderboard getUserStats wrapper", lb.includes("getUserStats"));
check("welcome section", home.includes("Welcome back"));
check("daily challenge section", home.includes("Daily Challenge"));
check("uses challenge API", home.includes("challengeApi"));
check("server streak (not client-only pick)", home.includes("challengeApi.getStreak") && !home.includes("pickDailyChallenge"));
check("progress overview", home.includes("Progress Overview"));
check("continue learning", home.includes("Continue Learning"));
check("recent submissions", home.includes("Recent Submissions"));
check("weak topics", home.includes("Weak Topics"));
check("recommended problems", home.includes("Recommended Problems"));
check("saved problems", home.includes("Saved problems"));
check("loading skeleton", home.includes("Skeleton") && home.includes("aria-busy"));
check("empty states", home.includes("EmptyState"));
check("error + refresh", home.includes("remoteError") && home.includes("Refresh"));
check("no fabricated rating default", !home.includes("1500") || home.includes("lbMissing"));
check("uses sheet progress API", home.includes("sheetProgressApi"));
check("uses progress status API", home.includes("progressApi.getStatus"));
check("uses favourites API", home.includes("listMyFavourites"));

console.log(`\n${passed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
