import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { Clock, Play, Swords, FileText, CheckCircle2, XCircle } from "lucide-react";
import {
  mockInterviewApi,
  type MockInterviewSession,
  type MockInterviewReport,
  type MockScoreCell,
} from "../api/mockInterviewApi";
import { problemApi, type Problem } from "../api/problemApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";

interface Props {
  onOpenProblem: (problem: Problem, mockInterviewSessionId?: string) => void;
  /** Notify Dashboard when active session id changes (start / complete / abandon). */
  onActiveSessionChange?: (sessionId: string | null) => void;
  /** Optional: last judged submission to attach */
  lastSubmission?: { id: string; problemId: string } | null;
  refreshKey?: number;
}

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function ScoreRow({ label, cell }: { label: string; cell: MockScoreCell }) {
  return (
    <li>
      <strong>{label}:</strong>{" "}
      {cell.available && cell.score != null ? (
        <>
          {cell.score}/100
          <span className="free-home-muted"> — {cell.detail || cell.signal}</span>
        </>
      ) : (
        <span className="free-home-muted">Unavailable ({cell.detail || cell.signal})</span>
      )}
    </li>
  );
}

export const MockInterviewPanel: FC<Props> = ({
  onOpenProblem,
  onActiveSessionChange,
  lastSubmission,
  refreshKey = 0,
}) => {
  const { user } = useAuth();
  const allowed = canAccess(user, "premium.mock_interview");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState<MockInterviewSession | null>(null);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pastSessions, setPastSessions] = useState<
    Array<{
      id: string;
      status: string;
      config?: { company?: string; role?: string; difficulty?: string };
      startedAt?: string;
      problemsTotal?: number;
      hasReport?: boolean;
    }>
  >([]);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("SDE");
  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard" | "mixed"
  >("medium");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [language, setLanguage] = useState<
    "python" | "javascript" | "cpp" | "java"
  >("python");
  const [topics, setTopics] = useState("Arrays");
  const [problemCount, setProblemCount] = useState(1);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      const [activeRes, mineRes] = await Promise.allSettled([
        mockInterviewApi.getActive(),
        mockInterviewApi.listMine(15),
      ]);
      if (activeRes.status === "fulfilled") {
        const active = activeRes.value.data ?? null;
        setSession(active);
        onActiveSessionChange?.(
          active?.status === "in_progress" ? active.id : null
        );
        if (active) {
          setRemainingMs(active.remainingMs);
          if (active.report) setReport(active.report);
        }
      } else {
        throw activeRes.reason;
      }
      if (mineRes.status === "fulfilled") {
        setPastSessions(mineRes.value.data || []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [allowed, onActiveSessionChange]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

  // Client countdown from server remainingMs + serverNow drift correction on poll
  useEffect(() => {
    if (!session || session.status !== "in_progress") return;
    setRemainingMs(session.remainingMs);
    const t = window.setInterval(() => {
      setRemainingMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    const sync = window.setInterval(() => {
      void (async () => {
        try {
          const res = await mockInterviewApi.getById(session.id);
          if (res.data) {
            setSession(res.data);
            setRemainingMs(res.data.remainingMs);
            if (res.data.status !== "in_progress" && res.data.report) {
              setReport(res.data.report);
            }
          }
        } catch {
          /* ignore */
        }
      })();
    }, 15000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(sync);
    };
  }, [session?.id, session?.status]);

  const attemptByProblem = useMemo(() => {
    const m = new Map<string, NonNullable<MockInterviewSession["attempts"]>[number]>();
    for (const a of session?.attempts || []) m.set(a.problemId, a);
    return m;
  }, [session]);

  if (!allowed) {
    return (
      <div className="free-home">
        <UpgradePrompt
          feature="premium.mock_interview"
          title="Premium mock interviews"
          description="Timed company/role interviews with server-side evaluation reports."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="free-home" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  const handleStart = async () => {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const res = await mockInterviewApi.start({
        company: company || undefined,
        role: role || undefined,
        difficulty,
        durationMinutes,
        language,
        topics: topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        problemCount,
      });
      if (res.data) {
        setSession(res.data);
        setRemainingMs(res.data.remainingMs);
        onActiveSessionChange?.(res.data.id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Start failed");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (problemId: string, slug?: string) => {
    try {
      let problem: Problem | null = null;
      if (slug) {
        const res = await problemApi.getProblemBySlug(slug);
        problem = res?.data || null;
      }
      if (!problem) {
        const res = await problemApi.getProblemById(problemId);
        problem = res?.data || null;
      }
      if (problem) {
        onOpenProblem(
          problem,
          session?.status === "in_progress" ? session.id : undefined
        );
      }
    } catch (err: any) {
      setError(err?.message || "Could not open problem");
    }
  };

  const handleAttach = async (problemId: string) => {
    if (!session || !lastSubmission) {
      setError("Submit a solution in the workspace first, then attach it here.");
      return;
    }
    if (lastSubmission.problemId !== problemId) {
      setError("Latest submission is for a different problem.");
      return;
    }
    setBusy(true);
    try {
      const res = await mockInterviewApi.attachSubmission(
        session.id,
        problemId,
        lastSubmission.id
      );
      if (res.data) setSession(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Attach failed");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const res = await mockInterviewApi.complete(session.id);
      if (res.data) {
        setSession(res.data);
        setReport(res.data.report || null);
        onActiveSessionChange?.(null);
      }
      const rep = await mockInterviewApi.getReport(session.id);
      if (rep.data?.report) setReport(rep.data.report);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Complete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAbandon = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const res = await mockInterviewApi.abandon(session.id);
      if (res.data) {
        setSession(res.data);
        setReport(res.data.report || null);
        onActiveSessionChange?.(null);
      }
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Abandon failed");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenPast = async (sessionId: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await mockInterviewApi.getById(sessionId);
      if (res.data) {
        setSession(res.data);
        setRemainingMs(res.data.remainingMs);
        if (res.data.report) setReport(res.data.report);
        else if (res.data.status !== "in_progress") {
          const rep = await mockInterviewApi.getReport(sessionId);
          if (rep.data?.report) setReport(rep.data.report);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not open session");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="free-home">
      <header className="free-home-welcome">
        <div>
          <p className="free-home-kicker">Premium</p>
          <h1 className="free-home-title">
            <Swords size={22} aria-hidden /> Mock Interview
          </h1>
          <p className="free-home-lede">
            Server-timed sessions. Scores come only from real judge signals — never
            invented AI grades.
          </p>
        </div>
      </header>

      {error ? (
        <div className="free-home-alert" role="alert">
          {error}
        </div>
      ) : null}

      {!session || session.status !== "in_progress" ? (
        <section className="free-home-card">
          <div className="free-home-card-head">
            <h2>Configure interview</h2>
          </div>
          <div className="mock-interview-form">
            <label>
              Company
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Role
              <input value={role} onChange={(e) => setRole(e.target.value)} />
            </label>
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <label>
              Duration (min)
              <input
                type="number"
                min={10}
                max={180}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 45)}
              />
            </label>
            <label>
              Language
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
            </label>
            <label>
              Topics (comma-separated)
              <input value={topics} onChange={(e) => setTopics(e.target.value)} />
            </label>
            <label>
              Problems
              <input
                type="number"
                min={1}
                max={5}
                value={problemCount}
                onChange={(e) => setProblemCount(Number(e.target.value) || 1)}
              />
            </label>
          </div>
          <Button type="button" disabled={busy} onClick={() => void handleStart()}>
            <Play size={14} /> Start interview
          </Button>
        </section>
      ) : (
        <section className="free-home-card">
          <div className="free-home-card-head">
            <h2>Live session</h2>
            <span className="free-home-muted mock-interview-timer">
              <Clock size={14} aria-hidden /> {formatMs(remainingMs)} left
            </span>
          </div>
          <p className="free-home-muted">
            {session.config.company || "General"} · {session.config.role || "Role"} ·{" "}
            {session.config.difficulty} · {session.config.language}
          </p>
          <p className="free-home-muted" style={{ marginTop: 4 }}>
            Timer is server-authoritative (ends {new Date(session.endsAt).toLocaleString()}
            ). Client countdown is display-only.
          </p>
          <ul className="free-home-list" style={{ marginTop: 12 }}>
            {(session.attempts || []).map((a) => {
              const att = attemptByProblem.get(a.problemId) || a;
              return (
                <li key={a.problemId}>
                  <div className="free-home-list-row" style={{ cursor: "default" }}>
                    <span className="free-home-list-main">
                      <strong>{a.title || a.problemSlug || a.problemId}</strong>
                      <span className="free-home-muted">
                        {att.status
                          ? `${att.status}${
                              att.testCasesPassed != null
                                ? ` · ${att.testCasesPassed}/${att.totalTestCases}`
                                : ""
                            }`
                          : "Not submitted"}
                      </span>
                    </span>
                    <span style={{ display: "flex", gap: 8 }}>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleOpen(a.problemId, a.problemSlug)}
                      >
                        Code
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void handleAttach(a.problemId)}
                      >
                        Attach submit
                      </Button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Button type="button" disabled={busy} onClick={() => void handleComplete()}>
              <CheckCircle2 size={14} /> Finish & report
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void handleAbandon()}
            >
              <XCircle size={14} /> Abandon
            </Button>
          </div>
        </section>
      )}

      {pastSessions.length > 0 ? (
        <section className="free-home-card">
          <div className="free-home-card-head">
            <h2>Past interviews</h2>
            <span className="free-home-muted">{pastSessions.length} sessions</span>
          </div>
          <ul className="free-home-activity">
            {pastSessions.map((s) => (
              <li key={s.id}>
                <div className="free-home-list-row" style={{ cursor: "default" }}>
                  <span className="free-home-list-main">
                    <strong>
                      {s.config?.company || "Interview"} · {s.config?.role || "Role"}
                    </strong>
                    <span className="free-home-muted">
                      {s.status}
                      {s.problemsTotal != null ? ` · ${s.problemsTotal} problems` : ""}
                      {s.hasReport ? " · report" : ""}
                      {s.startedAt
                        ? ` · ${new Date(s.startedAt).toLocaleString()}`
                        : ""}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void handleOpenPast(s.id)}
                  >
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report ? (
        <section className="free-home-card" aria-labelledby="interview-report">
          <div className="free-home-card-head">
            <h2 id="interview-report">
              <FileText size={16} aria-hidden /> Interview report
            </h2>
          </div>
          <p className="free-home-muted">
            Status: {report.sessionStatus} · Accepted {report.problemsAccepted}/
            {report.problemsTotal} · Time used {formatMs(report.timeUsedMs)}
          </p>
          <ul className="free-home-activity" style={{ marginTop: 12 }}>
            <ScoreRow label="Problem solving" cell={report.scores.problemSolving} />
            <ScoreRow label="Correctness" cell={report.scores.correctness} />
            <ScoreRow label="Complexity" cell={report.scores.complexity} />
            <ScoreRow label="Time management" cell={report.scores.timeManagement} />
            <ScoreRow label="Code quality" cell={report.scores.codeQuality} />
            <ScoreRow label="Performance" cell={report.scores.performance} />
            <ScoreRow label="Completion" cell={report.scores.completion} />
          </ul>
        </section>
      ) : !session ? (
        <EmptyState
          compact
          title="No active interview"
          description="Configure and start a timed mock interview when ready."
        />
      ) : null}
    </div>
  );
};
