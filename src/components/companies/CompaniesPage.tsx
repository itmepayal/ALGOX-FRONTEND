import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Circle,
  Play,
  RefreshCw,
  Search,
  Swords,
  AlertCircle,
} from "lucide-react";
import {
  companyApi,
  type CompanyCard,
  type CompanyPageData,
  type CompanyQuestion,
} from "../../api/companyApi";
import { useAuth } from "../../context/AuthContext";
import { canAccess } from "../../access/canAccess";
import { PremiumBadge } from "../access/PremiumBadge";
import { UpgradePrompt } from "../access/UpgradePrompt";
import { EmptyState } from "../ui/empty-state";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import "./companies.css";

type Props = {
  onSelectProblem?: (ref: { id?: string; slug?: string; title?: string }) => void;
  onUpgradeClick?: () => void;
  /** Official ACCEPTED problem IDs from submissions — never invented. */
  solvedProblemIds?: ReadonlySet<string>;
  /** Navigate to Mock Interview with company name preselected when supported. */
  onStartMockInterview?: (companyName: string) => void;
  mockInterviewAvailable?: boolean;
};

const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/** Never surface raw Axios/network strings in the UI. */
function friendlyLoadError(fallback: string, err?: unknown): string {
  if (!err || typeof err !== "object") return fallback;
  const status = (err as { response?: { status?: number } }).response?.status;
  if (status === 401 || status === 403) {
    return "You don’t have access to this content right now.";
  }
  if (status === 404) {
    return "This company is unpublished or does not exist.";
  }
  if (status && status >= 500) {
    return "Our servers hit a snag. Please try again in a moment.";
  }
  return fallback;
}

function isSolved(q: CompanyQuestion, solved: ReadonlySet<string> | undefined) {
  if (!solved || solved.size === 0) return false;
  return solved.has(String(q.problemId));
}

/** Next problem: first unsolved by order, then easy→hard. Documented client rule. */
function pickRecommended(
  questions: CompanyQuestion[],
  solved: ReadonlySet<string> | undefined
): CompanyQuestion | null {
  if (!questions.length) return null;
  const unsolved = questions.filter((q) => !isSolved(q, solved));
  const pool = unsolved.length ? unsolved : questions;
  return [...pool].sort((a, b) => {
    const ao = Number(a.order) || 0;
    const bo = Number(b.order) || 0;
    if (ao !== bo) return ao - bo;
    return (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9);
  })[0];
}

