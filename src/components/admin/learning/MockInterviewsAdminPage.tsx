import { useEffect, useState, type FC } from "react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";
import { DataTable } from "../shared/DataTable";
import { StatusBadge } from "../shared/StatusBadge";
import { PageHeader } from "../shared/PageHeader";
import { problemClient } from "../../../api/problemApi";

type Overview = {
  generatedAt: string;
  overview: {
    total: number;
    completed: number;
    inProgress: number;
    timedOut: number;
    abandoned: number;
    uniqueUsers: number;
    averageOverallScore: number | null;
    averageCompletionMs: number | null;
  };
  byCompany: Array<{ company: string; count: number }>;
  byDifficulty: Array<{ difficulty: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{
    id: string;
    userId: string;
    company: string;
    role: string | null;
    difficulty?: string;
    language?: string;
    durationMinutes?: number;
    status: string;
    startedAt?: string;
    completedAt?: string | null;
    problemsTotal: number;
    overallScore: number | null;
    problemsAccepted: number | null;
  }>;
  note?: string;
};

type Detail = {
  id: string;
  userId: string;
  config: Record<string, unknown>;
  status: string;
  problemIds: string[];
  attempts: unknown[];
  startedAt: string;
  endsAt: string;
  completedAt?: string | null;
  report?: {
    overallScore?: number | null;
    problemsAccepted?: number;
    problemsTotal?: number;
    scores?: Record<string, unknown>;
  } | null;
};

export const MockInterviewsAdminPage: FC = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await problemClient.get<{ data: Overview }>(
          "/admin/interviews/overview"
        );
        if (!cancelled) setData(res.data?.data || null);
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err.message ||
              "Failed to load mock interview metrics"
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

  const openDetail = async (id: string) => {
    setDetailError("");
    try {
      const res = await problemClient.get<{ data: Detail }>(
        `/admin/interviews/${id}`
      );
      setDetail(res.data?.data || null);
    } catch (err: any) {
      setDetail(null);
      setDetailError(
        err?.response?.data?.message || err.message || "Failed to load detail"
      );
    }
  };

  const ov = data?.overview;
  const recent = data?.recent || [];

  return (
    <PermissionGuard permission="analytics:view">
      <PageHeader
        title="Mock Interviews"
        description="Real MockInterviewSession metrics — no invented analytics."
      />

      {error ? (
        <div className="admin-alert" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="admin-muted">Loading…</p>
      ) : ov ? (
        <>
          <div className="admin-stats-grid">
            <StatsCard label="Total" value={ov.total} />
            <StatsCard label="Completed" value={ov.completed} />
            <StatsCard label="In progress" value={ov.inProgress} />
            <StatsCard label="Timed out" value={ov.timedOut} />
            <StatsCard label="Abandoned" value={ov.abandoned} />
            <StatsCard label="Unique users" value={ov.uniqueUsers} />
            <StatsCard
              label="Avg score"
              value={
                ov.averageOverallScore != null
                  ? `${ov.averageOverallScore}`
                  : "—"
              }
            />
            <StatsCard
              label="Avg duration"
              value={
                ov.averageCompletionMs != null
                  ? `${Math.round(ov.averageCompletionMs / 60000)}m`
                  : "—"
              }
            />
          </div>

          <div className="admin-dash-grid" style={{ marginTop: 16 }}>
            <section className="admin-dash-panel">
              <h3>By company</h3>
              <ul className="admin-simple-list">
                {(data?.byCompany || []).map((r) => (
                  <li key={r.company}>
                    <span>{r.company}</span>
                    <strong>{r.count}</strong>
                  </li>
                ))}
                {!data?.byCompany?.length ? (
                  <li className="admin-muted">No sessions yet</li>
                ) : null}
              </ul>
            </section>
            <section className="admin-dash-panel">
              <h3>By difficulty</h3>
              <ul className="admin-simple-list">
                {(data?.byDifficulty || []).map((r) => (
                  <li key={r.difficulty}>
                    <span>{r.difficulty}</span>
                    <strong>{r.count}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section style={{ marginTop: 20 }}>
            <h3>Recent sessions</h3>
            <DataTable
              loading={loading}
              emptyTitle="No mock interviews recorded"
              emptyDescription="Sessions appear after Premium users start interviews."
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "company",
                  header: "Company",
                  render: (r) => (
                    <span>
                      {r.company}
                      {r.role ? ` · ${r.role}` : ""}
                      <br />
                      <span className="admin-muted">
                        {r.difficulty} · {r.language} · {r.durationMinutes}m
                      </span>
                    </span>
                  ),
                },
                {
                  key: "userId",
                  header: "User",
                  technical: true,
                  render: (r) => (
                    <code style={{ fontSize: 11 }}>
                      {r.userId.slice(0, 12)}…
                    </code>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <StatusBadge status={r.status} />,
                },
                {
                  key: "score",
                  header: "Score",
                  render: (r) =>
                    r.overallScore != null ? `${r.overallScore}` : "—",
                },
                {
                  key: "problems",
                  header: "Problems",
                  render: (r) =>
                    r.problemsAccepted != null
                      ? `${r.problemsAccepted}/${r.problemsTotal}`
                      : String(r.problemsTotal),
                },
                {
                  key: "started",
                  header: "Started",
                  render: (r) =>
                    r.startedAt
                      ? new Date(r.startedAt).toLocaleString()
                      : "—",
                },
                {
                  key: "actions",
                  header: "",
                  render: (r) => (
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => void openDetail(r.id)}
                    >
                      Inspect
                    </button>
                  ),
                },
              ]}
              rows={recent}
            />
          </section>

          {detailError ? (
            <div className="admin-alert" role="alert">
              {detailError}
            </div>
          ) : null}

          {detail ? (
            <section className="admin-dash-panel" style={{ marginTop: 16 }}>
              <h3>Session {detail.id}</h3>
              <p className="admin-muted">
                User {detail.userId} · {detail.status} · Score{" "}
                {detail.report?.overallScore ?? "—"} · Problems{" "}
                {detail.report?.problemsAccepted ?? 0}/
                {detail.report?.problemsTotal ?? detail.problemIds.length}
              </p>
              <pre
                style={{
                  maxHeight: 320,
                  overflow: "auto",
                  fontSize: 12,
                  background: "var(--bg-elevated, #111)",
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                {JSON.stringify(
                  {
                    config: detail.config,
                    problemIds: detail.problemIds,
                    attempts: detail.attempts,
                    startedAt: detail.startedAt,
                    endsAt: detail.endsAt,
                    completedAt: detail.completedAt,
                    report: detail.report,
                  },
                  null,
                  2
                )}
              </pre>
            </section>
          ) : null}

          {data?.note ? (
            <p className="admin-muted" style={{ marginTop: 12 }}>
              {data.note}
            </p>
          ) : null}
        </>
      ) : null}
    </PermissionGuard>
  );
};
