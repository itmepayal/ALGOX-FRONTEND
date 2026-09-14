import { useEffect, useState, type FC } from "react";
import { Plus, Trash2 } from "lucide-react";

export interface TestCaseDraft {
  _id?: string;
  input: string;
  output: string;
  isHidden?: boolean;
  explanation?: string;
  weight?: number;
  order?: number;
}

interface Props {
  value: TestCaseDraft[];
  onChange: (next: TestCaseDraft[]) => void;
  readOnly?: boolean;
}

export const TestCaseManager: FC<Props> = ({ value, onChange, readOnly }) => {
  const [rows, setRows] = useState(value);

  useEffect(() => {
    setRows(value);
  }, [value]);

  const sync = (next: TestCaseDraft[]) => {
    setRows(next);
    onChange(next);
  };

  const update = (idx: number, patch: Partial<TestCaseDraft>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    sync(next);
  };

  return (
    <div>
      <div className="pe-tc-toolbar">
        <span className="pe-tc-count">{rows.length} case{rows.length === 1 ? "" : "s"}</span>
        {!readOnly && (
          <button
            type="button"
            className="admin-btn"
            onClick={() =>
              sync([
                ...rows,
                {
                  input: "",
                  output: "",
                  isHidden: false,
                  weight: 1,
                  order: rows.length,
                },
              ])
            }
          >
            <Plus size={14} /> Add case
          </button>
        )}
      </div>
      <div className="pe-tc-list">
        {rows.map((tc, idx) => (
          <div key={tc._id || idx} className="pe-tc-card">
            <div className="pe-tc-card-head">
              <strong>Case {idx + 1}</strong>
              {!readOnly && (
                <button
                  type="button"
                  className="admin-btn danger"
                  aria-label={`Delete test case ${idx + 1}`}
                  onClick={() => sync(rows.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="pe-tc-grid">
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label>Input</label>
                <textarea
                  placeholder='e.g. [2,7,11,15], 9'
                  value={
                    typeof tc.input === "string"
                      ? tc.input
                      : JSON.stringify(tc.input)
                  }
                  disabled={readOnly}
                  onChange={(e) => update(idx, { input: e.target.value })}
                />
              </div>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label>Expected output</label>
                <textarea
                  placeholder="e.g. [0,1]"
                  value={tc.output}
                  disabled={readOnly}
                  onChange={(e) => update(idx, { output: e.target.value })}
                />
              </div>
            </div>
            <div className="pe-tc-meta">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(tc.isHidden)}
                  disabled={readOnly}
                  onChange={(e) => update(idx, { isHidden: e.target.checked })}
                />
                Hidden from solvers
              </label>
              <label>
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
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="admin-muted" style={{ fontSize: "0.8rem", marginTop: 8 }}>
          No test cases yet. Add at least one public case before publishing.
        </p>
      ) : null}
    </div>
  );
};
