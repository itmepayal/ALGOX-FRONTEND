import { useCallback, useEffect, useState, type FC } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { srsApi, type SrsCard, type SrsFeedback, type SrsQueuePayload } from "../api/srsApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";

interface Props {
  refreshKey?: number;
  onOpenProblem?: (problemId: string) => void;
}

type BucketTab = "due" | "overdue" | "upcoming" | "completed" | "all";

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export const SpacedRepetitionPanel: FC<Props> = ({
  refreshKey = 0,
  onOpenProblem,
}) => {
  const { user } = useAuth();
  const premium = canAccess(user, "premium.spaced_repetition");

  const [queue, setQueue] = useState<SrsQueuePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bucket, setBucket] = useState<BucketTab>("due");
  const [busyId, setBusyId] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [tzDraft, setTzDraft] = useState("UTC");
  const [delayDays, setDelayDays] = useState(3);
  const [enrollProblemId, setEnrollProblemId] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [q, tz] = await Promise.all([
        srsApi.getQueue(
          bucket === "due"
            ? "due_today"
            : bucket === "all"
              ? undefined
              : bucket
        ),
        srsApi.getTimezone(),
      ]);
      setQueue(q.data ?? null);
      const z = tz.data?.timezone || "UTC";
      setTimezone(z);
      setTzDraft(z);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const rate = async (card: SrsCard, feedback: SrsFeedback) => {
    setBusyId(card.problemId);
    setError("");
    try {
      await srsApi.review(card.problemId, feedback);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Review failed");
    } finally {
      setBusyId("");
    }
  };

  const saveTz = async () => {
    setError("");
    try {
      const res = await srsApi.setTimezone(tzDraft.trim());
      setTimezone(res.data.timezone);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Timezone failed");
    }
  };

  const reschedule = async (card: SrsCard) => {
    if (!premium) return;
    setBusyId(card.problemId);
    setError("");
    try {
      await srsApi.reschedule(card.problemId, { delayDays });
      await load();
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
    setBusyId(card.problemId);
    setError("");
    try {
      await srsApi.setStatus(card.problemId, status);
      await load();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Status update failed"
      );
    } finally {
      setBusyId("");
    }
  };

  const enrollById = async () => {
    const pid = enrollProblemId.trim();
    if (!pid) return;
    setBusyId(pid);
    setError("");
    try {
      await srsApi.enroll(pid);
      setEnrollProblemId("");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Enroll failed");
    } finally {
      setBusyId("");
    }
  };

  if (loading && !queue) {
    return (
      <div className="free-home" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  const counts = queue?.counts;
  const list =
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

  return (
    <div className="free-home">
      <header className="free-home-welcome">
        <div>
          <p className="free-home-kicker">Server-authoritative</p>
          <h1 className="free-home-title">
            <RotateCcw size={22} aria-hidden /> Revision Queue
          </h1>
          <p className="free-home-lede">
            Hard / Okay / Easy feedback drives the next review date. Schedules
            live on the server — not in localStorage. Today:{" "}
            <strong>{queue?.todayKey || "—"}</strong> ({timezone})
          </p>
        </div>
      </header>

      {error ? (
        <div className="free-home-alert" role="alert">
          {error}
        </div>
      ) : null}

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>Timezone</h2>
        </div>
        <div className="mock-interview-form" style={{ alignItems: "end" }}>
          <label>
            IANA timezone
            <input
              value={tzDraft}
              onChange={(e) => setTzDraft(e.target.value)}
              placeholder="Asia/Kolkata"
            />
          </label>
          <Button type="button" size="sm" onClick={() => void saveTz()}>
            Save
          </Button>
        </div>
        <p className="free-home-muted" style={{ marginTop: 8 }}>
          Due / overdue buckets use this timezone. Client clock is not
          authoritative for scheduling.
        </p>
      </section>

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>Buckets</h2>
          <span className="free-home-muted">
            due {counts?.dueToday ?? 0} · overdue {counts?.overdue ?? 0} ·
            upcoming {counts?.upcoming ?? 0} · done {counts?.completed ?? 0}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              ["due", "Due today"],
              ["overdue", "Overdue"],
              ["upcoming", "Upcoming"],
              ["completed", "Completed"],
              ["all", "All active"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={bucket === id ? "primary" : "secondary"}
              onClick={() => setBucket(id)}
            >
              {label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void load()}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Refresh
          </Button>
        </div>
      </section>

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>Cards</h2>
          <span className="free-home-muted">
            {queue?.algorithm.standard}
            {queue?.algorithm.advanced
              ? ` · Premium: ${queue.algorithm.advanced}`
              : ""}
          </span>
        </div>
        {list.length === 0 ? (
          <EmptyState
            compact
            title="Nothing in this bucket"
            description="Cards appear after an official ACCEPTED solve (or enroll). First review is scheduled +1 day."
          />
        ) : (
          <ul className="free-home-activity">
            {list.map((card) => (
              <li key={card.id} style={{ marginBottom: 12 }}>
                <div>
                  <strong>
                    {card.difficulty} · {card.problemId.slice(-6)}
                  </strong>{" "}
                  · confidence {card.confidence || "—"} (
                  {card.confidenceScore}) · reviews {card.reviewCount} ·
                  attempts {card.attempts}
                  <br />
                  <span className="free-home-muted">
                    Next: {fmtWhen(card.nextReviewAt)} · interval{" "}
                    {card.intervalDays}d · last solved{" "}
                    {fmtWhen(card.lastSolvedAt)}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {(["hard", "okay", "easy"] as SrsFeedback[]).map((f) => (
                    <Button
                      key={f}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === card.problemId || card.status === "paused"}
                      onClick={() => void rate(card, f)}
                    >
                      {f === "hard" ? "Hard" : f === "okay" ? "Okay" : "Easy"}
                    </Button>
                  ))}
                  {onOpenProblem ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onOpenProblem(card.problemId)}
                    >
                      Open
                    </Button>
                  ) : null}
                  {premium ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === card.problemId}
                      onClick={() => void reschedule(card)}
                    >
                      Reschedule +{delayDays}d
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
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      busyId === card.problemId || card.status === "graduated"
                    }
                    onClick={() => void setCardStatus(card, "graduated")}
                  >
                    Graduate
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {premium ? (
        <section className="free-home-card">
          <div className="free-home-card-head">
            <h2>Premium controls</h2>
          </div>
          <label>
            Reschedule delay (days)
            <input
              type="number"
              min={0}
              max={365}
              value={delayDays}
              onChange={(e) => setDelayDays(Number(e.target.value) || 0)}
            />
          </label>
          <label style={{ display: "block", marginTop: 10 }}>
            Enroll problem ID
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                value={enrollProblemId}
                onChange={(e) => setEnrollProblemId(e.target.value)}
                placeholder="Mongo problem ObjectId"
                style={{ flex: 1 }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!enrollProblemId.trim() || Boolean(busyId)}
                onClick={() => void enrollById()}
              >
                Enroll
              </Button>
            </div>
          </label>
          <h3 className="free-home-kicker" style={{ marginTop: 12 }}>
            Personalized recommendations
          </h3>
          {(queue?.recommendations || []).length === 0 ? (
            <p className="free-home-muted">No recommendation signals yet.</p>
          ) : (
            <ul className="free-home-activity">
              {queue!.recommendations.map((r, i) => (
                <li key={`${r.type}-${i}`}>
                  <strong>{r.title}</strong>
                  <br />
                  <span className="free-home-muted">Evidence: {r.evidence}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="free-home-card">
          <UpgradePrompt
            feature="premium.spaced_repetition"
            title="Advanced spaced repetition"
            description="Unlock advanced interval caps, manual reschedule, larger queues, and personalized revision recommendations."
          />
        </section>
      )}
    </div>
  );
};
