import { useCallback, useState, type FC } from "react";
import { Bug, Loader2, Sparkles } from "lucide-react";
import {
  codeAnalysisApi,
  type CodeAnalysisResult,
} from "../api/codeAnalysisApi";
import { canAccess } from "../access/canAccess";
import { useAuth } from "../context/AuthContext";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { Button } from "./ui/button";
import type { RunCaseResult, RunResult } from "../types/judge";

interface Props {
  code: string;
  language: string;
  runResult: RunResult | null;
  caseResults?: RunCaseResult[];
}

/**
 * Premium editor tools: static analysis + run visualization.
 * Never executes code here — Run/Submit remain sandboxed via EvaluationService.
 */
export const PremiumEditorTools: FC<Props> = ({
  code,
  language,
  runResult,
  caseResults,
}) => {
  const { user } = useAuth();
  const analysisOk = canAccess(user, "premium.code_analysis");
  const debuggerOk = canAccess(user, "premium.debugger");

  const [analysis, setAnalysis] = useState<CodeAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runAnalysis = useCallback(async () => {
    if (!analysisOk) return;
    setLoading(true);
    setError("");
    try {
      const res = await codeAnalysisApi.analyze({ code, language });
      setAnalysis(res.data);
    } catch (err: any) {
      setAnalysis(null);
      setError(
        err?.response?.data?.message || err?.message || "Analysis failed"
      );
    } finally {
      setLoading(false);
    }
  }, [analysisOk, code, language]);

  const cases = caseResults || runResult?.cases || [];

  return (
    <div className="premium-editor-tools" style={{ padding: 12, overflow: "auto" }}>
      <section style={{ marginBottom: 16 }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <Sparkles size={16} aria-hidden /> Code analysis
        </h3>
        {!analysisOk ? (
          <div style={{ marginTop: 8 }}>
            <UpgradePrompt
              feature="premium.code_analysis"
              title="Static analysis & explanation"
              description="Complexity heuristics, quality findings, and code explanation — without executing your code outside the sandbox."
            />
          </div>
        ) : (
          <>
            <p className="free-home-muted" style={{ fontSize: 13 }}>
              Static only — does not call Docker or EvaluationService.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => void runAnalysis()}
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Analyze code
            </Button>
            {error ? (
              <div className="free-home-alert" role="alert" style={{ marginTop: 8 }}>
                {error}
              </div>
            ) : null}
            {analysis ? (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <p>
                  <strong>Complexity:</strong>{" "}
                  {analysis.complexity.estimate || "—"}
                </p>
                <p>
                  <strong>Quality:</strong>{" "}
                  {analysis.qualityScore == null
                    ? "—"
                    : `${analysis.qualityScore}/100`}
                </p>
                <p>{analysis.explanation}</p>
                <ul>
                  {analysis.findings.map((f) => (
                    <li key={f.id}>
                      <strong>{f.title}</strong> ({f.severity}) — {f.detail}
                      <br />
                      <span className="free-home-muted">
                        Evidence: {f.evidence}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="free-home-muted">{analysis.note}</p>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h3 style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <Bug size={16} aria-hidden /> Run visualization
        </h3>
        {!debuggerOk ? (
          <div style={{ marginTop: 8 }}>
            <UpgradePrompt
              feature="premium.debugger"
              title="Execution visualization"
              description="Inspect last sandboxed run I/O. Interactive breakpoints are not available — the judge does not expose a host debugger."
            />
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <p className="free-home-muted">
              Shows the last EvaluationService run cases (stdin / expected /
              actual). Not a live step debugger — Docker internals are never
              exposed.
            </p>
            {!runResult && cases.length === 0 ? (
              <p>Run code to populate visualization.</p>
            ) : (
              <ul>
                <li>
                  Overall: <strong>{runResult?.status || "—"}</strong> · time{" "}
                  {runResult?.executionTime ?? "—"} ms · mem{" "}
                  {runResult?.memory ?? "—"} MB
                </li>
                {cases.map((c) => (
                  <li key={c.index}>
                    Case {c.index + 1}: {c.status}
                    <br />
                    <span className="free-home-muted">
                      in: {String(c.input).slice(0, 80)}
                      {String(c.input).length > 80 ? "…" : ""}
                    </span>
                    <br />
                    <span className="free-home-muted">
                      expected: {String(c.expected).slice(0, 60)} · actual:{" "}
                      {String(c.actual).slice(0, 60)}
                    </span>
                    {c.error ? (
                      <>
                        <br />
                        <span className="free-home-alert">{c.error}</span>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
