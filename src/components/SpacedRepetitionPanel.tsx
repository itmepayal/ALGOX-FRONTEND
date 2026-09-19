import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  srsApi,
  type SrsCard,
  type SrsFeedback,
  type SrsImportCandidate,
  type SrsQueuePayload,
} from "../api/srsApi";
import { problemApi } from "../api/problemApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { PremiumBadge } from "./access/PremiumBadge";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/cn";
import "./submission-analytics.css";
import "./revision-queue.css";

interface Props {
  refreshKey?: number;
  onOpenProblem?: (problemId: string) => void;
}

type BucketTab = "due" | "overdue" | "upcoming" | "completed" | "all";

type DiffFilter = "all" | "easy" | "medium" | "hard";

function fmtTodayLabel(dayKey: string) {
  if (!dayKey) return "—";
  try {
    const [y, m, d] = dayKey.split("-").map(Number);
    if (!y || !m || !d) return dayKey;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dayKey;
  }
}

function fmtDate(iso: string | null | undefined, timeZone?: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

function fmtIntervalLabel(days: number) {
  const d = Math.max(0, Math.floor(Number(days) || 0));
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

function statusForCard(
  card: SrsCard,
  buckets: SrsQueuePayload["buckets"] | undefined
): "due" | "overdue" | "upcoming" | "completed" {
  if (card.status === "graduated" || card.status === "paused") return "completed";
  if (!buckets) return "upcoming";
  if (buckets.overdue.some((c) => c.id === card.id)) return "overdue";
  if (buckets.dueToday.some((c) => c.id === card.id)) return "due";
  if (buckets.upcoming.some((c) => c.id === card.id)) return "upcoming";
  if (buckets.completed.some((c) => c.id === card.id)) return "completed";
  return "upcoming";
}

function statusLabel(s: "due" | "overdue" | "upcoming" | "completed") {
  switch (s) {
    case "due":
      return "Due today";
    case "overdue":
      return "Overdue";
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
  }
}

function titleOf(card: SrsCard) {
  const t = String(card.title || "").trim();
  return t || "Untitled problem";
}

function tagsOf(card: SrsCard) {
  return Array.isArray(card.tags)
    ? card.tags.map((t) => String(t)).filter(Boolean).slice(0, 4)
    : [];
}

export const SpacedRepetitionPanel: FC<Props> = ({
  refreshKey = 0,
  onOpenProblem,
}) => {
  const { user } = useAuth();
  const premium = canAccess(user, "premium.spaced_repetition");

  const [queue, setQueue] = useState<SrsQueuePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [bucket, setBucket] = useState<BucketTab>("due");
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [tzDraft, setTzDraft] = useState("UTC");
  const [tzSaving, setTzSaving] = useState(false);
  const [tzSavedNote, setTzSavedNote] = useState("");
  const [todayKey, setTodayKey] = useState("");
  const [delayDays, setDelayDays] = useState(3);
  const [enrollQuery, setEnrollQuery] = useState("");
  const [enrollResults, setEnrollResults] = useState<
    Array<{ id: string; title: string; difficulty: string; tags: string[] }>
  >([]);
  const [enrollSearching, setEnrollSearching] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [lastScheduleNote, setLastScheduleNote] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importItems, setImportItems] = useState<SrsImportCandidate[]>([]);
  const [importSelected, setImportSelected] = useState<Set<string>>(
    () => new Set()
  );
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      setError("");
      if (opts?.soft) setRefreshing(true);
      else setLoading(true);
      try {
        const tz = await srsApi.getTimezone();
        const z = tz.data?.timezone || "UTC";
        setTimezone(z);
        setTzDraft(z);
      } catch {
        /* keep prior timezone */
      }
      try {
        const q = await srsApi.getQueue(
          bucket === "due"
            ? "due_today"
            : bucket === "all"
              ? undefined
              : bucket
        );
        setQueue(q.data ?? null);
        if (q.data?.todayKey) setTodayKey(q.data.todayKey);
        if (q.data?.timezone) {
          setTimezone(q.data.timezone);
          setTzDraft(q.data.timezone);
        }
      } catch {
        setQueue(null);
        setError("Unable to load your revision queue.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bucket]
  );

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const counts = queue?.counts;
  const tz = queue?.timezone || timezone;
  const dayKey = queue?.todayKey || todayKey;

  const reviewQueue = useMemo(() => {
    const overdue = queue?.buckets.overdue || [];
    const due = queue?.buckets.dueToday || [];
    return [...overdue, ...due];
  }, [queue]);

  const nextCard = reviewQueue[0] || null;
  const focusCard =
    (focusCardId
      ? reviewQueue.find((c) => c.id === focusCardId) ||
        (queue?.items || []).find((c) => c.id === focusCardId)
      : null) || nextCard;

  const list = useMemo(() => {
    const raw =
      bucket === "all"
        ? [
            ...(queue?.buckets.overdue || []),
            ...(queue?.buckets.dueToday || []),
            ...(queue?.buckets.upcoming || []),
          ]
        : bucket === "due"
          ? queue?.buckets.dueToday || []
          : bucket === "overdue"
            ? queue?.buckets.overdue || []
            : bucket === "upcoming"
              ? queue?.buckets.upcoming || []
              : queue?.buckets.completed || [];

    const q = search.trim().toLowerCase();
    return raw.filter((card) => {
      if (diffFilter !== "all" && card.difficulty !== diffFilter) return false;
      if (!q) return true;
      const hay = `${titleOf(card)} ${tagsOf(card).join(" ")} ${card.problemId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bucket, queue, diffFilter, search]);

  const rate = async (card: SrsCard, feedback: SrsFeedback) => {
    if (busyId) return;
    setBusyId(card.problemId);
    setError("");
    setLastScheduleNote("");
    try {
      const res = await srsApi.review(card.problemId, feedback);
      const s = res.data?.schedule;
      if (s && !s.duplicate) {
        setLastScheduleNote(
          `${feedback === "hard" ? "Hard" : feedback === "okay" ? "Okay" : "Easy"} · next review ${fmtDate(String(s.nextReviewAt), tz)} (${s.intervalDays}d)`
        );
      }
      const idx = reviewQueue.findIndex((c) => c.id === card.id);
      const following = reviewQueue[idx + 1];
      setFocusCardId(following?.id || null);
      await load({ soft: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Your review couldn't be saved. Please try again."
      );
    } finally {
      setBusyId("");
    }
  };

  const saveTz = async () => {
    setError("");
    setTzSavedNote("");
    setTzSaving(true);
    try {
      const res = await srsApi.setTimezone(tzDraft.trim());
      setTimezone(res.data.timezone);
      setTzDraft(res.data.timezone);
      setTzSavedNote(`Saved · ${res.data.timezone}`);
      await load({ soft: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not save timezone. Use a valid IANA name like Asia/Kolkata."
      );
    } finally {
      setTzSaving(false);
    }
  };

  const reschedule = async (card: SrsCard) => {
    if (!premium || busyId) return;
    setBusyId(card.problemId);
    setError("");
    try {
      await srsApi.reschedule(card.problemId, { delayDays });
      await load({ soft: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Reschedule failed"
      );
    } finally {
      setBusyId("");
    }
  };

  const setCardStatus = async (
    card: SrsCard,
    status: "active" | "paused" | "graduated"
  ) => {
    if (busyId) return;
    setBusyId(card.problemId);
    setError("");
    try {
      await srsApi.setStatus(card.problemId, status);
      await load({ soft: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Status update failed"
      );
    } finally {
      setBusyId("");
    }
  };

  const openImport = async () => {
    setImportOpen(true);
    setImportLoading(true);
    setError("");
    try {
      const res = await srsApi.listImportCandidates();
      const items = res.data?.items || [];
      setImportItems(items);
      setImportSelected(
        new Set(items.filter((i) => !i.enrolled).map((i) => i.problemId))
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not load solved problems"
      );
      setImportItems([]);
    } finally {
      setImportLoading(false);
    }
  };

  const runImportSelected = async () => {
    const ids = [...importSelected].filter((id) => {
      const row = importItems.find((i) => i.problemId === id);
      return row && !row.enrolled;
    });
    if (ids.length === 0) {
      setSyncNote("All selected problems are already in your queue.");
      return;
    }
    setSyncBusy(true);
    setError("");
    setSyncNote("");
    try {
      const res = await srsApi.syncFromSolved(ids);
      const d = res.data;
      setSyncNote(
        d
          ? `Imported ${d.created} new card(s) · ${d.existing} already enrolled · scanned ${d.scanned}`
          : "Import completed"
      );
      setImportOpen(false);
      setBucket("due");
      await load({ soft: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Import failed"
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const searchEnroll = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = enrollQuery.trim();
    if (!q) return;
    setEnrollSearching(true);
    setError("");
    try {
      // ObjectId paste → direct enroll candidate
      if (/^[a-f\d]{24}$/i.test(q)) {
        const one = await problemApi.getProblemById(q);
        const p = one.data;
        if (p) {
          setEnrollResults([
            {
              id: String(p.id || p._id || q),
              title: p.title,
              difficulty: String(p.difficulty || "medium").toLowerCase(),
              tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
            },
          ]);
        } else {
          setEnrollResults([]);
        }
      } else {
        const res = await problemApi.getProblems({
          search: q,
          limit: 8,
          page: 1,
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        setEnrollResults(
          rows.map((p) => ({
            id: String(p.id || p._id || ""),
            title: p.title,
            difficulty: String(p.difficulty || "medium").toLowerCase(),
            tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
          })).filter((r) => r.id)
        );
      }
    } catch (err: any) {
      setEnrollResults([]);
      setError(
        err?.response?.data?.message || err?.message || "Problem search failed"
      );
    } finally {
      setEnrollSearching(false);
    }
  };

  const enrollProblem = async (problemId: string) => {
    if (!problemId || busyId) return;
    setBusyId(problemId);
    setError("");
    try {
      const res = await srsApi.enroll(problemId);
      setSyncNote(
        res.data?.duplicate
          ? "Already in your revision queue."
          : "Problem added to your revision queue."
      );
      setEnrollQuery("");
      setEnrollResults([]);
      await load({ soft: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Enroll failed");
    } finally {
      setBusyId("");
    }
  };

  const startReview = (preferOverdue = false) => {
    const card = preferOverdue
      ? queue?.buckets.overdue?.[0] || nextCard
      : nextCard;
    if (!card) {
      void openImport();
      return;
    }
    setFocusCardId(card.id);
    setBucket(preferOverdue && (counts?.overdue || 0) > 0 ? "overdue" : "due");
    onOpenProblem?.(card.problemId);
  };

  if (loading && !queue) {
    return (
      <div className="co-page ax-page rq-page" aria-busy="true">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-3 h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <div className="ax-summary ax-summary-4" style={{ marginTop: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="mt-3 h-40 w-full" />
        <Skeleton className="mt-3 h-56 w-full" />
      </div>
    );
  }

  const rules = queue?.algorithm?.rules;
  const loadToday = queue?.reviewLoad?.today ?? (counts?.dueToday || 0) + (counts?.overdue || 0);
  const hasAnyCards = (counts?.active || 0) + (counts?.completed || 0) > 0;

  return (
    <div className="co-page ax-page rq-page">
      <header className="ax-header">
        <div className="rq-header-main">
          <p className="ax-kicker">Spaced repetition</p>
          <h1 className="co-title">
            <RotateCcw size={22} aria-hidden className="ax-icon" />
            Revision Queue
          </h1>
          <p className="ax-lede">
            Master problems through spaced repetition. Your review schedule is
            calculated server-side from your previous feedback.
          </p>
          <div className="ax-trust-row">
            <span
              className="ax-badge"
              title="Review schedules and due dates are calculated on the server."
            >
              <CheckCircle2 size={12} aria-hidden />
              Server-authoritative
            </span>
            <span className="ax-meta">
              Today · {fmtTodayLabel(dayKey || "")}
              {tz ? ` · ${tz}` : ""}
            </span>
            <button
              type="button"
              className="ax-info-btn"
              title="Review schedules and due dates are calculated on the server and are independent of your device clock."
              aria-label="How scheduling authority works"
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
            disabled={refreshing || loading}
            onClick={() => void load({ soft: true })}
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

      {error ? (
        <div className="ax-alert" role="alert">
          <AlertCircle size={16} aria-hidden />
          <div>
            <strong>
              {error === "Unable to load your revision queue."
                ? "Unable to load your revision queue"
                : "Something went wrong"}
            </strong>
            <p>
              {error === "Unable to load your revision queue."
                ? "Your schedule is safe. Please try again."
                : error}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void load({ soft: true })}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {lastScheduleNote ? (
        <p className="rq-ok" role="status">
          <CheckCircle2 size={14} aria-hidden />
          {lastScheduleNote}
        </p>
      ) : null}
      {syncNote ? (
        <p className="rq-ok" role="status">
          {syncNote}
        </p>
      ) : null}

      <div className="ax-layout">
        <section className="co-panel ax-panel" aria-label="Overview">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">Overview</p>
              <h2 className="ax-section-title">Current revision queue</h2>
              <p className="ax-section-meta">
                Due, overdue, upcoming, and completed counts from the server.
              </p>
            </div>
          </div>
          <div className="ax-summary ax-summary-4">
            {(
              [
                ["Due today", counts?.dueToday ?? 0, "Ready to review", "due"],
                ["Overdue", counts?.overdue ?? 0, "Needs attention", "overdue"],
                ["Upcoming", counts?.upcoming ?? 0, "Next reviews", "upcoming"],
                ["Completed", counts?.completed ?? 0, "Reviewed", "completed"],
              ] as const
            ).map(([label, value, hint, key]) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "ax-stat",
                  key === "overdue" && "ax-stat--overdue",
                  bucket === (key === "due" ? "due" : key) && "is-active"
                )}
                onClick={() =>
                  setBucket(key === "due" ? "due" : (key as BucketTab))
                }
              >
                <span className="ax-stat-label">{label}</span>
                <strong className="ax-stat-value">{value}</strong>
                <span className="ax-stat-hint">{hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="co-panel ax-panel rq-hero" aria-label="Today's review">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">Focus</p>
              <h2 className="ax-section-title">Today&apos;s Review</h2>
              <p className="ax-section-meta">
                Prioritize overdue cards first, followed by today&apos;s
                scheduled reviews.
              </p>
            </div>
            <div className="rq-cta-row">
              {(counts?.dueToday || 0) + (counts?.overdue || 0) > 0 ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => startReview(false)}
                  >
                    Start Review
                  </Button>
                  {(counts?.overdue || 0) > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => startReview(true)}
                    >
                      Review Overdue
                    </Button>
                  ) : null}
                </>
              ) : (counts?.upcoming || 0) > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setBucket("upcoming")}
                >
                  Preview Upcoming
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => void openImport()}
                >
                  Import solved problems
                </Button>
              )}
            </div>
          </div>

        {focusCard && ((counts?.dueToday || 0) + (counts?.overdue || 0) > 0) ? (
          <div className="rq-next">
            <div className="rq-next-main">
              <p className="rq-kicker">
                Today&apos;s next review
                {reviewQueue.length > 1
                  ? ` · ${Math.min(
                      reviewQueue.findIndex((c) => c.id === focusCard.id) + 1,
                      reviewQueue.length
                    )} of ${reviewQueue.length}`
                  : ""}
              </p>
              <h3 className="rq-next-title">{titleOf(focusCard)}</h3>
              <div className="rq-chip-row">
                <span className={`rq-diff rq-diff--${focusCard.difficulty}`}>
                  {focusCard.difficulty}
                </span>
                {tagsOf(focusCard).map((t) => (
                  <span key={t} className="rq-chip">
                    {t}
                  </span>
                ))}
                <span
                  className={`rq-status rq-status--${statusForCard(focusCard, queue?.buckets)}`}
                >
                  {statusLabel(statusForCard(focusCard, queue?.buckets))}
                </span>
              </div>
            </div>
            <div className="rq-next-actions">
              {onOpenProblem ? (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => onOpenProblem(focusCard.problemId)}
                >
                  Review
                </Button>
              ) : null}
            </div>
            {focusCard.status !== "paused" &&
            focusCard.status !== "graduated" ? (
              <div className="rq-feedback" aria-label="How did this feel?">
                <p className="rq-feedback-label">How did this feel?</p>
                <div className="rq-feedback-grid">
                  {(["hard", "okay", "easy"] as SrsFeedback[]).map((f) => {
                    const preview = focusCard.feedbackPreview?.[f];
                    return (
                      <button
                        key={f}
                        type="button"
                        className={`rq-fb rq-fb--${f}`}
                        disabled={busyId === focusCard.problemId}
                        onClick={() => void rate(focusCard, f)}
                      >
                        <strong>
                          {f === "hard" ? "Hard" : f === "okay" ? "Okay" : "Easy"}
                        </strong>
                        <span>
                          {preview
                            ? fmtIntervalLabel(preview.intervalDays)
                            : f === "hard"
                              ? "Sooner"
                              : f === "okay"
                                ? "Standard"
                                : "Later"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="rq-feedback-note">
                  Intervals shown are calculated by the server from your current
                  card state{premium ? " (premium rules)" : ""}.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            compact
            icon={<RotateCcw size={18} strokeWidth={1.75} aria-hidden />}
            title={
              hasAnyCards
                ? "You're all caught up"
                : "No reviews scheduled yet"
            }
            description={
              hasAnyCards
                ? "No overdue or due-today reviews right now. Check Upcoming or grow your queue."
                : "Your revision queue is ready for your next accepted solve. Accepted solutions are automatically scheduled for review. You can also import older solved problems."
            }
            action={
              <div className="rq-empty-actions">
                {!hasAnyCards || (counts?.upcoming || 0) === 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => void openImport()}
                  >
                    Import solved problems
                  </Button>
                ) : null}
                {(counts?.upcoming || 0) > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setBucket("upcoming")}
                  >
                    View upcoming
                  </Button>
                ) : null}
              </div>
            }
          />
        )}
      </section>

      <section className="co-panel ax-panel" aria-label="Review queue">
        <div className="ax-section-head">
          <div>
            <p className="ax-kicker">Queue</p>
            <h2 className="ax-section-title">Revision queue</h2>
            <p className="ax-section-meta">
              Browse due, overdue, upcoming, and completed cards.
            </p>
          </div>
        </div>

        <div className="ax-filters">
          <div className="ax-filter-row">
            <span className="ax-filter-label">Status</span>
            <div className="ax-chips" role="tablist" aria-label="Revision buckets">
              {(
                [
                  ["due", "Due", counts?.dueToday ?? 0],
                  ["overdue", "Overdue", counts?.overdue ?? 0],
                  ["upcoming", "Upcoming", counts?.upcoming ?? 0],
                  ["completed", "Completed", counts?.completed ?? 0],
                  ["all", "All", counts?.active ?? 0],
                ] as const
              ).map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={bucket === id}
                  className={cn("ax-chip", bucket === id && "ax-chip-active")}
                  onClick={() => setBucket(id)}
                >
                  {label}
                  <span className="rq-tab-count">{n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ax-filter-row">
            <span className="ax-filter-label">Difficulty</span>
            <div className="ax-chips" role="group" aria-label="Difficulty">
              {(
                [
                  ["all", "All"],
                  ["easy", "Easy"],
                  ["medium", "Medium"],
                  ["hard", "Hard"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "ax-chip",
                    diffFilter === id && "ax-chip-active"
                  )}
                  aria-pressed={diffFilter === id}
                  onClick={() => setDiffFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="rq-search rq-search--inline">
              <Search size={14} aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or topic"
                aria-label="Search revision cards"
              />
            </label>
          </div>
        </div>

        {list.length === 0 ? (
          !hasAnyCards ? (
            <p className="ax-empty-line" role="status">
              No cards in this filter yet.
            </p>
          ) : (
            <div className="rq-filter-empty-block">
              <p className="ax-empty-line" role="status">
                No cards match the current filter.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setBucket("due");
                  setDiffFilter("all");
                  setSearch("");
                }}
              >
                View Today&apos;s Review
              </Button>
            </div>
          )
        ) : (
          <ul className="rq-card-list">
            {list.map((card) => {
              const st = statusForCard(card, queue?.buckets);
              return (
                <li key={card.id} className="rq-card">
                  <div className="rq-card-top">
                    <span className={`rq-diff rq-diff--${card.difficulty}`}>
                      {card.difficulty}
                    </span>
                    <span className={`rq-status rq-status--${st}`}>
                      {statusLabel(st)}
                      {card.status === "paused" ? " · Paused" : ""}
                      {card.status === "graduated" ? " · Graduated" : ""}
                    </span>
                  </div>
                  <h3 className="rq-card-title">{titleOf(card)}</h3>
                  {tagsOf(card).length > 0 ? (
                    <p className="rq-card-topics">
                      {tagsOf(card).join(" · ")}
                    </p>
                  ) : null}
                  <dl className="rq-card-meta">
                    <div>
                      <dt>Last feedback</dt>
                      <dd>
                        {card.confidence
                          ? card.confidence === "hard"
                            ? "Hard"
                            : card.confidence === "okay"
                              ? "Okay"
                              : "Easy"
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Current interval</dt>
                      <dd>
                        {card.intervalDays} day
                        {card.intervalDays === 1 ? "" : "s"}
                      </dd>
                    </div>
                    <div>
                      <dt>Next review</dt>
                      <dd>{fmtDate(card.nextReviewAt, tz)}</dd>
                    </div>
                    <div>
                      <dt>Reviews</dt>
                      <dd>{card.reviewCount}</dd>
                    </div>
                  </dl>
                  <div className="rq-card-actions">
                    {onOpenProblem ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => onOpenProblem(card.problemId)}
                      >
                        {st === "due" || st === "overdue" ? "Review" : "Open"}
                      </Button>
                    ) : null}
                    {card.status !== "paused" &&
                    card.status !== "graduated" &&
                    (st === "due" || st === "overdue") ? (
                      (["hard", "okay", "easy"] as SrsFeedback[]).map((f) => (
                        <Button
                          key={f}
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === card.problemId}
                          onClick={() => void rate(card, f)}
                        >
                          {f === "hard" ? "Hard" : f === "okay" ? "Okay" : "Easy"}
                        </Button>
                      ))
                    ) : null}
                    {premium ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busyId === card.problemId}
                        onClick={() => void reschedule(card)}
                      >
                        Delay +{delayDays}d
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === card.problemId}
                      onClick={() =>
                        void setCardStatus(
                          card,
                          card.status === "paused" ? "active" : "paused"
                        )
                      }
                    >
                      {card.status === "paused" ? "Resume" : "Pause"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(queue?.upcomingByDay?.length || 0) > 0 &&
      (bucket === "upcoming" || bucket === "all") ? (
        <section className="co-panel ax-panel" aria-label="Upcoming schedule">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">Schedule</p>
              <h2 className="ax-section-title">Upcoming workload</h2>
              <p className="ax-section-meta">
                Grouped by server timezone ({tz}).
              </p>
            </div>
          </div>
          <ul className="rq-timeline">
            {(queue?.upcomingByDay || []).map((row) => (
              <li key={row.dateKey}>
                <strong>
                  {row.dateKey === dayKey
                    ? "Today"
                    : fmtDate(`${row.dateKey}T12:00:00.000Z`, tz)}
                </strong>
                <span>
                  {row.count} review{row.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loadToday + (queue?.reviewLoad?.tomorrow || 0) + (queue?.reviewLoad?.thisWeek || 0) >
      0 ? (
        <section className="co-panel ax-panel" aria-label="Review load">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">Load</p>
              <h2 className="ax-section-title">Review load</h2>
            </div>
          </div>
          <div className="rq-load">
            <div>
              <span>Today</span>
              <strong>{queue?.reviewLoad?.today ?? loadToday}</strong>
            </div>
            <div>
              <span>Tomorrow</span>
              <strong>{queue?.reviewLoad?.tomorrow ?? 0}</strong>
            </div>
            <div>
              <span>This week</span>
              <strong>{queue?.reviewLoad?.thisWeek ?? 0}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <section className="co-panel ax-panel" aria-label="How scheduling works">
        <div className="ax-section-head">
          <div>
            <p className="ax-kicker">Rules</p>
            <h2 className="ax-section-title">How your schedule works</h2>
            <p className="ax-section-meta">
              Your review interval changes based on your feedback and account
              tier.
            </p>
          </div>
        </div>
        <div className="ax-grid-2">
          <div className="ax-subcard">
            <h3>Free</h3>
            <ul className="rq-rule-rows">
              <li>
                <span>Hard</span>
                <strong>{rules?.free.hard || "1 day"}</strong>
              </li>
              <li>
                <span>Okay</span>
                <strong>{rules?.free.okay || "×3 · 30-day cap"}</strong>
              </li>
              <li>
                <span>Easy</span>
                <strong>{rules?.free.easy || "×5 · 90-day cap"}</strong>
              </li>
            </ul>
          </div>
          <div className={cn("ax-subcard", premium && "rq-subcard-premium")}>
            <h3 className="rq-premium-head">
              Premium
              <PremiumBadge feature="premium.spaced_repetition" />
            </h3>
            <ul className="rq-rule-rows">
              <li>
                <span>Hard</span>
                <strong>
                  {rules?.premium.hard || "½ previous · min 1 day"}
                </strong>
              </li>
              <li>
                <span>Okay</span>
                <strong>{rules?.premium.okay || "×3 · 60-day cap"}</strong>
              </li>
              <li>
                <span>Easy</span>
                <strong>{rules?.premium.easy || "×7 · 180-day cap"}</strong>
              </li>
              <li>
                <span>Reschedule</span>
                <strong>{rules?.premium.reschedule || "0–365 days"}</strong>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="co-panel ax-panel" aria-label="Review timezone">
        <div className="ax-section-head">
          <div>
            <p className="ax-kicker">Settings</p>
            <h2 className="ax-section-title">Review timezone</h2>
            <p className="ax-section-meta">
              Due and overdue dates are calculated using this IANA timezone.
            </p>
          </div>
        </div>
        <div className="rq-tz">
          <label>
            Timezone
            <input
              list="rq-tz-options"
              value={tzDraft}
              onChange={(e) => setTzDraft(e.target.value)}
              placeholder="Asia/Kolkata"
              autoComplete="off"
              spellCheck={false}
            />
            <datalist id="rq-tz-options">
              <option value="UTC" />
              <option value="Asia/Kolkata" />
              <option value="America/New_York" />
              <option value="America/Los_Angeles" />
              <option value="America/Chicago" />
              <option value="Europe/London" />
              <option value="Europe/Paris" />
              <option value="Asia/Singapore" />
              <option value="Asia/Tokyo" />
              <option value="Australia/Sydney" />
            </datalist>
          </label>
          <Button
            type="button"
            size="sm"
            disabled={tzSaving || !tzDraft.trim()}
            onClick={() => void saveTz()}
          >
            {tzSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save timezone"
            )}
          </Button>
          <span className="ax-meta">
            <Clock3 size={12} aria-hidden /> Current: {tz}
          </span>
          {tzSavedNote ? (
            <span className="rq-tz-saved" role="status">
              <CheckCircle2 size={12} aria-hidden />
              {tzSavedNote}
            </span>
          ) : null}
        </div>
      </section>

      <section className="co-panel ax-panel" aria-label="Import and enroll">
        <div className="ax-section-head">
          <div>
            <p className="ax-kicker">Grow</p>
            <h2 className="ax-section-title">Grow your queue</h2>
            <p className="ax-section-meta">
              Accepted solves are added automatically. Import older solves or
              enroll a specific problem.
            </p>
          </div>
          <div className="rq-cta-row">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => void openImport()}
            >
              Import solved problems
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEnrollOpen((v) => !v)}
              aria-expanded={enrollOpen}
            >
              Add a problem
            </Button>
          </div>
        </div>

        {enrollOpen ? (
          <>
            <form className="rq-enroll" onSubmit={(e) => void searchEnroll(e)}>
              <label>
                Problem ID / title
                <div className="rq-enroll-row">
                  <input
                    value={enrollQuery}
                    onChange={(e) => setEnrollQuery(e.target.value)}
                    placeholder="Search by problem ID or title"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    disabled={!enrollQuery.trim() || enrollSearching}
                  >
                    {enrollSearching ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <Search size={14} aria-hidden />
                    )}
                    Search
                  </Button>
                </div>
              </label>
            </form>
            {enrollResults.length > 0 ? (
              <ul className="rq-enroll-results">
                {enrollResults.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{p.title}</strong>
                      <span className="ax-meta">
                        {p.difficulty}
                        {p.tags.length
                          ? ` · ${p.tags.slice(0, 3).join(" · ")}`
                          : ""}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === p.id}
                      onClick={() => void enrollProblem(p.id)}
                    >
                      Enroll
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>

      {premium ? (
        <section className="co-panel ax-panel" aria-label="Premium controls">
          <div className="ax-section-head">
            <div>
              <p className="ax-kicker">
                Premium <PremiumBadge feature="premium.spaced_repetition" />
              </p>
              <h2 className="ax-section-title">Scheduling controls</h2>
              <p className="ax-section-meta">
                Delay a review without changing its underlying schedule.
                Scheduling changes are validated securely on the server.
              </p>
            </div>
          </div>
          <div className="rq-premium-ctrl">
            <label>
              Delay (days)
              <div className="rq-stepper">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setDelayDays((d) => Math.max(0, d - 1))}
                  aria-label="Decrease delay days"
                >
                  −
                </Button>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={delayDays}
                  onChange={(e) =>
                    setDelayDays(
                      Math.min(365, Math.max(0, Number(e.target.value) || 0))
                    )
                  }
                  aria-label="Delay days"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setDelayDays((d) => Math.min(365, d + 1))}
                  aria-label="Increase delay days"
                >
                  +
                </Button>
              </div>
            </label>
            <p className="ax-section-meta">
              Allowed: 0–365 days. Use “Delay +Nd” on a card to apply.
            </p>
          </div>
        </section>
      ) : (
        <section className="co-panel ax-panel">
          <UpgradePrompt
            feature="premium.spaced_repetition"
            title="Advanced spaced repetition"
            description="Unlock advanced interval caps, manual reschedule, larger queues, and personalized revision recommendations."
          />
        </section>
      )}

      <section className="co-panel ax-panel" aria-label="Revision insights">
        <div className="ax-section-head">
          <div>
            <p className="ax-kicker">
              <Sparkles size={12} aria-hidden /> Insights
              {premium ? (
                <>
                  {" "}
                  <PremiumBadge feature="premium.spaced_repetition" />
                </>
              ) : (
                " · Premium"
              )}
            </p>
            <h2 className="ax-section-title">Your revision insights</h2>
          </div>
        </div>
        {(counts?.overdue || 0) > 0 ? (
          <div className="ax-subcard">
            <strong>
              You have {counts!.overdue} overdue review
              {counts!.overdue === 1 ? "" : "s"}
            </strong>
            <p className="ax-section-meta">
              Start with your oldest review to get back on track.
            </p>
            <div style={{ marginTop: 10 }}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => startReview(true)}
              >
                Review overdue
              </Button>
            </div>
          </div>
        ) : (counts?.dueToday || 0) === 0 && hasAnyCards ? (
          <div className="ax-subcard">
            <strong>You&apos;re caught up</strong>
            <p className="ax-section-meta">
              No overdue or due-today reviews in the current queue window.
            </p>
            {(counts?.upcoming || 0) > 0 ? (
              <p className="ax-section-meta">
                Next: {counts!.upcoming} upcoming review
                {counts!.upcoming === 1 ? "" : "s"} in your schedule.
              </p>
            ) : (
              <p className="ax-section-meta">
                Your next review will appear here when scheduled.
              </p>
            )}
          </div>
        ) : null}
        {premium ? (
          (queue?.recommendations || []).length === 0 ? (
            !hasAnyCards ||
            (counts?.overdue || 0) > 0 ||
            (counts?.dueToday || 0) === 0 ? null : (
              <EmptyState
                compact
                title="Not enough data yet"
                description="Complete a few reviews and we'll start identifying useful patterns."
              />
            )
          ) : (
            <ul className="rq-insights">
              {queue!.recommendations.map((r, i) => (
                <li key={`${r.type}-${i}`} className="ax-subcard">
                  <strong>{r.title}</strong>
                  <p>{r.evidence}</p>
                  {r.problemId && onOpenProblem ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onOpenProblem(r.problemId!)}
                    >
                      Open related problem
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="ax-section-meta">
            Personalized recommendations require premium spaced repetition.
          </p>
        )}
      </section>
      </div>

      {importOpen ? (
        <div
          className="rq-modal-backdrop"
          role="presentation"
          onClick={() => setImportOpen(false)}
        >
          <div
            className="co-panel rq-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rq-import-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setImportOpen(false);
            }}
          >
            <div className="ax-section-head">
              <div>
                <h2 id="rq-import-title" className="ax-section-title">
                  Import solved problems
                </h2>
                <p className="ax-section-meta">
                  Bring previously accepted problems into your revision queue.
                  Already enrolled items stay unchanged.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setImportOpen(false)}
              >
                Close
              </Button>
            </div>
            {importLoading ? (
              <div className="rq-modal-skel" aria-busy="true">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : importItems.length === 0 ? (
              <EmptyState
                compact
                title="No solved problems found"
                description="Solve a problem with an official ACCEPTED verdict, then try again."
              />
            ) : (
              <>
                <div className="rq-modal-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setImportSelected(
                        new Set(
                          importItems
                            .filter((i) => !i.enrolled)
                            .map((i) => i.problemId)
                        )
                      )
                    }
                  >
                    Select all available
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setImportSelected(new Set())}
                  >
                    Deselect all
                  </Button>
                </div>
                <ul className="rq-import-list">
                  {importItems.map((item) => (
                    <li key={item.problemId}>
                      <label>
                        <input
                          type="checkbox"
                          disabled={item.enrolled}
                          checked={
                            item.enrolled || importSelected.has(item.problemId)
                          }
                          onChange={(e) => {
                            setImportSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(item.problemId);
                              else next.delete(item.problemId);
                              return next;
                            });
                          }}
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <span className="rq-meta">
                            {item.difficulty}
                            {item.tags.length
                              ? ` · ${item.tags.slice(0, 3).join(" · ")}`
                              : ""}
                            {item.enrolled ? " · Already in queue" : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="rq-modal-footer">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={syncBusy || importSelected.size === 0}
                    onClick={() => void runImportSelected()}
                  >
                    {syncBusy ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : null}
                    Import selected
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
