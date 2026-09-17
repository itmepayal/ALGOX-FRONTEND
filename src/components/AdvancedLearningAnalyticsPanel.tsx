import { useCallback, useEffect, useState, type FC } from "react";
import { BrainCircuit, Loader2 } from "lucide-react";
import {
  userAnalyticsApi,
  type LearningAnalyticsPayload,
} from "../api/userAnalyticsApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";

interface Props {
  range: string;
  refreshKey?: number;
}

function pct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v}%`;
}

function num(v: number | null | undefined) {
  if (v == null) return "—";
  return String(v);
}

export const AdvancedLearningAnalyticsPanel: FC<Props> = ({
  range,
  refreshKey = 0,
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
    } catch (err: any) {
      setData(null);
      if (err?.response?.status === 403) {
        setGated(true);
      } else {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Learning analytics failed"
        );
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
      <section className="free-home-card">
        <UpgradePrompt
          feature="premium.analytics"
          title="Advanced learning analytics"
          description="Unlock topic mastery, learning velocity, consistency, study-plan progress, contest performance, and explainable recommendations from your real history."
        />
      </section>
    );
  }

  if (loading && !data) {
    return (
      <section className="free-home-card" aria-busy="true">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-32 w-full" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="free-home-card">
        <div className="free-home-alert" role="alert">
          {error}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </section>
    );
  }

  if (!data) {
    return (
      <EmptyState
        compact
        title="No learning analytics"
        description="Premium learning insights appear after judged submissions are recorded."
      />
    );
  }

  const ov = data.performanceOverview;
  const diff = data.difficultyDistribution;
  const vel = data.learningVelocity;
  const con = data.consistency;

  return (
    <section className="free-home-card">
      <div className="free-home-card-head">
        <h2>
          <BrainCircuit size={18} aria-hidden /> Advanced learning
        </h2>
        <span className="free-home-muted">
          {data.range} · server aggregates only
        </span>
      </div>

      <h3 className="free-home-kicker" style={{ marginTop: 12 }}>
        Performance overview
      </h3>
      <ul className="free-home-activity">
        <li>
          Submissions / accepted:{" "}
          <strong>
            {ov.totalSubmissions}/{ov.acceptedSubmissions}
          </strong>{" "}
          ({ov.acceptanceRate}%)
        </li>
        <li>
          Avg solve time (measured):{" "}
          <strong>
            {ov.avgExecutionTimeMs == null ? "—" : `${ov.avgExecutionTimeMs} ms`}
          </strong>{" "}
          · samples {ov.runtimeSampleCount}
        </li>
        <li>
          Attempts / problems solved:{" "}
          <strong>
            {ov.attempts?.totalAttempts ?? 0}/
            {ov.attempts?.problemsSolved ?? 0}
          </strong>
        </li>
        <li>
          Languages:{" "}
          {Object.keys(ov.byLanguage || {}).length
            ? Object.entries(ov.byLanguage)
                .map(([l, c]) => `${l} (${c})`)
                .join(", ")
            : "—"}
        </li>
      </ul>

      <h3 className="free-home-kicker">Topic weakness</h3>
      {data.topicWeakness.length === 0 ? (
        <p className="free-home-muted">
          {data.topicMastery.length === 0
            ? "No topic submissions recorded yet."
            : "No weak topics (need ≥2 attempts with <50% acceptance)."}
        </p>
      ) : (
        <ul className="free-home-activity">
          {data.topicWeakness.map((t) => (
            <li key={t.topic}>
              <strong>{t.topic}</strong> — {t.solvedCount}/{t.totalSubmissions}{" "}
              accepted ({pct(t.acceptanceRate)})
            </li>
          ))}
        </ul>
      )}

      <h3 className="free-home-kicker">Difficulty distribution</h3>
      <ul className="free-home-activity">
        <li>
          E / M / H:{" "}
          <strong>
            {diff.easy} / {diff.medium} / {diff.hard}
          </strong>
          {diff.total > 0
            ? ` (${pct(diff.easyPct)} / ${pct(diff.mediumPct)} / ${pct(diff.hardPct)})`
            : ""}
        </li>
      </ul>

      <h3 className="free-home-kicker">Learning velocity & consistency</h3>
      <ul className="free-home-activity">
        <li>
          Active days: <strong>{vel.activeDays}</strong> / {vel.rangeDays} ·
          accepted/day {num(vel.acceptedPerDay)}
        </li>
        <li>
          Consistency: <strong>{pct(con.consistencyRate)}</strong> (
          {con.activeDays} heatmap days in range)
        </li>
        <li>
          Submission streak: <strong>{data.streaks.submission.current}</strong>{" "}
          (max {data.streaks.submission.max}) · Challenge streak:{" "}
          <strong>{data.streaks.challenge.current}</strong>
          {data.streaks.challenge.unavailable ? " (unavailable)" : ""}
        </li>
      </ul>

      <h3 className="free-home-kicker">Study plans</h3>
      {data.studyPlanProgress.length === 0 ? (
        <p className="free-home-muted">No enrolled study plans.</p>
      ) : (
        <ul className="free-home-activity">
          {data.studyPlanProgress.map((p) => (
            <li key={p.studyPlanSlug}>
              <strong>{p.title || p.studyPlanSlug}</strong> — {p.solvedCount}/
              {p.totalProblemsCount} ({p.completionPercentage}%) · {p.status}
            </li>
          ))}
        </ul>
      )}

      <h3 className="free-home-kicker">Contest performance</h3>
      {data.contestPerformance.unavailable ? (
        <p className="free-home-muted">Contest summary unavailable.</p>
      ) : data.contestPerformance.contestsEntered === 0 ? (
        <p className="free-home-muted">No contest registrations yet.</p>
      ) : (
        <ul className="free-home-activity">
          <li>
            Contests: <strong>{data.contestPerformance.contestsEntered}</strong>{" "}
            · solved {data.contestPerformance.totalSolved} · score{" "}
            {data.contestPerformance.totalScore}
          </li>
          {data.contestPerformance.items.slice(0, 5).map((c) => (
            <li key={c.contestId}>
              {c.title || c.slug || c.contestId}: score {c.score}, solved{" "}
              {c.solvedCount}
              {c.rank != null ? `, rank ${c.rank}` : ""}
            </li>
          ))}
        </ul>
      )}

      <h3 className="free-home-kicker">Recommendations</h3>
      {data.recommendations.length === 0 ? (
        <p className="free-home-muted">
          Not enough signal for recommendations yet.
        </p>
      ) : (
        <ul className="free-home-activity">
          {data.recommendations.map((r, i) => (
            <li key={`${r.type}-${i}`}>
              <strong>{r.title}</strong>
              <br />
              <span className="free-home-muted">Evidence: {r.evidence}</span>
              <br />
              {r.action}
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        size="sm"
        variant="secondary"
        style={{ marginTop: 12 }}
        onClick={() => void load()}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        Refresh learning
      </Button>
    </section>
  );
};
