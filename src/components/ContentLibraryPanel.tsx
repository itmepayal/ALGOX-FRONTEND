import { useCallback, useEffect, useState, type FC } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  Lock,
  Play,
} from "lucide-react";
import {
  contentApi,
  type ContentArticle,
  type ContentStudyPlan,
  type StudyPlanProgress,
} from "../api/contentApi";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../access/canAccess";
import { hasAccessToken } from "../api/accessToken";
import { PremiumBadge } from "./access/PremiumBadge";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { Button } from "./ui/button";
import { billingApi } from "../api/billingApi";

type Tab = "articles" | "plans";

type Props = {
  onOpenProblem?: (ref: { id?: string; slug?: string; title?: string }) => void;
  onRequireAuth?: () => void;
};

export const ContentLibraryPanel: FC<Props> = ({
  onOpenProblem,
  onRequireAuth,
}) => {
  const { user } = useAuth();
  const canPremiumPlans = canAccess(user, "premium.study_plans");
  const [tab, setTab] = useState<Tab>("plans");
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [plans, setPlans] = useState<ContentStudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [articleDetail, setArticleDetail] = useState<{
    title: string;
    body: string;
    meta?: string;
  } | null>(null);
  const [activePlan, setActivePlan] = useState<ContentStudyPlan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [articlesRes, plansRes] = await Promise.all([
        contentApi.listArticles({ page: 1, limit: 50 }),
        contentApi.listStudyPlans({}),
      ]);
      setArticles(articlesRes.data?.articles ?? []);
      setPlans(plansRes.data || []);
    } catch {
      setError("Failed to load content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openArticle = async (slug: string) => {
    try {
      const res = await contentApi.getArticleBySlug(slug);
      const a = res.data;
      if (!a) return;
      setArticleDetail({
        title: a.title,
        body: a.content,
        meta: a.summary || a.category,
      });
    } catch {
      setError("Failed to load article.");
    }
  };

  const openPlan = async (slug: string) => {
    try {
      const res = await contentApi.getStudyPlanBySlug(slug);
      if (res.data) setActivePlan(res.data);
    } catch {
      setError("Failed to load study plan.");
    }
  };

  const refreshPlan = async (slug: string) => {
    const res = await contentApi.getStudyPlanBySlug(slug);
    if (res.data) setActivePlan(res.data);
  };

  const startUpgrade = () => {
    void billingApi
      .createCheckout()
      .then((s) => {
        const url = s.data?.url;
        if (url) window.location.assign(url);
      })
      .catch(() => undefined);
  };

  if (articleDetail) {
    return (
      <div className="learn-layout animate-fade-in">
        <header className="learn-header">
          <button
            type="button"
            className="platform-icon-btn"
            onClick={() => setArticleDetail(null)}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{articleDetail.title}</h1>
            {articleDetail.meta && <p>{articleDetail.meta}</p>}
          </div>
        </header>
        <section className="learn-card">
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {articleDetail.body}
          </div>
        </section>
      </div>
    );
  }

  if (activePlan) {
    return (
      <StudyPlanDetail
        plan={activePlan}
        busy={busy}
        canPremium={canPremiumPlans}
        onBack={() => setActivePlan(null)}
        onRequireAuth={onRequireAuth}
        onUpgrade={startUpgrade}
        onBusy={setBusy}
        onRefresh={() => void refreshPlan(activePlan.slug)}
        onOpenProblem={onOpenProblem}
        onError={setError}
      />
    );
  }

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <BookOpen size={22} /> Learn
          </h1>
          <p>Structured study plans and articles — progress syncs to your account.</p>
        </div>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={`platform-chip ${tab === "plans" ? "platform-chip-streak" : ""}`}
          onClick={() => setTab("plans")}
        >
          Study Plans
        </button>
        <button
          type="button"
          className={`platform-chip ${tab === "articles" ? "platform-chip-streak" : ""}`}
          onClick={() => setTab("articles")}
        >
          Articles
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--danger, #ef4444)", marginBottom: 12 }}>{error}</p>
      )}

      {loading ? (
        <div className="loading-center">
          <Loader2 size={20} className="spin" /> Loading…
        </div>
      ) : tab === "articles" ? (
        articles.length === 0 ? (
          <div className="placeholder-tab">
            <BookOpen size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
            <h2>No articles yet</h2>
            <p>Published articles will appear here.</p>
          </div>
        ) : (
          <div className="learn-card">
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {articles.map((a) => (
                <li key={a._id || a.slug} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="platform-chip"
                    style={{ width: "100%", justifyContent: "flex-start" }}
                    onClick={() => void openArticle(a.slug)}
                  >
                    {a.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : plans.length === 0 ? (
        <div className="placeholder-tab">
          <BookOpen size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
          <h2>No study plans yet</h2>
          <p>Published plans will appear here once configured by admins.</p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 10,
          }}
        >
          {plans.map((p) => (
            <li key={p.id || p._id || p.slug}>
              <button
                type="button"
                className="learn-card"
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  border: "1px solid var(--border, #27272a)",
                }}
                onClick={() => void openPlan(p.slug)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <strong>{p.title}</strong>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {p.isPremium || p.access === "PREMIUM" ? (
                      <PremiumBadge label="Premium" />
                    ) : null}
                    {p.accessLocked ? <Lock size={14} /> : null}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                  {[
                    p.difficulty,
                    p.estimatedDays
                      ? `${p.estimatedDays} days`
                      : p.estimatedMinutes
                        ? `${p.estimatedMinutes} min`
                        : null,
                    `${p.totalProblemsCount || 0} problems`,
                    p.category,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {p.progress?.enrolled ? (
                  <p style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
                    {statusLabel(p.progress)} · {p.progress.completionPercentage}%
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function statusLabel(p?: StudyPlanProgress | null) {
  if (!p?.enrolled) return "Not started";
  if (p.status === "completed") return "Completed";
  if (p.status === "in_progress") return "In progress";
  return "Not started";
}

const StudyPlanDetail: FC<{
  plan: ContentStudyPlan;
  busy: boolean;
  canPremium: boolean;
  onBack: () => void;
  onRequireAuth?: () => void;
  onUpgrade: () => void;
  onBusy: (b: boolean) => void;
  onRefresh: () => Promise<void> | void;
  onOpenProblem?: Props["onOpenProblem"];
  onError: (msg: string) => void;
}> = ({
  plan,
  busy,
  canPremium,
  onBack,
  onRequireAuth,
  onUpgrade,
  onBusy,
  onRefresh,
  onOpenProblem,
  onError,
}) => {
  const progress = plan.progress;
  const locked = Boolean(plan.accessLocked);
  const sections = plan.sections || plan.cards || [];

  const ensureAuth = () => {
    if (!hasAccessToken()) {
      onRequireAuth?.();
      return false;
    }
    return true;
  };

  const enroll = async () => {
    if (!ensureAuth()) return;
    if (locked || (plan.isPremium && !canPremium)) {
      onUpgrade();
      return;
    }
    onBusy(true);
    try {
      await contentApi.enrollStudyPlan(plan.slug);
      await onRefresh();
    } catch (err: any) {
      onError(
        err?.response?.data?.message || err?.message || "Unable to enroll"
      );
    } finally {
      onBusy(false);
    }
  };

  const resume = async () => {
    if (!ensureAuth()) return;
    onBusy(true);
    try {
      const res = await contentApi.resumeStudyPlan(plan.slug);
      await onRefresh();
      const pid = res.data?.resumeProblemId;
      if (pid) onOpenProblem?.({ id: pid });
    } catch (err: any) {
      onError(err?.response?.data?.message || "Unable to resume");
    } finally {
      onBusy(false);
    }
  };

  const complete = async () => {
    if (!ensureAuth()) return;
    onBusy(true);
    try {
      await contentApi.completeStudyPlan(plan.slug);
      await onRefresh();
    } catch (err: any) {
      onError(err?.response?.data?.message || "Unable to complete");
    } finally {
      onBusy(false);
    }
  };

  const markDone = async (problemId: string) => {
    if (!ensureAuth()) return;
    onBusy(true);
    try {
      await contentApi.markStudyPlanProblem(plan.slug, problemId);
      await onRefresh();
    } catch (err: any) {
      onError(err?.response?.data?.message || "Unable to update progress");
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <button type="button" className="platform-icon-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {plan.title}
            {plan.isPremium ? <PremiumBadge /> : null}
          </h1>
          <p>
            {[
              plan.difficulty,
              plan.estimatedDays
                ? `${plan.estimatedDays} days`
                : plan.estimatedMinutes
                  ? `${plan.estimatedMinutes} min`
                  : null,
              statusLabel(progress),
              progress?.enrolled
                ? `${progress.completionPercentage}%`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      {locked ? (
        <UpgradePrompt
          feature="premium.study_plans"
          title="Premium study plan"
          description="Upgrade to unlock full sections, lessons, and progress tracking for this plan."
          onUpgradeClick={onUpgrade}
        />
      ) : null}

      <section className="learn-card" style={{ marginBottom: 12 }}>
        <p style={{ marginTop: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {plan.description}
        </p>
        {plan.topics?.length ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
            Topics: {plan.topics.join(", ")}
          </p>
        ) : null}
        {plan.prerequisiteSlugs?.length ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
            Prerequisites: {plan.prerequisiteSlugs.join(", ")}
          </p>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {!progress?.enrolled ? (
            <Button type="button" disabled={busy || locked} onClick={() => void enroll()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Enroll
            </Button>
          ) : (
            <>
              <Button
                type="button"
                disabled={busy || progress.status === "completed"}
                onClick={() => void resume()}
              >
                <Play size={14} /> Resume
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || progress.status === "completed"}
                onClick={() => void complete()}
              >
                <CheckCircle2 size={14} /> Mark complete
              </Button>
            </>
          )}
        </div>
        <p style={{ marginBottom: 0, marginTop: 10, fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Progress is saved on the server — not in this browser alone.
        </p>
      </section>

      {sections.map((s, i) => (
        <section key={`${s.title}-${i}`} className="learn-card" style={{ marginBottom: 10 }}>
          <h3 style={{ marginTop: 0 }}>
            {s.order || i + 1}. {s.title}
            {s.locked ? (
              <Lock size={14} style={{ marginLeft: 8, display: "inline" }} />
            ) : null}
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            {s.description}
          </p>
          {s.locked || !s.problemIds?.length ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {s.problemCount != null
                ? `${s.problemCount} lessons`
                : "Lessons locked"}
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {s.problemIds.map((pid) => {
                const done = progress?.completedProblemIds?.includes(pid);
                return (
                  <li
                    key={pid}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "6px 0",
                      borderTop: "1px solid var(--border, #27272a)",
                    }}
                  >
                    <button
                      type="button"
                      className="platform-chip"
                      onClick={() => onOpenProblem?.({ id: pid })}
                    >
                      {done ? <CheckCircle2 size={14} /> : null}
                      {pid}
                    </button>
                    {progress?.enrolled && !done ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void markDone(pid)}
                      >
                        Done
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
};
