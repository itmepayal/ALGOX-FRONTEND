/**
 * Daily Challenge problem resolution — client selftest.
 * Run: cd client && npx --yes tsx scripts/challenge-problem.selftest.ts
 */
import assert from "node:assert/strict";
import {
  findProblemByIdOrSlug,
  hasChallengeProblemRef,
  resolveChallengeProblem,
} from "../src/utils/challengeProblem";
import type { Problem } from "../src/api/problemApi";

let passed = 0;
function check(label: string, cond: boolean) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok — ${label}`);
  passed += 1;
}

const sample: Problem = {
  id: "prob-kth-bst",
  _id: "prob-kth-bst",
  slug: "kth-smallest-element-in-a-bst",
  title: "Kth Smallest Element in a BST",
  difficulty: "Easy",
  category: "Trees",
  description: "",
  constraints: "",
  examples: [],
  testcases: [],
} as Problem;

// --- hasChallengeProblemRef ---
check("rejects empty challenge", !hasChallengeProblemRef({ problemId: null, problemSlug: null }));
check("rejects undefined string id", !hasChallengeProblemRef({ problemId: "undefined", problemSlug: null }));
check("rejects null string slug", !hasChallengeProblemRef({ problemId: null, problemSlug: "null" }));
check("accepts problemId", hasChallengeProblemRef({ problemId: "prob-kth-bst", problemSlug: null }));
check("accepts problemSlug", hasChallengeProblemRef({ problemId: null, problemSlug: "kth-smallest-element-in-a-bst" }));

// --- findProblemByIdOrSlug ---
check(
  "finds by id in local list",
  findProblemByIdOrSlug([sample], "prob-kth-bst", null)?.slug ===
    "kth-smallest-element-in-a-bst"
);
check(
  "finds by slug in local list",
  findProblemByIdOrSlug([sample], null, "kth-smallest-element-in-a-bst")?.id ===
    "prob-kth-bst"
);
check(
  "returns null when not in local list",
  findProblemByIdOrSlug([], "prob-kth-bst", "kth-smallest-element-in-a-bst") ===
    null
);
check(
  "never matches undefined/null sentinel ids",
  findProblemByIdOrSlug([sample], "undefined", "null") === null
);

async function runAsync() {
  // Local hit — no API call needed
  const localHit = await resolveChallengeProblem(
    [sample],
    {
      problemId: "prob-kth-bst",
      problemSlug: "kth-smallest-element-in-a-bst",
      title: sample.title,
    },
    {
      getById: async () => {
        throw new Error("should not fetch when local");
      },
      getBySlug: async () => {
        throw new Error("should not fetch when local");
      },
    }
  );
  check("local resolve uses cache", localHit.ok && localHit.source === "local");

  // Missing from local → fetch by id
  let fetchedId = "";
  const apiById = await resolveChallengeProblem(
    [],
    {
      problemId: "prob-kth-bst",
      problemSlug: "kth-smallest-element-in-a-bst",
      title: sample.title,
    },
    {
      getById: async (id) => {
        fetchedId = id;
        return { data: sample };
      },
      getBySlug: async () => {
        throw new Error("should not need slug when id works");
      },
    }
  );
  check(
    "api resolve by id when not in local list",
    apiById.ok && apiById.source === "api" && fetchedId === "prob-kth-bst"
  );
  check(
    "api resolve returns server problem",
    apiById.ok && apiById.problem.title === "Kth Smallest Element in a BST"
  );

  // Missing identifiers
  const missing = await resolveChallengeProblem(
    [],
    { problemId: null, problemSlug: null, title: "Mystery" },
    {
      getById: async () => ({ data: sample }),
      getBySlug: async () => ({ data: sample }),
    }
  );
  check(
    "missing identifier prevents navigation",
    !missing.ok &&
      missing.reason === "missing_identifier" &&
      /temporarily unavailable/i.test(missing.message)
  );

  // Invalid sentinel identifiers
  const invalid = await resolveChallengeProblem(
    [],
    { problemId: "undefined", problemSlug: "null", title: "Bad" },
    {
      getById: async () => ({ data: sample }),
      getBySlug: async () => ({ data: sample }),
    }
  );
  check(
    "invalid identifier prevents /problems/undefined",
    !invalid.ok &&
      (invalid.reason === "invalid_identifier" ||
        invalid.reason === "missing_identifier") &&
      /temporarily unavailable/i.test(invalid.message)
  );

  // API failure
  const failed = await resolveChallengeProblem(
    [],
    {
      problemId: "prob-kth-bst",
      problemSlug: "kth-smallest-element-in-a-bst",
      title: sample.title,
    },
    {
      getById: async () => {
        throw new Error("network");
      },
      getBySlug: async () => {
        throw new Error("network");
      },
    }
  );
  check("api failure returns fetch_failed", !failed.ok && failed.reason === "fetch_failed");

  // Empty API response → not_found
  const notFound = await resolveChallengeProblem(
    [],
    {
      problemId: "missing",
      problemSlug: "missing-slug",
      title: "Gone",
    },
    {
      getById: async () => ({ data: null }),
      getBySlug: async () => ({ data: null }),
    }
  );
  check("empty api response is not_found", !notFound.ok && notFound.reason === "not_found");

  // Slug-only fallback when id miss
  let slugFetched = "";
  const slugOnly = await resolveChallengeProblem(
    [],
    {
      problemId: "gone-id",
      problemSlug: "kth-smallest-element-in-a-bst",
      title: sample.title,
    },
    {
      getById: async () => ({ data: null }),
      getBySlug: async (slug) => {
        slugFetched = slug;
        return { data: sample };
      },
    }
  );
  check(
    "falls back to slug fetch",
    slugOnly.ok &&
      slugOnly.source === "api" &&
      slugFetched === "kth-smallest-element-in-a-bst"
  );

  assert.ok(passed >= 15, `expected at least 15 checks, got ${passed}`);
  console.log(`\nAll ${passed} checks passed.`);
}

void runAsync().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
