import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
  ArrowRight,
  Brain,
  Briefcase,
  ClipboardList,
  LineChart,
  RotateCcw,
  Sparkles,
  Swords,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { canAccess } from "../../access/canAccess";
import { isPremium } from "../../access/accessModel";
import type { Problem } from "../../api/problemApi";
import type { Submission } from "../../api/submissionApi";
import { engagementApi } from "../../api/engagementApi";
import { contentApi, type ContentStudyPlan } from "../../api/contentApi";
import {
  userAnalyticsApi,
  type UserAnalyticsSnapshot,
} from "../../api/userAnalyticsApi";
import {
  buildRoadmap,
  everAcceptedProblemIds,
  type RoadmapTopic,
} from "../../utils/learningStats";
import { normalizeDifficulty } from "../../utils/problemUtils";
import { getProblemId } from "../../utils/workspacePersistence";
import { EmptyState } from "../ui/empty-state";
import { UpgradePrompt } from "../access/UpgradePrompt";
import { Button } from "../ui/button";
import { billingApi } from "../../api/billingApi";
import { companyApi, type CompanyCard } from "../../api/companyApi";
import type { FreeHomeNavTab } from "./types";

function weakTopics(roadmap: RoadmapTopic[], limit = 5): RoadmapTopic[] {
  return [...roadmap]
    .filter((t) => t.total > 0 && t.status !== "COMPLETED")
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, limit);
}

function premiumChallengeProblems(
  problems: Problem[],
  solved: Set<string>,
  limit = 5
) {
  return problems
    .filter((p) => {
      const id = getProblemId(p);
      return id && !solved.has(id) && Boolean(p.isPremium);
    })
    .slice(0, limit);
}

function interviewReadiness(opts: {
  weakCount: number;
  topicCount: number;
  acceptanceRate: number;
  revisionDue: number;
  solvedTotal: number;
}): { score: number; label: string } {
  const coverage =
    opts.topicCount > 0
      ? Math.max(0, 1 - opts.weakCount / opts.topicCount)
      : 0;
  const accept = Math.min(1, Math.max(0, opts.acceptanceRate / 100));
  const revisionPenalty = Math.min(0.25, opts.revisionDue * 0.03);
  const volume = Math.min(1, opts.solvedTotal / 50);
  const raw = (coverage * 0.4 + accept * 0.35 + volume * 0.25 - revisionPenalty) * 100;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  let label = "Building foundations";
  if (score >= 75) label = "Interview ready";
  else if (score >= 50) label = "Almost there";
  else if (score >= 25) label = "Keep practicing";
  return { score, label };
}

interface PremiumPreparationSectionProps {
  userId: string;
  problems: Problem[];
  submissions: Submission[];
  refreshKey?: number;
  onSelectProblem: (p: Problem) => void;
  onNavigate: (tab: FreeHomeNavTab) => void;
}

/**
 * Premium intelligence modules — only mounts data fetches when entitlement allows.
 * Free users see a compact upsell, never premium API payloads.
 */
