import { useEffect, useState, type FC } from "react";
import { Code2, Shield, TrendingUp } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatsCard } from "../shared/StatsCard";
import { DataTable } from "../shared/DataTable";
import { adminAnalyticsApi } from "../../../api/adminAnalyticsApi";

type UserAnalyticsOverview = {
  totalUsers?: number;
  dau?: number;
  wau?: number;
  mau?: number;
  newUsersInRange?: number;
  suspendedUsers?: number;
  bannedUsers?: number;
  staffUsers?: number;
  byRole?: Record<string, number>;
  growth?: Array<{ date: string; count: number }>;
};

export const UserAnalyticsPage: FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserAnalyticsOverview | null>(null);
  const [growth, setGrowth] = useState<Array<{ date: string; count: number }>>(
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const bundle = await adminAnalyticsApi.loadDashboard("30d");
        const overview = bundle.overview || {};
        const charts = bundle.charts || {};
        if (!cancelled) {
          setUsers(overview.users || {});
          setGrowth(
            charts.userGrowth || overview.users?.growth || []
          );
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load user analytics");
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
      {loading ? <p className="admin-muted">Loading…</p> : null}
      <div className="admin-stats-grid">
        <StatsCard label="Total users" value={users?.totalUsers ?? "—"} />
        <StatsCard label="Active (DAU)" value={users?.dau ?? "—"} />
        <StatsCard label="WAU" value={users?.wau ?? "—"} />
        <StatsCard label="MAU" value={users?.mau ?? "—"} />
        <StatsCard
          label="New (range)"
          value={users?.newUsersInRange ?? "—"}
        />
        <StatsCard label="Suspended" value={users?.suspendedUsers ?? "—"} />
        <StatsCard label="Banned" value={users?.bannedUsers ?? "—"} />
        <StatsCard label="Staff" value={users?.staffUsers ?? "—"} />
      </div>
      <h3 style={{ marginTop: 20 }}>Registration growth</h3>
      <DataTable
        loading={loading}
        emptyTitle="No growth series yet"
        emptyDescription="Daily registration counts will appear once users sign up."
        emptyIcon={<TrendingUp size={18} strokeWidth={1.75} />}
        columns={[
          { key: "date", header: "Date", render: (r) => r.date },
          { key: "count", header: "Registrations", render: (r) => r.count },
        ]}
        rows={growth}
        rowKey={(r) => r.date}
      />
      {users?.byRole ? (
        <>
          <h3 style={{ marginTop: 20 }}>By role</h3>
          <DataTable
            emptyTitle="No role breakdown"
            emptyDescription="Role counts appear when user analytics load successfully."
            emptyIcon={<Shield size={18} strokeWidth={1.75} />}
            columns={[
              { key: "role", header: "Role", render: (r) => r.role },
              { key: "count", header: "Count", render: (r) => r.count },
            ]}
            rows={Object.entries(users.byRole).map(([role, count]) => ({
              role,
              count,
            }))}
            rowKey={(r) => r.role}
          />
        </>
      ) : null}
    </PermissionGuard>
  );
};

export const LanguageAnalyticsPage: FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [byLanguage, setByLanguage] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const bundle = await adminAnalyticsApi.loadDashboard("30d");
        const overview = bundle.overview || {};
        const charts = bundle.charts || {};
        const langs =
          charts.languageUsage ||
          overview.submissions?.byLanguage ||
          {};
        if (!cancelled) {
          setByLanguage(langs);
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = Object.entries(byLanguage)
    .map(([language, count]) => ({ language, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count);

  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <PermissionGuard permission="analytics:view">
      {error ? <p className="admin-error">{error}</p> : null}
      <p className="admin-page-lead">
        Language usage from real submissions (Python, C++, JavaScript, Java,
        TypeScript, and others present in data).
      </p>
      <div className="admin-stats-grid">
        <StatsCard label="Total coded submissions" value={total || "—"} />
        <StatsCard label="Languages seen" value={rows.length || "—"} />
      </div>
      <DataTable
        loading={loading}
        emptyTitle="No language stats yet"
        emptyDescription="Language usage populates as coded submissions arrive."
        emptyIcon={<Code2 size={18} strokeWidth={1.75} />}
        columns={[
          { key: "language", header: "Language", render: (r) => r.language },
          { key: "count", header: "Submissions", render: (r) => r.count },
          {
            key: "pct",
            header: "Share",
            render: (r) =>
              total > 0 ? `${Math.round((r.count / total) * 1000) / 10}%` : "—",
          },
        ]}
        rows={rows}
        rowKey={(r) => r.language}
      />
    </PermissionGuard>
  );
};
