import { useCallback, useEffect, useState, type FC } from "react";
import {
  ArrowLeft,
  Briefcase,
  Lock,
  Loader2,
  Search,
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
import { billingApi } from "../../api/billingApi";
import "./companies.css";

type Props = {
  onSelectProblem?: (ref: { id?: string; slug?: string; title?: string }) => void;
  onUpgradeClick?: () => void;
};

export const CompaniesPage: FC<Props> = ({
  onSelectProblem,
  onUpgradeClick,
}) => {
  const { user } = useAuth();
  const entitled = canAccess(user, "premium.company_questions");
  const [view, setView] = useState<"directory" | "company">("directory");
  const [slug, setSlug] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState<CompanyCard[]>([]);
  const [dirMeta, setDirMeta] = useState({ total: 0, totalPages: 1 });
  const [loadingDir, setLoadingDir] = useState(true);

  const [pageData, setPageData] = useState<CompanyPageData | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [difficulty, setDifficulty] = useState("all");
  const [topic, setTopic] = useState("all");
  const [role, setRole] = useState("all");
  const [qPage, setQPage] = useState(1);

  const loadDirectory = useCallback(async () => {
    setLoadingDir(true);
    try {
      const res = await companyApi.listDirectory({
        page,
        limit: 20,
        search: search.trim() || undefined,
      });
      setCompanies(res.data || []);
      setDirMeta({
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      });
    } catch {
      setCompanies([]);
    } finally {
      setLoadingDir(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const loadCompany = useCallback(async () => {
    if (!slug) return;
    setLoadingPage(true);
    try {
      const res = await companyApi.getCompanyPage(slug, {
        page: qPage,
        limit: 20,
        difficulty: difficulty === "all" ? undefined : difficulty,
        topic: topic === "all" ? undefined : topic,
        role: role === "all" ? undefined : role,
      });
      setPageData(res.data || null);
    } catch {
      setPageData(null);
    } finally {
      setLoadingPage(false);
    }
  }, [slug, qPage, difficulty, topic, role]);

  useEffect(() => {
    if (view === "company") void loadCompany();
  }, [view, loadCompany]);

  const openCompany = (c: CompanyCard) => {
    setSlug(c.slug);
    setView("company");
    setQPage(1);
    setDifficulty("all");
    setTopic("all");
    setRole("all");
  };

  const startUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    void billingApi
      .createCheckout()
      .then((s) => {
        const url = s.data?.url;
        if (url) window.location.assign(url);
      })
      .catch(() => undefined);
  };

  if (view === "company" && slug) {
    return (
      <div className="co-page">
        <button
          type="button"
          className="co-back"
          onClick={() => {
            setView("directory");
            setSlug(null);
            setPageData(null);
          }}
        >
          <ArrowLeft size={14} /> Companies
        </button>

        {loadingPage ? (
          <div className="co-loading">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : !pageData ? (
          <EmptyState
            title="Company not found"
            description="This company is unpublished or does not exist."
          />
        ) : (
          <CompanyDetail
            data={pageData}
            entitled={entitled}
            difficulty={difficulty}
            topic={topic}
            role={role}
            onDifficulty={setDifficulty}
            onTopic={(t) => {
              setTopic(t);
              setQPage(1);
            }}
            onRole={(r) => {
              setRole(r);
              setQPage(1);
            }}
            onPage={setQPage}
            onSelectProblem={onSelectProblem}
            onUpgrade={startUpgrade}
          />
        )}
      </div>
    );
  }

  return (
    <div className="co-page">
      <header className="co-header">
        <div>
          <h1>
            <Briefcase size={20} aria-hidden /> Company Interview Prep
          </h1>
          <p className="co-muted">
            Configured company sets only — frequency and last-seen appear when
            admins provide them.
          </p>
        </div>
        {!entitled ? (
          <PremiumBadge feature="premium.company_questions" />
        ) : null}
      </header>

      <div className="co-toolbar">
        <div className="co-search">
          <Search size={14} />
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
      </div>

      {loadingDir ? (
        <div className="co-loading">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          title="No companies configured"
          description="Published companies will appear here once added by admins."
        />
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
                  <strong>{c.name}</strong>
                  {c.isPremium ? <PremiumBadge label="Premium" /> : null}
                </div>
                <p className="co-muted">
                  {c.questionCount} configured question
                  {c.questionCount === 1 ? "" : "s"}
                  {c.freePreviewLimit > 0
                    ? ` · ${c.freePreviewLimit} free preview`
                    : ""}
                </p>
                {c.description ? (
                  <p className="co-dir-desc">{c.description}</p>
                ) : null}
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

const CompanyDetail: FC<{
  data: CompanyPageData;
  entitled: boolean;
  difficulty: string;
  topic: string;
  role: string;
  onDifficulty: (d: string) => void;
  onTopic: (t: string) => void;
  onRole: (r: string) => void;
  onPage: (p: number) => void;
  onSelectProblem?: Props["onSelectProblem"];
  onUpgrade: () => void;
}> = ({
  data,
  entitled,
  difficulty,
  topic,
  role,
  onDifficulty,
  onTopic,
  onRole,
  onPage,
  onSelectProblem,
  onUpgrade,
}) => {
  const { company, topics, roles, difficulty: diffCounts, questions, meta } =
    data;

  return (
    <div className="co-detail">
      <header className="co-detail-head">
        <div>
          <h1>{company.name}</h1>
          <p className="co-muted">
            {meta.configuredTotal ?? company.questionCount} configured · Easy{" "}
            {diffCounts.easy} · Medium {diffCounts.medium} · Hard{" "}
            {diffCounts.hard}
          </p>
        </div>
        {company.isPremium ? <PremiumBadge /> : null}
      </header>

      {company.description ? (
        <p className="co-detail-desc">{company.description}</p>
      ) : null}

      <nav className="co-sections" aria-label="Company sections">
        <span className="co-chip active">Problems</span>
        <span className="co-chip">Topics ({topics.length})</span>
        <span className="co-chip">
          Difficulty ({diffCounts.easy + diffCounts.medium + diffCounts.hard})
        </span>
        <span className="co-chip">Role ({roles.length})</span>
        <span className="co-chip">Interview Prep</span>
      </nav>

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
                ? `Showing ${meta.total} of ${meta.configuredTotal} configured questions. Upgrade for the full dataset, filters, and interview prep.`
                : "Upgrade to unlock this company’s configured interview questions."
            }
            onUpgradeClick={onUpgrade}
          />
        </div>
      ) : null}

      <div className="co-filters">
        <select
          value={difficulty}
          aria-label="Difficulty"
          onChange={(e) => {
            onDifficulty(e.target.value);
            onPage(1);
          }}
        >
          <option value="all">All difficulties</option>
          <option value="easy">Easy ({diffCounts.easy})</option>
          <option value="medium">Medium ({diffCounts.medium})</option>
          <option value="hard">Hard ({diffCounts.hard})</option>
        </select>
        <select
          value={topic}
          aria-label="Topic"
          onChange={(e) => onTopic(e.target.value)}
        >
          <option value="all">All topics</option>
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
          <option value="all">All roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          compact
          title="No questions in this view"
          description={
            meta.upgradeRequired
              ? "Upgrade or adjust filters to see configured questions."
              : "No configured questions match these filters."
          }
        />
      ) : (
        <ul className="co-q-list">
          {questions.map((q) => (
            <QuestionRow
              key={q.id}
              q={q}
              onOpen={() =>
                onSelectProblem?.({
                  id: q.problemId,
                  slug: q.slug,
                  title: q.title,
                })
              }
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
            disabled={meta.page <= 1}
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
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPage(meta.page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const QuestionRow: FC<{ q: CompanyQuestion; onOpen: () => void }> = ({
  q,
  onOpen,
}) => (
  <li>
    <button type="button" className="co-q-row" onClick={onOpen}>
      <span className="co-q-main">
        {q.isPremium ? <Lock size={12} aria-hidden /> : null}
        <strong>{q.title}</strong>
        {q.isPremium ? <PremiumBadge label="Premium" /> : null}
      </span>
      <span className="co-muted">
        {q.difficulty}
        {q.role ? ` · ${q.role}` : ""}
        {q.topics?.length ? ` · ${q.topics.slice(0, 3).join(", ")}` : ""}
        {typeof q.frequency === "number" ? ` · freq ${q.frequency}` : ""}
        {q.lastSeenAt
          ? ` · seen ${new Date(q.lastSeenAt).toLocaleDateString()}`
          : ""}
      </span>
    </button>
  </li>
);
