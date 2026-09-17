import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { usePlatformSettings } from "../../context/PlatformSettingsContext";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { problemApi, type Problem, type Testcase } from "../../api/problemApi";
import {
  getStarterTemplate,
  loadSavedCode,
  saveCode,
  clearSavedCode,
  getProblemId,
} from "../../utils/workspacePersistence";
import {
  consumePendingProblemSlug,
  readProblemSlugFromLocation,
  setProblemInLocation,
} from "../../utils/problemShare";
import { ProblemsSheet } from "../ProblemsSheet";
import { ProblemWorkspace } from "../ProblemWorkspace";
import { ContestsPanel } from "../ContestsPanel";
import { DiscussionsPanel } from "../DiscussionsPanel";
import { ContentLibraryPanel } from "../ContentLibraryPanel";
import { LeaderboardPanel } from "../LeaderboardPanel";
import { GuestNavbar, type GuestTab } from "./GuestNavbar";
import { GuestHome } from "./GuestHome";
import { GuestPricing } from "./GuestPricing";
import { AuthPromptOverlay } from "./AuthPromptOverlay";
import { CompaniesPage } from "../companies/CompaniesPage";
import type { RunResult } from "../../types/judge";
import type { Submission } from "../../api/submissionApi";

function tabFromLocation(): GuestTab {
  const q = new URLSearchParams(window.location.search).get("tab");
  const allowed: GuestTab[] = [
    "home",
    "problems",
    "companies",
    "contests",
    "discuss",
    "learn",
    "ranks",
    "pricing",
  ];
  if (q && (allowed as string[]).includes(q)) return q as GuestTab;
  if (readProblemSlugFromLocation()) return "problems";
  return "home";
}

