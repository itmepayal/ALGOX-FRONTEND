import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Flame,
  Info,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  userAnalyticsApi,
  type PremiumAnalyticsPayload,
  type SubmissionHistoryPayload,
  type UserAnalyticsSnapshot,
} from "../api/userAnalyticsApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { PremiumBadge } from "./access/PremiumBadge";
import { AdvancedLearningAnalyticsPanel } from "./AdvancedLearningAnalyticsPanel";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/cn";
import "./submission-analytics.css";

interface Props {
  refreshKey?: number;
  onOpenRevisionQueue?: () => void;
  onPracticeProblems?: () => void;
  onOpenProblem?: (problemId: string) => void;
}

const RANGES = [
  { id: "7d", label: "7 days", summary: "Last 7 days", days: 7 },
  { id: "30d", label: "30 days", summary: "Last 30 days", days: 30 },
  { id: "90d", label: "90 days", summary: "Last 90 days", days: 90 },
  { id: "1y", label: "1 year", summary: "Last year", days: 365 },
] as const;

const VERDICTS = [
  { id: "", label: "All" },
  { id: "ACCEPTED", label: "Accepted" },
  { id: "WRONG_ANSWER", label: "Wrong Answer" },
  { id: "TIME_LIMIT_EXCEEDED", label: "TLE" },
  { id: "MEMORY_LIMIT_EXCEEDED", label: "MLE" },
  { id: "RUNTIME_ERROR", label: "Runtime Error" },
  { id: "COMPILATION_ERROR", label: "Compilation Error" },
] as const;

const LANGUAGES = [
  { id: "", label: "All" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
] as const;

const VERDICT_ORDER = [
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "RUNTIME_ERROR",
  "COMPILATION_ERROR",
] as const;

function fmtMs(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v} ms`;
}

function fmtMb(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v} MB`;
}

function languageLabel(lang: string | null | undefined): string {
  if (!lang) return "—";
  switch (lang.toLowerCase()) {
    case "python":
      return "Python";
    case "javascript":
      return "JavaScript";
    case "cpp":
      return "C++";
    case "java":
      return "Java";
    default:
      return lang;
  }
}

function verdictLabel(status: string): string {
  const s = String(status || "").toUpperCase();
  if (s === "ACCEPTED") return "Accepted";
  if (s === "WRONG_ANSWER") return "Wrong Answer";
  if (s === "TIME_LIMIT_EXCEEDED") return "TLE";
  if (s === "MEMORY_LIMIT_EXCEEDED") return "MLE";
  if (s === "RUNTIME_ERROR") return "Runtime Error";
  if (s === "COMPILATION_ERROR") return "Compilation Error";
  return status || "—";
}

function verdictVariant(
  status: string
): "success" | "warning" | "danger" | "default" {
  const s = String(status || "").toUpperCase();
  if (s === "ACCEPTED") return "success";
  if (s === "WRONG_ANSWER") return "danger";
  if (s === "TIME_LIMIT_EXCEEDED" || s === "MEMORY_LIMIT_EXCEEDED")
    return "warning";
  if (s === "RUNTIME_ERROR" || s === "COMPILATION_ERROR") return "danger";
  return "default";
}

function formatHistoryWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff >= 0 && diff < 60_000) return "Just now";
    if (diff >= 0 && diff < 3_600_000)
      return `${Math.floor(diff / 60_000)} min ago`;
    if (diff >= 0 && diff < 86_400_000)
      return `${Math.floor(diff / 3_600_000)} hr ago`;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function problemLabel(problemId: string): string {
  const id = String(problemId || "");
  if (!id) return "Unknown problem";
  if (id.length <= 10) return `Problem ${id}`;
  return `Problem · ${id.slice(-6)}`;
}

