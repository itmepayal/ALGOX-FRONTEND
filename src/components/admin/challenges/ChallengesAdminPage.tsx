import { useCallback, useEffect, useState, type FC, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  adminChallengeApi,
  type AdminDailyChallenge,
  type ChallengeTier,
} from "../../../api/adminChallengeApi";
import { adminProblemApi, type AdminProblem } from "../../../api/adminProblemApi";
import { usePermission } from "../../../rbac/usePermission";
import { useToast } from "../../../context/ToastContext";
import "./daily-challenges.css";

function todayKeyUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Daily Challenge CMS — date picker + problem assignment.
 * Backend: PUT /challenges/admin/:dateKey (problems:update|create).
 */
export const ChallengesAdminPage: FC = () => {
  const { can } = usePermission();
  const toast = useToast();
  const canEdit = can("problems:update") || can("problems:create");

  const [dateKey, setDateKey] = useState(todayKeyUtc());
  const [problemId, setProblemId] = useState("");
  const [tier, setTier] = useState<ChallengeTier>("standard");
  const [isPublished, setIsPublished] = useState(true);
  const [current, setCurrent] = useState<AdminDailyChallenge | null>(null);
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [problemSearch, setProblemSearch] = useState("");

  const loadProblems = useCallback(async () => {
    try {
      const res = await adminProblemApi.list({
        page: 1,
        limit: 50,
        status: "published",
        search: problemSearch || undefined,
      });
      setProblems(res.data || []);
    } catch {
      setProblems([]);
    }
  }, [problemSearch]);

  const loadChallenge = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      setError("dateKey must be YYYY-MM-DD");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await adminChallengeApi.getByDate(dateKey);
      const data = res.data || null;
      setCurrent(data);
      if (data?.problemId) setProblemId(String(data.problemId));
      if (data?.tier) setTier(data.tier);
      if (data) setIsPublished(data.isPublished !== false);
    } catch (err: any) {
      setCurrent(null);
      // 404 = no challenge for date yet
      if (err?.response?.status !== 404) {
        setError(err?.response?.data?.message || err.message || "Load failed");
      }
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  useEffect(() => {
    void loadProblems();
  }, [loadProblems]);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!problemId.trim()) {
      toast.warning("Select a problem");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await adminChallengeApi.upsert(dateKey, {
        problemId: problemId.trim(),
        tier,
        isPublished,
      });
      setCurrent(res.data || null);
      toast.success("Daily challenge saved");
      await loadChallenge();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Save failed";
      setError(msg);
      toast.apiError(err, msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PermissionGuard
      permission={["problems:view", "problems:update", "problems:create"]}
      fallback={<div className="admin-denied">No problems permission.</div>}
    >
      <div className="admin-daily-challenges-page">
        <div className="admin-daily-challenges-header">
          <div>
            <p className="admin-page-lead">
              Assign and manage the canonical daily coding challenge for each UTC date.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void loadChallenge()}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="spin" /> : "Reload"}
          </Button>
        </div>

        <form onSubmit={(e) => void onSave(e)} className="admin-daily-challenge-card">
          <div className="admin-daily-challenge-card-head">
            <h3 className="admin-daily-challenge-card-title">Daily challenge configuration</h3>
            <p className="admin-daily-challenge-card-sub">
              Assign the canonical problem for the selected UTC date.
            </p>
          </div>

          <div className="admin-daily-challenge-top-grid">
            <div className="admin-daily-challenge-field">
              <label htmlFor="ch-date">Date (UTC)</label>
              <Input
                id="ch-date"
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                disabled={!canEdit || saving}
                style={{ maxWidth: 320 }}
              />
              <span className="field-hint">Challenge assignment is evaluated using UTC.</span>
            </div>

            <div className="admin-daily-current-box">
              <div className="admin-daily-current-label">Current Challenge</div>
              {current ? (
                <>
                  <div className="admin-daily-current-title">{current.title || "Untitled"}</div>
                  {current.problemSlug && (
                    <div className="admin-daily-current-slug">{current.problemSlug}</div>
                  )}
                  <div className="admin-daily-current-meta">
                    <StatusBadge status={current.isPublished ? "published" : "draft"} />
                    <span className="admin-daily-tier-tag">Tier: {current.tier || "standard"}</span>
                  </div>
                </>
              ) : (
                <div className="admin-muted" style={{ fontSize: "0.875rem", fontStyle: "italic", paddingTop: 4 }}>
                  No challenge assigned for this date.
                </div>
              )}
            </div>
          </div>

          <div className="admin-daily-challenge-field">
            <label htmlFor="ch-search">Find published problem</label>
            <Input
              id="ch-search"
              value={problemSearch}
              placeholder="Search title..."
              onChange={(e) => setProblemSearch(e.target.value)}
              disabled={!canEdit}
              style={{ maxWidth: "60%" }}
            />
            <span className="field-hint">Search from published problems only.</span>
          </div>

          <div className="admin-daily-challenge-field">
            <label htmlFor="ch-problem">Problem</label>
            <select
              id="ch-problem"
              className="admin-input"
              value={problemId}
              onChange={(e) => setProblemId(e.target.value)}
              disabled={!canEdit || saving}
            >
              <option value="">Select problem…</option>
              {problems.map((p) => {
                const id = p.id || (p as any)._id;
                return (
                  <option key={id} value={id}>
                    {p.title} ({p.difficulty}) — {p.slug}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="admin-daily-challenge-bottom-grid">
            <div className="admin-daily-challenge-field">
              <label htmlFor="ch-tier">Tier</label>
              <select
                id="ch-tier"
                className="admin-input"
                value={tier}
                onChange={(e) => setTier(e.target.value as ChallengeTier)}
                disabled={!canEdit || saving}
              >
                <option value="standard">standard</option>
                <option value="advanced">advanced</option>
              </select>
            </div>

            <div className="admin-daily-challenge-field">
              <label htmlFor="ch-published">Published</label>
              <label className="admin-daily-checkbox-label">
                <input
                  id="ch-published"
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  disabled={!canEdit || saving}
                />
                Published
              </label>
            </div>
          </div>

          <div className="admin-daily-challenge-footer">
            <div className="admin-daily-footer-status">
              {error ? <p className="admin-error" style={{ margin: 0 }}>{error}</p> : null}
            </div>
            {canEdit ? (
              <Button type="submit" disabled={saving || !problemId}>
                {saving ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Save size={14} />
                )}
                <span style={{ marginLeft: 6 }}>Save challenge</span>
              </Button>
            ) : (
              <p className="admin-muted" style={{ margin: 0 }}>
                Requires <code>problems:update</code> or <code>problems:create</code>
              </p>
            )}
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
};