export const GuestApp: FC = () => {
  const { isEnabled, settings } = usePlatformSettings();
  const { openAuth } = useAuthPrompt();
  const [activeTab, setActiveTab] = useState<GuestTab>(() => tabFromLocation());
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [problemPage, setProblemPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [accessFilter, setAccessFilter] = useState<"all" | "free" | "premium">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "solved" | "attempted" | "unsolved"
  >("all");
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [userCode, setUserCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [customTestCases, setCustomTestCases] = useState<Testcase[]>([]);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const [runMode, setRunMode] = useState<"all" | "selected">("all");
  const emptySubs = useMemo(() => [] as Submission[], []);
  const emptyIds = useMemo(() => new Set<string>(), []);

  const navigate = useCallback((tab: GuestTab) => {
    setActiveTab(tab);
    setSelectedProblem(null);
    setProblemInLocation(null);
    const url = new URL(window.location.href);
    if (tab === "home") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    url.searchParams.delete("problem");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProblems(true);
      try {
        const res = await problemApi.getProblems({
          page: problemPage,
          limit: 50,
          search: debouncedSearch || undefined,
          difficulty:
            selectedDifficulty !== "All"
              ? selectedDifficulty.toLowerCase()
              : undefined,
          access: accessFilter === "all" ? undefined : accessFilter,
        });
        if (cancelled) return;
        if (res?.data) setProblems(res.data);
        setTotalPages(Math.max(1, res?.meta?.totalPages ?? 1));
      } catch {
        if (!cancelled) setProblems([]);
      } finally {
        if (!cancelled) setLoadingProblems(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [problemPage, debouncedSearch, selectedDifficulty, accessFilter]);

  // Deep-link problem preview for guests
  useEffect(() => {
    const slug =
      readProblemSlugFromLocation() || consumePendingProblemSlug() || null;
    if (!slug || !problems.length) return;
    const match = problems.find(
      (p) => p.slug === slug || p.title.toLowerCase() === slug.toLowerCase()
    );
    if (match) {
      setActiveTab("problems");
      setSelectedProblem(match);
    }
  }, [problems]);

  useEffect(() => {
    if (!selectedProblem) return;
    const pid = getProblemId(selectedProblem);
    const lang = selectedLanguage;
    const saved = loadSavedCode("guest", pid, lang);
    setUserCode(saved || getStarterTemplate(selectedProblem, lang));
    setCustomTestCases([]);
    setSelectedCaseIndex(0);
    setProblemInLocation(selectedProblem.slug);
  }, [selectedProblem?.slug, selectedLanguage]);

  const problemIndex = useMemo(() => {
    if (!selectedProblem) return -1;
    const id = getProblemId(selectedProblem);
    return problems.findIndex((p) => getProblemId(p) === id);
  }, [problems, selectedProblem]);

  const requireAuth = useCallback(
    (message: string, tab: "login" | "signup" = "signup") => {
      openAuth({
        tab,
        title: tab === "login" ? "Sign in required" : "Create an account",
        message,
      });
    },
    [openAuth]
  );

  const handleSelectProblem = (p: Problem) => {
    setSelectedProblem(p);
  };

  const contestsEnabled = isEnabled("contests");
  const discussionsEnabled = isEnabled("discussions");

  return (
    <div className="guest-root platform-root">
      <GuestNavbar active={activeTab} onNavigate={navigate} />
      <div className="guest-main">
        {activeTab === "home" && <GuestHome onNavigate={navigate} />}

        {activeTab === "pricing" && <GuestPricing />}

        {activeTab === "companies" && (
          <CompaniesPage
            onSelectProblem={(ref) => {
              void (async () => {
                try {
                  let problem: Problem | null = null;
                  if (ref.slug) {
                    const res = await problemApi.getProblemBySlug(ref.slug);
                    if (res?.data) problem = res.data;
                  } else if (ref.id) {
                    const res = await problemApi.getProblemById(ref.id);
                    if (res?.data) problem = res.data;
                  }
                  if (problem) {
                    setSelectedProblem(problem);
                    setProblemInLocation(problem.slug);
                    setActiveTab("problems");
                  } else {
                    requireAuth(
                      "Sign in to open this interview problem.",
                      "login"
                    );
                  }
                } catch {
                  requireAuth(
                    "Sign in to open this interview problem.",
                    "login"
                  );
                }
              })();
            }}
            onUpgradeClick={() =>
              requireAuth("Create an account to upgrade to Premium.", "signup")
            }
          />
        )}

        {activeTab === "problems" && !selectedProblem && (
          <div className="guest-browse platform-content platform-content-sheet">
            <div className="guest-inline-prompt" role="status">
              <p>
                Browsing as a guest.{" "}
                <button
                  type="button"
                  className="guest-text-link"
                  onClick={() =>
                    requireAuth(
                      "Create an account to track your progress.",
                      "signup"
                    )
                  }
                >
                  Sign up
                </button>{" "}
                to save problems and submit solutions.
              </p>
            </div>
            <ProblemsSheet
              problems={problems}
              loading={loadingProblems}
              submissions={emptySubs}
              searchQuery={searchQuery}
              selectedDifficulty={selectedDifficulty}
              accessFilter={accessFilter}
              statusFilter={statusFilter}
              bookmarkedIds={emptyIds}
              revisionIds={emptyIds}
              userId={undefined}
              learningRefreshKey={0}
              problemPage={problemPage}
              totalPages={totalPages}
              onProblemPageChange={setProblemPage}
              onSearchChange={setSearchQuery}
              onDifficultyChange={setSelectedDifficulty}
              onAccessFilterChange={setAccessFilter}
              onStatusFilterChange={setStatusFilter}
              onSelectProblem={handleSelectProblem}
              onRemoveBookmark={() =>
                requireAuth("Sign in to save this problem.", "login")
              }
              onBookmarkChange={() =>
                requireAuth("Sign in to save this problem.", "login")
              }
              onRevisionChange={() =>
                requireAuth("Sign in to save this problem.", "login")
              }
              onNavigateLearning={() =>
                requireAuth(
                  "Create an account to track your progress.",
                  "signup"
                )
              }
              onProgressImported={() => undefined}
            />
          </div>
        )}

        {activeTab === "contests" && contestsEnabled && (
          <div className="guest-browse">
            <div className="guest-inline-prompt" role="status">
              <p>
                Contest listings are public.{" "}
                <button
                  type="button"
                  className="guest-text-link"
                  onClick={() =>
                    requireAuth("Sign in to register for contests.", "login")
                  }
                >
                  Sign in
                </button>{" "}
                to participate.
              </p>
            </div>
            <ContestsPanel
              authenticated={false}
              onOpenProblem={async (ref) => {
                try {
                  let problem: Problem | null = null;
                  if (ref.slug) {
                    const res = await problemApi.getProblemBySlug(ref.slug);
                    if (res?.data) problem = res.data;
                  } else if (ref.id) {
                    const res = await problemApi.getProblemById(ref.id);
                    if (res?.data) problem = res.data;
                  }
                  if (problem) {
                    setActiveTab("problems");
                    setSelectedProblem(problem);
                  }
                } catch {
                  requireAuth("Sign in to open contest problems.", "login");
                }
              }}
            />
          </div>
        )}

        {activeTab === "discuss" && discussionsEnabled && (
          <div className="guest-browse">
            <div className="guest-inline-prompt" role="status">
              <p>
                Read public discussions.{" "}
                <button
                  type="button"
                  className="guest-text-link"
                  onClick={() =>
                    requireAuth("Sign in to post in discussions.", "login")
                  }
                >
                  Sign in
                </button>{" "}
                to post or vote.
              </p>
            </div>
            <DiscussionsPanel authenticated={false} />
          </div>
        )}

        {activeTab === "learn" && (
          <div className="guest-browse">
            <ContentLibraryPanel
              onRequireAuth={() =>
                requireAuth("Sign in to enroll in study plans.", "login")
              }
              onOpenProblem={(ref) => {
                void (async () => {
                  try {
                    let problem: Problem | null = null;
                    if (ref.slug) {
                      const res = await problemApi.getProblemBySlug(ref.slug);
                      if (res?.data) problem = res.data;
                    } else if (ref.id) {
                      const res = await problemApi.getProblemById(ref.id);
                      if (res?.data) problem = res.data;
                    }
                    if (problem) {
                      setSelectedProblem(problem);
                      setProblemInLocation(problem.slug);
                      setActiveTab("problems");
                    }
                  } catch {
                    /* ignore */
                  }
                })();
              }}
            />
          </div>
        )}

        {activeTab === "ranks" && (
          <div className="guest-browse">
            <div className="guest-inline-prompt" role="status">
              <p>Public leaderboard preview — no personal stats for guests.</p>
            </div>
            <LeaderboardPanel />
          </div>
        )}
      </div>

      {selectedProblem && (
        <ProblemWorkspace
          problem={selectedProblem}
          userCode={userCode}
          selectedLanguage={selectedLanguage}
          isRunning={false}
          isSubmitting={false}
          runResult={null as RunResult | null}
          submissionResult={null}
          selectedSubmission={null}
          runError=""
          submissionError=""
          problemSubmissions={[]}
          customTestCases={customTestCases}
          selectedCaseIndex={selectedCaseIndex}
          runMode={runMode}
          hasPrev={problemIndex > 0}
          hasNext={problemIndex >= 0 && problemIndex < problems.length - 1}
          userId={undefined}
          onBack={() => {
            setSelectedProblem(null);
            setProblemInLocation(null);
          }}
          onCodeChange={(code) => {
            setUserCode(code);
            const pid = getProblemId(selectedProblem);
            saveCode("guest", pid, selectedLanguage, code);
          }}
          onLanguageChange={setSelectedLanguage}
          onSubmit={() =>
            requireAuth("Sign in to submit solutions.", "login")
          }
          onRun={() => requireAuth("Sign in to run code.", "login")}
          onResetCode={() => {
            const pid = getProblemId(selectedProblem);
            clearSavedCode("guest", pid, selectedLanguage);
            setUserCode(getStarterTemplate(selectedProblem, selectedLanguage));
          }}
          onPrevProblem={() => {
            if (problemIndex > 0) setSelectedProblem(problems[problemIndex - 1]);
          }}
          onNextProblem={() => {
            if (problemIndex < problems.length - 1)
              setSelectedProblem(problems[problemIndex + 1]);
          }}
          onCustomTestCasesChange={setCustomTestCases}
          onSelectedCaseIndexChange={setSelectedCaseIndex}
          onRunModeChange={setRunMode}
          onLoadSubmission={() =>
            requireAuth("Sign in to view your submissions.", "login")
          }
          onCloseSubmissionView={() => undefined}
          onRequireAuth={() =>
            requireAuth("Sign in to save this problem.", "login")
          }
          onUpgradeClick={() =>
            requireAuth(
              "Upgrade to Premium to access this editorial.",
              "signup"
            )
          }
          onBookmarkChange={() =>
            requireAuth("Sign in to save this problem.", "login")
          }
          submissionsEnabled={isEnabled("submissions")}
          advancedEditorEnabled={isEnabled("newEditor")}
          supportedLanguages={settings?.supportedLanguages}
        />
      )}

      <AuthPromptOverlay />
    </div>
  );
};