function friendlyError(err: unknown, fallback: string): string {
  const ax = err as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  const status = ax?.response?.status;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "This analytics feature requires Premium.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status && status >= 500)
    return "Analytics are temporarily unavailable. Please try again.";
  if (
    ax?.code === "ERR_NETWORK" ||
    /network error/i.test(String(ax?.message || ""))
  ) {
    return "Connection unavailable. Check your network and try again.";
  }
  const msg = ax?.response?.data?.message;
  if (
    typeof msg === "string" &&
    msg.trim() &&
    !/axios|mongo|stack|internal server/i.test(msg)
  ) {
    return msg.trim();
  }
  return fallback;
}

function heatLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const r = count / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

function MetricCard({
  label,
  value,
  sub,
  progress,
}: {
  label: string;
  value: string;
  sub?: string;
  progress?: number | null;
}) {
  return (
    <div className="ax-metric">
      <span className="ax-metric-label">{label}</span>
      <strong className="ax-metric-value">{value}</strong>
      {sub ? <span className="ax-metric-sub">{sub}</span> : null}
      {progress != null && Number.isFinite(progress) ? (
        <div
          className="ax-accept-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} progress`}
        >
          <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export const SubmissionAnalyticsPanel: FC<Props> = ({
  refreshKey = 0,
  onOpenRevisionQueue,
  onPracticeProblems,
  onOpenProblem,
}) => {
  const { user } = useAuth();
  const premium = canAccess(user, "premium.analytics");

  const [overview, setOverview] = useState<UserAnalyticsSnapshot | null>(null);
  const [history, setHistory] = useState<SubmissionHistoryPayload | null>(null);
  const [premiumData, setPremiumData] =
    useState<PremiumAnalyticsPayload | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const [range, setRange] = useState("30d");
  const [status, setStatus] = useState("");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setRefreshing(true);
    setOverviewError(null);
    setHistoryError(null);
    setPremiumError(null);

    const ovOutcome = await userAnalyticsApi
      .getOverview()
      .then((r) => ({ ok: true as const, data: r.data ?? null }))
      .catch((err) => ({ ok: false as const, err }));

    const histOutcome = await userAnalyticsApi
      .getHistory({
        range,
        status: status || undefined,
        language: language || undefined,
        page,
        limit: 15,
      })
      .then((r) => ({ ok: true as const, data: r.data ?? null }))
      .catch((err) => ({ ok: false as const, err }));

    if (ovOutcome.ok) {
      setOverview(ovOutcome.data);
    } else {
      setOverviewError(
        friendlyError(ovOutcome.err, "Unable to load all-time profile.")
      );
    }

    if (histOutcome.ok) {
      setHistory(histOutcome.data);
      const softErr =
        histOutcome.data &&
        typeof (histOutcome.data as { error?: string }).error === "string"
          ? (histOutcome.data as { error?: string }).error
          : null;
      if (softErr) {
        setHistoryError(
          "Submission history may be incomplete. Please retry shortly."
        );
      }
    } else {
      setHistoryError(
        friendlyError(histOutcome.err, "Unable to load submission history.")
      );
    }

    if (premium) {
      try {
        const prem = await userAnalyticsApi.getPremium({
          range,
          status: status || undefined,
          language: language || undefined,
          page: 1,
          limit: 15,
        });
        setPremiumData(prem.data ?? null);
        setPremiumError(null);
      } catch (err: unknown) {
        setPremiumData(null);
        const ax = err as { response?: { status?: number } };
        if (ax?.response?.status === 403) {
          setPremiumError("PREMIUM_REQUIRED");
        } else {
          setPremiumError(
            friendlyError(err, "Unable to load premium insights.")
          );
        }
      }
    } else {
      setPremiumData(null);
      setPremiumError(null);
    }

    setLoadedOnce(true);
    setRefreshing(false);
  }, [range, status, language, page, premium]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const rangeMeta = RANGES.find((r) => r.id === range);
  const rangeSummary = rangeMeta?.summary || "Selected range";
  const verdictSummary =
    VERDICTS.find((v) => v.id === status)?.label || "All verdicts";
  const languageSummary =
    LANGUAGES.find((l) => l.id === language)?.label || "All languages";

  const items = history?.items || [];
  const agg = history?.aggregates;
  const submissions = history?.total ?? agg?.attempts?.totalAttempts ?? null;
  const accepted = agg?.acceptedCount ?? null;
  const acceptanceRate =
    submissions != null && submissions > 0 && accepted != null
      ? agg?.acceptanceRate ?? Math.round((accepted / submissions) * 100)
      : null;
  const runtimeSamples = agg?.runtimeSampleCount ?? 0;
  const avgRuntime = agg?.avgExecutionTimeMs ?? null;
  const avgMemory = agg?.avgMemoryMb ?? null;
  const attempted = agg?.attempts?.problemsAttempted;
  const solved = agg?.attempts?.problemsSolved;

  const activeDays = useMemo(() => {
    const daily = agg?.daily || [];
    return daily.filter((d) => (d.count || 0) > 0).length;
  }, [agg]);

  const rangeDays = rangeMeta?.days ?? 30;

  const langRows = useMemo(() => {
    if (premiumData?.languageComparison?.length) {
      return premiumData.languageComparison.filter((l) => l.count > 0);
    }
    const by = agg?.byLanguage || {};
    return Object.entries(by)
      .filter(([, c]) => c > 0)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);
  }, [premiumData, agg]);

  const langMax = useMemo(
    () => Math.max(1, ...langRows.map((l) => l.count || 0)),
    [langRows]
  );

  const verdictRows = useMemo(() => {
    const by = agg?.byStatus || {};
    const known = VERDICT_ORDER.map((id) => ({
      id,
      label: verdictLabel(id),
      count: Number(by[id] || 0),
    }));
    const extra = Object.entries(by)
      .filter(([k]) => !(VERDICT_ORDER as readonly string[]).includes(k))
      .map(([id, count]) => ({
        id,
        label: verdictLabel(id),
        count: Number(count || 0),
      }));
    return [...known, ...extra].filter((r) => r.count > 0);
  }, [agg]);

  const verdictMax = useMemo(
    () => Math.max(1, ...verdictRows.map((v) => v.count)),
    [verdictRows]
  );

  const measuredRuntimeTrend = useMemo(
    () =>
      (premiumData?.runtimeTrend || []).filter(
        (t) => t.avgExecutionTimeMs != null
      ),
    [premiumData]
  );

  const heatDays = useMemo(() => {
    const fromAgg = (agg?.daily || []).map((d) => ({
      date: d.date,
      count: d.count || 0,
    }));
    if (fromAgg.length > 0) return fromAgg.slice(-42);
    return (overview?.submissionHeatmap || [])
      .map((d) => ({
        date: String(d.date || ""),
        count: Number(d.count || 0),
      }))
      .filter((d) => d.date)
      .slice(-42);
  }, [agg, overview]);

  const heatMax = useMemo(
    () => Math.max(0, ...heatDays.map((d) => d.count)),
    [heatDays]
  );

  const acceptanceDaily = useMemo(() => {
    const daily = agg?.daily || [];
    return daily.filter((d) => (d.count || 0) > 0).slice(-14);
  }, [agg]);

  const clearFilters = () => {
    setRange("30d");
    setStatus("");
    setLanguage("");
    setPage(1);
  };

  if (!loadedOnce) {
    return (
      <div className="co-page ax-page" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <div className="ax-summary" style={{ marginTop: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="mt-3 h-40 w-full" />
        <Skeleton className="mt-3 h-56 w-full" />
      </div>
    );
  }

  const noHistoryAtAll =
    !historyError &&
    submissions === 0 &&
    !status &&
    !language &&
    (overview?.totalSubmissions ?? 0) === 0;

  const historyFailedHard = Boolean(historyError && !history);
  const pageFrom = history
    ? Math.min(
        history.total,
        (history.page - 1) * history.limit + (history.total > 0 ? 1 : 0)
      )
    : 0;
  const pageTo = history
    ? Math.min(history.total, history.page * history.limit)
    : 0;

  return (
    <div className="co-page ax-page">
      <header className="ax-header">
        <div>
          <p className="ax-kicker">Learning analytics</p>
          <h1 className="co-title">
            <BarChart3 size={22} aria-hidden className="ax-icon" />
            Submission Analytics
          </h1>
          <p className="ax-lede">
            Understand your solving patterns, progress, and areas to improve.
          </p>
          <div className="ax-trust-row">
            <span
              className="ax-badge"
              title="Analytics are calculated from your server-side submission records."
            >
              <CheckCircle2 size={12} aria-hidden />
              Server-authoritative
            </span>
            <span className="ax-meta">{rangeSummary}</span>
            <button
              type="button"
              className="ax-info-btn"
              title="Analytics are calculated from your real judged submissions. Runtime and memory are shown only when measured."
              aria-label="How analytics are calculated"
            >
              <Info size={14} aria-hidden />
            </button>
          </div>
        </div>
        <div className="ax-header-actions">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={refreshing}
            onClick={() => void load()}
          >
            <RefreshCw
              size={14}
              aria-hidden
              className={refreshing ? "ax-spin" : undefined}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </header>

      <div className="ax-layout">
        <section className="co-panel ax-panel" aria-label="Analytics filters">
          <div className="ax-filters">
            <div className="ax-filter-row">
              <span className="ax-filter-label">Range</span>
              <div className="ax-chips" role="group" aria-label="Date range">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={cn("ax-chip", range === r.id && "ax-chip-active")}
                    aria-pressed={range === r.id}
                    onClick={() => {
                      setPage(1);
                      setRange(r.id);
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ax-filter-row">
              <span className="ax-filter-label">Verdict</span>
              <div className="ax-chips" role="group" aria-label="Verdict">
                {VERDICTS.map((v) => (
                  <button
                    key={v.id || "all"}
                    type="button"
                    className={cn(
                      "ax-chip",
                      status === v.id && "ax-chip-active"
                    )}
                    aria-pressed={status === v.id}
                    onClick={() => {
                      setPage(1);
                      setStatus(v.id);
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ax-filter-row">
              <span className="ax-filter-label">Language</span>
              <div className="ax-chips" role="group" aria-label="Language">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id || "all"}
                    type="button"
                    className={cn(
                      "ax-chip",
                      language === l.id && "ax-chip-active"
                    )}
                    aria-pressed={language === l.id}
                    onClick={() => {
                      setPage(1);
                      setLanguage(l.id);
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              {(status || language || range !== "30d") && (
                <div className="ax-filter-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
            <p className="ax-showing">
              Showing: {rangeSummary} · {verdictSummary} · {languageSummary}
            </p>
          </div>
        </section>

        {historyFailedHard ? (
          <div className="ax-alert" role="alert">
            <AlertCircle size={16} aria-hidden />
            <div style={{ flex: 1 }}>
              <strong>Unable to load submission analytics</strong>
              <p>
                Your submissions are safe. We couldn&apos;t load the analytics
                right now. {historyError}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {noHistoryAtAll ? (
          <section className="co-panel ax-panel">
            <EmptyState
              compact
              icon={<BarChart3 size={18} strokeWidth={1.75} aria-hidden />}
              title="No judged submissions yet"
              description="Submit your first solution to start building your learning analytics."
              action={
                onPracticeProblems ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={onPracticeProblems}
                  >
                    Practice Problems
                  </Button>
                ) : undefined
              }
            />
          </section>
        ) : null}

        {!historyFailedHard ? (
          <section className="ax-summary" aria-label="Summary">
            <div className="ax-stat">
              <span className="ax-stat-label">Submissions</span>
              <strong className="ax-stat-value">
                {submissions != null ? String(submissions) : "—"}
              </strong>
              <span className="ax-stat-hint">Judged in range</span>
            </div>
            <div className="ax-stat">
              <span className="ax-stat-label">Accepted</span>
              <strong className="ax-stat-value">
                {accepted != null ? String(accepted) : "—"}
              </strong>
              <span className="ax-stat-hint">
                {acceptanceRate != null
                  ? `${acceptanceRate}% acceptance`
                  : "No acceptance rate yet"}
              </span>
              {acceptanceRate != null ? (
                <div
                  className="ax-accept-bar"
                  role="progressbar"
                  aria-valuenow={acceptanceRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Acceptance rate"
                >
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, acceptanceRate))}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div className="ax-stat">
              <span className="ax-stat-label">Problems solved</span>
              <strong className="ax-stat-value">
                {solved != null ? String(solved) : "—"}
              </strong>
              <span className="ax-stat-hint">
                {attempted != null
                  ? `${attempted} unique attempted`
                  : "Unique accepted problems"}
              </span>
            </div>
            <div className="ax-stat">
              <span className="ax-stat-label">Active days</span>
              <strong className="ax-stat-value">{activeDays}</strong>
              <span className="ax-stat-hint">
                of {rangeDays} days in range
              </span>
            </div>
            <div className="ax-stat">
              <span className="ax-stat-label">Current streak</span>
              <strong className="ax-stat-value">
                {overviewError && !overview
                  ? "—"
                  : `${overview?.currentStreak ?? 0}`}
              </strong>
              <span className="ax-stat-hint">
                {(overview?.currentStreak ?? 0) === 1 ? "day" : "days"} ·
                all-time
              </span>
            </div>
          </section>
        ) : null}

        {!historyFailedHard && !noHistoryAtAll ? (
          <section className="co-panel ax-panel" aria-label="Performance">
            <div className="ax-section-head">
              <div>
                <p className="ax-kicker">Performance</p>
                <h2 className="ax-section-title">Measured performance</h2>
                <p className="ax-section-meta">
                  Average runtime and memory use measured ACCEPTED samples only.
                </p>
              </div>
            </div>
            <div className="ax-metrics ax-metrics-3">
              <MetricCard
                label="Avg runtime"
                value={runtimeSamples > 0 ? fmtMs(avgRuntime) : "—"}
                sub={
                  runtimeSamples > 0
                    ? `${runtimeSamples} measured sample${
                        runtimeSamples === 1 ? "" : "s"
                      }`
                    : "No measured runtime yet"
                }
              />
              <MetricCard
                label="Avg memory"
                value={avgMemory != null ? fmtMb(avgMemory) : "—"}
                sub={
                  avgMemory != null
                    ? "Measured ACCEPTED samples"
                    : "No measured memory yet"
                }
              />
              <MetricCard
                label="Acceptance rate"
                value={acceptanceRate != null ? `${acceptanceRate}%` : "—"}
                sub={
                  submissions != null && submissions > 0
                    ? `${accepted ?? 0} of ${submissions} submissions`
                    : "Not enough submissions"
                }
                progress={acceptanceRate}
              />
            </div>
          </section>
        ) : null}

        {!historyFailedHard && !noHistoryAtAll ? (
          <section className="co-panel ax-panel" aria-label="Learning trends">
            <div className="ax-section-head">
              <div>
                <p className="ax-kicker">Trends</p>
                <h2 className="ax-section-title">Practice trends</h2>
                <p className="ax-section-meta">
                  How consistently your judged submissions are accepted.
                </p>
              </div>
            </div>
            <div className="ax-grid-2">
              <div className="ax-subcard">
                <h3>Acceptance trend</h3>
                {acceptanceDaily.length < 2 ? (
                  <p className="ax-empty-line">
                    Not enough submissions for a meaningful trend yet.
                  </p>
                ) : (
                  <ul className="ax-trend-list">
                    {acceptanceDaily.map((d) => {
                      const rate =
                        d.count > 0
                          ? Math.round((d.accepted / d.count) * 100)
                          : 0;
                      return (
                        <li key={d.date}>
                          <span>{d.date}</span>
                          <span className="ax-mono">
                            {rate}% · {d.accepted}/{d.count}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="ax-subcard">
                <h3>Submission activity</h3>
                {heatDays.length === 0 || heatMax === 0 ? (
                  <p className="ax-empty-line">
                    No judged activity in this window yet.
                  </p>
                ) : (
                  <>
                    <div
                      className="ax-heat"
                      role="img"
                      aria-label="Submission activity heatmap from judged submissions"
                    >
                      {heatDays.map((d) => (
                        <span
                          key={d.date}
                          className="ax-heat-cell"
                          data-level={heatLevel(d.count, heatMax)}
                          title={`${d.date}: ${d.count} submission${
                            d.count === 1 ? "" : "s"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="ax-heat-legend">
                      <span>Less</span>
                      <span className="ax-heat-cell" data-level={0} />
                      <span className="ax-heat-cell" data-level={1} />
                      <span className="ax-heat-cell" data-level={2} />
                      <span className="ax-heat-cell" data-level={3} />
                      <span className="ax-heat-cell" data-level={4} />
                      <span>More</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {!historyFailedHard && !noHistoryAtAll ? (
          <section className="co-panel ax-panel" aria-label="Solving profile">
            <div className="ax-section-head">
              <div>
                <p className="ax-kicker">Profile</p>
                <h2 className="ax-section-title">Solving profile</h2>
                <p className="ax-section-meta">
                  Verdicts and languages from judged submissions in this range.
                </p>
              </div>
            </div>
            <div className="ax-grid-2">
              <div className="ax-subcard">
                <h3>Verdict breakdown</h3>
                {verdictRows.length === 0 ? (
                  <p className="ax-empty-line">No verdict data in this range.</p>
                ) : (
                  <ul className="ax-verdict-list">
                    {verdictRows.map((v) => (
                      <li key={v.id} className="ax-verdict-row">
                        <span>{v.label}</span>
                        <div className="ax-verdict-track" aria-hidden>
                          <span
                            style={{
                              width: `${Math.round(
                                (v.count / verdictMax) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <strong>{v.count}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="ax-subcard">
                <h3>Languages used</h3>
                {langRows.length === 0 ? (
                  <p className="ax-empty-line">No language data in this range.</p>
                ) : (
                  langRows.map((l) => (
                    <div key={l.language} className="ax-lang-row">
                      <span className="ax-lang-name">
                        {languageLabel(l.language)}
                      </span>
                      <div className="ax-lang-bar" aria-hidden>
                        <span
                          style={{
                            width: `${Math.round(
                              (l.count / langMax) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="ax-lang-count">{l.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="co-panel ax-panel" aria-label="All-time progress">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">All time</p>
              <h2 className="ax-section-title">All-time progress</h2>
              <p className="ax-section-meta">
                Lifetime progress from your account activity.
              </p>
            </div>
          </div>
          {overviewError && !overview ? (
            <div className="ax-alert" role="alert">
              <AlertCircle size={16} aria-hidden />
              <div style={{ flex: 1 }}>
                <strong>Unable to load all-time progress</strong>
                <p>{overviewError}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void load()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              <div className="ax-metrics ax-metrics-4">
                <MetricCard
                  label="Submissions"
                  value={String(overview?.totalSubmissions ?? 0)}
                />
                <MetricCard
                  label="Accepted"
                  value={String(overview?.acceptedSubmissions ?? 0)}
                />
                <MetricCard
                  label="Current streak"
                  value={`${overview?.currentStreak ?? 0}`}
                  sub="days"
                />
                <MetricCard
                  label="Longest streak"
                  value={`${overview?.maxStreak ?? 0}`}
                  sub="days"
                />
              </div>
              {(overview?.currentStreak ?? 0) > 0 ? (
                <p className="ax-fire" style={{ marginTop: 12 }} role="status">
                  <Flame size={14} fill="currentColor" aria-hidden />
                  {overview?.currentStreak} day current streak
                </p>
              ) : null}
              <div style={{ marginTop: 14 }}>
                <p className="ax-metric-label" style={{ marginBottom: 8 }}>
                  Unique problems solved by difficulty
                </p>
                <div className="ax-diff-row">
                  <div className="ax-diff-chip">
                    <em>Easy</em>
                    <strong>{overview?.solvedEasy ?? 0}</strong>
                  </div>
                  <div className="ax-diff-chip">
                    <em>Medium</em>
                    <strong>{overview?.solvedMedium ?? 0}</strong>
                  </div>
                  <div className="ax-diff-chip">
                    <em>Hard</em>
                    <strong>{overview?.solvedHard ?? 0}</strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="co-panel ax-panel" aria-label="Learning loop">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">Learning loop</p>
              <h2 className="ax-section-title">Your learning loop</h2>
              <p className="ax-section-meta">
                Accepted solves can automatically enter your revision queue for
                spaced repetition.
              </p>
            </div>
          </div>
          <div className="ax-bridge">
            <div className="ax-loop" aria-hidden>
              <span>Solve</span>
              <em>→</em>
              <span>Submit</span>
              <em>→</em>
              <span>Analyze</span>
              <em>→</em>
              <span>Review</span>
              <em>→</em>
              <span>Improve</span>
            </div>
            {onOpenRevisionQueue ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={onOpenRevisionQueue}
              >
                <RotateCcw size={14} aria-hidden />
                Open Revision Queue
              </Button>
            ) : null}
          </div>
        </section>

        {premium && premiumData ? (
          <section className="co-panel ax-panel" aria-label="Premium insights">
            <div className="ax-section-head">
              <div>
                <p className="ax-kicker">
                  Premium Insights <PremiumBadge feature="premium.analytics" />
                </p>
                <h2 className="ax-section-title">Deeper analytics</h2>
                <p className="ax-section-meta">
                  {rangeSummary} · measured ACCEPTED samples for runtime trends
                </p>
              </div>
            </div>
            <div className="ax-grid-2">
              <div className="ax-subcard">
                <h3>Runtime trend</h3>
                {measuredRuntimeTrend.length === 0 ? (
                  <p className="ax-empty-line">
                    Not enough measured ACCEPTED runtime for a trend yet.
                  </p>
                ) : (
                  <ul className="ax-trend-list">
                    {measuredRuntimeTrend.slice(-7).map((t) => (
                      <li key={t.date}>
                        <span>{t.date}</span>
                        <span className="ax-mono">
                          {fmtMs(t.avgExecutionTimeMs)} · n={t.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="ax-subcard">
                <h3>Acceptance (premium)</h3>
                {(premiumData.acceptanceTrend || []).length === 0 ? (
                  <p className="ax-empty-line">
                    Not enough accepted submissions for a trend yet.
                  </p>
                ) : (
                  <ul className="ax-trend-list">
                    {premiumData.acceptanceTrend.slice(-7).map((t) => (
                      <li key={t.date}>
                        <span>{t.date}</span>
                        <span className="ax-mono">{t.accepted} accepted</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="ax-subcard">
                <h3>Attempts vs solved</h3>
                <div className="ax-metrics ax-metrics-3" style={{ gap: 8 }}>
                  <MetricCard
                    label="Unique attempted"
                    value={String(
                      premiumData.attemptAnalysis?.problemsAttempted ?? 0
                    )}
                  />
                  <MetricCard
                    label="Unique solved"
                    value={String(
                      premiumData.attemptAnalysis?.problemsSolved ?? 0
                    )}
                  />
                  <MetricCard
                    label="Avg attempts / problem"
                    value={
                      premiumData.attemptAnalysis?.avgAttemptsPerProblem != null
                        ? String(
                            premiumData.attemptAnalysis.avgAttemptsPerProblem
                          )
                        : "—"
                    }
                  />
                </div>
              </div>
              <div className="ax-subcard">
                <h3>Unique solved by difficulty</h3>
                <div className="ax-diff-row">
                  <div className="ax-diff-chip">
                    <em>Easy</em>
                    <strong>{premiumData.difficultyPerformance.easy}</strong>
                  </div>
                  <div className="ax-diff-chip">
                    <em>Medium</em>
                    <strong>{premiumData.difficultyPerformance.medium}</strong>
                  </div>
                  <div className="ax-diff-chip">
                    <em>Hard</em>
                    <strong>{premiumData.difficultyPerformance.hard}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : premium && premiumError === "PREMIUM_REQUIRED" ? (
          <section className="co-panel ax-panel">
            <UpgradePrompt
              feature="premium.analytics"
              title="Premium Insights"
              description="Unlock runtime trends, language usage, attempt analysis, and acceptance trends from real judged data."
            />
          </section>
        ) : premium && premiumError ? (
          <section className="co-panel ax-panel">
            <div className="ax-alert" role="alert">
              <AlertCircle size={16} aria-hidden />
              <div style={{ flex: 1 }}>
                <strong>Premium insights unavailable</strong>
                <p>{premiumError}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void load()}
              >
                Try again
              </Button>
            </div>
          </section>
        ) : !premium ? (
          <section className="co-panel ax-panel">
            <UpgradePrompt
              feature="premium.analytics"
              title="Advanced learning insights"
              description="Unlock deeper patterns across your submissions, topics, and performance."
            />
          </section>
        ) : null}

        {premium ? (
          <AdvancedLearningAnalyticsPanel
            range={range}
            refreshKey={refreshKey}
            onOpenRevisionQueue={onOpenRevisionQueue}
          />
        ) : null}

        <section className="co-panel ax-panel" aria-label="Submission history">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">History</p>
              <h2 className="ax-section-title">Submission history</h2>
              <p className="ax-section-meta">
                {history
                  ? `Showing ${pageFrom}–${pageTo} of ${history.total} submissions`
                  : "Server-side pagination"}
              </p>
            </div>
          </div>

          {historyError && history ? (
            <div className="ax-alert" role="status" style={{ marginBottom: 12 }}>
              <AlertCircle size={16} aria-hidden />
              <div style={{ flex: 1 }}>
                <strong>Couldn&apos;t refresh history</strong>
                <p>Showing the last successful load. {historyError}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void load()}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {historyError && !history ? (
            <div className="ax-alert" role="alert">
              <AlertCircle size={16} aria-hidden />
              <div style={{ flex: 1 }}>
                <strong>Submission history unavailable</strong>
                <p>{historyError}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void load()}
              >
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              compact
              title={
                status || language || range !== "30d"
                  ? "No submissions match these filters"
                  : "No judged submissions yet"
              }
              description={
                status || language || range !== "30d"
                  ? "Try another date range, verdict, or language."
                  : "Submit your first solution to start building your learning analytics."
              }
              action={
                status || language || range !== "30d" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : onPracticeProblems ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={onPracticeProblems}
                  >
                    Practice Problems
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap">
                <table className="ax-table">
                  <thead>
                    <tr>
                      <th scope="col">Problem</th>
                      <th scope="col">Verdict</th>
                      <th scope="col">Language</th>
                      <th scope="col">Runtime</th>
                      <th scope="col">Memory</th>
                      <th scope="col">Submitted</th>
                      {onOpenProblem ? <th scope="col">Action</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id}>
                        <td className="ax-problem-cell">
                          {problemLabel(row.problemId)}
                        </td>
                        <td>
                          <Badge
                            variant={verdictVariant(row.status)}
                            className="ax-tag"
                          >
                            {verdictLabel(row.status)}
                          </Badge>
                        </td>
                        <td>{languageLabel(row.language)}</td>
                        <td className="ax-mono">{fmtMs(row.executionTime)}</td>
                        <td className="ax-mono">{fmtMb(row.memory)}</td>
                        <td>{formatHistoryWhen(row.createdAt)}</td>
                        {onOpenProblem ? (
                          <td>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => onOpenProblem(row.problemId)}
                            >
                              Open
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ax-pager">
                <span className="ax-pager-label">
                  Showing {pageFrom}–{pageTo} of {history?.total ?? 0} · Page{" "}
                  {history?.page ?? page} of {history?.totalPages || 1}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={page <= 1 || refreshing}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      page >= (history?.totalPages || 1) || refreshing
                    }
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
