import { useEffect, useMemo, useState, type FC, type MouseEvent } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  CalendarDays,
  ListTodo,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Star,
  Timer,
  Upload,
} from "lucide-react";
import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import {
  computeProgress,
  groupByCategory,
  isSolved,
  normalizeDifficulty,
} from "../utils/problemUtils";
import {
  getProblemResources,
  hasNote,
  loadNotes,
  saveNotes,
} from "../utils/workspacePersistence";
import { engagementApi } from "../api/engagementApi";
import { YouTubeResourceIcon } from "./YouTubeResourceIcon";
import { ProblemShare } from "./ProblemShare";
import {
  formatDurationMs,
  loadAllSessions,
  loadDailyGoals,
  syncPlannerWithAccepted,
  toDateKey,
} from "../utils/learningPersistence";
import {
  buildDayActivityMap,
  buildRoadmap,
  computeStreaks,
  everAcceptedProblemIds,
} from "../utils/learningStats";

interface ProblemsSheetProps {
  problems: Problem[];
  loading: boolean;
  submissions: Submission[];
  searchQuery: string;
  selectedDifficulty: string;
  statusFilter: "all" | "solved" | "attempted" | "unsolved";
  bookmarkedIds: Set<string>;
  revisionIds: Set<string>;
  userId?: string;
  learningRefreshKey?: number;
  onSearchChange: (q: string) => void;
  onDifficultyChange: (d: string) => void;
  onStatusFilterChange: (s: "all" | "solved" | "attempted" | "unsolved") => void;
  onSelectProblem: (p: Problem) => void;
  onRemoveBookmark?: (problemId: string) => void;
  onRevisionChange?: (problemId: string, isRevision: boolean) => void;
  onOpenAdmin?: () => void;
  onNavigateLearning?: (tab: "calendar" | "sessions" | "planner") => void;
}

