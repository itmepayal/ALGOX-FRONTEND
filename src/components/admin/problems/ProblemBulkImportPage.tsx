import { useMemo, useState, type FC } from "react";
import { FileSpreadsheet, ListChecks } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { problemClient } from "../../../api/problemApi";

type Step = "upload" | "preview" | "done";

interface ParsedRow {
  index: number;
  raw: Record<string, unknown>;
  errors: string[];
}

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    // Normalize CSV shorthand into createProblem shape
    const tags =
      typeof row.tags === "string"
        ? String(row.tags)
            .split("|")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
    const input = String(row.input || row.testcaseInput || "[]");
    const output = String(row.output || row.expectedOutput || "[]");
    return {
      title: row.title,
      slug: row.slug || undefined,
      description: row.description || String(row.title || "Imported problem"),
      difficulty: String(row.difficulty || "easy").toLowerCase(),
      category: row.category || "general",
      tags,
      constraints: row.constraints || "",
      timeLimitMs: Number(row.timeLimitMs) || 2000,
      memoryLimitMb: Number(row.memoryLimitMb) || 256,
      testcases: [
        {
          input,
          output,
          expectedOutput: output,
          isHidden: String(row.isHidden || "false") === "true",
        },
      ],
      codeStubs: [
        {
          language: "javascript",
          startSnippet: "",
          userTemplate: String(row.starterCode || "// write code"),
        },
      ],
      status: "draft",
    };
  });
}

function validateRow(raw: Record<string, unknown>, index: number): ParsedRow {
  const errors: string[] = [];
  if (!raw.title || String(raw.title).length < 2) errors.push("title too short");
  if (!raw.description || String(raw.description).length < 10) {
    errors.push("description too short");
  }
  if (!["easy", "medium", "hard"].includes(String(raw.difficulty))) {
    errors.push("difficulty must be easy|medium|hard");
  }
  if (!raw.category) errors.push("category required");
  const tcs = raw.testcases as any[] | undefined;
  if (!Array.isArray(tcs) || tcs.length < 1) {
    errors.push("at least one testcase required");
  } else {
    for (const tc of tcs) {
      if (!tc.output && !tc.expectedOutput) {
        errors.push("testcase missing output");
        break;
      }
    }
  }
  return { index, raw, errors };
}

export const ProblemBulkImportPage: FC = () => {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    created: number;
    failed: number;
    results: Array<{ index: number; ok: boolean; title?: string; error?: string; id?: string }>;
  } | null>(null);

  const validCount = useMemo(
    () => rows.filter((r) => r.errors.length === 0).length,
    [rows]
  );
  const invalidCount = rows.length - validCount;

  const onFile = async (file: File) => {
    setError("");
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    let parsed: Record<string, unknown>[] = [];
    try {
      if (file.name.endsWith(".csv")) {
        parsed = parseCsv(text);
      } else {
        const json = JSON.parse(text);
        parsed = Array.isArray(json)
          ? json
          : Array.isArray(json?.problems)
            ? json.problems
            : [];
      }
    } catch (err: any) {
      setError(err?.message || "Failed to parse file");
      setRows([]);
      return;
    }
    if (!parsed.length) {
      setError("No problems found in file");
      setRows([]);
      return;
    }
    setRows(parsed.map((raw, index) => validateRow(raw, index)));
    setStep("preview");
  };

  const confirmImport = async () => {
    const payload = rows
      .filter((r) => r.errors.length === 0)
      .map((r) => r.raw);
    if (!payload.length) {
      setError("No valid rows to import");
      return;
    }
    try {
      setImporting(true);
      setError("");
      const res = await problemClient.post("/problems/admin/import", {
        problems: payload,
      });
      setResult(res.data?.data || null);
      setStep("done");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <PermissionGuard
      permission="problems:create"
      fallback={<div className="admin-denied">No create permission.</div>}
    >
      <p className="admin-page-lead">
        Upload JSON (array of problems) or CSV. Rows are validated before import.
        Created problems stay as drafts with hidden testcases preserved.
      </p>

      {step === "upload" ? (
        <div className="admin-field" style={{ maxWidth: 480 }}>
          <label htmlFor="import-file">JSON or CSV file</label>
          <input
            id="import-file"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <p className="admin-muted" style={{ fontSize: "0.8rem" }}>
            JSON: array of problem objects (title, description, difficulty,
            category, testcases[], codeStubs…). CSV: title, description,
            difficulty, category, tags (pipe-separated), input, output,
            isHidden, constraints, starterCode.
          </p>
        </div>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}

      {step === "preview" ? (
        <div>
          <div className="admin-toolbar">
            <span>
              File: {fileName} · Valid: {validCount} · Invalid: {invalidCount}
            </span>
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setStep("upload");
                setRows([]);
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="admin-btn primary"
              disabled={!validCount || importing}
              onClick={() => void confirmImport()}
            >
              {importing ? "Importing…" : `Import ${validCount} problems`}
            </button>
          </div>
          <DataTable
            rowKey={(r) => String(r.index)}
            rows={rows}
            emptyTitle="No rows to preview"
            emptyDescription="Upload a CSV with at least one data row to continue."
            emptyIcon={<FileSpreadsheet size={18} strokeWidth={1.75} />}
            columns={[
              { key: "i", header: "#", render: (r) => r.index + 1 },
              {
                key: "title",
                header: "Title",
                render: (r) => String(r.raw.title || "—"),
              },
              {
                key: "diff",
                header: "Difficulty",
                render: (r) => String(r.raw.difficulty || "—"),
              },
              {
                key: "ok",
                header: "Valid",
                render: (r) => (r.errors.length ? "No" : "Yes"),
              },
              {
                key: "err",
                header: "Errors",
                render: (r) => r.errors.join("; ") || "—",
              },
            ]}
          />
        </div>
      ) : null}

      {step === "done" && result ? (
        <div>
          <p className="admin-muted">
            Created {result.created}, failed {result.failed}.
          </p>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              setStep("upload");
              setRows([]);
              setResult(null);
            }}
          >
            Import another
          </button>
          <DataTable
            rowKey={(r) => String(r.index)}
            rows={result.results || []}
            emptyTitle="No import results"
            emptyDescription="Per-row outcomes will appear after an import run."
            emptyIcon={<ListChecks size={18} strokeWidth={1.75} />}
            columns={[
              { key: "i", header: "#", render: (r) => r.index + 1 },
              {
                key: "title",
                header: "Title",
                render: (r) => r.title || "—",
              },
              {
                key: "ok",
                header: "OK",
                render: (r) => (r.ok ? "Yes" : "No"),
              },
              {
                key: "id",
                header: "ID",
                render: (r) => r.id || "—",
              },
              {
                key: "err",
                header: "Error",
                render: (r) => r.error || "—",
              },
            ]}
          />
        </div>
      ) : null}
    </PermissionGuard>
  );
};
