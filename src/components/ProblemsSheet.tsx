import { useEffect, useMemo, useRef, useState, type FC, type MouseEvent } from "react";
import {
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Flag,
  Heart,
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
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import { EmptyState } from "./ui/empty-state";
import { ErrorBoundary } from "./ui/error-boundary";
import { ErrorState } from "./ui/error-state";
import { Skeleton } from "./ui/skeleton";
import { useToast } from "../context/ToastContext";
import { getErrorToastMessage } from "../lib/apiError";
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
  fetchError?: unknown;
  onRetryFetch?: () => void;
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
  fetchError,
  onRetryFetch,
}) => {
  const { user } = useAuth();
  const globalToast = useToast();
  const [sheetTab, setSheetTab] = useState<
    "all" | "revision" | "bookmarks" | "favourites" | "important"
  >("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
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

  /** Topic-wise sections from DSA Best Sheet. */
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

  /** Sidebar Topic Items with computed progress */
  const topicNavItems = useMemo(() => {
    return activeCatalog.topics.map((topic) => {
      const seen = new Set<string>();
      const items: Problem[] = [];
      for (const ref of topic.problems) {
        const hit =
          problemBySlug.get(ref.slug.toLowerCase()) ||
          problemBySlug.get(ref.title.trim().toLowerCase());
        if (!hit) continue;
        const pid = (hit.id || hit._id || hit.slug || "").toString();
        if (seen.has(pid)) continue;
        seen.add(pid);
        items.push(hit);
      }
      const solved = items.filter((p) =>
        isSheetCompleted(p.id || p._id, submissions, sheetResetAt)
      ).length;
      return {
        name: topic.name,
        total: items.length,
        solved,
        pct: items.length ? Math.round((solved / items.length) * 100) : 0,
      };
    });
  }, [activeCatalog, problemBySlug, submissions, sheetResetAt]);

  const visibleSections = useMemo(() => {
    if (selectedTopic === "all") return sheetSections;
    return sheetSections.filter((s) => s.name === selectedTopic);
  }, [sheetSections, selectedTopic]);

  const tabFiltered = useMemo(() => {
    if (selectedTopic === "all") return filtered;
    const sec = visibleSections.find((s) => s.name === selectedTopic);
    return sec ? sec.items : [];
  }, [filtered, selectedTopic, visibleSections]);

  const totalFilteredCount = useMemo(() => {
    if (sheetTab !== "all") {
      return tabFiltered.length;
    }
    return visibleSections.reduce((sum, sec) => sum + sec.items.length, 0);
  }, [sheetTab, tabFiltered.length, visibleSections]);

  const PAGE_SIZE = 50;

  const effectiveTotalPages = useMemo(() => {
    if (totalFilteredCount === 0) return 0;

    const hasClientFilters =
      selectedTopic !== "all" || statusFilter !== "all" || sheetTab !== "all";

    if (hasClientFilters) {
      return Math.ceil(totalFilteredCount / PAGE_SIZE);
    }

    return totalPages > 1
      ? totalPages
      : Math.ceil(totalFilteredCount / PAGE_SIZE);
  }, [totalFilteredCount, selectedTopic, statusFilter, sheetTab, totalPages]);

  // Reset page to 1 whenever any filter changes
  useEffect(() => {
    if (onProblemPageChange && problemPage !== 1) {
      onProblemPageChange(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedTopic,
    statusFilter,
    sheetTab,
    searchQuery,
    selectedDifficulty,
    accessFilter,
  ]);

  // Clamp page if current problemPage exceeds effectiveTotalPages
  useEffect(() => {
    if (
      onProblemPageChange &&
      effectiveTotalPages > 0 &&
      problemPage > effectiveTotalPages
    ) {
      onProblemPageChange(effectiveTotalPages);
    }
  }, [effectiveTotalPages, problemPage, onProblemPageChange]);

  const progress = computeProgress(sheetProblems, submissions, sheetResetAt);
  const sheetAllComplete =
    progress.total > 0 && progress.solved >= progress.total;

  const sheetFiltered = useMemo(
    () => sheetProblems.filter((p) => matchesFilters(p)),
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
        /* ignore */
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
          next[s.name] = true;
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
    onRevisionChange?.(pid, !prev);
    setRevisionBusy(pid);
    setRowError("");
    try {
      const res = await engagementApi.toggleRevision(pid);
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
      const errMsg = getErrorToastMessage(err);
      setRowError(errMsg);
      setToast({ type: "error", text: errMsg });
      globalToast.apiError(err, "Bookmark update failed");
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
      const errMsg = getErrorToastMessage(err);
      setRowError(errMsg);
      setToast({ type: "error", text: errMsg });
      globalToast.apiError(err, "Favourite update failed");
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
      const errMsg = getErrorToastMessage(err);
      setRowError(errMsg);
      setToast({ type: "error", text: errMsg });
      globalToast.apiError(err, "Important update failed");
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

  const handleTopicClick = (topicName: string) => {
    setSelectedTopic(topicName);
    if (topicName !== "all") {
      const el = document.getElementById(`topic-section-${topicName.replace(/\s+/g, "-")}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
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
            className={`ax-row-state ${solved ? "is-solved" : attempted ? "is-attempted" : "is-todo"
              }`}
          >
            {solved ? (
              <>
                <Check size={12} strokeWidth={2.5} aria-hidden /> Solved
              </>
            ) : attempted ? (
              <>
                <span className="ax-dot-attempted" /> Attempted
              </>
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

            <button
              type="button"
              className="ax-solve-btn"
              title="Solve problem"
              aria-label="Solve problem"
              onClick={() => onSelectProblem(prob)}
            >
              Solve <ArrowRight size={13} />
            </button>
          </div>
        </div>
      );
    });

  return (
    <div className="ax-workspace animate-fade-in">
      {/* HERO SECTION */}
      <header className="ax-hero-compact">
        <div className="ax-hero-left">
          <div className="ax-hero-badge-wrap">
            <span className="ax-hero-kicker">Learning Workspace</span>
          </div>
          <h1 className="ax-hero-title">
            <BookOpen size={22} className="ax-hero-icon" />
            {sheetDisplayName}
          </h1>
          <p className="ax-hero-sub">Learn DSA from A to Z</p>
          <div className="ax-hero-meta">
            <span className="ax-tag-pill">
              <Layers size={13} /> {activeCatalog.stats.topics} Topics
            </span>
            <span className="ax-tag-pill">
              <Sparkles size={13} /> {activeCatalog.stats.uniqueProblems} Problems
            </span>
            <span className="ax-tag-pill is-status">
              <span className={`ax-status-dot ${catalogSource !== "server" ? "warning" : ""}`} />
              {catalogSource === "server" ? "Progress synced" : "Bundled catalog"}
            </span>
            <span className="ax-tag-pill is-date">
              Updated {lastUpdated}
            </span>
          </div>
        </div>
        <div className="ax-hero-right">
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
          {userId && (
            <button
              type="button"
              className="ax-btn accent"
              onClick={() => void startImportProgress()}
              disabled={importPreviewing || importConfirming}
              title="Restore solved/attempted progress from past submissions"
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
      </header>

      {/* IMPORT BANNER */}
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

      {/* PROGRESS OVERVIEW CARD */}
      {userId ? (
        <section className="ax-progress-bar-card" aria-label="Your progress">
          <div className="ax-progress-card-header">
            <span className="ax-progress-kicker">YOUR PROGRESS</span>
          </div>

          <div className="ax-progress-main-row">
            <div className="ax-progress-info-left">
              <div className="ax-progress-headline">
                <span className="ax-progress-num">
                  {progress.solved} / {progress.total || 0}
                </span>
                <span className="ax-progress-sub">
                  solved · {progress.pct}% complete
                </span>
              </div>
              <div className="ax-progress-track" aria-hidden>
                <div
                  className="ax-progress-fill"
                  style={{ width: `${Math.max(progress.pct, progress.solved > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>

            <div className="ax-progress-stats-right">
              <div className="ax-stat-block">
                <span className="ax-stat-label">
                  <span className="ax-diff-dot easy" /> EASY
                </span>
                <b className="ax-stat-val">
                  {progress.byDiff.easy.solved} / {progress.byDiff.easy.total}
                </b>
              </div>
              <div className="ax-stat-block">
                <span className="ax-stat-label">
                  <span className="ax-diff-dot medium" /> MEDIUM
                </span>
                <b className="ax-stat-val">
                  {progress.byDiff.medium.solved} / {progress.byDiff.medium.total}
                </b>
              </div>
              <div className="ax-stat-block">
                <span className="ax-stat-label">
                  <span className="ax-diff-dot hard" /> HARD
                </span>
                <b className="ax-stat-val">
                  {progress.byDiff.hard.solved} / {progress.byDiff.hard.total}
                </b>
              </div>
              <div className="ax-stat-block is-streak">
                <span className="ax-stat-label">STREAK</span>
                <b className="ax-stat-val">
                  {streak === 1 ? "1 day" : `${streak} days`}
                </b>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="ax-progress-guest-card" aria-label="Sign in for progress">
          <p className="ax-progress-guest-text">
            Sign in to track sheet progress, streaks, and synced solves across your account.
          </p>
        </section>
      )}

      {/* SEGMENTED NAVIGATION TABS */}
      <nav className="ax-nav-tabs" role="tablist" aria-label="Sheet views">
        {(
          [
            ["all", "All", activeCatalog.stats.uniqueProblems],
            ["bookmarks", "Bookmarked", bookmarkedIds.size],
            ["favourites", "Favorites", favouriteIds.size],
            ["important", "Important", importantIds.size],
            ["revision", "Revision", revisionIds.size],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sheetTab === id}
            className={`ax-tab-btn ${sheetTab === id ? "active" : ""}`}
            onClick={() => setSheetTab(id)}
          >
            <span>{label}</span>
            <span className="ax-tab-badge">{count}</span>
          </button>
        ))}
      </nav>

      {/* SEARCH + FILTER TOOLBAR */}
      <div className="ax-filter-toolbar">
        <div className="ax-search-box">
          <Search size={14} className="ax-search-icon" aria-hidden />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search problems by title, slug, or topic..."
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

        <div className="ax-filter-group">
          <select
            className="ax-select"
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
            className="ax-select"
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
            className="ax-select"
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
            title="Pick a random unsolved problem from this sheet"
            aria-label="Random Problem"
          >
            {randomFinding ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Shuffle size={14} />
            )}
            {randomFinding ? "Finding…" : "Random Problem"}
          </button>
        </div>
      </div>

      {loading && problems.length > 0 ? (
        <div className="ax-updating" role="status" aria-live="polite">
          <Loader2 size={12} className="animate-spin" aria-hidden />
          Updating problem status…
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

      {/* MAIN THREE-COLUMN WORKSPACE BODY */}
      <div className="ax-workspace-body">
        {/* LEFT SIDEBAR: TOPIC NAVIGATION */}
        <aside className="ax-topic-sidebar" aria-label="Topic navigation">
          <div className="ax-sidebar-header">
            <h3>Topics</h3>
            <span className="ax-sidebar-count">{topicNavItems.length}</span>
          </div>

          <div className="ax-topic-select-mobile">
            <select
              value={selectedTopic}
              onChange={(e) => handleTopicClick(e.target.value)}
              aria-label="Select Topic"
            >
              <option value="all">All Topics ({activeCatalog.stats.topics})</option>
              {topicNavItems.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.solved}/{t.total})
                </option>
              ))}
            </select>
          </div>

          <div className="ax-topic-nav-list">
            <button
              type="button"
              className={`ax-topic-nav-item ${selectedTopic === "all" ? "active" : ""}`}
              onClick={() => handleTopicClick("all")}
            >
              <div className="ax-topic-nav-label">
                <span>All Topics</span>
                <span className="ax-topic-nav-badge">
                  {progress.solved}/{progress.total}
                </span>
              </div>
              <div className="ax-topic-mini-track">
                <div
                  className="ax-topic-mini-fill"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </button>

            {topicNavItems.map((t) => (
              <button
                key={t.name}
                type="button"
                className={`ax-topic-nav-item ${selectedTopic === t.name ? "active" : ""}`}
                onClick={() => handleTopicClick(t.name)}
              >
                <div className="ax-topic-nav-label">
                  <span className="ax-topic-name-text">{t.name}</span>
                  <span className="ax-topic-nav-badge">
                    {t.solved}/{t.total}
                  </span>
                </div>
                <div className="ax-topic-mini-track">
                  <div
                    className="ax-topic-mini-fill"
                    style={{ width: `${t.pct}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* CENTER PANEL: PROBLEM LIST */}
        <main className="ax-center-panel" role="region" aria-label="Problem List">
          <ErrorBoundary fallbackTitle="Unable to render sheet content">
            {loading && problems.length > 0 && (
              <div
                className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground mb-3"
                role="status"
                aria-live="polite"
              >
                <Loader2 size={13} className="animate-spin text-accent-foreground" />
                <span>Refreshing sheet content…</span>
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
            ) : fetchError && problems.length === 0 ? (
              <div className="ax-empty-panel">
                <ErrorState
                  error={fetchError}
                  onRetry={onRetryFetch}
                  isRetrying={loading}
                />
              </div>
            ) : totalFilteredCount === 0 ? (
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
                      setSelectedTopic("all");
                      if (onProblemPageChange) onProblemPageChange(1);
                    }}
                  >
                    Clear filters
                  </button>
                );
                if (selectedTopic !== "all") {
                  return (
                    <EmptyState
                      icon={<Search size={22} strokeWidth={1.75} />}
                      title="No problems found"
                      description={`There are no problems available for "${selectedTopic}" with the current filters.`}
                      action={clearFilters}
                    />
                  );
                }
                if (sheetTab === "bookmarks") {
                  return (
                    <EmptyState
                      icon={<Bookmark size={22} strokeWidth={1.75} />}
                      title="No bookmarked problems yet"
                      description="Save problems while practicing to find them later."
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
                      description="Mark problems as favorites to build your practice shortlist."
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
                    description="Try changing your search query or status/difficulty filters."
                    action={clearFilters}
                  />
                );
              })()}
            </div>
          ) : sheetTab !== "all" ? (
            <section className="ax-topic-card open flat">
              <div className="ax-problem-list">{renderProblemRows(tabFiltered)}</div>
            </section>
          ) : (
            <div className="ax-topics-wrapper">
              {visibleSections.map(({ name: category, items }) => {
                const catSolved = items.filter((p) =>
                  isSheetCompleted(p.id || p._id, submissions, sheetResetAt)
                ).length;
                const catPct = items.length
                  ? Math.round((catSolved / items.length) * 100)
                  : 0;
                const open = expanded[category] !== false;
                const completed = items.length > 0 && catSolved === items.length;
                const topicId = `topic-section-${category.replace(/\s+/g, "-")}`;

                return (
                  <section
                    key={category}
                    id={topicId}
                    className={`ax-topic-card ${open ? "open" : ""} ${completed ? "completed" : ""}`}
                  >
                    <button
                      type="button"
                      className="ax-topic-card-head"
                      aria-expanded={open}
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [category]: !open }))
                      }
                    >
                      <ChevronDown size={16} className="ax-topic-chevron" />
                      <div className="ax-topic-info">
                        <span className="ax-topic-title">{category}</span>
                        <span className="ax-topic-meta">
                          {items.length} problem{items.length === 1 ? "" : "s"} · {catSolved} solved
                          {completed ? " · Completed" : ""}
                        </span>
                      </div>
                      <div className="ax-topic-head-progress">
                        <div className="ax-topic-head-track" aria-hidden>
                          <div className="ax-topic-head-fill" style={{ width: `${catPct}%` }} />
                        </div>
                        <span className="ax-topic-head-count">
                          {catSolved} / {items.length}
                        </span>
                      </div>
                    </button>
                    <div className={`ax-topic-card-body ${open ? "open" : ""}`}>
                      <div className="ax-problem-list">{renderProblemRows(items)}</div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {effectiveTotalPages > 1 && totalFilteredCount > 0 && onProblemPageChange ? (
            <div className="ax-pagination">
              <button
                type="button"
                className="ax-btn"
                disabled={problemPage <= 1 || loading}
                onClick={() => onProblemPageChange(Math.max(1, problemPage - 1))}
              >
                ← Previous
              </button>
              <span className="ax-pagination-info">
                Page {problemPage} of {effectiveTotalPages}
              </span>
              <button
                type="button"
                className="ax-btn"
                disabled={problemPage >= effectiveTotalPages || loading}
                onClick={() =>
                  onProblemPageChange(Math.min(effectiveTotalPages, problemPage + 1))
                }
              >
                Next →
              </button>
            </div>
          ) : null}
          </ErrorBoundary>
        </main>

        {/* RIGHT SIDEBAR: LEARNING TOOLS */}
        <aside className="ax-tools-sidebar" aria-label="Learning tools">
          <div className="ax-tools-header">
            <h3>Learning Tools</h3>
          </div>

          <div className="ax-tool-cards">
            {(
              [
                {
                  id: "calendar" as const,
                  label: "Calendar & Roadmap",
                  desc: "Plan your learning journey",
                  Icon: CalendarDays,
                },
                {
                  id: "sessions" as const,
                  label: "Sessions",
                  desc: "Track focused practice time",
                  Icon: Timer,
                },
                {
                  id: "planner" as const,
                  label: "Daily Planner",
                  desc: "Plan today's DSA tasks",
                  Icon: ListTodo,
                },
              ] as const
            ).map(({ id, label, desc, Icon }) => {
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
                <div
                  key={id}
                  className="ax-tool-card"
                  onClick={() => {
                    if (feature && locked) {
                      setPendingPremiumNav(id, feature);
                    }
                    onNavigateLearning?.(id);
                  }}
                  title={tip}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (feature && locked) setPendingPremiumNav(id, feature);
                      onNavigateLearning?.(id);
                    }
                  }}
                >
                  <div className="ax-tool-card-icon">
                    <Icon size={18} />
                  </div>
                  <div className="ax-tool-card-body">
                    <span className="ax-tool-card-title">{label}</span>
                    <p className="ax-tool-card-desc">{desc}</p>
                  </div>
                  <div className="ax-tool-card-right">
                    {isPremium ? (
                      <PremiumNavIndicator locked={locked} variant="inline" />
                    ) : null}
                    <ChevronRight size={16} className="ax-tool-chevron" />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* NOTE MODAL */}
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

      {/* CONFIRM DIALOGS */}
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
