import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Crown,
  FileText,
  Layers,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  AlertCircle,
  Signal,
  Hash,
  Clock,
} from "lucide-react";
import {
  contentApi,
  type ContentArticle,
  type ContentStudyPlan,
} from "../api/contentApi";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../access/canAccess";
import { hasAccessToken } from "../api/accessToken";
import { asDisplayText } from "../lib/asDisplayText";
import { formatDisplayDate } from "../lib/formatDisplayDate";
import { PremiumBadge } from "./access/PremiumBadge";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import "./companies/companies.css";
import "./learn.css";

type Tab = "plans" | "articles";

type Props = {
  onOpenProblem?: (ref: { id?: string; slug?: string; title?: string }) => void;
  onRequireAuth?: () => void;
};

function friendlyLoadError(): string {
  return "We couldn't load the learning content right now.";
}

function difficultyLabel(d?: string): string | null {
  if (!d) return null;
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function planMetaBits(p: ContentStudyPlan): string[] {
  const bits: string[] = [];
  const diff = difficultyLabel(p.difficulty);
  if (diff) bits.push(diff);
  if (p.estimatedDays != null && Number.isFinite(Number(p.estimatedDays)) && Number(p.estimatedDays) > 0) {
    const d = Number(p.estimatedDays);
    bits.push(`${d} day${d === 1 ? "" : "s"}`);
  } else if (
    p.estimatedMinutes != null &&
    Number.isFinite(Number(p.estimatedMinutes)) &&
    Number(p.estimatedMinutes) > 0
  ) {
    bits.push(`${Number(p.estimatedMinutes)} min`);
  }
  const sectionN =
    p.sectionCount != null && Number.isFinite(Number(p.sectionCount))
      ? Number(p.sectionCount)
      : (p.sections || p.cards || []).length;
  if (Number.isFinite(sectionN)) {
    bits.push(`${sectionN} module${sectionN === 1 ? "" : "s"}`);
  }
  if (p.totalProblemsCount != null && Number.isFinite(Number(p.totalProblemsCount))) {
    const n = Number(p.totalProblemsCount);
    bits.push(`${n} problem${n === 1 ? "" : "s"}`);
  }
  const cat = asDisplayText(p.category);
  if (cat) bits.push(cat.charAt(0).toUpperCase() + cat.slice(1));
  return bits;
}

function sectionLessonCount(s: {
  problemIds?: string[];
  problemCount?: number;
}): number {
  if (Array.isArray(s.problemIds)) return s.problemIds.length;
  if (s.problemCount != null && Number.isFinite(Number(s.problemCount))) {
    return Number(s.problemCount);
  }
  return 0;
}

function planHasContent(plan: ContentStudyPlan): boolean {
  const sections = plan.sections || plan.cards || [];
  if (sections.length > 0) return true;
  if ((plan.totalProblemsCount ?? 0) > 0) return true;
  if ((plan.problemIds || []).length > 0) return true;
  return false;
}

/** Extract markdown ## / ### headings for an optional TOC. */
function extractMarkdownToc(
  markdown: string
): Array<{ id: string; label: string; level: number }> {
  const out: Array<{ id: string; label: string; level: number }> = [];
  const seen = new Map<string, number>();
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line.trim());
    if (!m) continue;
    const level = m[1].length;
    const label = m[2].replace(/[#*_`]/g, "").trim();
    if (!label) continue;
    let id = label
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    if (!id) continue;
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    out.push({ id, label, level });
  }
  return out;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function ProgressBar({ pct }: { pct: number }) {
  const safe = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <div
      className="learn-progress-track"
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${safe}% complete`}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

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
  const [refreshing, setRefreshing] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [articlesError, setArticlesError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [articleDetail, setArticleDetail] = useState<ContentArticle | null>(
    null
  );
  const [activePlan, setActivePlan] = useState<ContentStudyPlan | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (inFlight.current && opts?.soft) return;
    inFlight.current = true;
    if (opts?.soft || hasLoadedOnce) setRefreshing(true);
    else setLoading(true);
    setPlansError("");
    setArticlesError("");
    try {
      const [articlesSettled, plansSettled] = await Promise.allSettled([
        contentApi.listArticles({ page: 1, limit: 50 }),
        contentApi.listStudyPlans({}),
      ]);
      if (articlesSettled.status === "fulfilled") {
        setArticles(articlesSettled.value.data?.articles ?? []);
      } else {
        setArticlesError(friendlyLoadError());
        if (!hasLoadedOnce) setArticles([]);
      }
      if (plansSettled.status === "fulfilled") {
        setPlans(plansSettled.value.data || []);
      } else {
        setPlansError(friendlyLoadError());
        if (!hasLoadedOnce) setPlans([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
      inFlight.current = false;
    }
  }, [hasLoadedOnce]);

  useEffect(() => {
    void load();
  }, [load]);

  const continuePlan = useMemo(() => {
    return (
      plans.find(
        (p) =>
          p.progress?.enrolled &&
          p.progress.status === "in_progress" &&
          !p.accessLocked
      ) || null
    );
  }, [plans]);

  const enrolledCount = useMemo(
    () => plans.filter((p) => p.progress?.enrolled).length,
    [plans]
  );

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const tabs: Tab[] = ["plans", "articles"];
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + dir + tabs.length) % tabs.length];
    setTab(next);
    const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>(
      "[role='tab']"
    );
    btns[(index + dir + tabs.length) % tabs.length]?.focus();
  };

  const openArticle = async (slug: string) => {
    setDetailError("");
    setDetailLoading(true);
    try {
      const res = await contentApi.getArticleBySlug(slug);
      if (res.data) setArticleDetail(res.data);
    } catch {
      setDetailError("Unable to load this article.");
    } finally {
      setDetailLoading(false);
    }
  };

  const openPlan = async (slug: string) => {
    setDetailError("");
    setDetailLoading(true);
    try {
      const res = await contentApi.getStudyPlanBySlug(slug);
      if (res.data) setActivePlan(res.data);
    } catch {
      setDetailError("Unable to load this study plan.");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshPlan = async (slug: string) => {
    const res = await contentApi.getStudyPlanBySlug(slug);
    if (res.data) setActivePlan(res.data);
  };

  const startUpgrade = () => {
    void import("../billing/startPremiumCheckout")
      .then(({ startPremiumCheckout }) => startPremiumCheckout())
      .catch(() => undefined);
  };

  if (articleDetail) {
    return (
      <ArticleDetail
        article={articleDetail}
        onBack={() => setArticleDetail(null)}
        onBackToArticles={() => {
          setArticleDetail(null);
          setTab("articles");
        }}
      />
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
        onError={setDetailError}
        detailError={detailError}
      />
    );
  }

  if (loading && !hasLoadedOnce) {
    return (
      <div className="co-page learn-page" aria-busy="true" aria-live="polite">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        <div className="learn-tab-skel">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="learn-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const tabError = tab === "plans" ? plansError : articlesError;

  return (
    <div className="co-page learn-page">
      <header className="co-header learn-header-bar">
        <div>
          <p className="co-kicker">Learning</p>
          <h1 className="co-title">
            <BookOpen size={22} strokeWidth={2} aria-hidden className="learn-icon" />
            Learn
          </h1>
          <p className="co-lede">
            Structured study plans and articles to help you build consistent
            technical skills.
          </p>
          {hasAccessToken() ? (
            <p className="learn-sync" role="status">
              <span className="learn-sync-dot" aria-hidden />
              Progress synced
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={refreshing || loading}
          aria-label="Refresh learning content"
          title="Refresh learning content"
          onClick={() => void load({ soft: true })}
        >
          <RefreshCw
            size={14}
            strokeWidth={2}
            aria-hidden
            className={refreshing ? "learn-icon learn-spin" : "learn-icon"}
          />
          Refresh
        </Button>
      </header>

      {continuePlan ? (
        <section className="co-panel learn-continue" aria-label="Continue learning">
          <div>
            <p className="learn-continue-label">Continue learning</p>
            <strong>{asDisplayText(continuePlan.title, "Study plan")}</strong>
            {continuePlan.progress ? (
              <p className="co-muted">
                {continuePlan.progress.solvedCount}/
                {continuePlan.progress.totalProblemsCount} completed ·{" "}
                {continuePlan.progress.completionPercentage}%
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            disabled={detailLoading}
            onClick={() => void openPlan(continuePlan.slug)}
          >
            Continue <ArrowRight size={14} strokeWidth={2} aria-hidden className="learn-icon" />
          </Button>
        </section>
      ) : null}

      {enrolledCount > 0 ? (
        <p className="co-muted learn-enrolled-hint">
          {enrolledCount} enrolled plan{enrolledCount === 1 ? "" : "s"} · progress
          saved on the server
        </p>
      ) : null}

      <div
        className="learn-tabs"
        role="tablist"
        aria-label="Learn sections"
        onKeyDown={(e) => {
          const tabs = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']")
          );
          const idx = tabs.indexOf(e.target as HTMLButtonElement);
          if (idx >= 0) onTabKeyDown(e, idx);
        }}
      >
        {(
          [
            { id: "plans" as const, label: "Study Plans", Icon: BookMarked },
            { id: "articles" as const, label: "Articles", Icon: FileText },
          ] as const
        ).map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={
                selected ? "learn-tab learn-tab-active" : "learn-tab"
              }
              onClick={() => setTab(t.id)}
            >
              <t.Icon size={15} strokeWidth={2} aria-hidden className="learn-icon" />
              {t.label}
            </button>
          );
        })}
      </div>

      {detailError ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden className="learn-icon" />
          <p>{detailError}</p>
          <button type="button" onClick={() => setDetailError("")}>
            Dismiss
          </button>
        </div>
      ) : null}

      {detailLoading ? (
        <div className="learn-detail-loading" aria-live="polite">
          <Loader2 size={18} className="animate-spin learn-icon" aria-hidden />
          Opening…
        </div>
      ) : null}

      <div
        className={refreshing ? "learn-content learn-content-refreshing" : "learn-content"}
        aria-busy={refreshing}
      >
        {tabError ? (
          <div className="co-inline-error" role="alert">
            <AlertCircle size={16} strokeWidth={2} aria-hidden className="learn-icon" />
            <div>
              <strong>
                {tab === "plans"
                  ? "Unable to load study plans"
                  : "Unable to load articles"}
              </strong>
              <p>{tabError}</p>
            </div>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load({ soft: true })}
            >
              Retry
            </button>
          </div>
        ) : null}

        {!tabError && tab === "plans" ? (
          plans.length === 0 ? (
            <EmptyState
              title="No study plans available yet"
              description="There aren't any published study plans available right now. New learning paths will appear here once they are published."
              icon={<BookOpen size={22} strokeWidth={1.75} aria-hidden />}
            />
          ) : (
            <ul className="learn-grid">
              {plans.map((p) => {
                const progress = p.progress;
                const meta = planMetaBits(p);
                const enrolled = Boolean(progress?.enrolled);
                const completed = progress?.status === "completed";
                return (
                  <li key={p.id || p._id || p.slug}>
                    <button
                      type="button"
                      className="learn-plan-card"
                      onClick={() => void openPlan(p.slug)}
                    >
                      <div className="learn-plan-card-top">
                        <span className="learn-plan-icon" aria-hidden>
                          <BookMarked size={18} strokeWidth={2} className="learn-icon" />
                        </span>
                        <span className="learn-plan-badges">
                          {p.isPremium || p.access === "PREMIUM" ? (
                            <PremiumBadge label="Premium" />
                          ) : null}
                          {p.accessLocked ? (
                            <Lock
                              size={14}
                              strokeWidth={2}
                              aria-label="Locked"
                              className="learn-icon"
                            />
                          ) : null}
                          {completed ? (
                            <Badge variant="success">Completed</Badge>
                          ) : null}
                        </span>
                      </div>
                      <strong className="learn-plan-title">
                        {asDisplayText(p.title, "Untitled plan")}
                      </strong>
                      {asDisplayText(p.description) ? (
                        <p className="learn-plan-desc">
                          {asDisplayText(p.description)}
                        </p>
                      ) : null}
                      {meta.length ? (
                        <p className="learn-plan-meta">{meta.join(" · ")}</p>
                      ) : null}
                      {enrolled && progress ? (
                        <div className="learn-plan-progress">
                          <div className="learn-plan-progress-row">
                            <span>
                              {progress.solvedCount}/{progress.totalProblemsCount}{" "}
                              completed
                            </span>
                            <span>{progress.completionPercentage}%</span>
                          </div>
                          <ProgressBar pct={progress.completionPercentage} />
                        </div>
                      ) : null}
                      <span className="learn-plan-cta">
                        {enrolled
                          ? completed
                            ? "View plan"
                            : "Continue learning"
                          : p.accessLocked
                            ? "View details"
                            : "Start plan"}
                        <ArrowRight size={14} strokeWidth={2} aria-hidden className="learn-icon" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {!tabError && tab === "articles" ? (
          articles.length === 0 ? (
            <EmptyState
              title="No articles available yet"
              description="New learning articles will appear here once they are published."
              icon={<FileText size={22} strokeWidth={1.75} aria-hidden />}
            />
          ) : (
            <ul className="learn-grid">
              {articles.map((a) => {
                const published = formatDisplayDate(a.updatedAt || a.createdAt);
                const articleTitle = asDisplayText(a.title, "Untitled article");
                const articleSummary = asDisplayText(a.summary);
                const author = asDisplayText(a.authorName);
                const readMins =
                  a.readTimeMinutes != null &&
                  Number.isFinite(Number(a.readTimeMinutes)) &&
                  Number(a.readTimeMinutes) > 0
                    ? Number(a.readTimeMinutes)
                    : null;
                const meta = [
                  asDisplayText(a.category),
                  author ? `By ${author}` : null,
                  readMins != null ? `${readMins} min read` : null,
                  published ? `Updated ${published}` : null,
                ].filter(Boolean);
                return (
                  <li key={a._id || a.slug}>
                    <button
                      type="button"
                      className="learn-plan-card"
                      onClick={() => void openArticle(a.slug)}
                    >
                      <div className="learn-plan-card-top">
                        <span className="learn-plan-icon" aria-hidden>
                          <FileText size={18} strokeWidth={2} className="learn-icon" />
                        </span>
                        {asDisplayText(a.category) ? (
                          <Badge variant="default">
                            {asDisplayText(a.category)}
                          </Badge>
                        ) : null}
                      </div>
                      <strong className="learn-plan-title">{articleTitle}</strong>
                      {articleSummary ? (
                        <p className="learn-plan-desc">{articleSummary}</p>
                      ) : null}
                      {meta.length ? (
                        <p className="learn-plan-meta">{meta.join(" · ")}</p>
                      ) : null}
                      <span className="learn-plan-cta">
                        Read article
                        <ArrowRight size={14} strokeWidth={2} aria-hidden className="learn-icon" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
};

const ArticleDetail: FC<{
  article: ContentArticle;
  onBack: () => void;
  onBackToArticles: () => void;
}> = ({ article, onBack, onBackToArticles }) => {
  const title = asDisplayText(article.title, "Untitled article");
  const summary = asDisplayText(article.summary);
  const category = asDisplayText(article.category);
  const author = asDisplayText(article.authorName);
  const body = typeof article.content === "string" ? article.content : "";
  const published = formatDisplayDate(article.updatedAt || article.createdAt);
  const readMins =
    article.readTimeMinutes != null &&
    Number.isFinite(Number(article.readTimeMinutes)) &&
    Number(article.readTimeMinutes) > 0
      ? Number(article.readTimeMinutes)
      : null;
  const locked = Boolean(article.accessLocked);
  const toc = useMemo(() => extractMarkdownToc(body), [body]);
  const headingCounts = useRef(new Map<string, number>());

  useEffect(() => {
    headingCounts.current = new Map();
  }, [body]);

  const mdComponents = useMemo(
    () => ({
      h2: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => {
        const text = String(children ?? "");
        let id = slugifyHeading(text);
        const n = (headingCounts.current.get(id) || 0) + 1;
        headingCounts.current.set(id, n);
        if (n > 1) id = `${id}-${n}`;
        return (
          <h2 id={id} {...props}>
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => {
        const text = String(children ?? "");
        let id = slugifyHeading(text);
        const n = (headingCounts.current.get(id) || 0) + 1;
        headingCounts.current.set(id, n);
        if (n > 1) id = `${id}-${n}`;
        return (
          <h3 id={id} {...props}>
            {children}
          </h3>
        );
      },
    }),
    []
  );

  const metaBits = [
    category
      ? category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " ")
      : null,
    author ? `By ${author}` : null,
    readMins != null
      ? `${readMins} min read`
      : null,
    published ? `Updated ${published}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="co-page learn-page learn-article-page">
      <nav className="learn-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="learn-crumb-link" onClick={onBack}>
          Learn
        </button>
        <span className="learn-crumb-sep" aria-hidden>
          /
        </span>
        <button
          type="button"
          className="learn-crumb-link"
          onClick={onBackToArticles}
        >
          Articles
        </button>
        <span className="learn-crumb-sep" aria-hidden>
          /
        </span>
        <span className="learn-crumb-current">{title}</span>
      </nav>

      <section className="co-panel learn-article-hero">
        <div className="learn-hero-badges">
          <Badge variant="primary">Article</Badge>
          {category ? (
            <Badge variant="default">
              {category.charAt(0).toUpperCase() +
                category.slice(1).replace(/-/g, " ")}
            </Badge>
          ) : null}
          {article.isPremium ? <PremiumBadge label="Premium" /> : null}
        </div>
        <div className="learn-hero-title-row">
          <button
            type="button"
            className="platform-icon-btn learn-hero-back"
            aria-label="Back to Learn"
            onClick={onBack}
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden className="learn-icon" />
          </button>
          <h1 className="learn-hero-title">{title}</h1>
        </div>
        {summary ? <p className="learn-hero-desc">{summary}</p> : null}
        {metaBits.length ? (
          <ul className="learn-hero-meta" aria-label="Article details">
            {metaBits.map((bit) => (
              <li key={bit}>{bit}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {locked ? (
        <section className="co-panel learn-premium-card" role="status">
          <div className="learn-premium-card-head">
            <span className="learn-plan-icon" aria-hidden>
              <Lock size={18} strokeWidth={2} className="learn-icon" />
            </span>
            <div>
              <PremiumBadge label="Premium" />
              <h2 className="learn-premium-title">Premium Article</h2>
            </div>
          </div>
          <p className="learn-premium-lede">
            Unlock this article with AlgoPath Premium.
          </p>
          <Button
            type="button"
            onClick={() => {
              void import("../billing/startPremiumCheckout")
                .then(({ startPremiumCheckout }) => startPremiumCheckout())
                .catch(() => undefined);
            }}
          >
            <Crown size={14} strokeWidth={2} aria-hidden className="learn-icon" />
            Upgrade
          </Button>
        </section>
      ) : (
        <div
          className={
            toc.length > 0
              ? "learn-article-layout learn-article-layout-toc"
              : "learn-article-layout"
          }
        >
          <article className="co-panel learn-article-body">
            {body.trim() ? (
              <div className="learn-md">
                <ReactMarkdown components={mdComponents}>{body}</ReactMarkdown>
              </div>
            ) : (
              <EmptyState
                title="No article content yet"
                description="This article does not have published body content."
                icon={<FileText size={22} strokeWidth={1.75} aria-hidden />}
              />
            )}
          </article>

          {toc.length > 0 ? (
            <aside className="co-panel learn-article-toc" aria-label="On this page">
              <p className="learn-toc-kicker">On this page</p>
              <nav>
                <ul className="learn-toc-list">
                  {toc.map((item) => (
                    <li
                      key={item.id}
                      className={
                        item.level >= 3
                          ? "learn-toc-item learn-toc-item-sub"
                          : "learn-toc-item"
                      }
                    >
                      <a href={`#${item.id}`}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
};

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
  detailError: string;
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
  detailError,
}) => {
  const progress = plan.progress;
  const locked = Boolean(plan.accessLocked);
  const isPremium = Boolean(plan.isPremium || plan.access === "PREMIUM");
  const sections = plan.sections || plan.cards || [];
  const hasContent = planHasContent(plan);
  const title = asDisplayText(plan.title, "Untitled plan");
  const description = asDisplayText(plan.description);
  const enrolled = Boolean(progress?.enrolled);
  const completed = progress?.status === "completed";
  const inProgress = progress?.status === "in_progress";
  const lastStudied = formatDisplayDate(progress?.lastStudiedAt);
  const problemTotal = Math.max(
    Number(progress?.totalProblemsCount) || 0,
    Number(plan.totalProblemsCount) || 0,
    (plan.problemIds || []).length
  );
  const canTrackProgress = hasContent && problemTotal > 0;
  const showProgressCard = enrolled && canTrackProgress && progress != null;
  const showCompleteAction =
    enrolled && canTrackProgress && !completed && !locked;

  const ensureAuth = () => {
    if (!hasAccessToken()) {
      onRequireAuth?.();
      return false;
    }
    return true;
  };

  const enroll = async () => {
    if (!ensureAuth()) return;
    if (locked || (isPremium && !canPremium)) {
      onUpgrade();
      return;
    }
    onBusy(true);
    onError("");
    try {
      await contentApi.enrollStudyPlan(plan.slug);
      await onRefresh();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Unable to enroll in this plan.";
      onError(msg);
    } finally {
      onBusy(false);
    }
  };

  const resume = async () => {
    if (!ensureAuth()) return;
    onBusy(true);
    onError("");
    try {
      const res = await contentApi.resumeStudyPlan(plan.slug);
      await onRefresh();
      const pid = res.data?.resumeProblemId;
      if (pid) onOpenProblem?.({ id: pid });
    } catch {
      onError("Unable to resume this plan.");
    } finally {
      onBusy(false);
    }
  };

  const complete = async () => {
    if (!ensureAuth()) return;
    if (!hasContent) return;
    onBusy(true);
    onError("");
    try {
      await contentApi.completeStudyPlan(plan.slug);
      await onRefresh();
    } catch {
      onError("Unable to mark this plan complete.");
    } finally {
      onBusy(false);
    }
  };

  const markDone = async (problemId: string) => {
    if (!ensureAuth()) return;
    onBusy(true);
    onError("");
    try {
      await contentApi.markStudyPlanProblem(plan.slug, problemId);
      await onRefresh();
    } catch {
      onError("Unable to update progress.");
    } finally {
      onBusy(false);
    }
  };

  const primaryCta = () => {
    if (locked || (isPremium && !canPremium && !enrolled)) {
      // CTA lives on the premium upsell card to avoid duplicate Upgrade buttons.
      return null;
    }
    if (!enrolled) {
      return (
        <Button type="button" disabled={busy || locked} onClick={() => void enroll()}>
          {busy ? (
            <Loader2 size={14} className="animate-spin learn-icon" aria-hidden />
          ) : (
            <Play size={14} strokeWidth={2} aria-hidden className="learn-icon" />
          )}
          Start Learning
        </Button>
      );
    }
    if (completed) {
      return (
        <Button type="button" variant="secondary" disabled>
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden className="learn-icon" />
          Completed
        </Button>
      );
    }
    if (!canTrackProgress) {
      return null;
    }
    return (
      <Button type="button" disabled={busy} onClick={() => void resume()}>
        <Play size={14} strokeWidth={2} aria-hidden className="learn-icon" />
        {inProgress ? "Continue Learning" : "Resume"}
      </Button>
    );
  };

  const heroCta = primaryCta();

  const categoryLabel = asDisplayText(plan.category);
  const diffLabel = difficultyLabel(plan.difficulty);
  const sectionN =
    plan.sectionCount != null && Number.isFinite(Number(plan.sectionCount))
      ? Number(plan.sectionCount)
      : sections.length;
  const problemN =
    plan.totalProblemsCount != null &&
    Number.isFinite(Number(plan.totalProblemsCount))
      ? Number(plan.totalProblemsCount)
      : (plan.problemIds || []).length;
  const daysN =
    plan.estimatedDays != null &&
    Number.isFinite(Number(plan.estimatedDays)) &&
    Number(plan.estimatedDays) > 0
      ? Number(plan.estimatedDays)
      : null;
  const minsN =
    daysN == null &&
    plan.estimatedMinutes != null &&
    Number.isFinite(Number(plan.estimatedMinutes)) &&
    Number(plan.estimatedMinutes) > 0
      ? Number(plan.estimatedMinutes)
      : null;

  const metaStats: Array<{
    icon: typeof Signal;
    label: string;
    value: string;
  }> = [];
  if (diffLabel) {
    metaStats.push({ icon: Signal, label: "Difficulty", value: diffLabel });
  }
  if (daysN != null) {
    metaStats.push({
      icon: CalendarDays,
      label: "Duration",
      value: `${daysN} day${daysN === 1 ? "" : "s"}`,
    });
  } else if (minsN != null) {
    metaStats.push({
      icon: Clock,
      label: "Duration",
      value: `${minsN} min`,
    });
  }
  metaStats.push({
    icon: Layers,
    label: "Modules",
    value: `${sectionN} module${sectionN === 1 ? "" : "s"}`,
  });
  metaStats.push({
    icon: Hash,
    label: "Problems",
    value: `${problemN} problem${problemN === 1 ? "" : "s"}`,
  });
  if (categoryLabel) {
    metaStats.push({
      icon: BookMarked,
      label: "Category",
      value:
        categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1),
    });
  }

  const statusText = completed
    ? "Completed"
    : inProgress
      ? "In progress"
      : enrolled
        ? "Not started"
        : "Not enrolled";

  return (
    <div className="co-page learn-page learn-detail-page">
      <nav className="learn-breadcrumb learn-breadcrumb-spacious" aria-label="Breadcrumb">
        <button type="button" className="learn-crumb-link" onClick={onBack}>
          Learn
        </button>
        <span className="learn-crumb-sep" aria-hidden>
          /
        </span>
        <button type="button" className="learn-crumb-link" onClick={onBack}>
          Study Plans
        </button>
        <span className="learn-crumb-sep" aria-hidden>
          /
        </span>
        <span className="learn-crumb-current" title={title}>
          {title}
        </span>
      </nav>

      <section className="co-panel learn-sp-hero">
        <div className="learn-sp-hero-top">
          <div className="learn-hero-badges">
            <Badge variant="primary">Study Plan</Badge>
            {categoryLabel ? (
              <Badge variant="default">
                {categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1)}
              </Badge>
            ) : null}
            {diffLabel ? (
              <Badge variant="technical">{diffLabel}</Badge>
            ) : null}
            {completed ? <Badge variant="success">Completed</Badge> : null}
            {isPremium && !locked ? (
              <PremiumBadge label="Premium" />
            ) : null}
          </div>
          {heroCta ? (
            <div className="learn-sp-hero-cta">{heroCta}</div>
          ) : null}
        </div>

        <div className="learn-sp-hero-title-block">
          <button
            type="button"
            className="platform-icon-btn learn-hero-back"
            aria-label="Back to Study Plans"
            onClick={onBack}
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden className="learn-icon" />
          </button>
          <div className="learn-sp-hero-copy">
            <h1 className="learn-sp-title">{title}</h1>
            {description ? (
              <p className="learn-sp-desc">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="learn-sp-stats" aria-label="Plan details">
          {metaStats.map((item) => (
            <div key={item.label} className="learn-sp-stat">
              <item.icon
                size={14}
                strokeWidth={2}
                aria-hidden
                className="learn-icon learn-sp-stat-icon"
              />
              <div>
                <span className="learn-sp-stat-label">{item.label}</span>
                <strong className="learn-sp-stat-value">{item.value}</strong>
              </div>
            </div>
          ))}
          {lastStudied ? (
            <div className="learn-sp-stat learn-sp-stat-wide">
              <Clock
                size={14}
                strokeWidth={2}
                aria-hidden
                className="learn-icon learn-sp-stat-icon"
              />
              <div>
                <span className="learn-sp-stat-label">Last studied</span>
                <strong className="learn-sp-stat-value">{lastStudied}</strong>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {detailError ? (
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden className="learn-icon" />
          <div>
            <strong>Unable to update plan</strong>
            <p>{detailError}</p>
          </div>
          <button type="button" disabled={busy} onClick={() => void onRefresh()}>
            <RefreshCw size={14} strokeWidth={2} aria-hidden className="learn-icon" />
            Retry
          </button>
        </div>
      ) : null}

      {showProgressCard && progress ? (
        <section
          className="co-panel learn-progress-card"
          aria-labelledby="learn-progress-heading"
        >
          <div className="learn-progress-card-head">
            <div>
              <p className="learn-progress-kicker">Your Progress</p>
              <h2 id="learn-progress-heading" className="learn-progress-pct">
                {Math.round(progress.completionPercentage)}%
              </h2>
            </div>
            <p className="learn-progress-counts">
              {progress.solvedCount} / {progress.totalProblemsCount} completed
            </p>
          </div>
          <ProgressBar pct={progress.completionPercentage} />
          <p className="co-muted learn-sync-note">
            Progress is saved securely to your account.
          </p>
          {showCompleteAction ? (
            <div className="learn-detail-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void complete()}
              >
                <CheckCircle2
                  size={14}
                  strokeWidth={2}
                  aria-hidden
                  className="learn-icon"
                />
                Mark complete
              </Button>
            </div>
          ) : null}
          {completed ? (
            <p className="learn-completed-note" role="status">
              <CheckCircle2
                size={14}
                strokeWidth={2}
                aria-hidden
                className="learn-icon"
              />
              Completed
            </p>
          ) : null}
        </section>
      ) : (
        <section
          className="co-panel learn-progress-idle"
          aria-label="Progress status"
        >
          <div>
            <p className="learn-progress-kicker">Your Progress</p>
            <p className="learn-progress-idle-status">{statusText}</p>
            <p className="co-muted learn-progress-idle-hint">
              {canTrackProgress
                ? "Enroll to start tracking completion for this plan."
                : "Progress tracking unlocks once lessons and problems are published."}
            </p>
          </div>
          {lastStudied ? (
            <p className="learn-progress-idle-meta">Last studied {lastStudied}</p>
          ) : null}
        </section>
      )}

      {locked ? (
        <section className="co-panel learn-premium-card learn-premium-card-v2" role="status">
          <div className="learn-premium-v2-main">
            <div className="learn-premium-v2-head">
              <span className="learn-premium-v2-icon" aria-hidden>
                <Crown size={18} strokeWidth={2} className="learn-icon" />
              </span>
              <div>
                <p className="learn-premium-v2-eyebrow">Premium</p>
                <h2 className="learn-premium-title">Premium Study Plan</h2>
              </div>
            </div>
            <p className="learn-premium-lede">
              Unlock the complete learning experience.
            </p>
            <ul className="learn-premium-grid">
              <li>
                <CheckCircle2 size={14} strokeWidth={2} aria-hidden className="learn-icon" />
                Full lessons
              </li>
              <li>
                <CheckCircle2 size={14} strokeWidth={2} aria-hidden className="learn-icon" />
                Study modules
              </li>
              <li>
                <CheckCircle2 size={14} strokeWidth={2} aria-hidden className="learn-icon" />
                Problem practice
              </li>
              <li>
                <CheckCircle2 size={14} strokeWidth={2} aria-hidden className="learn-icon" />
                Progress tracking
              </li>
            </ul>
          </div>
          <div className="learn-premium-v2-action">
            <Button type="button" onClick={onUpgrade} disabled={busy}>
              {busy ? (
                <Loader2 size={14} className="animate-spin learn-icon" aria-hidden />
              ) : (
                <Crown size={14} strokeWidth={2} aria-hidden className="learn-icon" />
              )}
              Upgrade to Unlock
              <ArrowRight size={14} strokeWidth={2} aria-hidden className="learn-icon" />
            </Button>
          </div>
        </section>
      ) : null}

      <section className="learn-content-section" aria-labelledby="learn-content-heading">
        <div className="learn-section-head learn-section-head-stack">
          <h2 id="learn-content-heading">Study Plan Content</h2>
          <p className="co-muted learn-section-lede">
            {sections.length > 0
              ? `${sections.length} module${sections.length === 1 ? "" : "s"} in this plan`
              : "Lessons, modules, and practice problems included in this plan."}
          </p>
        </div>

        {!hasContent || sections.length === 0 ? (
          <div className="co-panel learn-empty-surface">
            <EmptyState
              compact
              title={
                !hasContent
                  ? "No content published yet"
                  : "No lessons available yet"
              }
              description={
                !hasContent
                  ? "This study plan is ready, but its lessons and practice problems haven't been published yet. Content will appear here once it is available."
                  : "This study plan currently has no published lessons."
              }
              icon={<BookOpen size={22} strokeWidth={1.75} aria-hidden />}
            />
          </div>
        ) : (
          <ul className="learn-module-list">
            {sections.map((s, i) => {
              const moduleTitle = asDisplayText(s.title, `Module ${i + 1}`);
              const moduleDesc = asDisplayText(s.description);
              const lessonCount = sectionLessonCount(s);
              const order = s.order || i + 1;
              const orderLabel = String(order).padStart(2, "0");
              const sectionLocked = Boolean(s.locked) || locked;
              const ids = s.problemIds || [];
              const doneCount = ids.filter((pid) =>
                progress?.completedProblemIds?.includes(pid)
              ).length;
              const sectionDone =
                ids.length > 0 && doneCount === ids.length && enrolled;

              return (
                <li key={`${moduleTitle}-${order}`} className="co-panel learn-module-card">
                  <div className="learn-module-row">
                    <span className="learn-module-num" aria-hidden>
                      {orderLabel}
                    </span>
                    <div className="learn-module-body">
                      <div className="learn-module-top">
                        <h3 className="learn-module-title">{moduleTitle}</h3>
                        <span className="learn-module-status">
                          {sectionLocked ? (
                            <Badge variant="warning">
                              <Lock
                                size={12}
                                strokeWidth={2}
                                aria-hidden
                                className="learn-icon"
                              />
                              Locked
                            </Badge>
                          ) : sectionDone ? (
                            <Badge variant="success">Completed</Badge>
                          ) : enrolled && ids.length > 0 ? (
                            <Badge variant="default">
                              {doneCount}/{ids.length}
                            </Badge>
                          ) : null}
                        </span>
                      </div>
                      {moduleDesc ? (
                        <p className="learn-module-desc">{moduleDesc}</p>
                      ) : null}
                      <p className="learn-module-meta">
                        {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                        {lessonCount > 0 && ids.length > 0
                          ? ` · ${ids.length} problem${ids.length === 1 ? "" : "s"}`
                          : ""}
                      </p>

                      {sectionLocked || !ids.length ? null : (
                        <ul className="learn-lesson-list">
                          {ids.map((pid, j) => {
                            const done =
                              progress?.completedProblemIds?.includes(pid);
                            return (
                              <li key={pid} className="learn-lesson-row">
                                <button
                                  type="button"
                                  className="learn-lesson-open"
                                  onClick={() => onOpenProblem?.({ id: pid })}
                                >
                                  {done ? (
                                    <CheckCircle2
                                      size={14}
                                      strokeWidth={2}
                                      aria-hidden
                                      className="learn-icon learn-lesson-done"
                                    />
                                  ) : (
                                    <span className="learn-lesson-num" aria-hidden>
                                      {j + 1}
                                    </span>
                                  )}
                                  <span>Lesson {j + 1}</span>
                                </button>
                                {enrolled && !done ? (
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
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
