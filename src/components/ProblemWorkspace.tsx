import { useState, type FC } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  BookOpen,
  MessageSquare,
  History,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Share2,
  RotateCcw,
  Maximize2,
  Settings,
  Terminal,
  Check
} from "lucide-react";
import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import { normalizeDifficulty } from "../utils/problemUtils";

interface ProblemWorkspaceProps {
  problem: Problem;
  userCode: string;
  selectedLanguage: string;
  submittingCode: boolean;
  activeSubmissionResult: Submission | null;
  submissionError: string;
  problemSubmissions: Submission[];
  onBack: () => void;
  onCodeChange: (code: string) => void;
  onLanguageChange: (lang: string) => void;
  onSubmit: () => void;
}

const FormattedDescription: FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const unescapedText = text.replace(/\\\[/g, "[").replace(/\\\]/g, "]");

  const lines = unescapedText.split("\n");

  const renderedElements: React.ReactNode[] = [];
  let inExampleBlock = false;
  let exampleLines: string[] = [];
  let exampleCount = 0;

  const flushExampleBlock = () => {
    if (exampleLines.length > 0) {
      exampleCount++;
      const blockContent = exampleLines.join("\n");
      // Extract Input, Output, Explanation if present
      const inputMatch = blockContent.match(/Input:\s*([^\n]+)/i);
      const outputMatch = blockContent.match(/Output:\s*([^\n]+)/i);
      const explMatch = blockContent.match(/Explanation:\s*([\s\S]+)/i);

      renderedElements.push(
        <div key={`example-${renderedElements.length}`} className="lc-example-box">
          <div className="lc-example-title">Example {exampleCount}:</div>
          <div className="lc-example-body">
            {inputMatch ? (
              <div className="lc-example-row">
                <span className="lc-label">Input:</span> <code className="lc-code-val">{inputMatch[1].trim()}</code>
              </div>
            ) : null}
            {outputMatch ? (
              <div className="lc-example-row">
                <span className="lc-label">Output:</span> <code className="lc-code-val">{outputMatch[1].trim()}</code>
              </div>
            ) : null}
            {explMatch ? (
              <div className="lc-example-row">
                <span className="lc-label">Explanation:</span> <span className="lc-expl-val">{explMatch[1].trim()}</span>
              </div>
            ) : (
              !inputMatch && !outputMatch && <pre className="lc-raw-example">{blockContent}</pre>
            )}
          </div>
        </div>
      );
      exampleLines = [];
    }
    inExampleBlock = false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("Example") || trimmed.match(/^Example \d+:/i)) {
      flushExampleBlock();
      inExampleBlock = true;
      return;
    }

    if (inExampleBlock) {
      if (trimmed.startsWith("Hint:") || trimmed.startsWith("Constraints:")) {
        flushExampleBlock();
      } else {
        if (trimmed) exampleLines.push(trimmed);
        return;
      }
    }

    if (trimmed.startsWith("Hint:")) {
      renderedElements.push(
        <div key={`hint-${index}`} className="lc-hint-box">
          <span className="lc-hint-title">💡 Hint:</span>
          <span>{trimmed.replace(/^Hint:\s*/i, "")}</span>
        </div>
      );
      return;
    }

    if (trimmed.startsWith("Constraints:")) {
      renderedElements.push(
        <div key={`constraints-title-${index}`} className="lc-section-title">
          Constraints:
        </div>
      );
      return;
    }

    if (trimmed) {
      // Highlight inline markdown code snippets like `nums`
      const parts = line.split(/(`[^`]+`)/g);
      renderedElements.push(
        <p key={`p-${index}`} className="lc-paragraph">
          {parts.map((part, pIdx) => {
            if (part.startsWith("`") && part.endsWith("`")) {
              return (
                <code key={pIdx} className="lc-inline-code">
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
        </p>
      );
    }
  });

  flushExampleBlock();

  return <div className="lc-description-container">{renderedElements}</div>;
};

export const ProblemWorkspace: FC<ProblemWorkspaceProps> = ({
  problem,
  userCode,
  selectedLanguage,
  submittingCode,
  activeSubmissionResult,
  submissionError,
  problemSubmissions,
  onBack,
  onCodeChange,
  onLanguageChange,
  onSubmit,
}) => {
  const [leftTab, setLeftTab] = useState<"description" | "submissions">("description");
  const [rightBottomTab, setRightBottomTab] = useState<"testcase" | "result">("testcase");
  const [selectedTestCaseIndex, setSelectedTestCaseIndex] = useState<number>(0);

  const diff = normalizeDifficulty(problem.difficulty);

  const visibleTestcases = problem.testcases?.filter((tc) => !tc.isHidden) || [];

  const lineCount = Math.max(15, userCode.split("\n").length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="lc-workspace">
      {/* ── Top Bar ── */}
      <header className="lc-topbar">
        <div className="lc-topbar-left">
          <button type="button" className="lc-icon-btn" onClick={onBack} title="Back to Problems">
            <ArrowLeft size={16} />
          </button>
          <div className="lc-brand">
            <span className="lc-logo-icon">LeetCode</span>
          </div>
          <div className="lc-nav-divider" />
          <div className="lc-problem-selector">
            <button type="button" className="lc-nav-arrow" title="Previous problem">
              <ChevronLeft size={16} />
            </button>
            <span className="lc-topbar-problem-title">{problem.title}</span>
            <button type="button" className="lc-nav-arrow" title="Next problem">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="lc-topbar-center">
          <button
            type="button"
            className="lc-action-btn lc-run-btn"
            onClick={onSubmit}
            disabled={submittingCode}
          >
            <Play size={14} fill="currentColor" />
            <span>Run</span>
          </button>
          <button
            type="button"
            className="lc-action-btn lc-submit-btn"
            onClick={onSubmit}
            disabled={submittingCode}
          >
            {submittingCode ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span>{submittingCode ? "Submitting..." : "Submit"}</span>
          </button>
        </div>

        <div className="lc-topbar-right">
          <div className="lc-timer-pill">
            <span className="lc-timer-dot" />
            <span>00:15:20</span>
          </div>
          <button type="button" className="lc-icon-btn" title="Settings">
            <Settings size={16} />
          </button>
          <button type="button" className="lc-icon-btn" title="Full Screen">
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      {/* ── Main Split View ── */}
      <div className="lc-body">
        {/* Left Column: Description & Submissions */}
        <section className="lc-panel lc-left-panel">
          <div className="lc-tabs-header">
            <button
              type="button"
              className={`lc-tab-btn ${leftTab === "description" ? "active" : ""}`}
              onClick={() => setLeftTab("description")}
            >
              <FileText size={14} />
              <span>Description</span>
            </button>
            <button
              type="button"
              className="lc-tab-btn disabled"
              title="Editorial coming soon"
            >
              <BookOpen size={14} />
              <span>Editorial</span>
            </button>
            <button
              type="button"
              className="lc-tab-btn disabled"
              title="Solutions coming soon"
            >
              <MessageSquare size={14} />
              <span>Solutions</span>
            </button>
            <button
              type="button"
              className={`lc-tab-btn ${leftTab === "submissions" ? "active" : ""}`}
              onClick={() => setLeftTab("submissions")}
            >
              <History size={14} />
              <span>Submissions ({problemSubmissions.length})</span>
            </button>
          </div>

          <div className="lc-panel-content">
            {leftTab === "description" ? (
              <div className="lc-description-wrapper">
                <h1 className="lc-problem-title">
                  {problem.slug ? `${problem.slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}` : problem.title}
                </h1>

                <div className="lc-meta-row">
                  <span className={`lc-diff-badge ${diff}`}>{diff}</span>
                  <span className="lc-tag-chip">{problem.category || "Array"}</span>
                  {(problem.tags || []).map((t) => (
                    <span key={t} className="lc-tag-chip muted">
                      {t}
                    </span>
                  ))}
                  <div className="lc-social-actions">
                    <button type="button" className="lc-social-btn" title="Like">
                      <ThumbsUp size={13} />
                      <span>2.4K</span>
                    </button>
                    <button type="button" className="lc-social-btn" title="Dislike">
                      <ThumbsDown size={13} />
                    </button>
                    <button type="button" className="lc-social-btn" title="Bookmark">
                      <Bookmark size={13} />
                    </button>
                    <button type="button" className="lc-social-btn" title="Share">
                      <Share2 size={13} />
                    </button>
                  </div>
                </div>

                <FormattedDescription text={problem.description} />

                {/* Additional Test Cases as visual examples if description didn't contain raw examples */}
                {visibleTestcases.length > 0 && !problem.description.includes("Example") && (
                  <div className="lc-examples-container">
                    {visibleTestcases.map((tc, idx) => (
                      <div key={idx} className="lc-example-box">
                        <div className="lc-example-title">Example {idx + 1}:</div>
                        <div className="lc-example-body">
                          <div className="lc-example-row">
                            <span className="lc-label">Input:</span>{" "}
                            <code className="lc-code-val">{tc.input}</code>
                          </div>
                          <div className="lc-example-row">
                            <span className="lc-label">Output:</span>{" "}
                            <code className="lc-code-val">{tc.output}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="lc-submissions-wrapper">
                <h3 className="lc-sub-title">Your Recent Submissions</h3>
                {problemSubmissions.length === 0 ? (
                  <div className="lc-empty-sub">No submissions yet. Submit your solution to see history!</div>
                ) : (
                  <div className="lc-submissions-list">
                    {problemSubmissions.map((sub, idx) => (
                      <div key={sub._id || sub.id || idx} className="lc-sub-item">
                        <div className="lc-sub-left">
                          <span className={`lc-sub-status ${sub.status === "ACCEPTED" ? "acc" : "err"}`}>
                            {sub.status}
                          </span>
                          <span className="lc-sub-lang">{sub.language}</span>
                        </div>
                        <div className="lc-sub-right">
                          <span className="lc-sub-time">{sub.executionTime ?? 0} ms</span>
                          <span className="lc-sub-date">
                            {sub.createdAt ? new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Code Editor & Console Drawer */}
        <section className="lc-panel lc-right-panel">
          {/* Code Editor Header */}
          <div className="lc-editor-header">
            <div className="lc-editor-header-left">
              <span className="lc-editor-title">Code</span>
              <select
                className="lc-lang-dropdown"
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
            </div>
            <div className="lc-editor-header-right">
              <button type="button" className="lc-icon-btn" title="Reset Code">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Main Code Editor Box */}
          <div className="lc-editor-container">
            <div className="lc-editor-gutter">
              {lineNumbers.map((num) => (
                <div key={num} className="lc-line-num">
                  {num}
                </div>
              ))}
            </div>
            <textarea
              className="lc-code-textarea"
              value={userCode}
              onChange={(e) => onCodeChange(e.target.value)}
              spellCheck={false}
              wrap="off"
            />
          </div>

          {/* Console / Testcase Drawer */}
          <div className="lc-console-drawer">
            <div className="lc-console-tabs">
              <button
                type="button"
                className={`lc-console-tab ${rightBottomTab === "testcase" ? "active" : ""}`}
                onClick={() => setRightBottomTab("testcase")}
              >
                <Check size={14} />
                <span>Testcase</span>
              </button>
              <button
                type="button"
                className={`lc-console-tab ${rightBottomTab === "result" ? "active" : ""}`}
                onClick={() => setRightBottomTab("result")}
              >
                <Terminal size={14} />
                <span>Test Result</span>
              </button>
            </div>

            <div className="lc-console-body">
              {rightBottomTab === "testcase" ? (
                <div className="lc-testcase-container">
                  <div className="lc-case-selector">
                    {visibleTestcases.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`lc-case-btn ${selectedTestCaseIndex === idx ? "active" : ""}`}
                        onClick={() => setSelectedTestCaseIndex(idx)}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                  </div>

                  {visibleTestcases.length > 0 && (
                    <div className="lc-case-details">
                      <div className="lc-input-group">
                        <label>nums =</label>
                        <div className="lc-input-box">
                          {visibleTestcases[selectedTestCaseIndex]?.input || "[]"}
                        </div>
                      </div>
                      <div className="lc-input-group">
                        <label>Expected Output =</label>
                        <div className="lc-input-box">
                          {visibleTestcases[selectedTestCaseIndex]?.output || "[]"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="lc-result-container">
                  {submissionError && (
                    <div className="lc-result-alert error">
                      <AlertCircle size={16} />
                      <span>{submissionError}</span>
                    </div>
                  )}

                  {activeSubmissionResult && !submissionError && (
                    <div className={`lc-result-card ${activeSubmissionResult.status === "ACCEPTED" ? "acc" : "pending"}`}>
                      <div className="lc-result-header">
                        {activeSubmissionResult.status === "ACCEPTED" ? (
                          <CheckCircle size={20} className="lc-acc-icon" />
                        ) : (
                          <Loader2 size={20} className="animate-spin lc-pending-icon" />
                        )}
                        <div className="lc-result-status-text">
                          <h4>{activeSubmissionResult.status}</h4>
                          {activeSubmissionResult.status !== "PENDING" && (
                            <div className="lc-result-stats">
                              <span>Runtime: {activeSubmissionResult.executionTime ?? 0} ms</span>
                              <span>Memory: 42.1 MB</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {activeSubmissionResult.error && (
                        <div className="lc-result-alert error" style={{ marginTop: 10 }}>
                          <AlertCircle size={16} />
                          <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.78rem", whiteSpace: "pre-wrap" }}>
                            {activeSubmissionResult.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {!activeSubmissionResult && !submissionError && (
                    <div className="lc-console-placeholder">
                      You must run or submit your code to see results here.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

