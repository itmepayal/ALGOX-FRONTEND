import { useMemo, type FC } from "react";
import { AlertCircle, Layers, RotateCcw, Tags, TrendingUp } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";
import { adminProblemApi } from "../../../api/adminProblemApi";
import {
  adminLearningApi,
  type RevisionSummary,
  type WeakTopicRow,
} from "../../../api/adminLearningApi";
import { useEffect, useState } from "react";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { SheetsAdminPage } from "./SheetsAdminPage";

type LearningMode = "sheets" | "topics" | "difficulty" | "revision" | "progress";

export const LearningAdminPage: FC<{ mode: LearningMode }> = ({ mode }) => {
  if (mode === "sheets") {
    return <SheetsAdminPage />;
  }

  if (mode === "topics") {
    return <TopicsFromProblems />;
  }

  if (mode === "difficulty") {
    return <DifficultyInsights />;
  }

  if (mode === "revision") {
    return <RevisionAdmin />;
  }

  return <LearningProgressAdmin />;
};

const TopicsFromProblems: FC = () => {
  const [topics, setTopics] = useState<Array<{ name: string; count: number }>>(
    []
  );
  const [status, setStatus] = useState<"all" | "published" | "draft" | "archived">(
    "all"
  );
  const [matched, setMatched] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await adminProblemApi.internalStats({ status });
        const map = res.data?.byTopic || {};
        const rows = Object.entries(map)
          .map(([name, count]) => ({ name, count: Number(count) || 0 }))
          .sort((a, b) => b.count - a.count);
        if (!cancelled) {
          setTopics(rows);
          setMatched(Number(res.data?.matchedProblems) || 0);
        }
      } catch (err: any) {
        if (!cancelled) {
          setTopics([]);
          setMatched(0);
          setError(
            err?.response?.data?.message ||
              err.message ||
              "Failed to load topic totals"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <PermissionGuard permission="problems:view">
      <div className="admin-toolbar">
        <strong>Topics / tags</strong>
        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as typeof status)
          }
          aria-label="Problem status filter"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <span className="admin-muted">
          {matched} problem{matched === 1 ? "" : "s"} in filter
        </span>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle="No topics found"
        emptyDescription="Topics and tags appear once problems are categorized."
        emptyIcon={<Tags size={18} strokeWidth={1.75} />}
        columns={[
          { key: "name", header: "Topic / Tag", render: (r) => r.name },
          { key: "count", header: "Problems", render: (r) => r.count },
        ]}
        rows={topics}
        rowKey={(r) => r.name}
      />
    </PermissionGuard>
  );
};

const DifficultyInsights: FC = () => {
  const [counts, setCounts] = useState<Record<string, number>>({
    easy: 0,
    medium: 0,
    hard: 0,
  });
  const [status, setStatus] = useState<"all" | "published" | "draft" | "archived">(
    "all"
  );
  const [matched, setMatched] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await adminProblemApi.internalStats({ status });
        if (!cancelled) {
          setCounts({
            easy: Number(res.data?.byDifficulty?.easy) || 0,
            medium: Number(res.data?.byDifficulty?.medium) || 0,
            hard: Number(res.data?.byDifficulty?.hard) || 0,
          });
          setMatched(Number(res.data?.matchedProblems) || 0);
        }
      } catch (err: any) {
        if (!cancelled) {
          setCounts({ easy: 0, medium: 0, hard: 0 });
          setMatched(0);
          setError(
            err?.response?.data?.message ||
              err.message ||
              "Failed to load difficulty totals"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const cards = useMemo(
    () =>
      Object.entries(counts).map(([k, v]) => (
        <StatsCard key={k} label={k} value={loading ? "…" : v} />
      )),
    [counts, loading]
  );

  const empty =
    !loading &&
    !error &&
    matched === 0 &&
    counts.easy + counts.medium + counts.hard === 0;

  return (
    <PermissionGuard permission="analytics:view">
      <div className="admin-toolbar">
        <strong>Difficulty distribution</strong>
        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as typeof status)
          }
          aria-label="Problem status filter"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <span className="admin-muted">
          {matched} problem{matched === 1 ? "" : "s"} in filter
        </span>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {empty ? (
        <p className="admin-muted">No problems match this filter.</p>
      ) : (
        <div className="admin-stats-grid">{cards}</div>
      )}
    </PermissionGuard>
  );
};

