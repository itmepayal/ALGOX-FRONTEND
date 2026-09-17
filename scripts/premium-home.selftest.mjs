/**
 * Phase 08 — Premium home extension smoke checks.
 * Run: cd client && node scripts/premium-home.selftest.mjs
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

const prep = fs.readFileSync(
  path.join(src, "components/home/PremiumPreparationSection.tsx"),
  "utf8"
);
const bar = fs.readFileSync(
  path.join(src, "components/home/SubscriptionStatusBar.tsx"),
  "utf8"
);
const home = fs.readFileSync(
  path.join(src, "components/home/FreeHomeDashboard.tsx"),
  "utf8"
);
const can = fs.readFileSync(path.join(src, "access/canAccess.ts"), "utf8");
const analytics = fs.readFileSync(
  path.join(src, "api/userAnalyticsApi.ts"),
  "utf8"
);

check("PremiumPreparationSection exists", fs.existsSync(path.join(src, "components/home/PremiumPreparationSection.tsx")));
check("SubscriptionStatusBar exists", fs.existsSync(path.join(src, "components/home/SubscriptionStatusBar.tsx")));
check("home embeds premium section", home.includes("PremiumPreparationSection"));
check("home embeds subscription bar", home.includes("SubscriptionStatusBar"));
check("extends existing home (not separate app)", home.includes("FreeHomeDashboard"));
check("gates with isPremium / canAccess", prep.includes("isPremium") && prep.includes("canAccess"));
check("free sees upsell not premium APIs", prep.includes("Unlock Premium preparation") && prep.includes("if (!premium)"));
check("analytics fetch only when allowAnalytics", prep.includes("if (allowAnalytics)"));
check("study plans only when allowPlans", prep.includes("if (allowPlans)"));
check("company module gated", prep.includes("premium.company_questions"));
check("revision queue for premium", prep.includes("Revision Due"));
check("interview readiness", prep.includes("Interview Readiness"));
check("AI assistance module", prep.includes("AI Assistance"));
check("premium challenges", prep.includes("Premium Challenges"));
check("subscription status + expiry", bar.includes("Access through") || bar.includes("currentPeriodEnd"));
check("manage subscription shortcut", bar.includes("Manage subscription") || bar.includes("handleManage"));
check("refresh entitlement updates UI", bar.includes("getProfile") && home.includes("entitlementTick"));
check("canAccess prefers server features", can.includes("user.features"));
check("user analytics client exists", analytics.includes("getMine"));
check("no duplicate free weak topics for premium", home.includes("!premiumUser"));

console.log(`\n${passed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
