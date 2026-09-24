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
import { ProblemWorkspace } from "../ProblemWorkspace";
import { GuestNavbar } from "./GuestNavbar";
import { GuestHome } from "./GuestHome";
import { GuestFooter } from "./GuestFooter";
import { AuthPromptOverlay } from "./AuthPromptOverlay";
import type { RunResult } from "../../types/judge";

/** Strip obsolete landing ?tab=… params so the URL shows the standalone landing page. */
function scrubLandingTabParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("tab")) return;
  url.searchParams.delete("tab");
  const next = url.pathname + url.search + url.hash;
  window.history.replaceState({}, "", next || "/");
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Guest landing shell — standalone marketing page (no ?tab= content switching).
 * Shared problem deep-links still open a read-only workspace overlay.
 * Authenticated product features live in Dashboard, not here.
 */
export const GuestApp: FC = () => {
  const { isEnabled, settings } = usePlatformSettings();
  const { openAuth } = useAuthPrompt();
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [userCode, setUserCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [customTestCases, setCustomTestCases] = useState<Testcase[]>([]);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const [runMode, setRunMode] = useState<"all" | "selected">("all");

  useEffect(() => {
    scrubLandingTabParam();
  }, []);

  useEffect(() => {
    const slug =
      readProblemSlugFromLocation() || consumePendingProblemSlug() || null;
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await problemApi.getProblemBySlug(slug);
        if (cancelled || !res?.data) return;
        setSelectedProblem(res.data);
      } catch {
        /* stay on landing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const emptyRun = useMemo(() => null as RunResult | null, []);

  return (
    <div className="guest-root platform-root">
      <GuestNavbar
        onGoHome={() => {
          setSelectedProblem(null);
          setProblemInLocation(null);
          scrubLandingTabParam();
          scrollToTop();
        }}
      />
      <div className="guest-main guest-container">
        {!selectedProblem ? (
          <GuestHome />
        ) : (
          <ProblemWorkspace
            problem={selectedProblem}
            userCode={userCode}
            selectedLanguage={selectedLanguage}
            isRunning={false}
            isSubmitting={false}
            runResult={emptyRun}
            submissionResult={null}
            selectedSubmission={null}
            runError=""
            submissionError=""
            problemSubmissions={[]}
            customTestCases={customTestCases}
            selectedCaseIndex={selectedCaseIndex}
            runMode={runMode}
            hasPrev={false}
            hasNext={false}
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
              setUserCode(
                getStarterTemplate(selectedProblem, selectedLanguage)
              );
            }}
            onPrevProblem={() => undefined}
            onNextProblem={() => undefined}
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
      </div>

      {!selectedProblem ? <GuestFooter onGoHome={scrollToTop} /> : null}
      <AuthPromptOverlay />
    </div>
  );
};
