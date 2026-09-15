import { useEffect, useMemo, useRef, useState, type FC, type MouseEvent } from "react";
import {
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Code,
  ExternalLink,
  FileText,
  Flame,
  Info,
  ListTodo,
  Loader2,
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
  isSheetCompleted,
  hasAttempted,
  normalizeDifficulty,
} from "../utils/problemUtils";
import { normalizeProblemId } from "../utils/engagementIds";
import {
  loadRecentRandomIds,
  pickRandomSheetProblem,
  pushRecentRandomId,
  type RandomPickMode,
} from "../utils/randomSheetProblem";
import {
  DSA_BEST_SHEET,
  STRIVER_A2Z_SHEET_ID,
  STRIVER_A2Z_SHEET_NAME,
} from "../data/dsaBestSheet";
import {
  getProblemResources,
  hasNote,
  loadNotes,
  saveNotes,
} from "../utils/workspacePersistence";
import { engagementApi } from "../api/engagementApi";
import { sheetProgressApi } from "../api/sheetProgressApi";
import { progressApi, type ProgressImportPreview } from "../api/progressApi";
import { YouTubeResourceIcon } from "./YouTubeResourceIcon";
import { ProblemShare } from "./ProblemShare";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  loadAllSessions,
  syncPlannerWithAccepted,
  toDateKey,
} from "../utils/learningPersistence";
import {
  buildDayActivityMap,
  computeStreaks,
  everAcceptedProblemIds,
} from "../utils/learningStats";

