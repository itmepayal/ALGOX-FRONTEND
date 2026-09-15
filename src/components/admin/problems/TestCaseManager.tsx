import { useEffect, useState, type FC } from "react";
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Play,
  FlaskConical,
  Eye,
} from "lucide-react";
import { EmptyState } from "../shared/EmptyState";

export interface TestCaseDraft {
  _id?: string;
  input: string;
  output: string;
  isHidden?: boolean;
  explanation?: string;
  weight?: number;
  order?: number;
}

export interface TestCaseValidationIssue {
  index: number;
  messages: string[];
}

interface Props {
  value: TestCaseDraft[];
  onChange: (next: TestCaseDraft[]) => void;
  readOnly?: boolean;
  onExecuteCase?: (tc: TestCaseDraft, index: number) => void;
  executingIndex?: number | null;
}

export function validateTestCases(
  rows: TestCaseDraft[]
): TestCaseValidationIssue[] {
  const issues: TestCaseValidationIssue[] = [];
  rows.forEach((tc, index) => {
    const messages: string[] = [];
    if (!String(tc.input ?? "").trim()) messages.push("Input is empty");
    if (!String(tc.output ?? "").trim()) messages.push("Expected output is empty");
    if ((tc.weight ?? 1) < 1) messages.push("Weight must be ≥ 1");
    if (
      String(tc.input).trim() &&
      String(tc.input).trim() === String(tc.output).trim()
    ) {
      messages.push("Input equals expected output (suspicious)");
    }
    if (messages.length) issues.push({ index, messages });
  });
  return issues;
}

