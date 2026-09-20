import { useEffect, useMemo, useRef, useState, type FC, type MouseEvent } from "react";
import {
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Code,
  ExternalLink,
  FileText,
  Flag,
  Flame,
  Heart,
  Info,
  ListTodo,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Shuffle,
  Star,
  Timer,
  Upload,
  Lock,
  X,
} from "lucide-react";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
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
  type DsaBestSheet,
  type SheetDifficulty,
  type SheetProblemRef,
  type SheetTopic,
} from "../data/dsaBestSheet";
import { sheetApi, type SheetPreview } from "../api/sheetApi";
import {
  getProblemResources,
  loadNotes,
  saveNotes,
} from "../utils/workspacePersistence";
import { engagementApi } from "../api/engagementApi";
import { contentApi } from "../api/contentApi";
import { sheetProgressApi } from "../api/sheetProgressApi";
import { progressApi, type ProgressImportPreview } from "../api/progressApi";
import { YouTubeResourceIcon } from "./YouTubeResourceIcon";
import { ProblemShare } from "./ProblemShare";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  loadAllSessions,
  syncPlannerWithAccepted,
  toDateKey,
  type StudySession,
} from "../utils/learningPersistence";
import { hasAccessToken } from "../api/accessToken";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../access/canAccess";
import {
  buildDayActivityMap,
  computeStreaks,
  everAcceptedProblemIds,
} from "../utils/learningStats";
import { PremiumBadge } from "./access/PremiumBadge";
import { PremiumNavIndicator } from "./access/PremiumNavIndicator";
import { getPlatformNavItem } from "../nav/platformNav";
import { setPendingPremiumNav } from "../access/pendingPremiumNav";

const importBannerKey = (uid: string) => `ax-import-banner-dismissed:${uid}`;

function previewToCatalog(preview: SheetPreview): DsaBestSheet | null {
  const sections = preview.sections;
  if (!sections?.length) return null;

  const topics: SheetTopic[] = [];
  const uniqueMap = new Map<
    string,
    SheetProblemRef & { category: string; topics: string[] }
  >();
  let order = 0;

  for (const sec of sections) {
    for (const topic of sec.topics || []) {
      const topicName = topic.title || topic.name || "General";
      const problems: SheetProblemRef[] = [];

      for (const p of topic.problems || []) {
        if (!p.slug && !p.title) continue;
        const ref: SheetProblemRef = {
          title: p.title || p.slug || "Untitled",
          slug: p.slug || "",
          difficulty: String(p.difficulty || "easy").toLowerCase() as SheetDifficulty,
        };
        problems.push(ref);
        const key = ref.slug.toLowerCase() || ref.title.toLowerCase();
        const existing = uniqueMap.get(key);
        if (existing) {
          if (!existing.topics.includes(topicName)) {
            existing.topics.push(topicName);
          }
        } else {
          uniqueMap.set(key, {
            ...ref,
            category: topicName,
            topics: [topicName],
          });
        }
      }

      if (problems.length) {
        topics.push({ order: order++, name: topicName, problems });
      }
    }
  }

  if (!topics.length) return null;
  const uniqueProblems = Array.from(uniqueMap.values());
  return {
    name: preview.title || preview.name || "Sheet",
    topics,
    uniqueProblems,
    stats: {
      topics: topics.length,
      sheetEntries: topics.reduce((n, t) => n + t.problems.length, 0),
      uniqueProblems: uniqueProblems.length,
    },
  };
}

