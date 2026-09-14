import { useCallback, useMemo, type FC } from "react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";
import { ModuleGate } from "../shared/ModuleGate";
import { adminProblemApi } from "../../../api/adminProblemApi";
import { adminSheetApi, type AdminSheet } from "../../../api/adminSheetApi";
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
    return (
      <ModuleGate
        title="Revision admin"
        description="Revision lists are per-user (ProblemRevision). Aggregate weak-topic admin views will query ProblemService engagement aggregates."
        status="backend"
      />
    );
  }

  return (
    <ModuleGate
      title="Platform learning progress"
      description="Cross-user sheet progress analytics will aggregate UserSheetProgress + UserProblemProgress. Sheet reset and import already exist on the product side."
      status="backend"
    />
  );
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
        emptyTitle="No sheets in DB yet — sync from catalog."
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
        emptyTitle="No topics found on problems."
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