export const TestCaseManager: FC<Props> = ({
  value,
  onChange,
  readOnly,
  onExecuteCase,
  executingIndex,
}) => {
  const [rows, setRows] = useState(value);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [validation, setValidation] = useState<TestCaseValidationIssue[]>([]);
  const [validatedClean, setValidatedClean] = useState(false);

  useEffect(() => {
    setRows(value);
  }, [value]);

  const sync = (next: TestCaseDraft[]) => {
    const ordered = next.map((r, i) => ({ ...r, order: i }));
    setRows(ordered);
    onChange(ordered);
    setValidatedClean(false);
  };

  const update = (idx: number, patch: Partial<TestCaseDraft>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    sync(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    sync(next);
  };

  const duplicate = (idx: number) => {
    const copy = { ...rows[idx], _id: undefined, order: rows.length };
    const next = [...rows];
    next.splice(idx + 1, 0, copy);
    sync(next);
    setExpanded((prev) => new Set(prev).add(idx + 1));
  };

  const bulkDelete = () => {
    if (!selected.size) return;
    sync(rows.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  };

  const applyBulk = () => {
    try {
      const parsed = JSON.parse(bulkText);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const added: TestCaseDraft[] = arr.map((raw: any, i: number) => ({
        input:
          typeof raw.input === "string"
            ? raw.input
            : JSON.stringify(raw.input ?? ""),
        output: String(raw.output ?? raw.expectedOutput ?? ""),
        isHidden: Boolean(raw.isHidden),
        explanation: raw.explanation || "",
        weight: Number(raw.weight) || 1,
        order: rows.length + i,
      }));
      const start = rows.length;
      sync([...rows, ...added]);
      setBulkText("");
      setShowBulk(false);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (let i = 0; i < added.length; i++) next.add(start + i);
        return next;
      });
    } catch {
      alert("Invalid JSON — expect an array of { input, output, isHidden? }");
    }
  };

  const runValidate = () => {
    const issues = validateTestCases(rows);
    setValidation(issues);
    setValidatedClean(issues.length === 0 && rows.length > 0);
  };

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const issueMap = new Map(validation.map((v) => [v.index, v.messages]));

  return (
    <div className="pe-tc">
      <div className="pe-tc-toolbar">
        <span className="pe-tc-count">
          <strong>{rows.length}</strong> case{rows.length === 1 ? "" : "s"}
          {selected.size ? ` · ${selected.size} selected` : ""}
        </span>
        <div className="pe-tc-actions">
          {!readOnly && (
            <>
              <button
                type="button"
                className="admin-btn primary"
                onClick={() => {
                  const idx = rows.length;
                  sync([
                    ...rows,
                    {
                      input: "",
                      output: "",
                      isHidden: false,
                      weight: 1,
                      order: idx,
                    },
                  ]);
                  setExpanded((prev) => new Set(prev).add(idx));
                }}
              >
                <Plus size={14} strokeWidth={1.75} /> Add Case
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={() => setShowBulk((s) => !s)}
              >
                Bulk Add JSON
              </button>
              <button
                type="button"
                className="admin-btn danger"
                disabled={!selected.size}
                onClick={bulkDelete}
              >
                <Trash2 size={14} strokeWidth={1.75} /> Delete Selected
              </button>
            </>
          )}
          <button type="button" className="admin-btn" onClick={runValidate}>
            <CheckCircle2 size={14} strokeWidth={1.75} /> Validate
          </button>
        </div>
      </div>

      {showBulk && !readOnly ? (
        <div className="pe-tc-bulk">
          <label className="pe-field-hint" htmlFor="pe-tc-bulk">
            Paste a JSON array of cases
          </label>
          <textarea
            id="pe-tc-bulk"
            className="pe-code"
            rows={5}
            placeholder='[{"input":"[1,2]","output":"3","isHidden":false}]'
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <button type="button" className="admin-btn primary" onClick={applyBulk}>
            Import cases
          </button>
        </div>
      ) : null}

      {validation.length > 0 ? (
        <div className="pe-tc-banner pe-tc-banner-error" role="status">
          {validation.length} case(s) have issues. Expand highlighted cards below.
        </div>
      ) : null}
      {validatedClean ? (
        <div className="pe-tc-banner pe-tc-banner-ok" role="status">
          All test cases look valid.
        </div>
      ) : null}

      <div className="pe-tc-list">
        {rows.map((tc, idx) => {
          const open = expanded.has(idx);
          const hasIssue = issueMap.has(idx);
          return (
            <div
              key={tc._id || idx}
              className={`pe-tc-card ${open ? "is-open" : ""} ${
                hasIssue ? "has-error" : ""
              } ${selected.has(idx) ? "is-selected" : ""}`}
            >
              <div className="pe-tc-card-head">
                <div className="pe-tc-card-id">
                  {!readOnly ? (
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(idx);
                        else next.delete(idx);
                        setSelected(next);
                      }}
                      aria-label={`Select case ${idx + 1}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="pe-tc-expand"
                    onClick={() => toggleExpand(idx)}
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown size={14} strokeWidth={1.75} />
                    ) : (
                      <ChevronRight size={14} strokeWidth={1.75} />
                    )}
                    <strong>Case {idx + 1}</strong>
                    {tc.isHidden ? (
                      <span className="pe-tc-chip">Hidden</span>
                    ) : (
                      <span className="pe-tc-chip pe-tc-chip-public">Public</span>
                    )}
                    <span className="pe-tc-chip pe-tc-chip-muted">
                      w{tc.weight ?? 1}
                    </span>
                  </button>
                </div>
                <div className="pe-tc-card-actions">
                  <button
                    type="button"
                    className="admin-btn"
                    title="Preview"
                    onClick={() =>
                      setPreviewIdx(previewIdx === idx ? null : idx)
                    }
                  >
                    <Eye size={14} strokeWidth={1.75} /> Preview
                  </button>
                  {onExecuteCase ? (
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={executingIndex === idx}
                      onClick={() => onExecuteCase(tc, idx)}
                    >
                      <Play size={14} strokeWidth={1.75} />
                      {executingIndex === idx ? "Running…" : "Execute"}
                    </button>
                  ) : null}
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        className="admin-btn"
                        aria-label="Move up"
                        onClick={() => move(idx, -1)}
                      >
                        <ChevronUp size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        aria-label="Move down"
                        onClick={() => move(idx, 1)}
                      >
                        <ChevronDown size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        aria-label="Duplicate"
                        onClick={() => duplicate(idx)}
                      >
                        <Copy size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        className="admin-btn danger"
                        aria-label={`Delete test case ${idx + 1}`}
                        onClick={() => sync(rows.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {hasIssue ? (
                <ul className="pe-tc-issues">
                  {issueMap.get(idx)!.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : null}

              {previewIdx === idx ? (
                <pre className="pe-tc-preview">
                  {JSON.stringify(
                    {
                      input: tc.input,
                      expectedOutput: tc.output,
                      isHidden: tc.isHidden,
                      weight: tc.weight,
                    },
                    null,
                    2
                  )}
                </pre>
              ) : null}

              {open ? (
                <div className="pe-tc-body">
                  <div className="pe-tc-grid">
                    <div className="admin-field" style={{ marginBottom: 0 }}>
                      <label>Input</label>
                      <textarea
                        className="pe-code"
                        placeholder='e.g. [2,7,11,15], 9'
                        value={
                          typeof tc.input === "string"
                            ? tc.input
                            : JSON.stringify(tc.input)
                        }
                        disabled={readOnly}
                        onChange={(e) => update(idx, { input: e.target.value })}
                        rows={4}
                        spellCheck={false}
                      />
                    </div>
                    <div className="admin-field" style={{ marginBottom: 0 }}>
                      <label>Expected Output</label>
                      <textarea
                        className="pe-code"
                        placeholder="e.g. [0,1]"
                        value={tc.output}
                        disabled={readOnly}
                        onChange={(e) => update(idx, { output: e.target.value })}
                        rows={4}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <div className="pe-tc-meta">
                    <label className="pe-tc-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(tc.isHidden)}
                        disabled={readOnly}
                        onChange={(e) =>
                          update(idx, { isHidden: e.target.checked })
                        }
                      />
                      Hidden from solvers
                    </label>
                    <label className="pe-tc-weight">
                      Weight
                      <input
                        type="number"
                        min={1}
                        value={tc.weight ?? 1}
                        disabled={readOnly}
                        onChange={(e) =>
                          update(idx, { weight: Number(e.target.value) || 1 })
                        }
                        title="Weight"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="pe-tc-collapsed-hint"
                  onClick={() => toggleExpand(idx)}
                >
                  {String(tc.input || "").slice(0, 48) || "Empty input"}
                  {String(tc.input || "").length > 48 ? "…" : ""}
                  {" → "}
                  {String(tc.output || "").slice(0, 24) || "—"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          compact
          className="mt-2"
          icon={<FlaskConical size={18} strokeWidth={1.75} />}
          title="No test cases yet"
          description="Add at least one public case before publishing."
          action={
            !readOnly ? (
              <button
                type="button"
                className="admin-btn primary"
                onClick={() =>
                  sync([
                    {
                      input: "",
                      output: "",
                      isHidden: false,
                      weight: 1,
                      order: 0,
                    },
                  ])
                }
              >
                <Plus size={14} strokeWidth={1.75} /> Add Case
              </button>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
};
