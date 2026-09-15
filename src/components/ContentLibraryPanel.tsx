import { useCallback, useEffect, useState, type FC } from "react";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import {
  contentApi,
  type ContentArticle,
  type ContentStudyPlan,
} from "../api/contentApi";

type Tab = "articles" | "plans";

export const ContentLibraryPanel: FC = () => {
  const [tab, setTab] = useState<Tab>("articles");
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [plans, setPlans] = useState<ContentStudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<{
    kind: Tab;
    title: string;
    body: string;
    meta?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [articlesRes, plansRes] = await Promise.all([
        contentApi.listArticles({ page: 1, limit: 50 }),
        contentApi.listStudyPlans({ page: 1, limit: 50 }),
      ]);
      setArticles(articlesRes.data || []);
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
      setDetail({
        kind: "articles",
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
      const p = res.data;
      if (!p) return;
      const body = [
        p.description || "",
        p.problemSlugs?.length
          ? `\n\nProblems:\n${p.problemSlugs.map((s) => `• ${s}`).join("\n")}`
          : "",
      ].join("");
      setDetail({
        kind: "plans",
        title: p.title,
        body,
        meta: p.difficulty
          ? `${p.difficulty}${p.estimatedDays ? ` · ${p.estimatedDays} days` : ""}`
          : undefined,
      });
    } catch {
      setError("Failed to load study plan.");
    }
  };

  if (detail) {
    return (
      <div className="learn-layout animate-fade-in">
        <header className="learn-header">
          <button type="button" className="platform-icon-btn" onClick={() => setDetail(null)}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{detail.title}</h1>
            {detail.meta && <p>{detail.meta}</p>}
          </div>
        </header>
        <section className="learn-card">
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{detail.body}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <BookOpen size={22} /> Learn
          </h1>
          <p>Articles and curated study plans.</p>
        </div>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={`platform-chip ${tab === "articles" ? "platform-chip-streak" : ""}`}
          onClick={() => setTab("articles")}
        >
          Articles
        </button>
        <button
          type="button"
          className={`platform-chip ${tab === "plans" ? "platform-chip-streak" : ""}`}
          onClick={() => setTab("plans")}
        >
          Study Plans
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
                <li
                  key={a._id}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                  onClick={() => void openArticle(a.slug)}
                >
                  <div style={{ fontWeight: 600 }}>{a.title}</div>
                  {a.summary && (
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
                      {a.summary}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : plans.length === 0 ? (
        <div className="placeholder-tab">
          <BookOpen size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
          <h2>No study plans yet</h2>
          <p>Curated study plans will appear here.</p>
        </div>
      ) : (
        <div className="learn-card">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {plans.map((p) => (
              <li
                key={p._id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                }}
                onClick={() => void openPlan(p.slug)}
              >
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                {p.description && (
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
                    {p.description}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
