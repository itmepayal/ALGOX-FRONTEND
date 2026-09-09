import { type FC } from "react";
import { AlertCircle, ArrowLeft, CheckCircle, Loader2, Send } from "lucide-react";
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
  const diff = normalizeDifficulty(problem.difficulty);

  return (
    <div className="workspace-root">
      <header className="workspace-topbar">
        <div className="workspace-topbar-left">
          <button type="button" className="workspace-back-btn" onClick={onBack} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <span className="workspace-title">{problem.title}</span>
          <span className={`diff-badge ${diff}`}>{diff}</span>
        </div>
        <div className="workspace-topbar-right">
          <select
            className="workspace-lang-select"
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
          <button type="button" className="workspace-submit-btn" onClick={onSubmit} disabled={submittingCode}>
            {submittingCode ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            <span>{submittingCode ? "Evaluating..." : "Submit"}</span>
          </button>
        </div>
      </header>

      <div className="workspace-panels">
        <section className="workspace-desc-panel">
          <div className="workspace-panel-tabs">
            <button type="button" className="workspace-panel-tab active">Description</button>
            <button type="button" className="workspace-panel-tab">Submissions ({problemSubmissions.length})</button>
          </div>
          <div className="workspace-desc-body">
            <h1 className="workspace-problem-heading">{problem.title}</h1>
            
            <div className="workspace-tags">
              <span className={`diff-badge ${diff}`} style={{ fontSize: "0.75rem", padding: "4px 10px" }}>{diff}</span>
              <span className="workspace-tag">{problem.category || "Array"}</span>
              {(problem.tags || []).map((t) => (
                <span key={t} className="workspace-tag muted">{t}</span>
              ))}
            </div>

            <div className="workspace-description-text">
              {problem.description}
            </div>

            {/* Testcases Rendered as Examples */}
            {(problem.testcases && problem.testcases.length > 0) && (
              <div className="workspace-examples-section">
                {problem.testcases.filter(tc => !tc.isHidden).map((tc, index) => (
                  <div key={index} className="workspace-example-block">
                    <div className="workspace-example-title">Example {index + 1}:</div>
                    <div className="workspace-example-content">
                      <div><span className="bold">Input:</span> {tc.input}</div>
                      <div><span className="bold">Output:</span> {tc.output}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="workspace-code-panel">
          <div className="workspace-code-header">
            <span>Code</span>
            <span>{selectedLanguage}</span>
          </div>
          <textarea
            className="workspace-code-editor"
            value={userCode}
            onChange={(e) => onCodeChange(e.target.value)}
            spellCheck={false}
          />
          <div className="workspace-bottom-tabs">
            <div className="workspace-bottom-tab-row">
              <button type="button" className="workspace-bottom-tab active">Testcase</button>
              <button type="button" className="workspace-bottom-tab">Test Result</button>
            </div>
            <div className="workspace-result-area">
              {submissionError && (
                <div className="workspace-result-error">
                  <AlertCircle size={16} />
                  <span>{submissionError}</span>
                </div>
              )}
              {activeSubmissionResult && !submissionError && (
                <div className={activeSubmissionResult.status === "ACCEPTED" ? "workspace-result-success" : "workspace-result-pending"}>
                  {activeSubmissionResult.status === "ACCEPTED" ? <CheckCircle size={18} /> : <Loader2 size={18} className="animate-spin" style={{ color: "var(--primary-hover)" }} />}
                  <div>
                    <strong>{activeSubmissionResult.status}</strong>
                    {activeSubmissionResult.status !== "PENDING" && activeSubmissionResult.status !== "RUNNING" && (
                      <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: "0.75rem" }}>
                        {activeSubmissionResult.executionTime ?? 0}ms · {activeSubmissionResult.language}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!activeSubmissionResult && !submissionError && problemSubmissions.length > 0 && (
                <div style={{ color: "var(--text-muted)" }}>
                  Last: {problemSubmissions[0].status} · {problemSubmissions[0].language}
                </div>
              )}
              {!activeSubmissionResult && !submissionError && problemSubmissions.length === 0 && (
                <div style={{ color: "var(--text-muted)" }}>Run your code and submit to see results here.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