function hasAnySubmission(
  problemId: string | undefined,
  submissions: Submission[]
): boolean {
  if (!problemId) return false;
  return submissions.some(
    (s) => s.problemId === problemId || s.problemId?.toString() === problemId
  );
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export const ProblemsSheet: FC<ProblemsSheetProps> = ({
  problems,
  loading,
  submissions,
  searchQuery,
  selectedDifficulty,
  statusFilter,
  bookmarkedIds,
  revisionIds,
  userId,
  learningRefreshKey = 0,
  onSearchChange,
  onDifficultyChange,
  onStatusFilterChange,
  onSelectProblem,
  onRemoveBookmark,
  onRevisionChange,
  onOpenAdmin,
  onNavigateLearning,
}) => {
  const [sheetTab, setSheetTab] = useState<"all" | "revision" | "bookmarks">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [noteProblem, setNoteProblem] = useState<Problem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteVersion, setNoteVersion] = useState(0);
  const [revisionBusy, setRevisionBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      const q = searchQuery.toLowerCase();
      const pid = (p.id || p._id || "").toString();
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q));
      const matchDiff =
        selectedDifficulty === "All" ||
        normalizeDifficulty(p.difficulty) === selectedDifficulty.toLowerCase();
      const matchTab =
        sheetTab === "all" ||
        (sheetTab === "revision" && revisionIds.has(pid)) ||
        (sheetTab === "bookmarks" && bookmarkedIds.has(pid));

      const solved = isSolved(pid, submissions);
      const attempted = !solved && hasAnySubmission(pid, submissions);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "solved" && solved) ||
        (statusFilter === "attempted" && attempted) ||
        (statusFilter === "unsolved" && !solved);

      return matchSearch && matchDiff && matchTab && matchStatus;
    });
  }, [
    problems,
    searchQuery,
    selectedDifficulty,
    sheetTab,
    revisionIds,
    bookmarkedIds,
    statusFilter,
    submissions,
  ]);

  const grouped = groupByCategory(filtered);
  const progress = computeProgress(problems, submissions);
  const progressDeg = `${(progress.pct / 100) * 360}deg`;
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const learningWidgets = useMemo(() => {
    void learningRefreshKey;
    const today = toDateKey();
    const accepted = everAcceptedProblemIds(submissions);
    const plan = syncPlannerWithAccepted(userId, today, accepted);
    const goals = loadDailyGoals(userId);
    const problemDone = plan.tasks.filter(
      (t) => t.type === "problem" && t.completed
    ).length;
    const sessions = loadAllSessions(userId);
    const activity = buildDayActivityMap(submissions, sessions);
    const streaks = computeStreaks(activity);
    const day = activity.get(today);
    const roadmap = buildRoadmap(problems, submissions).slice(0, 2);
    const sessionsToday = day?.sessionsCompleted || 0;
    return {
      problemsDone: problemDone,
      problemsGoal: goals.problemsPerDay,
      studyMs: day?.studyMs || 0,
      streak: streaks.current,
      sessionsToday,
      roadmap,
    };
  }, [problems, submissions, userId, learningRefreshKey]);

  useEffect(() => {
    // Expand first category by default once problems load
    if (Object.keys(expanded).length === 0 && Object.keys(grouped).length > 0) {
      const first = Object.keys(grouped)[0];
      setExpanded({ [first]: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems.length]);

  const toggleCategory = (cat: string) => {
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleReset = () => {
    onSearchChange("");
    onDifficultyChange("All");
    onStatusFilterChange("all");
    setSheetTab("all");
    setExpanded({});
  };

  const pickRandom = () => {
    if (filtered.length === 0) return;
    onSelectProblem(filtered[Math.floor(Math.random() * filtered.length)]);
  };

  const openNote = (p: Problem, e?: MouseEvent) => {
    e?.stopPropagation();
    const pid = (p.id || p._id || "").toString();
    setNoteProblem(p);
    setNoteDraft(loadNotes(userId, pid));
    setNoteError("");
  };

  const saveNote = () => {
    if (!noteProblem) return;
    const pid = (noteProblem.id || noteProblem._id || "").toString();
    setNoteSaving(true);
    setNoteError("");
    try {
      saveNotes(userId, pid, noteDraft);
      setNoteVersion((v) => v + 1);
      setNoteProblem(null);
    } catch {
      setNoteError("Failed to save note. Please try again.");
    } finally {
      setNoteSaving(false);
    }
  };

  const deleteNote = () => {
    if (!noteProblem) return;
    const pid = (noteProblem.id || noteProblem._id || "").toString();
    saveNotes(userId, pid, "");
    setNoteDraft("");
    setNoteVersion((v) => v + 1);
    setNoteProblem(null);
  };

  const toggleRevision = async (p: Problem, e: MouseEvent) => {
    e.stopPropagation();
    const pid = (p.id || p._id || "").toString();
    if (!pid || revisionBusy) return;
    if (!localStorage.getItem("accessToken")) {
      setRowError("Please sign in to mark problems for revision.");
      return;
    }
    const prev = revisionIds.has(pid);
    onRevisionChange?.(pid, !prev);
    setRevisionBusy(pid);
    setRowError("");
    try {
      const res = await engagementApi.toggleRevision(pid);
      onRevisionChange?.(pid, Boolean(res.data?.isRevision));
    } catch (err: any) {
      onRevisionChange?.(pid, prev);
      setRowError(
        err.response?.data?.message || err.message || "Failed to update revision."
      );
    } finally {
      setRevisionBusy(null);
    }
  };

  const handleResourceClick = (
    p: Problem,
    type: string,
    url: string,
    isPremium: boolean | undefined,
    e: MouseEvent
  ) => {
    e.stopPropagation();
    if (isPremium) {
      window.alert(
        "This is a Plus / premium resource. Upgrade your plan to unlock it."
      );
      return;
    }
    if (url.startsWith("editorial://")) {
      onSelectProblem(p);
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setRowError("Invalid resource URL.");
      return;
    }
    openExternal(url);
  };

  const renderProblemRows = (items: Problem[], startIndex = 0) =>
    items.map((prob, itemIdx) => {
      const pid = (prob.id || prob._id || "").toString();
      const solved = isSolved(pid, submissions);
      const attempted = !solved && hasAnySubmission(pid, submissions);
      const diff = normalizeDifficulty(prob.difficulty);
      const isRev = revisionIds.has(pid);
      const noted = hasNote(userId, pid);
      // noteVersion forces re-eval after save
      void noteVersion;
      const resources = getProblemResources(prob).filter(
        (r) => r.type !== "practice"
      );
      const premiumResources = resources.filter((r) => r.isPremium);
      const freeResources = resources.filter((r) => !r.isPremium);
      const practice =
        getProblemResources(prob).find((r) => r.type === "practice") ||
        (prob.practiceUrl
          ? {
              type: "practice" as const,
              url: prob.practiceUrl,
              label: "Practice",
            }
          : null);

      return (
        <div
          key={pid || `${prob.slug}-${itemIdx}`}
          className={`dsa-row ${solved ? "solved" : attempted ? "attempted" : ""}`}
        >
          <div className="dsa-cell dsa-cell-status" title={solved ? "Solved" : attempted ? "Attempted" : "Unsolved"}>
            {solved ? (
              <CheckCircle2 size={16} className="dsa-status-solved" aria-label="Solved" />
            ) : (
              <Circle size={16} className="dsa-status-open" aria-label={attempted ? "Attempted" : "Unsolved"} />
            )}
          </div>

          <div className="dsa-cell dsa-cell-problem">
            <button
              type="button"
              className="dsa-problem-title"
              onClick={() => onSelectProblem(prob)}
              aria-label={`Open problem ${prob.title}`}
            >
              <span className="dsa-problem-index">{startIndex + itemIdx + 1}.</span>
              {prob.title}
            </button>
            <button
              type="button"
              className="dsa-solve-link"
              onClick={() => onSelectProblem(prob)}
              aria-label={`Solve ${prob.title}`}
            >
              Solve
            </button>
            <div className="dsa-problem-actions" onClick={(e) => e.stopPropagation()}>
              <ProblemShare problem={prob} variant="icon" />
            </div>
          </div>

          <div className="dsa-cell dsa-cell-center">
            {premiumResources.length > 0 ? (
              <button
                type="button"
                className="dsa-plus-badge"
                aria-label="Premium Plus resource"
                title="Plus resource"
                onClick={(e) =>
                  handleResourceClick(
                    prob,
                    "plus",
                    premiumResources[0].url,
                    true,
                    e
                  )
                }
              >
                <GraduationCap size={14} />
                <span>Plus</span>
              </button>
            ) : (
              <span className="dsa-empty">—</span>
            )}
          </div>

          <div className="dsa-cell dsa-cell-center">
            {premiumResources.length > 0 ? (
              <span className="dsa-plus-dot" title="Resource Plus" aria-label="Resource Plus">
                <Lock size={13} />
              </span>
            ) : (
              <span className="dsa-empty">—</span>
            )}
          </div>

          <div className="dsa-cell dsa-cell-icons">
            {freeResources.length === 0 ? (
              <span className="dsa-empty">—</span>
            ) : (
              freeResources.map((r) => (
                <button
                  key={`${r.type}-${r.url}`}
                  type="button"
                  className="dsa-icon-btn"
                  title={r.label}
                  aria-label={`Open ${r.label}`}
                  onClick={(e) =>
                    handleResourceClick(prob, r.type, r.url, r.isPremium, e)
                  }
                >
                  {r.type === "youtube" ? (
                    <YouTubeResourceIcon size={15} />
                  ) : r.type === "editorial" ? (
                    <FileText size={15} />
                  ) : (
                    <ExternalLink size={15} />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="dsa-cell dsa-cell-center">
            {practice ? (
              <button
                type="button"
                className="dsa-icon-btn"
                title="Practice"
                aria-label={`Open practice for ${prob.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (/^https?:\/\//i.test(practice.url)) openExternal(practice.url);
                  else onSelectProblem(prob);
                }}
              >
                <ExternalLink size={15} />
              </button>
            ) : (
              <span className="dsa-empty">—</span>
            )}
          </div>

          <div className="dsa-cell dsa-cell-center">
            <button
              type="button"
              className={`dsa-icon-btn ${noted ? "active-note" : ""}`}
              title={noted ? "Edit note" : "Add note"}
              aria-label={noted ? "Edit note" : "Add note"}
              onClick={(e) => openNote(prob, e)}
            >
              {noted ? <FileText size={15} /> : <Plus size={15} />}
            </button>
          </div>

          <div className="dsa-cell dsa-cell-center">
            <button
              type="button"
              className={`dsa-icon-btn ${isRev ? "active-star" : ""}`}
              title={isRev ? "Remove from revision" : "Mark for revision"}
              aria-label={
                isRev ? "Remove problem from revision" : "Mark problem for revision"
              }
              disabled={revisionBusy === pid}
              onClick={(e) => void toggleRevision(prob, e)}
            >
              {revisionBusy === pid ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Star size={15} fill={isRev ? "currentColor" : "none"} />
              )}
            </button>
          </div>

          <div className="dsa-cell dsa-cell-diff">
            <span className={`diff-badge ${diff}`}>{diff}</span>
          </div>
        </div>
      );
    });

  return (
    <div className="striver-layout animate-fade-in">
      <div className="striver-main">
        <header className="striver-hero">
          <div className="striver-hero-text">
            <h1>
              {sheetTab === "bookmarks"
                ? "My Bookmarks"
                : sheetTab === "revision"
                  ? "My Revision"
                  : "algoX DSA Sheet — Learn DSA from A to Z"}
            </h1>
            <p>
              {sheetTab === "revision"
                ? "Problems you marked with ★ for later revision."
                : sheetTab === "bookmarks"
                  ? "Problems you bookmarked. Open any problem or remove a bookmark."
                  : "Track Status, Solve exact problems, notes, revision, and resources — fully wired to your progress."}
            </p>
          </div>
          <div className="striver-hero-actions">
            <div className="striver-hero-btn-row">
              <button type="button" className="striver-outline-btn" onClick={handleReset}>
                <RotateCcw size={15} />
                Reset
              </button>
              {onOpenAdmin && (
                <button
                  type="button"
                  className="striver-outline-btn striver-outline-primary"
                  onClick={onOpenAdmin}
                >
                  <Upload size={15} />
                  Import
                </button>
              )}
            </div>
            <span className="striver-updated">Last updated: {lastUpdated}</span>
          </div>
        </header>

        <div className="striver-controls-card">
          <div className="striver-tabs">
            <button
              type="button"
              className={`striver-tab ${sheetTab === "all" ? "active" : ""}`}
              onClick={() => setSheetTab("all")}
            >
              All Problems
            </button>
            <button
              type="button"
              className={`striver-tab ${sheetTab === "revision" ? "active" : ""}`}
              onClick={() => setSheetTab("revision")}
            >
              Revision ({revisionIds.size})
            </button>
            <button
              type="button"
              className={`striver-tab ${sheetTab === "bookmarks" ? "active" : ""}`}
              onClick={() => setSheetTab("bookmarks")}
            >
              My Bookmarks ({bookmarkedIds.size})
            </button>
          </div>

          <div className="striver-controls-right">
            <div className="striver-search-inline">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <select
              className="striver-select"
              value={selectedDifficulty}
              onChange={(e) => onDifficultyChange(e.target.value)}
            >
              <option value="All">All difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <select
              className="striver-select"
              value={statusFilter}
              onChange={(e) =>
                onStatusFilterChange(
                  e.target.value as "all" | "solved" | "attempted" | "unsolved"
                )
              }
            >
              <option value="all">All status</option>
              <option value="solved">Solved</option>
              <option value="attempted">Attempted</option>
              <option value="unsolved">Unsolved</option>
            </select>
            <button
              type="button"
              className="striver-random-btn"
              onClick={pickRandom}
              disabled={filtered.length === 0}
            >
              <Shuffle size={15} />
              Random
            </button>
          </div>
        </div>

        <div className="striver-progress-banner">
          <div className="striver-progress-left">
            <div
              className="striver-progress-ring"
              data-label={`${progress.pct}%`}
              style={{ ["--progress-deg" as string]: progressDeg }}
            />
            <div className="striver-progress-center">
              <span className="striver-progress-label">Overall Progress</span>
              <span className="striver-progress-count">
                {progress.solved} / {progress.total}
              </span>
            </div>
          </div>
          <div className="striver-progress-divider" />
          <div className="striver-progress-breakdown">
            <div className="striver-diff-pill easy">
              <span className="dot" />
              <span>Easy</span>
              <b>
                {progress.byDiff.easy.solved}/{progress.byDiff.easy.total}
              </b>
            </div>
            <div className="striver-diff-pill medium">
              <span className="dot" />
              <span>Medium</span>
              <b>
                {progress.byDiff.medium.solved}/{progress.byDiff.medium.total}
              </b>
            </div>
            <div className="striver-diff-pill hard">
              <span className="dot" />
              <span>Hard</span>
              <b>
                {progress.byDiff.hard.solved}/{progress.byDiff.hard.total}
              </b>
            </div>
          </div>
        </div>

        {rowError && (
          <div className="dsa-banner-error" role="alert">
            {rowError}
            <button type="button" onClick={() => setRowError("")} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-center">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="striver-empty">
            <p>
              {sheetTab === "revision"
                ? "No revision problems yet. Click ★ on a row to add one."
                : sheetTab === "bookmarks"
                  ? "No bookmarked problems yet."
                  : "No problems found."}
            </p>
          </div>
        ) : sheetTab === "bookmarks" || sheetTab === "revision" ? (
          <div className="dsa-table-wrap dsa-table-flat">
            <div className="dsa-table-head">
              <span>Status</span>
              <span>Problem</span>
              <span>Plus</span>
              <span>Resource Plus</span>
              <span>Resource</span>
              <span>Practice</span>
              <span>Note</span>
              <span>Revision</span>
              <span>Difficulty</span>
            </div>
            <div className="dsa-table-body">
              {renderProblemRows(filtered)}
            </div>
            {sheetTab === "bookmarks" && filtered.length > 0 && (
              <div className="dsa-flat-hint">
                Tip: use the bookmark icon inside the problem workspace to remove a bookmark,
                or mark ★ for revision from this table.
              </div>
            )}
          </div>
        ) : (
          <div className="striver-topics">
            {Object.entries(grouped).map(([category, items]) => {
              const catSolved = items.filter((p) =>
                isSolved(p.id || p._id, submissions)
              ).length;
              const catPct = items.length
                ? Math.round((catSolved / items.length) * 100)
                : 0;
              const open = expanded[category] === true;

              return (
                <div key={category} className="striver-topic-group">
                  <button
                    type="button"
                    className="striver-topic-row"
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="striver-topic-left">
                      <ChevronRight
                        size={18}
                        className={`striver-chevron ${open ? "open" : ""}`}
                      />
                      <span className="striver-topic-name">{category}</span>
                    </span>
                    <span className="striver-topic-right">
                      <span className="striver-topic-bar">
                        <span
                          className="striver-topic-bar-fill"
                          style={{ width: `${catPct}%` }}
                        />
                      </span>
                      <span className="striver-topic-fraction">
                        {catSolved} / {items.length}
                      </span>
                    </span>
                  </button>

                  {open && (
                    <div className="dsa-table-wrap">
                      <div className="dsa-table-head">
                        <span>Status</span>
                        <span>Problem</span>
                        <span>Plus</span>
                        <span>Resource Plus</span>
                        <span>Resource</span>
                        <span>Practice</span>
                        <span>Note</span>
                        <span>Revision</span>
                        <span>Difficulty</span>
                      </div>
                      <div className="dsa-table-body">{renderProblemRows(items)}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="striver-rail">
        <div className="striver-rail-card">
          <h3 className="striver-rail-title">DSA Progress</h3>
          <div
            className="striver-dsa-gauge"
            style={{ ["--progress-deg" as string]: progressDeg }}
          >
            <div className="striver-dsa-gauge-inner">
              <strong>{progress.solved}</strong>
              <span>/ {progress.total}</span>
            </div>
          </div>
          <div className="striver-rail-legend">
            <div>
              <span className="leg-dot easy" />
              Easy{" "}
              <b>
                {progress.byDiff.easy.solved}/{progress.byDiff.easy.total}
              </b>
            </div>
            <div>
              <span className="leg-dot medium" />
              Medium{" "}
              <b>
                {progress.byDiff.medium.solved}/{progress.byDiff.medium.total}
              </b>
            </div>
            <div>
              <span className="leg-dot hard" />
              Hard{" "}
              <b>
                {progress.byDiff.hard.solved}/{progress.byDiff.hard.total}
              </b>
            </div>
          </div>
        </div>

        <div className="striver-rail-card learn-rail-widgets">
          <h3 className="striver-rail-title">Today&apos;s Progress</h3>
          <div className="learn-rail-stat">
            <strong>
              {learningWidgets.problemsDone} / {learningWidgets.problemsGoal}
            </strong>
            <span>Problems</span>
          </div>
          <div className="learn-rail-stat">
            <strong>{formatDurationMs(learningWidgets.studyMs)}</strong>
            <span>Study Time</span>
          </div>
          <div className="learn-rail-stat">
            <strong>{learningWidgets.streak} Days</strong>
            <span>Current Streak</span>
          </div>
          <div className="learn-rail-stat">
            <strong>{learningWidgets.sessionsToday}</strong>
            <span>Sessions</span>
          </div>
          {learningWidgets.roadmap.length > 0 && (
            <div className="learn-rail-roadmap">
              <h4>Roadmap</h4>
              {learningWidgets.roadmap.map((t) => (
                <div key={t.name} className="learn-rail-topic">
                  <span>{t.name}</span>
                  <b>{t.pct}%</b>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="striver-locked-list">
          {(
            [
              {
                id: "calendar" as const,
                label: "Calendar + Roadmap",
                Icon: CalendarDays,
              },
              { id: "sessions" as const, label: "Sessions", Icon: Timer },
              { id: "planner" as const, label: "Daily Planner", Icon: ListTodo },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="striver-locked-item striver-nav-item"
              onClick={() => onNavigateLearning?.(id)}
            >
              <span>
                <Icon size={14} style={{ marginRight: 8, verticalAlign: -2 }} />
                {label}
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </aside>

      {noteProblem && (
        <div
          className="dsa-note-overlay"
          role="dialog"
          aria-label="Problem note"
          onClick={() => setNoteProblem(null)}
        >
          <div className="dsa-note-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Note — {noteProblem.title}</h3>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Write your approach, patterns, pitfalls…"
              rows={8}
              autoFocus
            />
            {noteError && <p className="dsa-note-error">{noteError}</p>}
            <div className="dsa-note-actions">
              <button type="button" className="dsa-note-danger" onClick={deleteNote}>
                Delete
              </button>
              <div className="dsa-note-actions-right">
                <button type="button" onClick={() => setNoteProblem(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="dsa-note-save"
                  disabled={noteSaving}
                  onClick={saveNote}
                >
                  {noteSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