const importBannerKey = (uid: string) => `ax-import-banner-dismissed:${uid}`;

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
  userName?: string;
  onSearchChange: (q: string) => void;
  onDifficultyChange: (d: string) => void;
  onStatusFilterChange: (s: "all" | "solved" | "attempted" | "unsolved") => void;
  onSelectProblem: (p: Problem) => void;
  onRemoveBookmark?: (problemId: string) => void;
  onBookmarkChange?: (problemId: string, isBookmarked: boolean) => void;
  onRevisionChange?: (problemId: string, isRevision: boolean) => void;
  onOpenAdmin?: () => void;
  onNavigateLearning?: (tab: "calendar" | "sessions" | "planner") => void;
  /** Refresh submissions / dashboard after progress import. */
  onProgressImported?: () => void | Promise<void>;
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
  onBookmarkChange,
  onRevisionChange,
  onOpenAdmin: _onOpenAdmin,
  onNavigateLearning,
  onProgressImported,
}) => {
  const [sheetTab, setSheetTab] = useState<"all" | "revision" | "bookmarks">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [noteProblem, setNoteProblem] = useState<Problem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteVersion, setNoteVersion] = useState(0);
  const [revisionBusy, setRevisionBusy] = useState<string | null>(null);
  const [bookmarkBusy, setBookmarkBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");
  const [sheetResetAt, setSheetResetAt] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const resetInFlight = useRef(false);
  const [randomFinding, setRandomFinding] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeDialogKind, setCompleteDialogKind] = useState<
    "sheet" | "filtered"
  >("sheet");
  const randomInFlight = useRef(false);

  const [importBannerVisible, setImportBannerVisible] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ProgressImportPreview | null>(
    null
  );
  const [importPreviewing, setImportPreviewing] = useState(false);
  const [importConfirming, setImportConfirming] = useState(false);
  const importInFlight = useRef(false);

  const problemBySlug = useMemo(() => {
    const map = new Map<string, Problem>();
    for (const p of problems) {
      if (p.slug) map.set(p.slug.toLowerCase(), p);
      map.set(p.title.trim().toLowerCase(), p);
    }
    return map;
  }, [problems]);

  /** Unique curated sheet problems present in the loaded DB catalog. */
  const sheetProblems = useMemo(() => {
    const seen = new Set<string>();
    const items: Problem[] = [];
    for (const ref of DSA_BEST_SHEET.uniqueProblems) {
      const hit =
        problemBySlug.get(ref.slug.toLowerCase()) ||
        problemBySlug.get(ref.title.trim().toLowerCase());
      if (!hit) continue;
      const pid = normalizeProblemId(hit.id || hit._id);
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      items.push(hit);
    }
    return items;
  }, [problemBySlug]);

  useEffect(() => {
    if (!userId) {
      setSheetResetAt(null);
      setImportBannerVisible(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await sheetProgressApi.getProgress(STRIVER_A2Z_SHEET_ID);
        if (!cancelled) setSheetResetAt(res.data?.resetAt ?? null);
      } catch {
        if (!cancelled) setSheetResetAt(null);
      }
    })();
    try {
      const dismissed = localStorage.getItem(importBannerKey(userId)) === "1";
      setImportBannerVisible(!dismissed);
    } catch {
      setImportBannerVisible(true);
    }
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const dismissImportBanner = () => {
    setImportBannerVisible(false);
    if (userId) {
      try {
        localStorage.setItem(importBannerKey(userId), "1");
      } catch {
        /* ignore */
      }
    }
  };

  const startImportProgress = async () => {
    if (!userId) {
      setToast({ type: "error", text: "Sign in to import progress from your submissions." });
      return;
    }
    if (importInFlight.current) return;
    importInFlight.current = true;
    setImportPreviewing(true);
    try {
      const res = await progressApi.previewImport();
      setImportPreview(res.data);
      setImportPreviewOpen(true);
    } catch (err: any) {
      setToast({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to analyze submissions for import",
      });
    } finally {
      setImportPreviewing(false);
      importInFlight.current = false;
    }
  };

  const confirmImportProgress = async () => {
    if (!userId || importInFlight.current) return;
    importInFlight.current = true;
    setImportConfirming(true);
    try {
      const res = await progressApi.importProgress();
      setImportPreviewOpen(false);
      setImportPreview(null);
      dismissImportBanner();
      try {
        const sheetRes = await sheetProgressApi.getProgress(STRIVER_A2Z_SHEET_ID);
        setSheetResetAt(sheetRes.data?.resetAt ?? null);
      } catch {
        /* keep existing */
      }
      await onProgressImported?.();
      const d = res.data;
      setSheetResetAt(null);
      setToast({
        type: "success",
        text: `Progress imported: ${d.solvedProblems} solved, ${d.attemptedProblems} attempted · ${d.affectedSheets} sheet(s) synced`,
      });
    } catch (err: any) {
      setToast({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Import progress failed",
      });
    } finally {
      setImportConfirming(false);
      importInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const matchesFilters = (p: Problem) => {
    const q = searchQuery.toLowerCase();
    const pid = normalizeProblemId(p.id || p._id);
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
    const completed = isSheetCompleted(pid, submissions, sheetResetAt);
    const attempted = !completed && hasAttempted(pid, submissions);
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "solved" && completed) ||
      (statusFilter === "attempted" && attempted) ||
      (statusFilter === "unsolved" && !completed);
    return matchSearch && matchDiff && matchTab && matchStatus;
  };

  const filtered = useMemo(() => {
    return problems.filter(matchesFilters);
  }, [
    problems,
    searchQuery,
    selectedDifficulty,
    sheetTab,
    revisionIds,
    bookmarkedIds,
    statusFilter,
    submissions,
    sheetResetAt,
  ]);

  /** Topic-wise sections from DSA Best Sheet (problems may appear under multiple topics). */
  const sheetSections = useMemo(() => {
    const sections = DSA_BEST_SHEET.topics.map((topic) => {
      const seen = new Set<string>();
      const items: Problem[] = [];
      for (const ref of topic.problems) {
        const hit =
          problemBySlug.get(ref.slug.toLowerCase()) ||
          problemBySlug.get(ref.title.trim().toLowerCase());
        if (!hit) continue;
        const pid = (hit.id || hit._id || hit.slug || "").toString();
        if (seen.has(pid)) continue;
        if (!matchesFilters(hit)) continue;
        seen.add(pid);
        items.push(hit);
      }
      return { name: topic.name, items };
    });

    // Any DB problems not present in the curated sheet
    const sheetSlugs = new Set(
      DSA_BEST_SHEET.uniqueProblems.map((p) => p.slug.toLowerCase())
    );
    const extras = filtered.filter(
      (p) => !p.slug || !sheetSlugs.has(p.slug.toLowerCase())
    );
    if (extras.length) {
      sections.push({ name: "Additional Problems", items: extras });
    }
    return sections.filter((s) => s.items.length > 0);
  }, [
    problemBySlug,
    filtered,
    searchQuery,
    selectedDifficulty,
    sheetTab,
    revisionIds,
    bookmarkedIds,
    statusFilter,
    submissions,
    sheetResetAt,
  ]);

  const progress = computeProgress(sheetProblems, submissions, sheetResetAt);
  const progressDeg = `${(progress.pct / 100) * 360}deg`;
  const sheetAllComplete =
    progress.total > 0 && progress.solved >= progress.total;

  /** Sheet problems that match the same filters as the visible list. */
  const sheetFiltered = useMemo(
    () => sheetProblems.filter((p) => matchesFilters(p)),
    // matchesFilters closes over the listed deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sheetProblems,
      searchQuery,
      selectedDifficulty,
      sheetTab,
      revisionIds,
      bookmarkedIds,
      statusFilter,
      submissions,
      sheetResetAt,
    ]
  );
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const streak = useMemo(() => {
    void learningRefreshKey;
    const sessions = loadAllSessions(userId);
    syncPlannerWithAccepted(
      userId,
      toDateKey(),
      everAcceptedProblemIds(submissions)
    );
    return computeStreaks(buildDayActivityMap(submissions, sessions)).current;
  }, [submissions, userId, learningRefreshKey]);

  useEffect(() => {
    if (Object.keys(expanded).length === 0 && sheetSections.length > 0) {
      setExpanded({ [sheetSections[0].name]: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems.length, sheetSections.length]);


  const handleResetProgress = async () => {
    if (resetInFlight.current || resetConfirming) return;
    resetInFlight.current = true;
    setResetConfirming(true);
    try {
      const res = await sheetProgressApi.resetProgress(STRIVER_A2Z_SHEET_ID);
      setSheetResetAt(res.data?.resetAt ?? new Date().toISOString());
      setResetConfirmOpen(false);
      setToast({
        type: "success",
        text: "Sheet progress has been reset successfully.",
      });
    } catch (err: any) {
      setToast({
        type: "error",
        text:
          err?.response?.data?.message ||
          "Unable to reset sheet progress. Please try again.",
      });
    } finally {
      setResetConfirming(false);
      resetInFlight.current = false;
    }
  };

  const openPickedProblem = (problem: Problem) => {
    const pid = normalizeProblemId(problem.id || problem._id);
    if (pid) pushRecentRandomId(STRIVER_A2Z_SHEET_ID, pid);
    setToast({ type: "success", text: `Random problem selected: ${problem.title}` });
    onSelectProblem(problem);
  };

  const runRandomPick = (mode: RandomPickMode = "smart") => {
    if (randomInFlight.current || randomFinding) return;
    randomInFlight.current = true;
    setRandomFinding(true);

    const hasActiveFilters =
      selectedDifficulty !== "All" ||
      statusFilter !== "all" ||
      Boolean(searchQuery.trim()) ||
      sheetTab !== "all";

    window.setTimeout(() => {
      try {
        if (sheetFiltered.length === 0) {
          setToast({
            type: "error",
            text: "No problems found matching your current filters. Clear filters and try again.",
          });
          return;
        }

        // Status=Solved list is already completed — pick among them directly.
        const effectiveMode: RandomPickMode =
          mode === "smart" && statusFilter === "solved" ? "solved-only" : mode;

        const result = pickRandomSheetProblem(
          sheetFiltered,
          submissions,
          sheetResetAt,
          {
            mode: effectiveMode,
            recentIds: loadRecentRandomIds(STRIVER_A2Z_SHEET_ID),
            sheetAllComplete: sheetAllComplete && !hasActiveFilters,
          }
        );

        if (result.reason === "empty") {
          setToast({
            type: "error",
            text: "No problems found matching your current filters.",
          });
          return;
        }

        if (result.reason === "sheet-complete") {
          setCompleteDialogKind("sheet");
          setCompleteDialogOpen(true);
          return;
        }

        if (result.reason === "filtered-complete") {
          setCompleteDialogKind("filtered");
          setCompleteDialogOpen(true);
          return;
        }

        if (!result.problem) {
          setToast({
            type: "error",
            text: "Unable to find a random problem. Please try again.",
          });
          return;
        }

        openPickedProblem(result.problem);
      } catch {
        setToast({
          type: "error",
          text: "Unable to find a random problem. Please try again.",
        });
      } finally {
        setRandomFinding(false);
        randomInFlight.current = false;
      }
    }, 120);
  };

  const handleCompleteDialogPick = (mode: "any" | "solved-only") => {
    setCompleteDialogOpen(false);
    window.setTimeout(() => runRandomPick(mode), 0);
  };

  const openNote = (p: Problem, e?: MouseEvent) => {
    e?.stopPropagation();
    const pid = normalizeProblemId(p.id || p._id);
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
    e.preventDefault();
    e.stopPropagation();
    const pid = normalizeProblemId(p.id || p._id);
    if (!pid || revisionBusy) return;
    if (!localStorage.getItem("accessToken")) {
      setRowError("Please sign in to mark problems for revision.");
      return;
    }
    const prev = revisionIds.has(pid);
    // Optimistic revision-only update
    onRevisionChange?.(pid, !prev);
    setRevisionBusy(pid);
    setRowError("");
    try {
      const res = await engagementApi.toggleRevision(pid);
      // Only apply when the server explicitly returns the revision flag.
      // Never read isBookmarked from this response.
      if (typeof res.data?.isRevision === "boolean") {
        onRevisionChange?.(pid, res.data.isRevision);
      }
    } catch (err: any) {
      onRevisionChange?.(pid, prev);
      setRowError(
        err.response?.data?.message || err.message || "Failed to update revision."
      );
    } finally {
      setRevisionBusy(null);
    }
  };

  const toggleBookmark = async (p: Problem, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pid = normalizeProblemId(p.id || p._id);
    if (!pid || bookmarkBusy) return;
    if (!localStorage.getItem("accessToken")) {
      setRowError("Please sign in to save favourite questions.");
      return;
    }
    const prev = bookmarkedIds.has(pid);
    // Optimistic favourite-only update — never touch revision
    onBookmarkChange?.(pid, !prev);
    setBookmarkBusy(pid);
    setRowError("");
    try {
      const res = await engagementApi.toggleBookmark(pid);
      // Only apply bookmark flag. Ignore any unrelated fields.
      const next =
        typeof res.data?.isFavourite === "boolean"
          ? res.data.isFavourite
          : typeof res.data?.isBookmarked === "boolean"
            ? res.data.isBookmarked
            : !prev;
      onBookmarkChange?.(pid, next);
      setToast({
        type: "success",
        text: next ? "Added to favourites" : "Removed from favourites",
      });
    } catch (err: any) {
      onBookmarkChange?.(pid, prev);
      setRowError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update favourites. Please try again."
      );
      setToast({
        type: "error",
        text: "Unable to update favourites. Please try again.",
      });
    } finally {
      setBookmarkBusy(null);
    }
  };

  const handleResourceClick = (
    p: Problem,
    url: string,
    isPremium: boolean | undefined,
    e: MouseEvent
  ) => {
    e.stopPropagation();
    if (isPremium) {
      window.alert("This is a Plus / premium resource.");
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

  const renderProblemRows = (items: Problem[]) =>
    items.map((prob, itemIdx) => {
      const pid = normalizeProblemId(prob.id || prob._id);
      const solved = isSheetCompleted(pid, submissions, sheetResetAt);
      const attempted = !solved && hasAttempted(pid, submissions);
      const diff = normalizeDifficulty(prob.difficulty);
      const isRev = revisionIds.has(pid);
      const isBm = bookmarkedIds.has(pid);
      const noted = hasNote(userId, pid);
      void noteVersion;
      const resources = getProblemResources(prob).filter((r) => r.type !== "practice");
      const practice =
        getProblemResources(prob).find((r) => r.type === "practice") ||
        (prob.practiceUrl
          ? { type: "practice" as const, url: prob.practiceUrl, label: "Practice" }
          : null);

      return (
        <div
          key={pid || `${prob.slug}-${itemIdx}`}
          className={`ax-row ${solved ? "solved" : attempted ? "attempted" : ""}`}
        >
          <div className="ax-row-status">
            {solved ? (
              <span className="ax-check done" aria-label="Solved" title="Solved">
                <Check size={11} strokeWidth={3} />
              </span>
            ) : attempted ? (
              <span className="ax-check attempted" aria-label="Attempted" title="Attempted" />
            ) : (
              <span className="ax-check" aria-label="Todo" title="Not attempted" />
            )}
          </div>
          <span className="ax-row-num">{String(itemIdx + 1).padStart(2, "0")}</span>
          <button
            type="button"
            className="ax-row-title"
            onClick={() => onSelectProblem(prob)}
          >
            {prob.title}
          </button>
          <span className={`ax-diff ${diff}`}>
            {diff.charAt(0).toUpperCase() + diff.slice(1)}
          </span>
          <span className="ax-row-topic">{prob.category || "General"}</span>
          <div className="ax-row-actions">
            {resources.map((r) => (
              <button
                key={`${r.type}-${r.url}`}
                type="button"
                className="ax-icon"
                title={r.label}
                aria-label={r.label}
                onClick={(e) => handleResourceClick(prob, r.url, r.isPremium, e)}
              >
                {r.type === "youtube" ? (
                  <YouTubeResourceIcon size={14} />
                ) : r.type === "editorial" ? (
                  <FileText size={14} />
                ) : (
                  <ExternalLink size={14} />
                )}
              </button>
            ))}
            <button
              type="button"
              className="ax-icon"
              title="Open editor"
              aria-label="Open editor"
              onClick={() => onSelectProblem(prob)}
            >
              <Code size={14} />
            </button>
            {practice && (
              <button
                type="button"
                className="ax-icon"
                title="Practice"
                aria-label="Practice"
                onClick={(e) => {
                  e.stopPropagation();
                  if (/^https?:\/\//i.test(practice.url)) openExternal(practice.url);
                  else onSelectProblem(prob);
                }}
              >
                <ExternalLink size={14} />
              </button>
            )}
            <div onClick={(e) => e.stopPropagation()}>
              <ProblemShare problem={prob} variant="icon" />
            </div>
            <button
              type="button"
              className={`ax-icon ${isBm ? "on-bookmark" : ""}`}
              title={isBm ? "Remove from favourites" : "Add to favourites"}
              aria-label={isBm ? "Remove from favourites" : "Add to favourites"}
              aria-pressed={isBm}
              disabled={bookmarkBusy === pid}
              onClick={(e) => void toggleBookmark(prob, e)}
            >
              {bookmarkBusy === pid ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Bookmark size={14} fill={isBm ? "currentColor" : "none"} />
              )}
            </button>
            <button
              type="button"
              className={`ax-icon ${noted ? "on-note" : ""}`}
              title="Notes"
              aria-label="Notes"
              onClick={(e) => openNote(prob, e)}
            >
              <FileText size={14} />
            </button>
            <button
              type="button"
              className={`ax-icon ${isRev ? "on-revision" : ""}`}
              title={isRev ? "Remove from revision" : "Mark for revision"}
              aria-label={isRev ? "Remove from revision" : "Mark for revision"}
              aria-pressed={isRev}
              disabled={revisionBusy === pid}
              onClick={(e) => void toggleRevision(prob, e)}
            >
              {revisionBusy === pid ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Star size={14} fill={isRev ? "currentColor" : "none"} />
              )}
            </button>
          </div>
        </div>
      );
    });

  return (
    <div className="ax-sheet animate-fade-in">
      <div className="ax-sheet-main">
        <header className="ax-hero">
          <div>
            <h1>{STRIVER_A2Z_SHEET_NAME}</h1>
            <p>
              {DSA_BEST_SHEET.stats.topics} topics ·{" "}
              {DSA_BEST_SHEET.stats.uniqueProblems} unique problems · topic-wise
              practice. Sheet progress is independent of bookmarks, revision, and
              global solved status.
            </p>
          </div>
          <div className="ax-hero-actions">
            <div className="ax-hero-btns">
              <button
                type="button"
                className="ax-btn danger"
                onClick={() => setResetConfirmOpen(true)}
                disabled={!userId || resetConfirming}
                title="Reset learning progress for this sheet only"
              >
                {resetConfirming ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                Reset Progress
              </button>
              {userId && !importBannerVisible && (
                <button
                  type="button"
                  className="ax-btn accent"
                  onClick={() => void startImportProgress()}
                  disabled={importPreviewing || importConfirming}
                  title="Restore solved/attempted progress from your past submissions"
                >
                  {importPreviewing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {importPreviewing ? "Analyzing…" : "Import Progress"}
                </button>
              )}
            </div>
            <span className="ax-meta">Last updated: {lastUpdated}</span>
          </div>
        </header>

        {userId && importBannerVisible && (
          <div className="ax-import-banner" role="region" aria-label="Import progress">
            <div className="ax-import-banner-copy">
              <strong>Import Progress</strong>
              <span>Auto-fill progress from past submissions</span>
            </div>
            <div className="ax-import-banner-actions">
              <button
                type="button"
                className="ax-btn accent"
                onClick={() => void startImportProgress()}
                disabled={importPreviewing || importConfirming}
              >
                {importPreviewing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                Import
              </button>
              <button
                type="button"
                className="ax-btn"
                onClick={dismissImportBanner}
                disabled={importPreviewing || importConfirming}
              >
                Nah, Not now
              </button>
            </div>
          </div>
        )}

        <div className="ax-controls">
          <div className="ax-tabs">
            {(
              [
                ["all", "All Problems"],
                ["revision", `Revision (${revisionIds.size})`],
                ["bookmarks", `Favourites (${bookmarkedIds.size})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`ax-tab ${sheetTab === id ? "active" : ""}`}
                onClick={() => setSheetTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ax-filters">
            <div className="ax-search">
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search problems..."
                aria-label="Search problems"
              />
            </div>
            <select
              value={statusFilter}
              aria-label="Status"
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
            <select
              value={selectedDifficulty}
              aria-label="Difficulty"
              onChange={(e) => onDifficultyChange(e.target.value)}
            >
              <option value="All">Difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <button
              type="button"
              className="ax-btn ax-btn-random"
              onClick={() => runRandomPick("smart")}
              disabled={randomFinding || loading}
              title="Pick a random unsolved problem from this sheet (respects filters)"
              aria-label="Random Problem"
            >
              {randomFinding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Shuffle size={14} />
              )}
              {randomFinding ? "Finding Problem…" : "Random Problem"}
            </button>
          </div>
        </div>

        <section className="ax-progress-banner" aria-label="Overall progress">
          <div className="ax-progress-banner-head">
            <span className="ax-progress-kicker">Overall Progress</span>
          </div>
          <div className="ax-progress-banner-body">
            <div
              className="ax-ring"
              style={{ ["--progress-deg" as string]: progressDeg }}
              aria-label={`${progress.pct}% complete`}
            >
              <div className="ax-ring-inner">
                <strong>{progress.pct}%</strong>
                <span>
                  {progress.solved} / {progress.total}
                </span>
              </div>
            </div>
            <div className="ax-progress-legend">
              <div>
                <i className="easy" />
                <span className="ax-diff-label">Easy</span>
                <b>
                  {progress.byDiff.easy.solved} / {progress.byDiff.easy.total}
                </b>
              </div>
              <div>
                <i className="medium" />
                <span className="ax-diff-label">Medium</span>
                <b>
                  {progress.byDiff.medium.solved} / {progress.byDiff.medium.total}
                </b>
              </div>
              <div>
                <i className="hard" />
                <span className="ax-diff-label">Hard</span>
                <b>
                  {progress.byDiff.hard.solved} / {progress.byDiff.hard.total}
                </b>
              </div>
            </div>
          </div>
        </section>

        {rowError && (
          <div className="ax-error" role="alert">
            {rowError}
            <button type="button" onClick={() => setRowError("")} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div className="ax-loading">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="ax-empty">No problems found.</div>
        ) : sheetTab !== "all" ? (
          <section className="ax-topic open flat">
            <div className="ax-problem-list">{renderProblemRows(filtered)}</div>
          </section>
        ) : (
          <div className="ax-topics">
            {sheetSections.map(({ name: category, items }) => {
              const catSolved = items.filter((p) =>
                isSheetCompleted(p.id || p._id, submissions, sheetResetAt)
              ).length;
              const catPct = items.length
                ? Math.round((catSolved / items.length) * 100)
                : 0;
              const open = expanded[category] === true;
              return (
                <section key={category} className={`ax-topic ${open ? "open" : ""}`}>
                  <button
                    type="button"
                    className="ax-topic-head"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [category]: !prev[category] }))
                    }
                  >
                    <ChevronRight size={18} className="ax-chevron" />
                    <span className="ax-topic-name">{category}</span>
                    <span className="ax-topic-bar">
                      <i style={{ width: `${catPct}%` }} />
                    </span>
                    <span className="ax-topic-count">
                      {catSolved} / {items.length}
                    </span>
                  </button>
                  <div className={`ax-topic-body ${open ? "open" : ""}`}>
                    <div className="ax-problem-list">{renderProblemRows(items)}</div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <aside className="ax-rail" aria-label="DSA progress and learning tools">
        <div className="ax-rail-card">
          <div className="ax-rail-card-head">
            <h3>AlgoPath Progress</h3>
            <span
              className="ax-rail-info"
              title={`${progress.pct}% of sheet solved · ${streak} day streak`}
              aria-label={`${progress.pct}% complete, ${streak} day streak`}
            >
              <Info size={14} strokeWidth={2} />
            </span>
          </div>

          <div className="ax-rail-progress">
            <div
              className="ax-ring md"
              style={{ ["--progress-deg" as string]: progressDeg }}
              aria-hidden
            >
              <div className="ax-ring-inner">
                <strong>
                  {progress.solved}
                  <span className="ax-ring-sep">/</span>
                  {progress.total || 0}
                </strong>
              </div>
            </div>

            <div className="ax-rail-legend">
              <div>
                <i className="easy" />
                <span className="ax-diff-label">Easy</span>
                <b>
                  {progress.byDiff.easy.solved} / {progress.byDiff.easy.total}
                </b>
              </div>
              <div>
                <i className="medium" />
                <span className="ax-diff-label">Medium</span>
                <b>
                  {progress.byDiff.medium.solved} / {progress.byDiff.medium.total}
                </b>
              </div>
              <div>
                <i className="hard" />
                <span className="ax-diff-label">Hard</span>
                <b>
                  {progress.byDiff.hard.solved} / {progress.byDiff.hard.total}
                </b>
              </div>
            </div>
          </div>

          <p className="ax-rail-streak">
            <Flame size={13} strokeWidth={2} aria-hidden />
            {streak} day streak
          </p>
        </div>

        <div className="ax-rail-links">
          {(
            [
              { id: "calendar" as const, label: "Calendar + Roadmap", Icon: CalendarDays },
              { id: "sessions" as const, label: "Sessions", Icon: Timer },
              { id: "planner" as const, label: "Daily Planner", Icon: ListTodo },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="ax-rail-link"
              onClick={() => onNavigateLearning?.(id)}
            >
              <span>
                <Icon size={15} strokeWidth={1.75} /> {label}
              </span>
              <ChevronRight size={15} strokeWidth={2} aria-hidden />
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
                  className="dsa-note-primary"
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

      <ConfirmDialog
        open={importPreviewOpen}
        title="Import Progress"
        confirmVariant="primary"
        confirmLabel="Import"
        confirmingLabel="Importing…"
        confirming={importConfirming}
        cancelLabel="Nah, Not now"
        onCancel={() => {
          if (!importConfirming) {
            setImportPreviewOpen(false);
            setImportPreview(null);
          }
        }}
        onConfirm={() => {
          void confirmImportProgress();
        }}
        description={
          importPreview ? (
            <div style={{ fontSize: "0.88rem", lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 8px" }}>
                Auto-fill progress from past submissions
              </p>
              <p style={{ margin: "0 0 10px" }}>
                <strong>{importPreview.totalSubmissions}</strong> submissions found ·{" "}
                <strong>{importPreview.uniqueProblems}</strong> unique problems
              </p>
              <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                <li>✓ {importPreview.solvedProblems} Solved</li>
                <li>🟡 {importPreview.attemptedProblems} Attempted</li>
              </ul>
              <p style={{ margin: "0 0 8px" }}>
                {importPreview.affectedSheets} learning sheet
                {importPreview.affectedSheets === 1 ? "" : "s"} will be synchronized
              </p>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                {importPreview.revisionItemsAffected} revision/weak-problem records may
                be updated. Activity and streak will sync from your submission history.
              </p>
            </div>
          ) : (
            "Preparing preview…"
          )
        }
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset sheet progress?"
        description={
          <>
            <p>
              This will reset all your learning progress for {STRIVER_A2Z_SHEET_NAME}.
              Your solved problems, completion percentage, and sheet progress will be
              reset.
            </p>
            <p>
              Your solved problems, submissions, bookmarks and revision data will NOT
              be affected.
            </p>
          </>
        }
        warning="This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Reset Progress"
        confirmVariant="danger"
        confirming={resetConfirming}
        confirmingLabel="Resetting…"
        onCancel={() => {
          if (!resetConfirming) setResetConfirmOpen(false);
        }}
        onConfirm={() => {
          void handleResetProgress();
        }}
      />

      {completeDialogOpen && (
        <div
          className="lc-confirm-overlay"
          role="presentation"
          onClick={() => {
            if (!randomFinding) setCompleteDialogOpen(false);
          }}
        >
          <div
            className="lc-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ax-random-complete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ax-random-complete-title" className="lc-confirm-title">
              {completeDialogKind === "sheet"
                ? "You've completed this sheet!"
                : "All matching problems completed"}
            </h3>
            <div className="lc-confirm-desc">
              {completeDialogKind === "sheet" ? (
                <p>
                  Great work — you finished every problem in {STRIVER_A2Z_SHEET_NAME}.
                  Practice any problem or revisit ones you already solved.
                </p>
              ) : (
                <p>
                  There are no remaining incomplete problems for your current filters.
                  Pick any matching problem or practice solved ones.
                </p>
              )}
            </div>
            <div className="lc-confirm-actions ax-random-complete-actions">
              <button
                type="button"
                className="lc-confirm-btn lc-confirm-cancel"
                disabled={randomFinding}
                onClick={() => setCompleteDialogOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="lc-confirm-btn lc-confirm-confirm primary"
                disabled={randomFinding}
                onClick={() => handleCompleteDialogPick("any")}
              >
                Pick Any Problem
              </button>
              <button
                type="button"
                className="lc-confirm-btn lc-confirm-confirm danger"
                disabled={randomFinding}
                onClick={() => handleCompleteDialogPick("solved-only")}
              >
                Practice Solved Problems
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`ax-toast ${toast.type}`} role="status" aria-live="polite">
          {toast.text}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
};