interface ProblemsSheetProps {
  problems: Problem[];
  loading: boolean;
  submissions: Submission[];
  searchQuery: string;
  selectedDifficulty: string;
  accessFilter?: "all" | "free" | "premium";
  statusFilter: "all" | "solved" | "attempted" | "unsolved";
  bookmarkedIds: Set<string>;
  favouriteIds?: Set<string>;
  importantIds?: Set<string>;
  revisionIds: Set<string>;
  userId?: string;
  learningRefreshKey?: number;
  userName?: string;
  problemPage?: number;
  totalPages?: number;
  onProblemPageChange?: (page: number) => void;
  onSearchChange: (q: string) => void;
  onDifficultyChange: (d: string) => void;
  onAccessFilterChange?: (a: "all" | "free" | "premium") => void;
  onStatusFilterChange: (s: "all" | "solved" | "attempted" | "unsolved") => void;
  onSelectProblem: (p: Problem) => void;
  onRemoveBookmark?: (problemId: string) => void;
  onBookmarkChange?: (problemId: string, isBookmarked: boolean) => void;
  onFavoriteChange?: (problemId: string, isFavourite: boolean) => void;
  onImportantChange?: (problemId: string, isImportant: boolean) => void;
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
  accessFilter = "all",
  statusFilter,
  bookmarkedIds,
  favouriteIds = new Set(),
  importantIds = new Set(),
  revisionIds,
  userId,
  learningRefreshKey = 0,
  problemPage = 1,
  totalPages = 1,
  onProblemPageChange,
  onSearchChange,
  onDifficultyChange,
  onAccessFilterChange,
  onStatusFilterChange,
  onSelectProblem,
  onBookmarkChange,
  onFavoriteChange,
  onImportantChange,
  onRevisionChange,
  onOpenAdmin: _onOpenAdmin,
  onNavigateLearning,
  onProgressImported,
}) => {
  const { user } = useAuth();
  const [sheetTab, setSheetTab] = useState<
    "all" | "revision" | "bookmarks" | "favourites" | "important"
  >("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [noteProblem, setNoteProblem] = useState<Problem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteTagsDraft, setNoteTagsDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteProblemIds, setNoteProblemIds] = useState<Set<string>>(new Set());
  const [revisionBusy, setRevisionBusy] = useState<string | null>(null);
  const [bookmarkBusy, setBookmarkBusy] = useState<string | null>(null);
  const [favouriteBusy, setFavouriteBusy] = useState<string | null>(null);
  const [importantBusy, setImportantBusy] = useState<string | null>(null);
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
  const [activeCatalog, setActiveCatalog] = useState<DsaBestSheet>(DSA_BEST_SHEET);
  const [catalogSource, setCatalogSource] = useState<"server" | "fallback">(
    "fallback"
  );
  const [activeSheetId, setActiveSheetId] = useState(STRIVER_A2Z_SHEET_ID);
  const [sheetDisplayName, setSheetDisplayName] = useState(STRIVER_A2Z_SHEET_NAME);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const listRes = await sheetApi.listPublished();
        const sheets = listRes.data || [];
        const picked =
          sheets.find((s) => s.id === STRIVER_A2Z_SHEET_ID) || sheets[0];
        if (!picked) return;
        const previewRes = await sheetApi.getPreview(picked.id);
        const catalog = previewRes.data
          ? previewToCatalog(previewRes.data)
          : null;
        if (!cancelled && catalog) {
          setActiveCatalog(catalog);
          setCatalogSource("server");
          setActiveSheetId(picked.id);
          setSheetDisplayName(picked.name || catalog.name);
        }
      } catch {
        /* bundled fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !hasAccessToken()) {
      setNoteProblemIds(new Set());
      return;
    }
    void contentApi
      .listUserNotes(userId)
      .then((res) => {
        if (cancelled) return;
        const ids = new Set<string>();
        for (const n of res.data || []) {
          const pid = normalizeProblemId(n.problemId);
          if (!pid) continue;
          if (String(n.noteText || "").trim()) {
            ids.add(pid);
            saveNotes(userId, pid, n.noteText);
          }
        }
        setNoteProblemIds(ids);
      })
      .catch(() => {
        if (!cancelled) setNoteProblemIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
    for (const ref of activeCatalog.uniqueProblems) {
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
  }, [problemBySlug, activeCatalog]);

  useEffect(() => {
    if (!userId) {
      setSheetResetAt(null);
      setImportBannerVisible(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await sheetProgressApi.getProgress(activeSheetId);
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
  }, [userId, activeSheetId]);

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
        const sheetRes = await sheetProgressApi.getProgress(activeSheetId);
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
    const pid = normalizeProblemId(p.id || p._id);
    const matchTab =
      sheetTab === "all" ||
      (sheetTab === "revision" && revisionIds.has(pid)) ||
      (sheetTab === "bookmarks" && bookmarkedIds.has(pid)) ||
      (sheetTab === "favourites" && favouriteIds.has(pid)) ||
      (sheetTab === "important" && importantIds.has(pid));
    const completed = isSheetCompleted(pid, submissions, sheetResetAt);
    const attempted = !completed && hasAttempted(pid, submissions);
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "solved" && completed) ||
      (statusFilter === "attempted" && attempted) ||
      (statusFilter === "unsolved" && !completed);
    return matchTab && matchStatus;
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
    favouriteIds,
    importantIds,
    statusFilter,
    submissions,
    sheetResetAt,
  ]);

  /** Topic-wise sections from DSA Best Sheet (problems may appear under multiple topics). */
  const sheetSections = useMemo(() => {
    const sections = activeCatalog.topics.map((topic) => {
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
      activeCatalog.uniqueProblems.map((p) => p.slug.toLowerCase())
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
    activeCatalog,
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

  useEffect(() => {
    if (!userId) {
      setStudySessions([]);
      return;
    }
    const allowPlanner = canAccess(user, "premium.daily_planner");
    const allowSessions = canAccess(user, "premium.study_sessions");
    if (!allowPlanner && !allowSessions) {
      setStudySessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (allowPlanner) {
          await syncPlannerWithAccepted(
            userId,
            toDateKey(),
            everAcceptedProblemIds(submissions)
          );
        }
        if (allowSessions) {
          const list = await loadAllSessions(userId);
          if (!cancelled) setStudySessions(list);
        } else if (!cancelled) {
          setStudySessions([]);
        }
      } catch {
        /* ignore — streak still uses submissions */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, user, submissions, learningRefreshKey]);

  const streak = useMemo(() => {
    return computeStreaks(buildDayActivityMap(submissions, studySessions))
      .current;
  }, [submissions, studySessions]);

  useEffect(() => {
    if (sheetSections.length === 0) return;
    setExpanded((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of sheetSections) {
        if (next[s.name] === undefined) {
          next[s.name] = true; // expand topics by default so the list is visible
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sheetSections]);


  const handleResetProgress = async () => {
    if (resetInFlight.current || resetConfirming) return;
    resetInFlight.current = true;
    setResetConfirming(true);
    try {
      const res = await sheetProgressApi.resetProgress(activeSheetId);
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
    if (pid) pushRecentRandomId(activeSheetId, pid);
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
            recentIds: loadRecentRandomIds(activeSheetId),
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
    setNoteTagsDraft("");
    setNoteError("");
    if (userId && pid && hasAccessToken()) {
      void contentApi
        .getProblemNote(userId, pid)
        .then((res) => {
          const text = String(res.data?.noteText ?? "");
          setNoteDraft(text);
          setNoteTagsDraft((res.data?.tags || []).join(", "));
          saveNotes(userId, pid, text);
        })
        .catch(() => {
          /* keep cache draft */
        });
    }
  };

  const saveNote = async () => {
    if (!noteProblem) return;
    const pid = normalizeProblemId(noteProblem.id || noteProblem._id);
    if (!pid) return;
    if (!userId || !hasAccessToken()) {
      setNoteError("Sign in to save notes to your account.");
      return;
    }
    setNoteSaving(true);
    setNoteError("");
    const tags = noteTagsDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const res = await contentApi.upsertProblemNote({
        userId,
        problemId: pid,
        content: noteDraft,
        tags,
      });
      const saved = Boolean(res.data?.noteText?.trim());
      saveNotes(userId, pid, saved ? noteDraft : "");
      setNoteProblemIds((prev) => {
        const next = new Set(prev);
        if (saved) next.add(pid);
        else next.delete(pid);
        return next;
      });
      setNoteProblem(null);
    } catch {
      setNoteError("Failed to save note. Please try again.");
    } finally {
      setNoteSaving(false);
    }
  };

  const deleteNote = async () => {
    if (!noteProblem) return;
    const pid = normalizeProblemId(noteProblem.id || noteProblem._id);
    if (!pid) return;
    if (!userId || !hasAccessToken()) {
      setNoteError("Sign in to delete notes from your account.");
      return;
    }
    setNoteSaving(true);
    setNoteError("");
    try {
      await contentApi.deleteProblemNote(userId, pid);
      saveNotes(userId, pid, "");
      setNoteDraft("");
      setNoteTagsDraft("");
      setNoteProblemIds((prev) => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
      setNoteProblem(null);
    } catch {
      setNoteError("Failed to delete note. Please try again.");
    } finally {
      setNoteSaving(false);
    }
  };

  const toggleRevision = async (p: Problem, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pid = normalizeProblemId(p.id || p._id);
    if (!pid || revisionBusy) return;
    if (!hasAccessToken()) {
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
    if (!hasAccessToken()) {
      setRowError("Please sign in to bookmark questions.");
      return;
    }
    const prev = bookmarkedIds.has(pid);
    onBookmarkChange?.(pid, !prev);
    setBookmarkBusy(pid);
    setRowError("");
    try {
      const res = await engagementApi.toggleBookmark(pid);
      // Bookmark flag only — never drive favourite UI from this response.
      const next =
        typeof res.data?.isBookmarked === "boolean"
          ? res.data.isBookmarked
          : !prev;
      onBookmarkChange?.(pid, next);
      setToast({
        type: "success",
        text: next ? "Bookmarked" : "Removed bookmark",
      });
    } catch (err: any) {
      onBookmarkChange?.(pid, prev);
      setRowError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update bookmark. Please try again."
      );
      setToast({
        type: "error",
        text: "Unable to update bookmark. Please try again.",
      });
    } finally {
      setBookmarkBusy(null);
    }
  };

  const toggleFavourite = async (p: Problem, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pid = normalizeProblemId(p.id || p._id);
    if (!pid || favouriteBusy) return;
    if (!hasAccessToken()) {
      setRowError("Please sign in to favourite questions.");
      return;
    }
    const prev = favouriteIds.has(pid);
    onFavoriteChange?.(pid, !prev);
    setFavouriteBusy(pid);
    setRowError("");
    try {
      const res = await engagementApi.toggleFavorite(pid);
      const next =
        typeof res.data?.isFavourite === "boolean"
          ? res.data.isFavourite
          : !prev;
      onFavoriteChange?.(pid, next);
      setToast({
        type: "success",
        text: next ? "Added to favourites" : "Removed from favourites",
      });
    } catch (err: any) {
      onFavoriteChange?.(pid, prev);
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
      setFavouriteBusy(null);
    }
  };

  const toggleImportant = async (p: Problem, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pid = normalizeProblemId(p.id || p._id);
    if (!pid || importantBusy) return;
    if (!hasAccessToken()) {
      setRowError("Please sign in to mark questions as important.");
      return;
    }
    const prev = importantIds.has(pid);
    onImportantChange?.(pid, !prev);
    setImportantBusy(pid);
    setRowError("");
    try {
      const res = await engagementApi.toggleImportant(pid);
      const next =
        typeof res.data?.isImportant === "boolean"
          ? res.data.isImportant
          : !prev;
      onImportantChange?.(pid, next);
      setToast({
        type: "success",
        text: next ? "Marked important" : "Removed important",
      });
    } catch (err: any) {
      onImportantChange?.(pid, prev);
      setRowError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update important. Please try again."
      );
      setToast({
        type: "error",
        text: "Unable to update important. Please try again.",
      });
    } finally {
      setImportantBusy(null);
    }
  };

  const handleResourceClick = (
    p: Problem,
    url: string | undefined,
    isPremium: boolean | undefined,
    e: MouseEvent
  ) => {
    e.stopPropagation();
    if (isPremium || !url || (p.isPremium && p.accessLocked)) {
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
      const isFav = favouriteIds.has(pid);
      const isImp = importantIds.has(pid);
      const noted = noteProblemIds.has(pid);
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
          <span className="ax-row-num">{String(itemIdx + 1).padStart(2, "0")}</span>
          <div className="ax-row-main">
            <button
              type="button"
              className="ax-row-title"
              onClick={() => onSelectProblem(prob)}
            >
              {prob.isPremium || prob.accessLocked ? (
                <Lock size={12} aria-hidden className="ax-row-lock" />
              ) : null}
              {prob.title}
              {prob.isPremium ? (
                <PremiumBadge className="ax-row-premium-badge" label="Premium" />
              ) : null}
            </button>
            <div className="ax-row-meta">
              <span className={`ax-diff ${diff}`}>
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </span>
              <span className="ax-row-topic">{prob.category || "General"}</span>
            </div>
          </div>
          <span
            className={`ax-row-state ${
              solved ? "is-solved" : attempted ? "is-attempted" : "is-todo"
            }`}
          >
            {solved ? (
              <>
                <Check size={12} strokeWidth={2.5} aria-hidden /> Solved
              </>
            ) : attempted ? (
              <>Attempted</>
            ) : (
              <>Not solved</>
            )}
          </span>
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
              title="Open problem"
              aria-label="Open problem"
              onClick={() => onSelectProblem(prob)}
            >
              <ChevronRight size={14} />
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
              title={isBm ? "Remove bookmark" : "Bookmark — save for later"}
              aria-label={isBm ? "Remove bookmark" : "Bookmark this problem"}
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
              className={`ax-icon ${isFav ? "on-favourite" : ""}`}
              title={isFav ? "Remove favourite" : "Favourite — preferred problem"}
              aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
              aria-pressed={isFav}
              disabled={favouriteBusy === pid}
              onClick={(e) => void toggleFavourite(prob, e)}
            >
              {favouriteBusy === pid ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Heart size={14} fill={isFav ? "currentColor" : "none"} />
              )}
            </button>
            <button
              type="button"
              className={`ax-icon ${isImp ? "on-important" : ""}`}
              title={isImp ? "Remove important" : "Important — interview / exam priority"}
              aria-label={isImp ? "Remove important mark" : "Mark as important"}
              aria-pressed={isImp}
              disabled={importantBusy === pid}
              onClick={(e) => void toggleImportant(prob, e)}
            >
              {importantBusy === pid ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Star size={14} fill={isImp ? "currentColor" : "none"} />
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
                <RefreshCw size={14} />
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
          <div className="ax-hero-brand">
            <span className="ax-hero-icon" aria-hidden>
              <BookOpen size={20} strokeWidth={1.75} />
            </span>
            <div className="ax-hero-copy">
              <p className="ax-hero-kicker">Learning workspace</p>
              <h1>{sheetDisplayName}</h1>
              <p className="ax-hero-sub">Learn DSA from A to Z</p>
              <p className="ax-hero-stats">
                {activeCatalog.stats.topics} Topics ·{" "}
                {activeCatalog.stats.uniqueProblems} Problems · Topic-wise practice
              </p>
              <div className="ax-hero-meta-row">
                <span
                  className={`ax-meta ${catalogSource !== "server" ? "is-fallback" : ""}`}
                >
                  {catalogSource === "server"
                    ? "Progress synced"
                    : "Bundled catalog fallback"}
                </span>
                <span className="ax-meta is-plain">
                  Last updated: {lastUpdated}
                </span>
              </div>
            </div>
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
          </div>
        </header>

        {userId && importBannerVisible && (
          <div className="ax-import-banner" role="region" aria-label="Import progress">
            <div className="ax-import-banner-copy">
              <strong>Import previous progress</strong>
              <span>Sync solved problems from your past submissions.</span>
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
                Not now
              </button>
            </div>
          </div>
        )}

        {userId ? (
          <section className="ax-progress-strip" aria-label="Overall progress">
            <div className="ax-progress-strip-main">
              <div className="ax-progress-strip-head">
                <span className="ax-progress-kicker">Overall progress</span>
                <strong>
                  {progress.solved} / {progress.total || 0} solved
                </strong>
              </div>
              <div className="ax-progress-strip-bar" aria-hidden>
                <i style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
            <div className="ax-progress-strip-stats">
              <div>
                <span className="ax-diff-dot easy" aria-hidden />
                Easy{" "}
                <b>
                  {progress.byDiff.easy.solved}/{progress.byDiff.easy.total}
                </b>
              </div>
              <div>
                <span className="ax-diff-dot medium" aria-hidden />
                Medium{" "}
                <b>
                  {progress.byDiff.medium.solved}/{progress.byDiff.medium.total}
                </b>
              </div>
              <div>
                <span className="ax-diff-dot hard" aria-hidden />
                Hard{" "}
                <b>
                  {progress.byDiff.hard.solved}/{progress.byDiff.hard.total}
                </b>
              </div>
              <div className="ax-progress-strip-streak">
                <Flame size={12} aria-hidden />
                {streak} day streak
              </div>
            </div>
          </section>
        ) : (
          <section className="ax-progress-strip" aria-label="Sign in for progress">
            <p className="ax-progress-guest">
              Sign in to track sheet progress, streaks, and synced solves.
            </p>
          </section>
        )}

        <div className="ax-controls">
          <div className="ax-tabs" role="tablist" aria-label="Sheet views">
            {(
              [
                ["all", `All (${activeCatalog.stats.uniqueProblems})`],
                ["bookmarks", `Bookmarked (${bookmarkedIds.size})`],
                ["favourites", `Favorites (${favouriteIds.size})`],
                ["important", `Important (${importantIds.size})`],
                ["revision", `Revision (${revisionIds.size})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={sheetTab === id}
                className={`ax-tab ${sheetTab === id ? "active" : ""}`}
                onClick={() => setSheetTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ax-filters">
            <div className="ax-search">
              <Search size={14} aria-hidden />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search problems..."
                aria-label="Search problems"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="ax-search-clear"
                  onClick={() => onSearchChange("")}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
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
            <select
              value={accessFilter}
              aria-label="Access"
              onChange={(e) =>
                onAccessFilterChange?.(
                  e.target.value as "all" | "free" | "premium"
                )
              }
            >
              <option value="all">Access</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
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
              {randomFinding ? "Finding…" : "Random"}
            </button>
          </div>
        </div>

        {loading && problems.length > 0 ? (
          <div className="ax-updating" role="status" aria-live="polite">
            <Loader2 size={12} className="animate-spin" aria-hidden />
            Updating…
          </div>
        ) : null}

        {rowError && (
          <div className="ax-error" role="alert">
            {rowError}
            <button type="button" onClick={() => setRowError("")} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {loading && problems.length === 0 ? (
          <div className="ax-skel" aria-busy="true" aria-label="Loading sheet">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ax-skel-topic">
                <div className="ax-skel-row" style={{ gridTemplateColumns: "24px 1fr 80px 48px" }}>
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-4 w-10" />
                </div>
                {i === 0
                  ? Array.from({ length: 3 }).map((__, j) => (
                      <div key={j} className="ax-skel-row">
                        <Skeleton className="h-3 w-6" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-5 w-14 rounded" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))
                  : null}
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="ax-empty-panel">
            {(() => {
              const clearFilters = (
                <button
                  type="button"
                  className="ax-btn"
                  onClick={() => {
                    onSearchChange("");
                    onDifficultyChange("All");
                    onStatusFilterChange("all");
                    onAccessFilterChange?.("all");
                    setSheetTab("all");
                  }}
                >
                  Clear filters
                </button>
              );
              if (sheetTab === "bookmarks") {
                return (
                  <EmptyState
                    icon={<Bookmark size={22} strokeWidth={1.75} />}
                    title="No bookmarked problems yet"
                    description="Save problems while practicing and they will appear here."
                    action={
                      <button type="button" className="ax-btn accent" onClick={() => setSheetTab("all")}>
                        Explore problems
                      </button>
                    }
                  />
                );
              }
              if (sheetTab === "favourites") {
                return (
                  <EmptyState
                    icon={<Star size={22} strokeWidth={1.75} />}
                    title="No favorite problems yet"
                    description="Mark problems as favorites to build your shortlist."
                    action={
                      <button type="button" className="ax-btn accent" onClick={() => setSheetTab("all")}>
                        Explore problems
                      </button>
                    }
                  />
                );
              }
              if (sheetTab === "important") {
                return (
                  <EmptyState
                    icon={<Flag size={22} strokeWidth={1.75} />}
                    title="No important problems yet"
                    description="Flag interview-critical problems to keep them in focus."
                    action={
                      <button type="button" className="ax-btn accent" onClick={() => setSheetTab("all")}>
                        Explore problems
                      </button>
                    }
                  />
                );
              }
              if (sheetTab === "revision") {
                return (
                  <EmptyState
                    icon={<RefreshCw size={22} strokeWidth={1.75} />}
                    title="No problems in revision"
                    description="Add problems to revision when you want to revisit them later."
                    action={
                      <button type="button" className="ax-btn accent" onClick={() => setSheetTab("all")}>
                        Explore problems
                      </button>
                    }
                  />
                );
              }
              return (
                <EmptyState
                  icon={<Search size={22} strokeWidth={1.75} />}
                  title="No problems found"
                  description="Try changing your search or filters."
                  action={clearFilters}
                />
              );
            })()}
          </div>
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
              const open = expanded[category] !== false;
              const completed = items.length > 0 && catSolved === items.length;
              return (
                <section
                  key={category}
                  className={`ax-topic ${open ? "open" : ""} ${completed ? "completed" : ""}`}
                >
                  <button
                    type="button"
                    className="ax-topic-head"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [category]: !open }))
                    }
                  >
                    <ChevronRight size={16} className="ax-chevron" />
                    <span className="ax-topic-name-wrap">
                      <span className="ax-topic-name">{category}</span>
                      <span className="ax-topic-sub">
                        {items.length} problem{items.length === 1 ? "" : "s"} ·{" "}
                        {catSolved} solved
                        {completed ? " · Completed" : ""}
                      </span>
                    </span>
                    <span className="ax-topic-bar" aria-hidden>
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

        {totalPages > 1 && onProblemPageChange ? (
          <div className="ax-pagination">
            <button
              type="button"
              className="ax-btn"
              disabled={problemPage <= 1 || loading}
              onClick={() => onProblemPageChange(Math.max(1, problemPage - 1))}
            >
              ← Previous
            </button>
            <span>
              Page {problemPage} of {totalPages}
            </span>
            <button
              type="button"
              className="ax-btn"
              disabled={problemPage >= totalPages || loading}
              onClick={() =>
                onProblemPageChange(Math.min(totalPages, problemPage + 1))
              }
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>

      <aside className="ax-rail" aria-label="DSA progress and learning tools">
        <div className="ax-rail-card">
          <div className="ax-rail-card-head">
            <h3>{userId ? "AlgoPath Progress" : "Browse the sheet"}</h3>
            {userId ? (
            <span
              className="ax-rail-info"
              title={`${progress.pct}% of sheet solved · ${streak} day streak`}
              aria-label={`${progress.pct}% complete, ${streak} day streak`}
            >
              <Info size={14} strokeWidth={2} />
            </span>
            ) : null}
          </div>

          {userId ? (
          <>
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
          </>
          ) : (
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
            Open any problem to preview the statement. Sign in to save favourites, submit, and track a streak.
          </p>
          )}
        </div>

        <div className="ax-rail-links">
          {(
            [
              {
                id: "calendar" as const,
                label: "Calendar + Roadmap",
                Icon: CalendarDays,
              },
              { id: "sessions" as const, label: "Sessions", Icon: Timer },
              {
                id: "planner" as const,
                label: "Daily Planner",
                Icon: ListTodo,
              },
            ] as const
          ).map(({ id, label, Icon }) => {
            const nav = getPlatformNavItem(id);
            const feature = nav?.premiumFeature;
            const locked = Boolean(feature && !canAccess(user, feature));
            const isPremium = Boolean(feature);
            const tip = locked
              ? `${label} — Premium feature — Upgrade to unlock`
              : isPremium
                ? `${label} — Premium feature — Included in your plan`
                : label;
            return (
              <button
                key={id}
                type="button"
                className="ax-rail-link"
                title={tip}
                aria-label={tip}
                onClick={() => {
                  if (feature && locked) {
                    setPendingPremiumNav(id, feature);
                  }
                  onNavigateLearning?.(id);
                }}
              >
                <span>
                  <Icon size={15} strokeWidth={1.75} /> {label}
                  {isPremium ? (
                    <PremiumNavIndicator locked={locked} variant="inline" />
                  ) : null}
                </span>
                <ChevronRight size={15} strokeWidth={2} aria-hidden />
              </button>
            );
          })}
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
            <input
              type="text"
              className="dsa-note-tags"
              value={noteTagsDraft}
              onChange={(e) => setNoteTagsDraft(e.target.value)}
              placeholder="Tags (comma-separated)"
              aria-label="Note tags"
            />
            {noteError && <p className="dsa-note-error">{noteError}</p>}
            <div className="dsa-note-actions">
              <button
                type="button"
                className="dsa-note-danger"
                disabled={noteSaving}
                onClick={() => void deleteNote()}
              >
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
                  onClick={() => void saveNote()}
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