const RevisionAdmin: FC = () => {
  const [summary, setSummary] = useState<RevisionSummary | null>(null);
  const [weak, setWeak] = useState<WeakTopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [rev, weakRes] = await Promise.all([
          adminLearningApi.revisionSummary({ limit: 40 }),
          adminLearningApi.weakTopics(),
        ]);
        if (!cancelled) {
          setSummary(rev.data ?? null);
          setWeak(Array.isArray(weakRes.data) ? weakRes.data : []);
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              "Learning APIs unavailable — start ProblemService"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PermissionGuard permission="problems:view">
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-stats-grid" style={{ marginBottom: 16 }}>
        <StatsCard
          label="Total revisions"
          value={summary?.totalRevisions ?? "—"}
        />
        <StatsCard
          label="Users with revision"
          value={summary?.usersWithRevision ?? "—"}
        />
      </div>
      <h3>Top revision problems</h3>
      <DataTable
        loading={loading}
        emptyTitle="No revision data yet"
        emptyDescription="Top revision problems will appear as users mark items for review."
        emptyIcon={<RotateCcw size={18} strokeWidth={1.75} />}
        columns={[
          { key: "title", header: "Problem", render: (r) => r.title },
          { key: "diff", header: "Difficulty", render: (r) => r.difficulty },
          {
            key: "count",
            header: "Revision count",
            render: (r) => r.revisionCount,
          },
        ]}
        rows={summary?.topProblems || []}
        rowKey={(r) => r.problemId}
      />
      <h3 style={{ marginTop: 20 }}>Weak topics</h3>
      <DataTable
        loading={loading}
        emptyTitle="No weak topics yet"
        emptyDescription="Topics need at least 5 attempts with under 40% solve rate."
        emptyIcon={<AlertCircle size={18} strokeWidth={1.75} />}
        columns={[
          { key: "topic", header: "Topic", render: (r) => r.topic },
          { key: "att", header: "Attempted", render: (r) => r.attempted },
          { key: "sol", header: "Solved", render: (r) => r.solved },
          { key: "rate", header: "Solve %", render: (r) => r.solveRate },
          {
            key: "rev",
            header: "Revision hints",
            render: (r) => r.revisionHints,
          },
        ]}
        rows={weak}
        rowKey={(r) => r.topic}
      />
    </PermissionGuard>
  );
};

const LearningProgressAdmin: FC = () => {
  const [sheets, setSheets] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [sheetRes, topicRes] = await Promise.all([
          adminLearningApi.sheetProgress(),
          adminLearningApi.topicEngagement(),
        ]);
        if (!cancelled) {
          setSheets(sheetRes.data || []);
          setTopics(topicRes.data || []);
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              "Learning progress APIs unavailable"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PermissionGuard permission="analytics:view">
      {error ? <p className="admin-error">{error}</p> : null}
      <h3>Sheet progress</h3>
      <DataTable
        loading={loading}
        emptyTitle="No sheet progress yet"
        emptyDescription="Progress appears once users start working through sheets."
        emptyIcon={<Layers size={18} strokeWidth={1.75} />}
        columns={[
          { key: "title", header: "Sheet", render: (r) => r.title },
          { key: "users", header: "Users", render: (r) => r.usersWithProgress },
          {
            key: "avg",
            header: "Avg completed",
            render: (r) => r.avgCompleted,
          },
          {
            key: "pct",
            header: "Completion %",
            render: (r) => `${r.completionPct}%`,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
        ]}
        rows={sheets}
        rowKey={(r) => r.sheetId}
      />
      <h3 style={{ marginTop: 20 }}>Topic engagement</h3>
      <DataTable
        loading={loading}
        emptyTitle="No topic engagement yet"
        emptyDescription="Engagement stats populate as users attempt tagged problems."
        emptyIcon={<TrendingUp size={18} strokeWidth={1.75} />}
        columns={[
          { key: "topic", header: "Topic", render: (r) => r.topic },
          {
            key: "problems",
            header: "Problems",
            render: (r) => r.problemCount,
          },
          { key: "att", header: "Attempted", render: (r) => r.attempted },
          { key: "sol", header: "Solved", render: (r) => r.solved },
          { key: "rate", header: "Solve %", render: (r) => r.solveRate },
        ]}
        rows={topics}
        rowKey={(r) => r.topic}
      />
    </PermissionGuard>
  );
};
