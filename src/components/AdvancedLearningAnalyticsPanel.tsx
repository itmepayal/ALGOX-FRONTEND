import { useCallback, useEffect, useState, type FC } from "react";
import { AlertCircle, BrainCircuit, RefreshCw } from "lucide-react";
import {
  userAnalyticsApi,
  type LearningAnalyticsPayload,
} from "../api/userAnalyticsApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import "./companies/companies.css";
import "./submission-analytics.css";

interface Props {
  range: string;
  refreshKey?: number;
  onOpenRevisionQueue?: () => void;
}

function pct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v}%`;
}

function num(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return String(v);
}

/** Prefer real titles; collapse repeated slug spam like create-articlecreate-article. */
function displayStudyPlanTitle(
  title?: string | null,
  slug?: string | null
): string {
  let s = (title || slug || "").trim();
  if (!s) return "Untitled study plan";

  // Collapse exact doubling: abcabc → abc
  const half = Math.floor(s.length / 2);
  if (half >= 4 && s.slice(0, half) === s.slice(half)) {
    s = s.slice(0, half);
  }

  // Collapse hyphen-unit repeats: create-article-create-article → create-article
  const hyphenParts = s.split("-").filter(Boolean);
  if (hyphenParts.length >= 4 && hyphenParts.length % 2 === 0) {
    const mid = hyphenParts.length / 2;
    const a = hyphenParts.slice(0, mid).join("-");
    const b = hyphenParts.slice(mid).join("-");
    if (a === b) s = a;
  }

  // Humanize slug-like strings when title missing or identical to slug
  const looksLikeSlug = !/\s/.test(s) && /-/.test(s);
  if ((!title || title === slug || looksLikeSlug) && /-/.test(s)) {
    return s
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return s;
}

function languageLabel(lang: string): string {
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
    return "Learning analytics are temporarily unavailable.";
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

export const AdvancedLearningAnalyticsPanel: FC<Props> = ({
  range,
  refreshKey = 0,
  onOpenRevisionQueue,
}) => {
  const { user } = useAuth();
  const premium = canAccess(user, "premium.analytics");
  const [data, setData] = useState<LearningAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gated, setGated] = useState(false);

  const load = useCallback(async () => {
    if (!premium) {
      setData(null);
      setGated(true);
      return;
    }
    setGated(false);
    setLoading(true);
    setError("");
    try {
      const res = await userAnalyticsApi.getLearning({ range });
      setData(res.data ?? null);
    } catch (err: unknown) {
      setData(null);
      const ax = err as { response?: { status?: number } };
      if (ax?.response?.status === 403) {
        setGated(true);
      } else {
        setError(friendlyError(err, "Unable to load learning analytics."));
      }
    } finally {
      setLoading(false);
    }
  }, [premium, range]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!premium || gated) {
    return (
      <section className="co-panel ax-panel">
        <UpgradePrompt
          feature="premium.analytics"
          title="Advanced Learning"
          description="Unlock topic weakness, learning velocity, consistency, study-plan progress, contest performance, and evidence-based recommendations."
        />
      </section>
    );
  }

  if (loading && !data) {
    return (
      <section className="co-panel ax-panel" aria-busy="true">
        <Skeleton className="h-6 w-48" />
        <div className="ax-grid-2" style={{ marginTop: 12 }}>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="co-panel ax-panel">
        <div className="co-inline-error" role="alert">
          <AlertCircle size={16} aria-hidden />
          <div>
            <strong>Learning analytics unavailable</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="co-panel ax-panel">
        <EmptyState
          compact
          title="No learning analytics"
          description="Premium learning insights appear after judged submissions are recorded."
        />
      </section>
    );
  }

  const ov = data.performanceOverview;
  const diff = data.difficultyDistribution;
  const vel = data.learningVelocity;
  const con = data.consistency;
  const acceptanceDisplay =
    ov.totalSubmissions > 0 ? `${ov.acceptanceRate}%` : "—";

  return (
    <section className="co-panel ax-panel" aria-label="Advanced learning">
      <div className="ax-section-head">
        <div>
          <p className="ax-kicker">Learning insights</p>
          <h2 className="ax-section-title">
            <BrainCircuit
              size={18}
              strokeWidth={2}
              aria-hidden
              style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}
            />
            What to focus on next
          </h2>
          <p className="ax-section-meta">
            Evidence-based insights from your judged submissions in this range.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw
            size={14}
            aria-hidden
            className={loading ? "ax-spin" : undefined}
          />
          Refresh
        </Button>
      </div>

      <div className="ax-grid-2">
        <div className="ax-subcard">
          <h3>Performance</h3>
          <ul className="ax-trend-list">
            <li>
              <span>Submissions / accepted</span>
              <strong>
                {ov.totalSubmissions} / {ov.acceptedSubmissions}
              </strong>
            </li>
            <li>
              <span>Acceptance rate</span>
              <strong>{acceptanceDisplay}</strong>
            </li>
            <li>
              <span>Avg measured ACCEPTED runtime</span>
              <strong>
                {ov.runtimeSampleCount > 0 && ov.avgExecutionTimeMs != null
                  ? `${ov.avgExecutionTimeMs} ms`
                  : "—"}
              </strong>
            </li>
            <li>
              <span>Unique attempted / solved</span>
              <strong>
                {ov.attempts?.problemsAttempted ?? 0} /{" "}
                {ov.attempts?.problemsSolved ?? 0}
              </strong>
            </li>
            <li>
              <span>Languages</span>
              <strong>
                {Object.keys(ov.byLanguage || {}).length
                  ? Object.entries(ov.byLanguage)
                      .map(([l, c]) => `${languageLabel(l)} (${c})`)
                      .join(", ")
                  : "—"}
              </strong>
            </li>
          </ul>
          {ov.runtimeSampleCount != null ? (
            <p className="ax-empty-line" style={{ marginTop: 8 }}>
              {ov.runtimeSampleCount} measured runtime sample
              {ov.runtimeSampleCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        <div className="ax-subcard">
          <h3>Topic weakness</h3>
          {data.topicWeakness.length === 0 ? (
            <p className="ax-empty-line">
              {data.topicMastery.length === 0
                ? "No topic submissions recorded yet."
                : "No weak topics detected yet. Weakness signals require at least 2 attempts and less than 50% acceptance."}
            </p>
          ) : (
            <ul className="ax-trend-list">
              {data.topicWeakness.map((t) => (
                <li key={t.topic}>
                  <span>
                    <strong style={{ color: "var(--text-main)" }}>
                      {t.topic}
                    </strong>
                    <br />
                    <span className="ax-empty-line">
                      {t.solvedCount}/{t.totalSubmissions} accepted
                    </span>
                  </span>
                  <strong>{pct(t.acceptanceRate)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ax-subcard">
          <h3>Difficulty</h3>
          <div className="ax-diff-row">
            <div className="ax-diff-chip">
              <em>Easy</em>
              <strong>{diff.easy}</strong>
              {diff.total > 0 ? (
                <span className="ax-metric-sub">{pct(diff.easyPct)}</span>
              ) : null}
            </div>
            <div className="ax-diff-chip">
              <em>Medium</em>
              <strong>{diff.medium}</strong>
              {diff.total > 0 ? (
                <span className="ax-metric-sub">{pct(diff.mediumPct)}</span>
              ) : null}
            </div>
            <div className="ax-diff-chip">
              <em>Hard</em>
              <strong>{diff.hard}</strong>
              {diff.total > 0 ? (
                <span className="ax-metric-sub">{pct(diff.hardPct)}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="ax-subcard">
          <h3>Learning velocity & consistency</h3>
          <ul className="ax-trend-list">
            <li>
              <span>Active days</span>
              <strong>
                {vel.activeDays} / {vel.rangeDays}
              </strong>
            </li>
            <li>
              <span>Accepted / day</span>
              <strong>{num(vel.acceptedPerDay)}</strong>
            </li>
            <li>
              <span>Consistency</span>
              <strong>{pct(con.consistencyRate)}</strong>
            </li>
            <li>
              <span>Submission streak</span>
              <strong>
                {data.streaks.submission.current} day
                {data.streaks.submission.current === 1 ? "" : "s"}
              </strong>
            </li>
            <li>
              <span>Challenge streak</span>
              <strong>
                {data.streaks.challenge.unavailable
                  ? "Unavailable"
                  : `${data.streaks.challenge.current}`}
              </strong>
            </li>
          </ul>
          <p className="ax-empty-line" style={{ marginTop: 8 }}>
            {con.activeDays} active day{con.activeDays === 1 ? "" : "s"} out of{" "}
            {vel.rangeDays}
          </p>
        </div>

        <div className="ax-subcard">
          <h3>Study plans</h3>
          {data.studyPlanProgress.length === 0 ? (
            <p className="ax-empty-line">No enrolled study plans.</p>
          ) : (
            data.studyPlanProgress.map((p) => (
              <div key={p.studyPlanSlug} className="ax-plan-row">
                <div>
                  <strong>
                    {displayStudyPlanTitle(p.title, p.studyPlanSlug)}
                  </strong>
                  <span className="ax-empty-line">
                    {p.solvedCount} / {p.totalProblemsCount} completed ·{" "}
                    {p.completionPercentage}%
                  </span>
                </div>
                <Badge variant="default" className="ax-tag">
                  {p.status}
                </Badge>
              </div>
            ))
          )}
        </div>

        <div className="ax-subcard">
          <h3>Contest performance</h3>
          {data.contestPerformance.unavailable ? (
            <p className="ax-empty-line">Contest summary unavailable.</p>
          ) : data.contestPerformance.contestsEntered === 0 ? (
            <p className="ax-empty-line">
              No contest registrations yet. Participate in a contest to start
              building your contest analytics.
            </p>
          ) : (
            <ul className="ax-trend-list">
              <li>
                <span>Contests</span>
                <strong>{data.contestPerformance.contestsEntered}</strong>
              </li>
              <li>
                <span>Total solved</span>
                <strong>{data.contestPerformance.totalSolved}</strong>
              </li>
              <li>
                <span>Total score</span>
                <strong>{data.contestPerformance.totalScore}</strong>
              </li>
              {data.contestPerformance.items.slice(0, 5).map((c) => (
                <li key={c.contestId}>
                  <span>{c.title || c.slug || c.contestId}</span>
                  <strong>
                    score {c.score}
                    {c.rank != null ? ` · rank ${c.rank}` : ""}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ax-subcard" style={{ gridColumn: "1 / -1" }}>
          <h3>What to focus on next</h3>
          {data.recommendations.length === 0 ? (
            <p className="ax-empty-line">
              Not enough data yet. Complete more judged submissions and
              we&apos;ll identify useful patterns.
            </p>
          ) : (
            data.recommendations.map((r, i) => (
              <article key={`${r.type}-${i}`} className="ax-rec-card">
                <strong>{r.title}</strong>
                <p className="ax-rec-evidence">{r.evidence}</p>
                <p className="ax-rec-action">{r.action}</p>
                {onOpenRevisionQueue &&
                (r.type === "consistency" || r.type === "weak_topic") ? (
                  <div style={{ marginTop: 8 }}>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={onOpenRevisionQueue}
                    >
                      Open Revision Queue
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