function topicStats(
  questions: CompanyQuestion[],
  solved: ReadonlySet<string> | undefined
) {
  const map = new Map<string, { total: number; solved: number }>();
  for (const q of questions) {
    for (const t of q.topics || []) {
      const key = String(t).trim();
      if (!key) continue;
      const row = map.get(key) || { total: 0, solved: 0 };
      row.total += 1;
      if (isSolved(q, solved)) row.solved += 1;
      map.set(key, row);
    }
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export const CompaniesPage: FC<Props> = ({
  onSelectProblem,
  onUpgradeClick,
  solvedProblemIds,
  onStartMockInterview,
  mockInterviewAvailable = false,
}) => {
  const { user } = useAuth();
  const entitled = canAccess(user, "premium.company_questions");
  const [view, setView] = useState<"directory" | "company">("directory");
  const [slug, setSlug] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [dirPremium, setDirPremium] = useState<"all" | "free" | "premium">(
    "all"
  );
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState<CompanyCard[]>([]);
  const [dirMeta, setDirMeta] = useState({ total: 0, totalPages: 1 });
  const [loadingDir, setLoadingDir] = useState(true);
  const [dirError, setDirError] = useState("");

  const [pageData, setPageData] = useState<CompanyPageData | null>(null);
  const [catalog, setCatalog] = useState<CompanyPageData | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [pageError, setPageError] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [topic, setTopic] = useState("all");
  const [role, setRole] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "solved" | "unsolved">(
    "all"
  );
  const [premiumFilter, setPremiumFilter] = useState<"all" | "free" | "premium">(
    "all"
  );
  const [qSearch, setQSearch] = useState("");
  const [qPage, setQPage] = useState(1);

  const loadDirectory = useCallback(async () => {
    if (!entitled) {
      setCompanies([]);
      setLoadingDir(false);
      return;
    }
    setLoadingDir(true);
    setDirError("");
    try {
      const res = await companyApi.listDirectory({
        page,
        limit: 20,
        search: search.trim() || undefined,
        premium: dirPremium === "all" ? undefined : dirPremium,
      });
      setCompanies(res.data || []);
      setDirMeta({
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });
    } catch (err) {
      setCompanies([]);
      setDirError(
        friendlyLoadError(
          "Something went wrong while loading company data. Please try again.",
          err
        )
      );
    } finally {
      setLoadingDir(false);
    }
  }, [page, search, dirPremium, entitled]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const loadCatalog = useCallback(async (companySlug: string) => {
    setLoadingCatalog(true);
    try {
      const res = await companyApi.getCompanyPage(companySlug, {
        page: 1,
        limit: 100,
      });
      setCatalog(res.data || null);
    } catch {
      setCatalog(null);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const loadCompany = useCallback(async () => {
    if (!slug || !entitled) return;
    setLoadingPage(true);
    setPageError("");
    try {
      const res = await companyApi.getCompanyPage(slug, {
        page: qPage,
        limit: 20,
        difficulty: difficulty === "all" ? undefined : difficulty,
        topic: topic === "all" ? undefined : topic,
        role: role === "all" ? undefined : role,
        access:
          premiumFilter === "all"
            ? undefined
            : premiumFilter === "free"
              ? "free"
              : "premium",
      });
      setPageData(res.data || null);
    } catch (err) {
      setPageData(null);
      setPageError(
        friendlyLoadError(
          "Something went wrong while loading this company. Please try again.",
          err
        )
      );
    } finally {
      setLoadingPage(false);
    }
  }, [slug, qPage, difficulty, topic, role, premiumFilter, entitled]);

  useEffect(() => {
    if (view === "company" && entitled) void loadCompany();
  }, [view, loadCompany, entitled]);

  const openCompany = (c: CompanyCard) => {
    setSlug(c.slug);
    setView("company");
    setQPage(1);
    setDifficulty("all");
    setTopic("all");
    setRole("all");
    setStatusFilter("all");
    setPremiumFilter("all");
    setQSearch("");
    setCatalog(null);
    void loadCatalog(c.slug);
  };

  const startUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    void import("../../billing/startPremiumCheckout")
      .then(({ startPremiumCheckout }) => startPremiumCheckout())
      .catch(() => undefined);
  };

  if (view === "company" && slug) {
    return (
      <div className="co-page co-page-detail">
        <button
          type="button"
          className="co-back"
          onClick={() => {
            setView("directory");
            setSlug(null);
            setPageData(null);
            setCatalog(null);
          }}
        >
          <ArrowLeft size={14} aria-hidden /> Companies
        </button>

        {loadingPage && !pageData ? (
          <CompanyDetailSkeleton />
        ) : pageError && !pageData ? (
          <EmptyState
            icon={<AlertCircle size={22} strokeWidth={1.75} />}
            title="Unable to load company"
            description={pageError}
            action={
              <Button type="button" onClick={() => void loadCompany()}>
                <RefreshCw size={14} aria-hidden /> Try Again
              </Button>
            }
          />
        ) : !pageData ? (
          <EmptyState
            icon={<Briefcase size={22} strokeWidth={1.75} />}
            title="Company not found"
            description="This company is unpublished or does not exist."
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setView("directory");
                  setSlug(null);
                }}
              >
                Back to Companies
              </Button>
            }
          />
        ) : (
          <CompanyDetail
            data={pageData}
            catalog={catalog}
            loadingCatalog={loadingCatalog}
            loadingPage={loadingPage}
            entitled={entitled}
            difficulty={difficulty}
            topic={topic}
            role={role}
            statusFilter={statusFilter}
            premiumFilter={premiumFilter}
            qSearch={qSearch}
            solvedProblemIds={solvedProblemIds}
            mockInterviewAvailable={mockInterviewAvailable}
            onDifficulty={(d) => {
              setDifficulty(d);
              setQPage(1);
            }}
            onTopic={(t) => {
              setTopic(t);
              setQPage(1);
            }}
            onRole={(r) => {
              setRole(r);
              setQPage(1);
            }}
            onStatusFilter={setStatusFilter}
            onPremiumFilter={(v) => {
              setPremiumFilter(v);
              setQPage(1);
            }}
            onQSearch={setQSearch}
            onPage={setQPage}
            onSelectProblem={onSelectProblem}
            onUpgrade={startUpgrade}
            onStartMockInterview={onStartMockInterview}
            onRetry={() => {
              void loadCompany();
              if (slug) void loadCatalog(slug);
            }}
            pageError={pageError}
          />
        )}
      </div>
    );
  }

  return (
    <div className="co-page">
      <header className="co-header">
        <div>
          <p className="co-kicker">Interview prep</p>
          <h1 className="co-title">
            <Briefcase size={22} aria-hidden /> Companies
          </h1>
          <p className="co-lede">
            Prepare for technical interviews with company-focused coding
            problems and interview preparation.
          </p>
        </div>
        {!entitled ? (
          <PremiumBadge feature="premium.company_questions" />
        ) : null}
      </header>

      <div className="co-toolbar">
        <div className="co-search">
          <Search size={14} aria-hidden />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search companies…"
            aria-label="Search companies"
          />
        </div>
        <div className="co-filter-scroll" role="group" aria-label="Access filter">
          {(["all", "premium", "free"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`co-chip ${dirPremium === v ? "active" : ""}`}
              onClick={() => {
                setDirPremium(v);
                setPage(1);
              }}
            >
              {v === "all" ? "All" : v === "premium" ? "Premium" : "Free"}
            </button>
          ))}
        </div>
      </div>

      {loadingDir ? (
        <div className="co-dir-grid" aria-busy="true" aria-label="Loading companies">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="co-dir-skel" aria-hidden>
              <div className="co-dir-skel-top">
                <Skeleton className="h-11 w-11 shrink-0 rounded-[10px]" />
                <div className="co-dir-skel-titles">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="mt-auto h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : dirError ? (
        <EmptyState
          icon={<AlertCircle size={22} strokeWidth={1.75} />}
          title="Unable to load companies"
          description={dirError}
          action={
            <Button type="button" onClick={() => void loadDirectory()}>
              <RefreshCw size={14} aria-hidden /> Try Again
            </Button>
          }
        />
      ) : companies.length === 0 ? (
        search.trim() || dirPremium !== "all" ? (
          <EmptyState
            icon={<Search size={22} strokeWidth={1.75} />}
            title="No companies match your filters"
            description="Try a different search term or clear filters to see all published companies."
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setDirPremium("all");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Briefcase size={22} strokeWidth={1.75} />}
            title="No companies published yet"
            description="Published companies appear here after admins configure and publish them."
          />
        )
      ) : (
        <ul className="co-dir-grid">
          {companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="co-dir-card"
                onClick={() => openCompany(c)}
              >
                <div className="co-dir-card-top">
                  <div className="co-dir-card-identity">
                    <span className="co-dir-logo" aria-hidden>
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt="" />
                      ) : (
                        c.name.charAt(0)
                      )}
                    </span>
                    <div className="co-dir-card-titles">
                      <strong>{c.name}</strong>
                      <p className="co-dir-eyebrow">
                        Technical Interview Preparation
                      </p>
                    </div>
                  </div>
                  {c.isPremium ? (
                    <PremiumBadge
                      feature="premium.company_questions"
                      label="Premium"
                    />
                  ) : null}
                </div>
                {c.description ? (
                  <p className="co-dir-desc">{c.description}</p>
                ) : (
                  <p className="co-dir-desc">
                    Prepare for {c.name} technical interviews with
                    company-focused coding problems.
                  </p>
                )}
                <div className="co-dir-meta">
                  <span>
                    {c.questionCount} configured
                  </span>
                  {c.roles?.length ? (
                    <span>
                      {c.roles.length} role{c.roles.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                <span className="co-dir-cta">
                  Start Preparation <ArrowRight size={14} aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {dirMeta.totalPages > 1 ? (
        <div className="co-pager">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <span>
            Page {page} / {dirMeta.totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page >= dirMeta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
};

function CompanyDetailSkeleton() {
  return (
    <div className="co-detail" aria-busy="true" aria-label="Loading company">
      <div className="co-skel-hero" aria-hidden>
        <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="co-skel-hero-copy">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-full max-w-xl" />
          <Skeleton className="h-3 w-80 max-w-lg" />
        </div>
        <div className="co-skel-hero-actions">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <div className="co-top-grid" aria-hidden>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" aria-hidden />
      <div className="co-skel-panel" aria-hidden>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-72" />
        <Skeleton className="mt-3 h-9 w-full rounded-lg" />
        <div className="co-skel-chips">
          <Skeleton className="h-8 w-14 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <div className="co-skel-rows">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-[10px]" />
          ))}
        </div>
      </div>
      <div className="co-skel-panel" aria-hidden>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64" />
        <div className="co-skel-topic-row">
          <Skeleton className="h-[7.5rem] w-[15rem] rounded-[10px]" />
          <Skeleton className="h-[7.5rem] w-[15rem] rounded-[10px]" />
        </div>
        <div className="co-skel-diff-row">
          <Skeleton className="h-[5.75rem] w-[10.5rem] rounded-[10px]" />
          <Skeleton className="h-[5.75rem] w-[10.5rem] rounded-[10px]" />
          <Skeleton className="h-[5.75rem] w-[10.5rem] rounded-[10px]" />
        </div>
        <Skeleton className="mt-2 h-9 w-72 rounded-lg" />
      </div>
    </div>
  );
}

const CompanyDetail: FC<{
  data: CompanyPageData;
  catalog: CompanyPageData | null;
  loadingCatalog: boolean;
  loadingPage: boolean;
  entitled: boolean;
  difficulty: string;
  topic: string;
  role: string;
  statusFilter: "all" | "solved" | "unsolved";
  premiumFilter: "all" | "free" | "premium";
  qSearch: string;
  solvedProblemIds?: ReadonlySet<string>;
  mockInterviewAvailable: boolean;
  onDifficulty: (d: string) => void;
  onTopic: (t: string) => void;
  onRole: (r: string) => void;
  onStatusFilter: (s: "all" | "solved" | "unsolved") => void;
  onPremiumFilter: (p: "all" | "free" | "premium") => void;
  onQSearch: (s: string) => void;
  onPage: (p: number) => void;
  onSelectProblem?: Props["onSelectProblem"];
  onUpgrade: () => void;
  onStartMockInterview?: Props["onStartMockInterview"];
  onRetry: () => void;
  pageError: string;
}> = ({
  data,
  catalog,
  loadingCatalog,
  loadingPage,
  entitled,
  difficulty,
  topic,
  role,
  statusFilter,
  premiumFilter,
  qSearch,
  solvedProblemIds,
  mockInterviewAvailable,
  onDifficulty,
  onTopic,
  onRole,
  onStatusFilter,
  onPremiumFilter,
  onQSearch,
  onPage,
  onSelectProblem,
  onUpgrade,
  onStartMockInterview,
  onRetry,
  pageError,
}) => {
  const { company, topics, roles, difficulty: diffCounts, questions, meta } =
    data;

  const bank = useMemo(
    () => catalog?.questions ?? [],
    [catalog?.questions]
  );
  const configuredTotal =
    catalog?.meta.configuredTotal ??
    meta.configuredTotal ??
    company.questionCount;

  const progress = useMemo(() => {
    if (!bank.length) {
      return { solved: null as number | null, total: configuredTotal, pct: null as number | null };
    }
    if (!solvedProblemIds) {
      return { solved: null, total: configuredTotal, pct: null };
    }
    const solved = bank.filter((q) => isSolved(q, solvedProblemIds)).length;
    const total = Math.max(configuredTotal, bank.length);
    const pct = total > 0 ? Math.round((solved / bank.length) * 100) : 0;
    return { solved, total: bank.length, pct, note: configuredTotal > bank.length ? `Progress over ${bank.length} of ${configuredTotal} configured` : undefined };
  }, [bank, configuredTotal, solvedProblemIds]);

  const topicsWithStats = useMemo(
    () => topicStats(bank, solvedProblemIds),
    [bank, solvedProblemIds]
  );

  const recommended = useMemo(
    () => pickRecommended(bank, solvedProblemIds),
    [bank, solvedProblemIds]
  );

  const diffSolved = useMemo(() => {
    if (!solvedProblemIds) return null;
    const out = { easy: 0, medium: 0, hard: 0 };
    for (const q of bank) {
      if (!isSolved(q, solvedProblemIds)) continue;
      if (q.difficulty === "easy") out.easy += 1;
      else if (q.difficulty === "medium") out.medium += 1;
      else if (q.difficulty === "hard") out.hard += 1;
    }
    return out;
  }, [bank, solvedProblemIds]);

  const filteredQuestions = useMemo(() => {
    let rows = questions;
    const q = qSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (row) =>
          row.title.toLowerCase().includes(q) ||
          (row.slug || "").toLowerCase().includes(q) ||
          (row.topics || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (statusFilter === "solved") {
      rows = rows.filter((row) => isSolved(row, solvedProblemIds));
    } else if (statusFilter === "unsolved") {
      rows = rows.filter((row) => !isSolved(row, solvedProblemIds));
    }
    return rows;
  }, [questions, qSearch, statusFilter, solvedProblemIds]);

  const openProblem = (q: CompanyQuestion) => {
    onSelectProblem?.({
      id: q.problemId,
      slug: q.slug,
      title: q.title,
    });
  };

  const scrollToProblems = () => {
    document.getElementById("co-problems")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="co-detail">
      <section className="co-hero" aria-labelledby="co-company-title">
        <div className="co-hero-grid">
          <div className="co-hero-left">
            <span className="co-hero-logo" aria-hidden>
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="" />
              ) : (
                company.name.charAt(0)
              )}
            </span>
            <div className="co-hero-copy">
              <div className="co-hero-title-row">
                <h1 id="co-company-title">{company.name}</h1>
                <div className="co-hero-badges">
                  {company.isPremium ? (
                    <PremiumBadge feature="premium.company_questions" />
                  ) : null}
                  <span className="co-pill co-pill-ok">
                    {configuredTotal} configured
                  </span>
                </div>
              </div>
              <p className="co-hero-sub">Technical Interview Preparation</p>
              <p className="co-hero-lede">
                {company.description?.trim() ||
                  `Prepare for ${company.name} technical interviews with company-focused coding problems, SDE interview questions, and role-specific practice.`}
              </p>
            </div>
          </div>
          <div className="co-hero-right">
            <Button type="button" onClick={scrollToProblems}>
              <Play size={15} aria-hidden /> Start Preparation
            </Button>
            {mockInterviewAvailable && onStartMockInterview ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onStartMockInterview(company.name)}
              >
                <Swords size={15} aria-hidden /> Mock Interview
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled
                title="Mock Interview uses problem tags, not this company bank."
              >
                <Swords size={15} aria-hidden /> Mock Interview
              </Button>
            )}
          </div>
        </div>
      </section>

      {(meta.preview || company.access === "locked") && !entitled ? (
        <div className="co-upsell">
          <UpgradePrompt
            feature="premium.company_questions"
            title={
              company.access === "locked"
                ? "Full company set requires Premium"
                : "Preview mode"
            }
            description={
              meta.previewLimit
                ? `Showing ${meta.total} of ${meta.configuredTotal} configured questions.`
                : "Upgrade to unlock this company’s configured interview questions."
            }
            onUpgradeClick={onUpgrade}
          />
        </div>
      ) : null}

      <div className="co-top-grid">
        <section className="co-progress-card" aria-label="Preparation progress">
          <div className="co-progress-head">
            <div>
              <h2>Preparation Progress</h2>
              <p className="co-muted">
                {progress.pct != null
                  ? progress.note || "Based on your accepted submissions"
                  : "Solve problems to track progress"}
              </p>
            </div>
            <div className="co-progress-head-right">
              {progress.pct != null ? (
                <span
                  className={`co-pill ${
                    progress.pct >= 100
                      ? "co-pill-ok"
                      : progress.pct > 0
                        ? "co-pill-progress"
                        : ""
                  }`}
                >
                  {progress.pct >= 100
                    ? "Completed"
                    : progress.pct > 0
                      ? "In progress"
                      : "Not started"}
                </span>
              ) : null}
              <strong className="co-progress-pct" aria-live="polite">
                {progress.pct != null ? `${progress.pct}%` : "—"}
              </strong>
            </div>
          </div>
          <div
            className="co-progress-bar-track"
            aria-hidden={progress.pct == null}
          >
            <span
              className="co-progress-bar-fill"
              style={{ width: `${progress.pct ?? 0}%` }}
            />
          </div>
          <div className="co-progress-metrics">
            <div>
              <span className="co-stat-label">Problems</span>
              <strong>
                {progress.solved != null
                  ? `${progress.solved} / ${progress.total}`
                  : `— / ${configuredTotal}`}
              </strong>
            </div>
            <div>
              <span className="co-stat-label">Topics</span>
              <strong>{topicsWithStats.length || topics.length || "—"}</strong>
            </div>
            <div>
              <span className="co-stat-label">Next</span>
              <strong className="co-progress-next">
                {recommended?.title || "—"}
              </strong>
            </div>
          </div>
        </section>

        <section className="co-mock-card" aria-labelledby="co-mock-title">
          <div className="co-mock-icon" aria-hidden>
            <Swords size={18} />
          </div>
          <div className="co-mock-body">
            <h2 id="co-mock-title">Mock Interview</h2>
            <p>Practice under timed conditions.</p>
            <p>
              <strong>{company.name}</strong> is preselected when you start from
              here.
            </p>
            <p className="co-fineprint">
              Problems are chosen from tagged problems on the server — not only
              this configured bank.
            </p>
            {mockInterviewAvailable && onStartMockInterview ? (
              <Button
                type="button"
                className="co-mock-cta"
                onClick={() => onStartMockInterview(company.name)}
              >
                Start Mock Interview <ArrowRight size={14} aria-hidden />
              </Button>
            ) : (
              <Button type="button" className="co-mock-cta" disabled>
                Not available
              </Button>
            )}
          </div>
        </section>
      </div>

      <section className="co-recommend" aria-labelledby="co-next-title">
        <div className="co-section-head">
          <h2 id="co-next-title">Recommended Next</h2>
          <p className="co-muted">
            First unsolved by admin order, then difficulty (easy → hard).
          </p>
        </div>
        {loadingCatalog && !recommended ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : recommended ? (
          <div className="co-recommend-card">
            <div className="co-recommend-main">
              <div className="co-q-meta co-q-meta-spread">
                <span className="co-q-meta-left">
                  <span className={`diff-badge ${recommended.difficulty}`}>
                    {recommended.difficulty}
                  </span>
                  {recommended.isPremium ? (
                    <PremiumBadge
                      feature="premium.company_questions"
                      label="Premium"
                    />
                  ) : null}
                </span>
                {isSolved(recommended, solvedProblemIds) ? (
                  <span className="co-pill co-pill-ok">
                    <CheckCircle2 size={11} aria-hidden /> Solved
                  </span>
                ) : (
                  <span className="co-pill">
                    <Circle size={11} aria-hidden /> Not started
                  </span>
                )}
              </div>
              <h3>{recommended.title}</h3>
              <p className="co-muted">
                {(recommended.topics || []).slice(0, 4).join(" · ") ||
                  "Continue your company preparation"}
              </p>
            </div>
            <Button
              type="button"
              className="co-solve-btn"
              onClick={() => openProblem(recommended)}
            >
              Solve <ArrowRight size={15} aria-hidden />
            </Button>
          </div>
        ) : (
          <EmptyState
            compact
            title="No problems configured yet"
            description="Admins need to attach interview problems to this company."
          />
        )}
      </section>

      <div className="co-stack">
        <section
          id="co-problems"
          className="co-explorer"
          aria-labelledby="co-problems-title"
        >
          <div className="co-section-head">
            <h2 id="co-problems-title">Company Problems</h2>
            <p className="co-muted">
              Practice company-configured coding questions.
            </p>
          </div>

          <div
            className="co-toolbar-panel"
            role="group"
            aria-label="Problem filters"
          >
            <div className="co-search co-search-lg">
              <Search size={15} aria-hidden />
              <input
                value={qSearch}
                onChange={(e) => onQSearch(e.target.value)}
                placeholder="Search problems…"
                aria-label="Search problems"
              />
            </div>
            <div className="co-toolbar-row">
              <div
                className="co-filter-scroll"
                role="group"
                aria-label="Difficulty filter"
              >
                {(["all", "easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`co-chip ${difficulty === d ? "active" : ""}`}
                    onClick={() => onDifficulty(d)}
                  >
                    {d === "all"
                      ? "All"
                      : `${d.charAt(0).toUpperCase()}${d.slice(1)} ${diffCounts[d] ?? 0}`}
                  </button>
                ))}
              </div>
              <div className="co-filter-selects">
                <select
                  value={topic}
                  aria-label="Topic"
                  onChange={(e) => onTopic(e.target.value)}
                >
                  <option value="all">Topic</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  value={role}
                  aria-label="Role"
                  onChange={(e) => onRole(e.target.value)}
                >
                  <option value="all">Role</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  aria-label="Status"
                  onChange={(e) =>
                    onStatusFilter(e.target.value as typeof statusFilter)
                  }
                >
                  <option value="all">Status</option>
                  <option value="solved">Solved</option>
                  <option value="unsolved">Unsolved</option>
                </select>
                <select
                  value={premiumFilter}
                  aria-label="Access"
                  onChange={(e) =>
                    onPremiumFilter(e.target.value as typeof premiumFilter)
                  }
                >
                  <option value="all">Access</option>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>
          </div>

          {pageError ? (
            <div className="co-inline-error" role="alert">
              <AlertCircle size={16} aria-hidden />
              <span>{pageError}</span>
              <button type="button" onClick={onRetry}>
                <RefreshCw size={12} aria-hidden /> Try again
              </button>
            </div>
          ) : null}

          {loadingPage ? (
            <div className="co-q-list" aria-busy="true" aria-label="Loading problems">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="co-q-skel" aria-hidden>
                  <div className="co-q-skel-meta">
                    <Skeleton className="h-5 w-14 rounded" />
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="ml-auto h-5 w-20 rounded" />
                  </div>
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ))}
            </div>
          ) : filteredQuestions.length === 0 ? (
            <EmptyState
              compact
              icon={
                questions.length === 0 &&
                difficulty === "all" &&
                topic === "all" &&
                role === "all" &&
                !qSearch.trim() ? (
                  <Briefcase size={18} strokeWidth={1.75} />
                ) : (
                  <Search size={18} strokeWidth={1.75} />
                )
              }
              title={
                questions.length === 0 &&
                difficulty === "all" &&
                topic === "all" &&
                role === "all" &&
                statusFilter === "all" &&
                premiumFilter === "all" &&
                !qSearch.trim()
                  ? meta.upgradeRequired
                    ? "Problems locked"
                    : "No problems configured yet"
                  : "No problems match your filters"
              }
              description={
                meta.upgradeRequired
                  ? "Upgrade to unlock this company’s configured interview questions."
                  : questions.length === 0 &&
                      difficulty === "all" &&
                      topic === "all" &&
                      role === "all" &&
                      statusFilter === "all" &&
                      premiumFilter === "all" &&
                      !qSearch.trim()
                    ? "Admins need to attach interview problems to this company."
                    : "Try clearing search or adjusting difficulty, topic, role, or status."
              }
              action={
                questions.length > 0 ||
                difficulty !== "all" ||
                topic !== "all" ||
                role !== "all" ||
                statusFilter !== "all" ||
                premiumFilter !== "all" ||
                qSearch.trim() ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onDifficulty("all");
                      onTopic("all");
                      onRole("all");
                      onStatusFilter("all");
                      onPremiumFilter("all");
                      onQSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : meta.upgradeRequired ? (
                  <Button type="button" size="sm" onClick={onUpgrade}>
                    Upgrade
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="co-q-list">
              {filteredQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  solved={isSolved(q, solvedProblemIds)}
                  onOpen={() => openProblem(q)}
                />
              ))}
            </ul>
          )}

          {meta.totalPages > 1 ? (
            <div className="co-pager">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={meta.page <= 1 || loadingPage}
                onClick={() => onPage(meta.page - 1)}
              >
                Prev
              </Button>
              <span>
                Page {meta.page} / {meta.totalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={meta.page >= meta.totalPages || loadingPage}
                onClick={() => onPage(meta.page + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </section>

        <section className="co-insights" aria-label="Interview insights">
          <header className="co-insights-head">
            <h2 className="co-insights-title">Interview Insights</h2>
            <p className="co-muted">
              Topics, difficulty mix, and role filters for this company bank.
            </p>
          </header>

          <div className="co-insights-body">
            <div className="co-insights-main">
              <div className="co-insights-block" aria-labelledby="co-topics-title">
                <div className="co-section-head">
                  <h3 id="co-topics-title">Interview Topics</h3>
                  <p className="co-muted">
                    Click a topic to filter company problems.
                  </p>
                </div>
                {loadingCatalog && topicsWithStats.length === 0 ? (
                  <div className="co-topic-grid">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-[7.5rem] w-[15rem] rounded-xl"
                      />
                    ))}
                  </div>
                ) : topicsWithStats.length === 0 ? (
                  <EmptyState
                    compact
                    title="No topics yet"
                    description="Topics appear when configured problems include topic tags."
                  />
                ) : (
                  <div className="co-topic-grid">
                    {topicsWithStats.slice(0, 12).map((t) => {
                      const pct =
                        solvedProblemIds && t.total > 0
                          ? Math.round((t.solved / t.total) * 100)
                          : null;
                      return (
                        <button
                          key={t.name}
                          type="button"
                          className={`co-topic-card ${topic === t.name ? "active" : ""}`}
                          aria-pressed={topic === t.name}
                          onClick={() =>
                            onTopic(t.name === topic ? "all" : t.name)
                          }
                        >
                          <strong className="co-topic-name">{t.name}</strong>
                          <span className="co-muted">
                            {t.total} problem{t.total === 1 ? "" : "s"}
                            {solvedProblemIds ? ` · ${t.solved} solved` : ""}
                          </span>
                          {pct != null ? (
                            <div className="co-topic-progress">
                              <div className="co-topic-progress-label">
                                <span className="co-stat-label">Progress</span>
                                <span className="co-topic-pct">{pct}%</span>
                              </div>
                              <span className="co-mini-bar" aria-hidden>
                                <span style={{ width: `${pct}%` }} />
                              </span>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <aside className="co-insights-aside">
              <div className="co-insights-block" aria-labelledby="co-diff-title">
                <div className="co-section-head">
                  <h3 id="co-diff-title">Difficulty</h3>
                  <p className="co-muted">
                    Problem counts for this company bank.
                  </p>
                </div>
                <div className="co-diff-cards">
                  {(["easy", "medium", "hard"] as const).map((d) => {
                    const count = diffCounts[d] || 0;
                    const solvedN = diffSolved?.[d];
                    const pct =
                      solvedN != null && count > 0
                        ? Math.round((solvedN / count) * 100)
                        : count === 0
                          ? 0
                          : null;
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`co-diff-stat ${difficulty === d ? "active" : ""}`}
                        aria-pressed={difficulty === d}
                        onClick={() =>
                          onDifficulty(difficulty === d ? "all" : d)
                        }
                      >
                        <span className={`diff-badge ${d}`}>{d}</span>
                        <strong className="co-diff-stat-count">
                          {count} problem{count === 1 ? "" : "s"}
                        </strong>
                        <span className="co-muted">
                          {solvedN != null ? `${solvedN} solved` : "Solved —"}
                        </span>
                        {pct != null ? (
                          <span className="co-bar" aria-hidden>
                            <span
                              className={`co-bar-fill co-bar-${d}`}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {roles.length > 0 ? (
                <div
                  className="co-insights-block"
                  aria-labelledby="co-roles-title"
                >
                  <div className="co-section-head">
                    <h3 id="co-roles-title">Prepare for your role</h3>
                    <p className="co-muted">
                      Server-side filter on configured role for this company
                      bank.
                    </p>
                  </div>
                  <div className="co-role-select-wrap">
                    <label className="co-sr-only" htmlFor="co-role-select">
                      Role filter
                    </label>
                    <select
                      id="co-role-select"
                      className="co-role-select"
                      value={role}
                      aria-label="Prepare for your role"
                      onChange={(e) => onRole(e.target.value)}
                    >
                      <option value="all">All roles</option>
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="co-panel co-cta-panel" aria-labelledby="co-tools-title">
          <div className="co-cta-panel-inner">
            <div>
              <h2 id="co-tools-title">Interview Preparation</h2>
              <p className="co-muted">
                Continue preparing for your {company.name} technical interview.
              </p>
            </div>
            <div className="co-cta-panel-actions">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={scrollToProblems}
              >
                Practice Problems
              </Button>
              {mockInterviewAvailable && onStartMockInterview ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onStartMockInterview(company.name)}
                >
                  Start Mock Interview <ArrowRight size={14} aria-hidden />
                </Button>
              ) : (
                <Button type="button" size="sm" variant="secondary" disabled>
                  Mock Interview unavailable
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const QuestionCard: FC<{
  q: CompanyQuestion;
  solved: boolean;
  onOpen: () => void;
}> = ({ q, solved, onOpen }) => (
  <li>
    <article className="co-q-card">
      <div className="co-q-card-body">
        <div className="co-q-meta">
          <span className={`diff-badge ${q.difficulty}`}>{q.difficulty}</span>
          {q.isPremium ? (
            <PremiumBadge
              feature="premium.company_questions"
              label="Premium"
            />
          ) : null}
          {q.role ? <span className="co-pill">{q.role}</span> : null}
        </div>
        <h3>{q.title}</h3>
        <p className="co-muted">
          {(q.topics || []).slice(0, 5).join(" · ") || "—"}
          {typeof q.frequency === "number" ? ` · freq ${q.frequency}` : ""}
          {q.lastSeenAt
            ? ` · seen ${new Date(q.lastSeenAt).toLocaleDateString()}`
            : ""}
        </p>
      </div>
      <div className="co-q-card-aside">
        {solved ? (
          <span className="co-pill co-pill-ok">
            <CheckCircle2 size={11} aria-hidden /> Solved
          </span>
        ) : (
          <span className="co-pill">
            <Circle size={11} aria-hidden /> Not started
          </span>
        )}
        <Button type="button" size="sm" onClick={onOpen}>
          Solve <ArrowRight size={14} aria-hidden />
        </Button>
      </div>
    </article>
  </li>
);
