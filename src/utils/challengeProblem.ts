import type { Problem } from "../api/problemApi";
import type { DailyChallengePublic } from "../api/challengeApi";
import { getProblemId } from "./workspacePersistence";

/** True when the challenge payload includes a usable problem identifier. */
export function hasChallengeProblemRef(
  challenge: Pick<DailyChallengePublic, "problemId" | "problemSlug"> | null | undefined
): boolean {
  const id = challenge?.problemId?.trim();
  const slug = challenge?.problemSlug?.trim();
  if (id && id !== "undefined" && id !== "null") return true;
  if (slug && slug !== "undefined" && slug !== "null") return true;
  return false;
}

export function findProblemByIdOrSlug(
  problems: Problem[],
  id: string | null | undefined,
  slug: string | null | undefined
): Problem | null {
  const idNorm = id?.trim() || "";
  const slugNorm = slug?.trim() || "";
  if (
    (!idNorm || idNorm === "undefined" || idNorm === "null") &&
    (!slugNorm || slugNorm === "undefined" || slugNorm === "null")
  ) {
    return null;
  }
  return (
    problems.find((p) => {
      const pid = getProblemId(p);
      return (
        (idNorm && pid === idNorm) ||
        (slugNorm && p.slug === slugNorm)
      );
    }) || null
  );
}

export type ResolveChallengeProblemResult =
  | { ok: true; problem: Problem; source: "local" | "api" }
  | {
      ok: false;
      reason: "missing_identifier" | "invalid_identifier" | "not_found" | "fetch_failed";
      message: string;
    };

export type ChallengeProblemFetchers = {
  getById: (id: string) => Promise<{ data?: Problem | null } | Problem | null | undefined>;
  getBySlug: (slug: string) => Promise<{ data?: Problem | null } | Problem | null | undefined>;
};

function unwrapProblem(
  res: { data?: Problem | null } | Problem | null | undefined
): Problem | null {
  if (!res) return null;
  if (typeof res === "object" && "data" in res) {
    return res.data ?? null;
  }
  return res as Problem;
}

/**
 * Resolve the Daily Challenge problem for navigation.
 * Prefer local catalog cache; fall back to ProblemService by id then slug.
 * Never invents routes from missing/undefined identifiers.
 */
export async function resolveChallengeProblem(
  problems: Problem[],
  challenge: Pick<
    DailyChallengePublic,
    "problemId" | "problemSlug" | "title"
  > | null | undefined,
  fetchers: ChallengeProblemFetchers
): Promise<ResolveChallengeProblemResult> {
  if (!challenge) {
    return {
      ok: false,
      reason: "missing_identifier",
      message: "Today's challenge is temporarily unavailable.",
    };
  }

  if (!hasChallengeProblemRef(challenge)) {
    console.error(
      "[AlgoPath] Daily Challenge missing problemId/problemSlug",
      challenge
    );
    return {
      ok: false,
      reason: "missing_identifier",
      message: "Today's challenge is temporarily unavailable.",
    };
  }

  const id = challenge.problemId?.trim() || "";
  const slug = challenge.problemSlug?.trim() || "";

  if (
    id === "undefined" ||
    id === "null" ||
    slug === "undefined" ||
    slug === "null"
  ) {
    console.error(
      "[AlgoPath] Daily Challenge has invalid problem identifier",
      { problemId: challenge.problemId, problemSlug: challenge.problemSlug }
    );
    return {
      ok: false,
      reason: "invalid_identifier",
      message: "Today's challenge is temporarily unavailable.",
    };
  }

  const local = findProblemByIdOrSlug(problems, id || null, slug || null);
  if (local) {
    return { ok: true, problem: local, source: "local" };
  }

  try {
    if (id) {
      const byId = unwrapProblem(await fetchers.getById(id));
      if (byId && (getProblemId(byId) || byId.slug)) {
        return { ok: true, problem: byId, source: "api" };
      }
    }
    if (slug) {
      const bySlug = unwrapProblem(await fetchers.getBySlug(slug));
      if (bySlug && (getProblemId(bySlug) || bySlug.slug)) {
        return { ok: true, problem: bySlug, source: "api" };
      }
    }
    console.error(
      "[AlgoPath] Daily Challenge problem not found via API",
      { problemId: id || null, problemSlug: slug || null, title: challenge.title }
    );
    return {
      ok: false,
      reason: "not_found",
      message: "Could not load today's challenge problem. Retry to try again.",
    };
  } catch (err) {
    console.error("[AlgoPath] Failed to fetch Daily Challenge problem", err);
    return {
      ok: false,
      reason: "fetch_failed",
      message: "Could not load today's challenge problem. Check your connection and retry.",
    };
  }
}
