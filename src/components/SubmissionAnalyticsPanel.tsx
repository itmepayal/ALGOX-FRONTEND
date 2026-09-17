import { useCallback, useEffect, useState, type FC } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import {
  userAnalyticsApi,
  type PremiumAnalyticsPayload,
  type SubmissionHistoryPayload,
  type UserAnalyticsSnapshot,
} from "../api/userAnalyticsApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { AdvancedLearningAnalyticsPanel } from "./AdvancedLearningAnalyticsPanel";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";

interface Props {
  refreshKey?: number;
}

function fmtMs(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v} ms`;
}
function fmtMb(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v} MB`;
}

export const SubmissionAnalyticsPanel: FC<Props> = ({ refreshKey = 0 }) => {
  const { user } = useAuth();
  const premium = canAccess(user, "premium.analytics");

  const [overview, setOverview] = useState<UserAnalyticsSnapshot | null>(null);
  const [history, setHistory] = useState<SubmissionHistoryPayload | null>(null);
  const [premiumData, setPremiumData] =
    useState<PremiumAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("30d");
  const [status, setStatus] = useState("");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [ov, hist] = await Promise.all([
        userAnalyticsApi.getOverview(),
        userAnalyticsApi.getHistory({
          range,
          status: status || undefined,
          language: language || undefined,
          page,
          limit: 15,
        }),
      ]);
      setOverview(ov.data ?? null);
      setHistory(hist.data ?? null);

      if (premium) {
        try {
          const prem = await userAnalyticsApi.getPremium({
            range,
            status: status || undefined,
            language: language || undefined,
            page,
            limit: 15,
          });
          setPremiumData(prem.data ?? null);
        } catch (err: any) {
          setPremiumData(null);
          if (err?.response?.status !== 403) {
            setError(
              err?.response?.data?.message ||
                err?.message ||
                "Premium analytics failed"
            );
          }
        }
      } else {
        setPremiumData(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [range, status, language, page, premium]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="free-home" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  const items = history?.items || [];
  const agg = history?.aggregates;

  return (
    <div className="free-home">
      <header className="free-home-welcome">
        <div>
          <p className="free-home-kicker">Real submissions</p>
          <h1 className="free-home-title">
            <BarChart3 size={22} aria-hidden /> Submission Analytics
          </h1>
          <p className="free-home-lede">
            Runtime and memory come only from judged submissions — never
            invented. Lists are paginated server-side.
          </p>
        </div>
      </header>

      {error ? (
        <div className="free-home-alert" role="alert">
          {error}
        </div>
      ) : null}

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>Filters</h2>
        </div>
        <div className="mock-interview-form">
          <label>
            Range
            <select value={range} onChange={(e) => { setPage(1); setRange(e.target.value); }}>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="1y">1 year</option>
            </select>
          </label>
          <label>
            Verdict
            <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
              <option value="">All</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="WRONG_ANSWER">Wrong Answer</option>
              <option value="TIME_LIMIT_EXCEEDED">TLE</option>
              <option value="MEMORY_LIMIT_EXCEEDED">MLE</option>
              <option value="RUNTIME_ERROR">Runtime Error</option>
              <option value="COMPILATION_ERROR">Compilation Error</option>
            </select>
          </label>
          <label>
            Language
            <select value={language} onChange={(e) => { setPage(1); setLanguage(e.target.value); }}>
              <option value="">All</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
          </label>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Refresh
        </Button>
      </section>

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>Overview</h2>
        </div>
        <ul className="free-home-activity">
          <li>
            Submissions: <strong>{overview?.totalSubmissions ?? 0}</strong>
          </li>
          <li>
            Accepted: <strong>{overview?.acceptedSubmissions ?? 0}</strong> (
            {overview?.acceptanceRate ?? 0}%)
          </li>
          <li>
            Streak: <strong>{overview?.currentStreak ?? 0}</strong> (max{" "}
            {overview?.maxStreak ?? 0})
          </li>
          <li>
            Easy / Med / Hard solved:{" "}
            <strong>
              {overview?.solvedEasy ?? 0} / {overview?.solvedMedium ?? 0} /{" "}
              {overview?.solvedHard ?? 0}
            </strong>
          </li>
          {agg ? (
            <>
              <li>
                Avg runtime (measured):{" "}
                <strong>{fmtMs(agg.avgExecutionTimeMs)}</strong> · samples{" "}
                {agg.runtimeSampleCount}
              </li>
              <li>
                Avg memory (measured):{" "}
                <strong>{fmtMb(agg.avgMemoryMb)}</strong>
              </li>
            </>
          ) : null}
        </ul>
      </section>

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>History</h2>
          <span className="free-home-muted">
            {history?.total ?? 0} rows · page {history?.page ?? 1}/
            {history?.totalPages ?? 1}
          </span>
        </div>
        {items.length === 0 ? (
          <EmptyState
            compact
            title="No submissions in range"
            description="Official submits in this filter will appear here with real runtime/memory when judged."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ax-table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th align="left">Time</th>
                  <th align="left">Verdict</th>
                  <th align="left">Lang</th>
                  <th align="right">Runtime</th>
                  <th align="right">Memory</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>{row.status}</td>
                    <td>{row.language || "—"}</td>
                    <td align="right">{fmtMs(row.executionTime)}</td>
                    <td align="right">{fmtMb(row.memory)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page >= (history?.totalPages || 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </section>

      {premium && premiumData ? (
        <section className="free-home-card">
          <div className="free-home-card-head">
            <h2>Premium insights</h2>
            <span className="free-home-muted">{premiumData.range}</span>
          </div>
          <ul className="free-home-activity">
            <li>
              Languages:{" "}
              {premiumData.languageComparison.length
                ? premiumData.languageComparison
                    .map((l) => `${l.language} (${l.count})`)
                    .join(", ")
                : "—"}
            </li>
            <li>
              Attempts / solved problems:{" "}
              <strong>
                {premiumData.attemptAnalysis?.totalAttempts ?? 0} /{" "}
                {premiumData.attemptAnalysis?.problemsSolved ?? 0}
              </strong>
              {premiumData.attemptAnalysis?.avgAttemptsPerProblem != null
                ? ` · avg ${premiumData.attemptAnalysis.avgAttemptsPerProblem} attempts/problem`
                : ""}
            </li>
            <li>
              Runtime trend points:{" "}
              <strong>
                {
                  premiumData.runtimeTrend.filter(
                    (t) => t.avgExecutionTimeMs != null
                  ).length
                }
              </strong>{" "}
              days with measured ACCEPTED runtime
            </li>
            <li>
              Acceptance trend days:{" "}
              <strong>{premiumData.acceptanceTrend.length}</strong>
            </li>
            <li>
              Difficulty solved E/M/H:{" "}
              <strong>
                {premiumData.difficultyPerformance.easy}/
                {premiumData.difficultyPerformance.medium}/
                {premiumData.difficultyPerformance.hard}
              </strong>
            </li>
          </ul>
          {premiumData.runtimeTrend.length > 0 ? (
            <ul className="free-home-muted" style={{ marginTop: 8 }}>
              {premiumData.runtimeTrend.slice(-7).map((t) => (
                <li key={t.date}>
                  {t.date}: {fmtMs(t.avgExecutionTimeMs)} · mem{" "}
                  {fmtMb(
                    premiumData.memoryTrend.find((m) => m.date === t.date)
                      ?.avgMemoryMb
                  )}{" "}
                  · n={t.count}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <section className="free-home-card">
          <UpgradePrompt
            feature="premium.analytics"
            title="Premium submission analytics"
            description="Unlock runtime/memory trends, language comparison, attempt analysis, and acceptance trends from real judged data."
          />
        </section>
      )}

      {premium ? (
        <AdvancedLearningAnalyticsPanel range={range} refreshKey={refreshKey} />
      ) : null}
    </div>
  );
};
