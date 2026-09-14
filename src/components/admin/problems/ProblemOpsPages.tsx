import { useEffect, useState, type FC } from "react";
import { adminProblemApi } from "../../../api/adminProblemApi";
import { PermissionGuard } from "../shared/PermissionGuard";
import { ModuleGate } from "../shared/ModuleGate";
import { TestCaseManager, type TestCaseDraft } from "../problems/TestCaseManager";
import { StatusBadge } from "../shared/StatusBadge";

export const ProblemTestCasesHub: FC = () => {
  const [problems, setProblems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [cases, setCases] = useState<TestCaseDraft[]>([]);
  const [loading, setLoading] = useState(true);

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
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await adminProblemApi.getById(selectedId);
        const p = res.data as any;
        const tcs = (p.testcases || p.testCases || []).map((t: any, i: number) => ({
          id: t._id || t.id || `tc-${i}`,
          input: typeof t.input === "string" ? t.input : JSON.stringify(t.input ?? ""),
          expectedOutput: String(t.expectedOutput ?? t.output ?? ""),
          explanation: t.explanation || "",
          isHidden: Boolean(t.isHidden),
          weight: t.weight ?? 1,
        }));
        if (!cancelled) setCases(tcs);
      } catch {
        if (!cancelled) setCases([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const save = async (next: TestCaseDraft[]) => {
    setCases(next);
    if (!selectedId) return;
    await adminProblemApi.update(selectedId, {
      testcases: next.map((t) => ({
        input: t.input,
        expectedOutput: t.expectedOutput,
        explanation: t.explanation,
        isHidden: t.isHidden,
        weight: t.weight,
      })),
    } as any);
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
              problems.find((p) => (p.id || p._id) === selectedId)?.status || "draft"
            }
          />
        ) : null}
      </div>
      {!selectedId ? (
        <p className="admin-muted">Choose a problem to manage public/hidden test cases.</p>
      ) : (
        <TestCaseManager value={cases} onChange={(v) => void save(v)} />
      )}
    </PermissionGuard>
  );
};

export const ProblemAnalyticsPage: FC = () => (
  <ModuleGate
    title="Problem quality analytics"
    description="Per-problem attempts, acceptance, error mix, and language distribution will use SubmissionService aggregates. Use Failed Executions and platform Analytics for current live signals."
    status="backend"
  />
);

export const ProblemBulkImportPage: FC = () => (
  <ModuleGate
    title="Bulk problem import"
    description="JSON/CSV bulk import with validation + audit will extend ProblemService admin bulk. Use Duplicate / Bulk publish on All Problems for current ops."
    status="backend"
  />
);
