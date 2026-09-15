import { useCallback, useMemo, type FC } from "react";
import { AlertCircle, BookMarked, Layers, RotateCcw, Tags, TrendingUp } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";
import { adminProblemApi } from "../../../api/adminProblemApi";
import { adminSheetApi, type AdminSheet } from "../../../api/adminSheetApi";
import {
  adminLearningApi,
  type RevisionSummary,
  type WeakTopicRow,
} from "../../../api/adminLearningApi";
import { useEffect, useState } from "react";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";

type LearningMode = "sheets" | "topics" | "difficulty" | "revision" | "progress";

export const LearningAdminPage: FC<{ mode: LearningMode }> = ({ mode }) => {
  if (mode === "sheets") {
    return <SheetsCrudAdmin />;
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

const SheetsCrudAdmin: FC = () => {
  const [rows, setRows] = useState<AdminSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminSheetApi.list();
      const data = res.data as any;
      setRows(Array.isArray(data) ? data : data?.items || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Sheets API failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PermissionGuard permission="sheets:manage">
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() =>
            void adminSheetApi
              .syncFromCatalog()
              .then(load)
              .catch((err: any) =>
                setError(err?.response?.data?.message || "Sync failed")
              )
          }
        >
          Sync from catalog (striver-a2z)
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <DataTable
        loading={loading}
        emptyTitle="No sheets yet"
        emptyDescription="Sync from catalog to load practice sheets into the database."
        emptyIcon={<BookMarked size={18} strokeWidth={1.75} />}
        columns={[
          { key: "id", header: "Sheet ID", render: (r) => r.sheetId },
          { key: "title", header: "Title", render: (r) => r.title },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="admin-link"
                  onClick={() =>
                    void adminSheetApi
                      .preview(r.sheetId)
                      .then((res) => setPreview(res.data || res))
                  }
                >
                  Preview
                </button>
                {r.status !== "PUBLISHED" ? (
                  <button
                    type="button"
                    className="admin-link"
                    onClick={() =>
                      void adminSheetApi.publish(r.sheetId).then(load)
                    }
                  >
                    Publish
                  </button>
                ) : null}
                <button
                  type="button"
                  className="admin-link"
                  onClick={() =>
                    void adminSheetApi.archive(r.sheetId).then(load)
                  }
                >
                  Archive
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.sheetId}
      />
      {preview ? (
        <pre
          className="admin-muted"
          style={{
            marginTop: 16,
            maxHeight: 320,
            overflow: "auto",
            fontSize: 12,
          }}
        >
          {JSON.stringify(preview, null, 2)}
        </pre>
      ) : null}
    </PermissionGuard>
  );
};

const TopicsFromProblems: FC = () => {
  const [topics, setTopics] = useState<Array<{ name: string; count: number }>>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminProblemApi.list({ page: 1, limit: 200 });
        const map = new Map<string, number>();
        for (const p of res.data || []) {
          const cat = (p as any).category || "Uncategorized";
          map.set(cat, (map.get(cat) || 0) + 1);
          for (const tag of (p as any).tags || []) {
            map.set(String(tag), (map.get(String(tag)) || 0) + 1);
          }
        }
        const rows = [...map.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        if (!cancelled) setTopics(rows);
      } catch {
        if (!cancelled) setTopics([]);
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
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await adminProblemApi.list({ page: 1, limit: 200 });
        const c: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
        for (const p of res.data || []) {
          const d = String((p as any).difficulty || "").toLowerCase();
          if (d in c) c[d] += 1;
        }
        setCounts(c);
      } catch {
        setCounts({});
      }
    })();
  }, []);

  const cards = useMemo(
    () =>
      Object.entries(counts).map(([k, v]) => (
        <StatsCard key={k} label={k} value={v} />
      )),
    [counts]
  );

  return (
    <PermissionGuard permission="analytics:view">
      <div className="admin-stats-grid">{cards}</div>
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