export const PremiumPreparationSection: FC<PremiumPreparationSectionProps> = ({
  userId,
  problems,
  submissions,
  refreshKey = 0,
  onSelectProblem,
  onNavigate,
}) => {
  const { user } = useAuth();
  const premium = isPremium(user);
  const allowAnalytics = canAccess(user, "premium.analytics");
  const allowPlans = canAccess(user, "premium.study_plans");
  const allowCompany = canAccess(user, "premium.company_questions");
  const allowAi = canAccess(user, "premium.ai");
  const allowInterview = canAccess(user, "premium.mock_interview");
  const allowProblems = canAccess(user, "premium.problems");

  const [analytics, setAnalytics] = useState<UserAnalyticsSnapshot | null>(null);
  const [plans, setPlans] = useState<ContentStudyPlan[]>([]);
  const [revisionIds, setRevisionIds] = useState<string[]>([]);
  const [companies, setCompanies] = useState<CompanyCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  const solvedIds = useMemo(
    () => everAcceptedProblemIds(submissions),
    [submissions]
  );
  const roadmap = useMemo(
    () => buildRoadmap(problems, submissions),
    [problems, submissions]
  );
  const weak = useMemo(() => weakTopics(roadmap), [roadmap]);

  const loadPremium = useCallback(async () => {
    if (!userId || !premium) {
      setAnalytics(null);
      setPlans([]);
      setRevisionIds([]);
      setCompanies([]);
      return;
    }
    setLoading(true);
    try {
      const tasks: Promise<void>[] = [];

      // Revision queue is part of prep — fetch only for entitled premium users
      tasks.push(
        engagementApi
          .listMyRevisions()
          .then((res) => {
            setRevisionIds(res?.data?.problemIds || []);
          })
          .catch(() => setRevisionIds([]))
      );

      if (allowCompany) {
        tasks.push(
          companyApi
            .listDirectory({ page: 1, limit: 6 })
            .then((res) => setCompanies(res?.data || []))
            .catch(() => setCompanies([]))
        );
      } else {
        setCompanies([]);
      }

      if (allowAnalytics) {
        tasks.push(
          userAnalyticsApi
            .getMine(userId)
            .then((res) => setAnalytics(res?.data || null))
            .catch(() => setAnalytics(null))
        );
      } else {
        setAnalytics(null);
      }

      if (allowPlans) {
        tasks.push(
          contentApi
            .listStudyPlans({ limit: 6, page: 1 })
            .then((res) => {
              const list = Array.isArray(res?.data)
                ? res.data
                : (res as any)?.data?.plans || [];
              setPlans(list.slice(0, 6));
            })
            .catch(() => setPlans([]))
        );
      } else {
        setPlans([]);
      }

      await Promise.all(tasks);
    } finally {
      setLoading(false);
    }
  }, [userId, premium, allowAnalytics, allowPlans, allowCompany]);

  useEffect(() => {
    void loadPremium();
  }, [loadPremium, refreshKey]);

  const revisionProblems = useMemo(() => {
    const set = new Set(revisionIds.map(String));
    return problems.filter((p) => set.has(getProblemId(p))).slice(0, 8);
  }, [problems, revisionIds]);

  const personalized = useMemo(() => {
    // Prefer analytics topic strengths (weakest) when entitled; else weak roadmap topics
    const fromAnalytics = (analytics?.topicStrengths || [])
      .map((t) => ({
        name: String(t.topic || t.name || ""),
        score: Number(t.strength ?? t.score ?? 0),
      }))
      .filter((t) => t.name)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((t) => t.name.toLowerCase());

    const focus = fromAnalytics.length
      ? fromAnalytics
      : weak.slice(0, 3).map((w) => w.name.toLowerCase());

    const out: Problem[] = [];
    for (const p of problems) {
      const id = getProblemId(p);
      if (!id || solvedIds.has(id)) continue;
      const blob = `${p.category || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
      if (focus.some((f) => blob.includes(f) || f.includes(blob))) {
        out.push(p);
      }
      if (out.length >= 5) break;
    }
    return out;
  }, [analytics, weak, problems, solvedIds]);

  const challenges = useMemo(
    () => (allowProblems ? premiumChallengeProblems(problems, solvedIds) : []),
    [allowProblems, problems, solvedIds]
  );

  const readiness = useMemo(() => {
    if (!allowInterview && !allowAnalytics) return null;
    const rate = Number(analytics?.acceptanceRate ?? 0);
    return interviewReadiness({
      weakCount: weak.length,
      topicCount: Math.max(1, roadmap.filter((t) => t.total > 0).length),
      acceptanceRate: rate,
      revisionDue: revisionIds.length,
      solvedTotal: solvedIds.size,
    });
  }, [
    allowInterview,
    allowAnalytics,
    analytics,
    weak,
    roadmap,
    revisionIds,
    solvedIds,
  ]);

  const startUpgrade = async () => {
    setUpgradeBusy(true);
    try {
      const cfg = await billingApi.getConfig();
      if (!cfg.data?.enabled) return;
      const session = await billingApi.createCheckout();
      if (session.data?.url) window.location.assign(session.data.url);
    } catch {
      /* ignore */
    } finally {
      setUpgradeBusy(false);
    }
  };

  if (!premium) {
    return (
      <section
        className="free-home-card"
        aria-labelledby="premium-prep-locked"
      >
        <h2 id="premium-prep-locked">Your Preparation</h2>
        <UpgradePrompt
          feature="premium.study_plans"
          title="Unlock Premium preparation"
          description="Personalized recommendations, company sets, revision coaching, interview readiness, and AI assist."
          ctaLabel={upgradeBusy ? "Starting…" : "Upgrade to Premium"}
          onUpgradeClick={() => void startUpgrade()}
        />
      </section>
    );
  }

  return (
    <section className="free-home-prep" aria-labelledby="premium-prep-heading">
      <div className="free-home-card-head" style={{ marginBottom: 4 }}>
        <h2 id="premium-prep-heading">Your Preparation</h2>
        {loading ? (
          <span className="free-home-muted">Updating…</span>
        ) : (
          <span className="free-home-muted">Premium intelligence</span>
        )}
      </div>

      {/* Weak Topics (premium prep framing) */}
      <article className="free-home-card" aria-labelledby="prep-weak">
        <div className="free-home-card-head">
          <h3 id="prep-weak">Weak Topics</h3>
        </div>
        {weak.length === 0 ? (
          <EmptyState
            compact
            title="No weak topics flagged"
            description="Keep solving across categories to refine this view."
          />
        ) : (
          <ul className="free-home-topics">
            {weak.map((t) => (
              <li key={t.name}>
                <div className="free-home-topic-row">
                  <strong>{t.name}</strong>
                  <span className="free-home-muted">
                    {t.solved}/{t.total} ({t.pct}%)
                  </span>
                </div>
                <div className="free-home-bar thin">
                  <span style={{ width: `${t.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* Personalized recommendations */}
      <article className="free-home-card" aria-labelledby="prep-recos">
        <div className="free-home-card-head">
          <h3 id="prep-recos">
            <Sparkles size={16} aria-hidden /> Recommended Problems
          </h3>
        </div>
        {personalized.length === 0 ? (
          <EmptyState
            compact
            title="No personalized picks yet"
            description="Solve more problems so recommendations can target your gaps."
          />
        ) : (
          <ul className="free-home-list">
            {personalized.map((p) => (
              <li key={getProblemId(p) || p.slug}>
                <button
                  type="button"
                  className="free-home-list-row"
                  onClick={() => onSelectProblem(p)}
                >
                  <span className="free-home-list-main">
                    <strong>{p.title}</strong>
                    <span className="free-home-muted">
                      {normalizeDifficulty(p.difficulty)}
                      {p.category ? ` · ${p.category}` : ""}
                    </span>
                  </span>
                  <ArrowRight size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* Revision Due */}
      <article className="free-home-card" aria-labelledby="prep-revision">
        <div className="free-home-card-head">
          <h3 id="prep-revision">
            <RotateCcw size={16} aria-hidden /> Revision Due
          </h3>
          <button
            type="button"
            className="free-home-link"
            onClick={() => onNavigate("reviews")}
          >
            Spaced reviews
          </button>
        </div>
        {revisionProblems.length === 0 ? (
          <EmptyState
            compact
            title="Revision queue empty"
            description="Official ACCEPTED solves seed spaced-repetition cards. Open Reviews for due/overdue queues."
          />
        ) : (
          <ul className="free-home-list">
            {revisionProblems.map((p) => (
              <li key={getProblemId(p) || p.slug}>
                <button
                  type="button"
                  className="free-home-list-row"
                  onClick={() => onSelectProblem(p)}
                >
                  <span className="free-home-list-main">
                    <strong>{p.title}</strong>
                    <span className="free-home-muted">
                      {normalizeDifficulty(p.difficulty)}
                    </span>
                  </span>
                  <ArrowRight size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* Company Preparation */}
      <article className="free-home-card" aria-labelledby="prep-company">
        <div className="free-home-card-head">
          <h3 id="prep-company">
            <Briefcase size={16} aria-hidden /> Company Preparation
          </h3>
        </div>
        {!allowCompany ? (
          <UpgradePrompt
            feature="premium.company_questions"
            title="Company sets require Premium"
            ctaLabel="Included in Premium"
          />
        ) : companies.length === 0 ? (
          <EmptyState
            compact
            title="No companies configured"
            description="Published company interview sets will appear here."
          />
        ) : (
          <ul className="free-home-list">
            {companies.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="free-home-list-row"
                  onClick={() => onNavigate("companies")}
                >
                  <span className="free-home-list-main">
                    <strong>{c.name}</strong>
                    <span className="free-home-muted">
                      {c.questionCount} question
                      {c.questionCount === 1 ? "" : "s"}
                      {c.isPremium ? " · Premium" : ""}
                    </span>
                  </span>
                  <ArrowRight size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* Interview Readiness + Advanced analytics */}
      <div className="free-home-split">
        <article className="free-home-card" aria-labelledby="prep-interview">
          <div className="free-home-card-head">
            <h3 id="prep-interview">
              <Swords size={16} aria-hidden /> Interview Readiness
            </h3>
          </div>
          {!allowInterview ? (
            <UpgradePrompt feature="premium.mock_interview" />
          ) : (
            <div>
              {readiness ? (
                <>
                  <p className="free-home-daily-title">{readiness.score}/100</p>
                  <p className="free-home-muted">{readiness.label}</p>
                  <p className="free-home-muted" style={{ marginTop: 8 }}>
                    Prep heuristic from coverage/acceptance — not a mock interview
                    grade.
                  </p>
                </>
              ) : (
                <EmptyState compact title="Not enough data yet" />
              )}
              <Button
                type="button"
                size="sm"
                style={{ marginTop: 12 }}
                onClick={() => onNavigate("interview")}
              >
                Start mock interview <ArrowRight size={14} />
              </Button>
            </div>
          )}
        </article>

        <article className="free-home-card" aria-labelledby="prep-analytics">
          <div className="free-home-card-head">
            <h3 id="prep-analytics">
              <LineChart size={16} aria-hidden /> Advanced Analytics
            </h3>
          </div>
          {!allowAnalytics ? (
            <UpgradePrompt feature="premium.analytics" />
          ) : analytics ? (
            <ul className="free-home-activity">
              <li>
                Acceptance rate:{" "}
                <strong>
                  {Math.round(Number(analytics.acceptanceRate || 0))}%
                </strong>
              </li>
              <li>
                Accepted / total:{" "}
                <strong>
                  {analytics.acceptedSubmissions ?? 0}/
                  {analytics.totalSubmissions ?? 0}
                </strong>
              </li>
              <li>
                Analytics streak:{" "}
                <strong>{analytics.currentStreak ?? 0}</strong> (max{" "}
                {analytics.maxStreak ?? 0})
              </li>
              <li>
                Topic signals:{" "}
                <strong>{analytics.topicStrengths?.length ?? 0}</strong>
              </li>
              <li>
                <button
                  type="button"
                  className="free-home-link"
                  onClick={() => onNavigate("analytics")}
                >
                  Open submission analytics
                </button>
              </li>
            </ul>
          ) : (
            <EmptyState
              compact
              title="No analytics events yet"
              description="Stats appear after judged submissions are recorded."
            />
          )}
        </article>
      </div>

      {/* Premium study plans */}
      <article className="free-home-card" aria-labelledby="prep-plans">
        <div className="free-home-card-head">
          <h3 id="prep-plans">
            <ClipboardList size={16} aria-hidden /> Premium Study Plans
          </h3>
          <button
            type="button"
            className="free-home-link"
            onClick={() => onNavigate("learn")}
          >
            Learn
          </button>
        </div>
        {!allowPlans ? (
          <UpgradePrompt feature="premium.study_plans" />
        ) : plans.length === 0 ? (
          <EmptyState
            compact
            title="No published study plans"
            description="Plans from ContentService will show here when available."
          />
        ) : (
          <ul className="free-home-list">
            {plans.map((plan) => (
              <li key={plan._id || plan.slug}>
                <div className="free-home-list-row" style={{ cursor: "default" }}>
                  <span className="free-home-list-main">
                    <strong>{plan.title}</strong>
                    <span className="free-home-muted">
                      {plan.difficulty || "Plan"}
                      {plan.estimatedDays
                        ? ` · ~${plan.estimatedDays} days`
                        : ""}
                      {plan.problemSlugs?.length
                        ? ` · ${plan.problemSlugs.length} problems`
                        : ""}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* Premium challenges + AI */}
      <div className="free-home-split">
        <article className="free-home-card" aria-labelledby="prep-challenges">
          <div className="free-home-card-head">
            <h3 id="prep-challenges">Premium Challenges</h3>
          </div>
          {!allowProblems ? (
            <UpgradePrompt feature="premium.problems" />
          ) : challenges.length === 0 ? (
            <EmptyState
              compact
              title="No premium challenges queued"
              description="Premium-flagged problems you have not solved appear here."
            />
          ) : (
            <ul className="free-home-list">
              {challenges.map((p) => (
                <li key={getProblemId(p) || p.slug}>
                  <button
                    type="button"
                    className="free-home-list-row"
                    onClick={() => onSelectProblem(p)}
                  >
                    <span className="free-home-list-main">
                      <strong>{p.title}</strong>
                      <span className="free-home-muted">
                        {normalizeDifficulty(p.difficulty)}
                      </span>
                    </span>
                    <ArrowRight size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="free-home-card" aria-labelledby="prep-ai">
          <div className="free-home-card-head">
            <h3 id="prep-ai">
              <Brain size={16} aria-hidden /> AI Assistance
            </h3>
          </div>
          <div>
            <p className="free-home-muted">
              Learning-first AI: hints and explanations with server-side daily
              credits. Free gets a limited allowance; Premium gets more plus
              Interview Mode.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => onNavigate("ai")}
            >
              Open AlgoPath AI
            </Button>
            {!allowAi ? (
              <div style={{ marginTop: 12 }}>
                <UpgradePrompt
                  feature="premium.ai"
                  title="Unlock Premium AI allowance"
                />
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
};
