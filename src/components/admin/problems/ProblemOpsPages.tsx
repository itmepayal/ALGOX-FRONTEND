import { useEffect, useState, type FC } from "react";
import { adminProblemApi } from "../../../api/adminProblemApi";
import { evaluationApi } from "../../../api/evaluationApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import {
  TestCaseManager,
  type TestCaseDraft,
} from "../problems/TestCaseManager";
import { StatusBadge } from "../shared/StatusBadge";
import { useToast } from "../../../context/ToastContext";
import {
  formatJudgeInput,
  getTestCaseExpectedOutput,
} from "../../../utils/problemUtils";

function normalizeCompare(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

export const ProblemTestCasesHub: FC = () => {
  const toast = useToast();
  const [problems, setProblems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [problem, setProblem] = useState<any>(null);
  const [cases, setCases] = useState<TestCaseDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executingIndex, setExecutingIndex] = useState<number | null>(null);
  const [runCode, setRunCode] = useState("");
  const [runLanguage, setRunLanguage] = useState<
    "javascript" | "python" | "cpp" | "java"
  >("javascript");
  const [lastResult, setLastResult] = useState<{
    passed: boolean;
    expected: string;
    actual: string;
    stderr: string;
    executionTimeMs: number;
    memoryMb: number;
    timedOut: boolean;
    exitCode: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminProblemApi.list({ page: 1, limit: 100 });
        if (!cancelled) setProblems(res.data || []);
      } catch {
        if (!cancelled) setProblems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setCases([]);
      setProblem(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await adminProblemApi.getById(selectedId);
        const p = res.data as any;
        if (cancelled) return;
        setProblem(p);

        // Prefer configured reference solution, then starter/template for selected language
        const refMap = p.referenceSolutions || p.solutions || {};
        const stubs: any[] = p.codeStubs || [];
        const preferredLang =
          (Object.keys(refMap)[0] as typeof runLanguage) ||
          stubs[0]?.language ||
          "javascript";
        const lang = (preferredLang as typeof runLanguage) || "javascript";
        setRunLanguage(lang);

        const refCode =
          refMap[lang] ||
          stubs.find((s) => s.language === lang)?.userTemplate ||
          stubs.find((s) => s.language === lang)?.startSnippet ||
          stubs[0]?.userTemplate ||
          stubs[0]?.startSnippet ||
          "";
        setRunCode(String(refCode || ""));

        const tcs = (p.testcases || p.testCases || []).map(
          (t: any, i: number) => ({
            id: t._id || t.id || `tc-${i}`,
            _id: t._id || t.id,
            input:
              typeof t.input === "string"
                ? t.input
                : JSON.stringify(t.input ?? ""),
            output: String(t.output ?? t.expectedOutput ?? ""),
            explanation: t.explanation || "",
            isHidden: Boolean(t.isHidden),
            weight: t.weight ?? 1,
            order: t.order ?? i,
          })
        );
        setCases(tcs);
      } catch {
        if (!cancelled) {
          setCases([]);
          setProblem(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const save = async (next: TestCaseDraft[]) => {
    setCases(next);
    if (!selectedId) return;
    try {
      setSaving(true);
      await adminProblemApi.update(selectedId, {
        testcases: next.map((t, i) => ({
          input: t.input,
          output: t.output,
          expectedOutput: t.output,
          explanation: t.explanation,
          isHidden: t.isHidden,
          weight: t.weight,
          order: t.order ?? i,
        })),
      } as any);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save test cases");
    } finally {
      setSaving(false);
    }
  };

  const executeCase = async (tc: TestCaseDraft, index: number) => {
    if (!runCode.trim()) {
      toast.error("Paste or load a reference solution before executing");
      return;
    }
    try {
      setExecutingIndex(index);
      setLastResult(null);
      const expected = normalizeCompare(
        getTestCaseExpectedOutput({
          output: tc.output,
          expectedOutput: tc.output,
        } as any) || tc.output
      );
      const stdin = formatJudgeInput(tc.input);

      const res = await evaluationApi.runCode({
        code: runCode,
        language: runLanguage,
        input: stdin,
        timeLimitMs: problem?.timeLimitMs,
        memoryLimitMb: problem?.memoryLimitMb,
        functionName: problem?.functionName || "solution",
        className: problem?.className || "Solution",
        problemId: selectedId || undefined,
      });

      const data = res.data;
      if (!data) {
        throw new Error("Empty response from EvaluationService");
      }

      const actual = normalizeCompare(String(data.stdout ?? ""));
      const stderr = String(data.stderr || "").trim();
      const passed =
        !data.timedOut &&
        data.exitCode === 0 &&
        actual === expected;

      setLastResult({
        passed,
        expected,
        actual: actual || "(empty)",
        stderr,
        executionTimeMs: data.executionTimeMs || 0,
        memoryMb: data.memoryMb || 0,
        timedOut: Boolean(data.timedOut),
        exitCode: data.exitCode ?? -1,
      });

      if (passed) toast.success("PASS — output matches expected");
      else toast.warning("FAIL — see result panel");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err.message || "Execute failed";
      setLastResult({
        passed: false,
        expected: tc.output,
        actual: "",
        stderr: msg,
        executionTimeMs: 0,
        memoryMb: 0,
        timedOut: false,
        exitCode: -1,
        error: msg,
      });
      toast.error(msg);
    } finally {
      setExecutingIndex(null);
    }
  };

  return (
    <PermissionGuard permission="testcases:view">
      <div className="admin-toolbar">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loading}
          style={{ minWidth: 280 }}
        >
          <option value="">Select a problem…</option>
          {problems.map((p) => (
            <option key={p.id || p._id} value={p.id || p._id}>
              {p.title} ({p.status})
            </option>
          ))}
        </select>
        {selectedId ? (
          <StatusBadge
            status={
              problems.find((p) => (p.id || p._id) === selectedId)?.status ||
              "draft"
            }
          />
        ) : null}
        {saving ? <span className="admin-muted">Saving…</span> : null}
      </div>
      {!selectedId ? (
        <p className="admin-muted">
          Choose a problem to manage public/hidden test cases.
        </p>
      ) : (
        <>
          <div
            className="admin-card"
            style={{ padding: 12, marginBottom: 12, display: "grid", gap: 8 }}
          >
            <h3 style={{ margin: 0 }}>Execute test case (EvaluationService)</h3>
            <p className="admin-muted" style={{ margin: 0, fontSize: 13 }}>
              Uses the same /evaluation/run path as the product editor.
              Loads reference/starter code when available. Hidden cases are
              only visible here (admin).
            </p>
            <select
              className="admin-input"
              value={runLanguage}
              onChange={(e) => {
                const lang = e.target.value as typeof runLanguage;
                setRunLanguage(lang);
                const refMap = problem?.referenceSolutions || {};
                const stubs: any[] = problem?.codeStubs || [];
                const stub = stubs.find((s) => s.language === lang);
                if (refMap[lang]) setRunCode(String(refMap[lang]));
                else if (stub?.userTemplate) setRunCode(stub.userTemplate);
                else if (stub?.startSnippet) setRunCode(stub.startSnippet);
              }}
            >
              <option value="javascript">javascript</option>
              <option value="python">python</option>
              <option value="cpp">cpp</option>
              <option value="java">java</option>
            </select>
            <textarea
              className="admin-input"
              rows={8}
              value={runCode}
              onChange={(e) => setRunCode(e.target.value)}
              placeholder="Reference solution code"
            />
            {lastResult ? (
              <div
                style={{
                  fontSize: 13,
                  padding: 10,
                  borderRadius: 8,
                  background: lastResult.passed
                    ? "rgba(34,197,94,0.12)"
                    : "rgba(239,68,68,0.12)",
                }}
              >
                <strong>
                  {lastResult.passed ? "PASS" : "FAIL"}
                  {lastResult.timedOut ? " (TLE)" : ""}
                </strong>
                <div>Expected: {lastResult.expected || "(empty)"}</div>
                <div>Actual: {lastResult.actual}</div>
                <div>
                  Runtime: {lastResult.executionTimeMs} ms · Memory:{" "}
                  {lastResult.memoryMb} MB · exit {lastResult.exitCode}
                </div>
                {lastResult.stderr ? (
                  <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                    {lastResult.stderr}
                  </pre>
                ) : null}
                {lastResult.error ? (
                  <p className="admin-error">{lastResult.error}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <TestCaseManager
            value={cases}
            onChange={(v) => void save(v)}
            onExecuteCase={(tc, i) => void executeCase(tc, i)}
            executingIndex={executingIndex}
          />
        </>
      )}
    </PermissionGuard>
  );
};
