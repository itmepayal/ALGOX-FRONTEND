import { useEffect, useRef, useState, type FC } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Eye, Save, Send, AlertTriangle } from "lucide-react";
import { adminProblemApi, type AdminProblem } from "../../../api/adminProblemApi";
import { TestCaseManager, type TestCaseDraft } from "./TestCaseManager";
import { PermissionGuard } from "../shared/PermissionGuard";
import { StatusBadge } from "../shared/StatusBadge";
import { hasPermission } from "../../../rbac/permissions";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { normalizeApiError } from "../../../lib/apiError";
import "./problem-editor.css";

interface Props {
  problemId: string | null;
  onBack: () => void;
}

const emptyForm = (): Partial<AdminProblem> & { testcases: TestCaseDraft[] } => ({
  title: "",
  slug: "",
  description: "",
  difficulty: "easy",
  category: "Arrays",
  tags: [],
  editorial: "",
  hints: [],
  constraints: "",
  functionName: "solution",
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  codeStubs: [
    {
      language: "javascript",
      startSnippet: "",
      userTemplate: "function solution() {\n  // write code\n}\n",
    },
  ],
  testcases: [{ input: "[]", output: "[]", isHidden: false, weight: 1 }],
});

export const ProblemEditorPage: FC<Props> = ({ problemId, onBack }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [id, setId] = useState<string | null>(problemId);
  const [previewTab, setPreviewTab] = useState<"problem" | "editorial">("problem");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!problemId) {
      setForm(emptyForm());
      setId(null);
      loaded.current = true;
      return;
    }
    (async () => {
      try {
        const res = await adminProblemApi.getById(problemId);
        const p = res.data;
        setId(p.id || p._id || problemId);
        setForm({
          ...p,
          tags: p.tags || [],
          testcases: (p.testcases || []).map((tc: any, i: number) => ({
            _id: tc._id,
            input:
              typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input),
            output: tc.output || tc.expectedOutput || "",
            isHidden: Boolean(tc.isHidden),
            explanation: tc.explanation,
            weight: tc.weight ?? 1,
            order: tc.order ?? i,
          })),
        });
        loaded.current = true;
      } catch (err: unknown) {
        const n = normalizeApiError(err);
        setError(n.message);
        toast.apiError(err, "Failed to load problem");
      }
    })();
  }, [problemId]);

  const patch = (partial: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const buildPayload = () => {
    const tags =
      typeof form.tags === "string"
        ? String(form.tags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : form.tags || [];
    return {
      title: form.title,
      slug: form.slug || undefined,
      description: form.description,
      difficulty: form.difficulty,
      category: form.category,
      tags,
      editorial: form.editorial,
      hints: form.hints,
      constraints: form.constraints,
      functionName: form.functionName,
      timeLimitMs: form.timeLimitMs,
      memoryLimitMb: form.memoryLimitMb,
      codeStubs: form.codeStubs,
      testcases: (form.testcases || []).map((tc, i) => ({
        input: tc.input,
        output: tc.output,
        expectedOutput: tc.output,
        isHidden: Boolean(tc.isHidden),
        explanation: tc.explanation,
        weight: tc.weight ?? 1,
        order: i,
      })),
    };
  };

  const save = async (silent = false) => {
    if (!hasPermission(user?.role, "problems:update") && id) return;
    if (!hasPermission(user?.role, "problems:create") && !id) return;
    try {
      setSaving(true);
      if (!silent) setMsg("");
      setError("");
      setFieldErrors({});
      const payload = buildPayload();
      if (id) {
        await adminProblemApi.update(id, payload as any);
        if (!silent) {
          setMsg("Saved");
          toast.success("Problem updated successfully");
        } else {
          setMsg("Autosaved");
        }
      } else {
        const res = await adminProblemApi.create({
          ...payload,
          status: "draft",
        } as any);
        const nid = res.data?.id || (res.data as any)?._id;
        if (nid) setId(String(nid));
        if (!silent) {
          setMsg("Draft created");
          toast.success("Problem draft created");
        }
      }
    } catch (err: unknown) {
      const n = normalizeApiError(err);
      setError(n.message);
      if (n.fieldErrors) setFieldErrors(n.fieldErrors);
      if (!silent) toast.apiError(err, "Failed to save problem");
      else setMsg("Unable to autosave");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!loaded.current || !id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(true);
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, id]);

  const publish = async () => {
    try {
      await save(true);
      if (!id) return;
      await adminProblemApi.setStatus(id, "published");
      setMsg("Published");
      toast.success("Problem published successfully");
      const res = await adminProblemApi.getById(id);
      setForm((prev) => ({ ...prev, status: res.data.status }));
    } catch (err: unknown) {
      toast.apiError(err, "Failed to publish problem");
    }
  };

  const isEdit = Boolean(id);
  const status = String(form.status || "draft");
  const tagText = Array.isArray(form.tags)
    ? form.tags.join(", ")
    : String(form.tags || "");

  return (
    <PermissionGuard
      permission={["problems:create", "problems:update"]}
      fallback={<div className="admin-denied">No editor permission.</div>}
    >
      <div className="pe-page">
        <header className="pe-topbar">
          <div className="pe-topbar-left">
            <button type="button" className="admin-btn" onClick={onBack}>
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <h2 className="pe-title">
                {isEdit ? "Edit problem" : "Create problem"}
              </h2>
              <p className="pe-sub">
                {isEdit
                  ? "Update statement, tests, and publishing settings."
                  : "Configure statement, limits, tests, and publish when ready."}
              </p>
            </div>
          </div>
          <div className="pe-topbar-actions">
            {msg ? <span className="pe-save-hint">{msg}</span> : null}
            {saving ? <span className="pe-save-hint">Autosaving…</span> : null}
            <button
              type="button"
              className="admin-btn primary"
              disabled={saving}
              onClick={() => save(false)}
            >
              <Save size={14} />
              {saving ? "Saving…" : "Save draft"}
            </button>
            {hasPermission(user?.role, "problems:publish") && id ? (
              <button type="button" className="admin-btn" onClick={publish}>
                <Send size={14} /> Publish
              </button>
            ) : null}
          </div>
        </header>

        {error || Object.keys(fieldErrors).length ? (
          <div className="admin-form-banner" role="alert">
            <AlertTriangle size={16} aria-hidden />
            <div>
              <strong>
                {Object.keys(fieldErrors).length
                  ? "Please correct the highlighted fields."
                  : "Unable to save"}
              </strong>
              {error ? <div>{error}</div> : null}
            </div>
          </div>
        ) : null}

        <div className="pe-layout">
          <div className="pe-main">
            <section className="pe-card">
              <div className="pe-card-head">
                <h3>Problem Information</h3>
                <p>Core identity and classification</p>
              </div>
              <div className="pe-grid-2">
                <div
                  className={`admin-field pe-span-2 ${
                    fieldErrors.title ? "has-error" : ""
                  }`}
                >
                  <label htmlFor="pe-title">Title</label>
                  <input
                    id="pe-title"
                    value={form.title || ""}
                    onChange={(e) => {
                      patch({ title: e.target.value });
                      if (fieldErrors.title) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.title;
                          return next;
                        });
                      }
                    }}
                    placeholder="e.g. Two Sum"
                  />
                  {fieldErrors.title ? (
                    <span className="admin-field-error">
                      ⚠ {fieldErrors.title}
                    </span>
                  ) : null}
                </div>
                <div className="admin-field">
                  <label htmlFor="pe-slug">Slug</label>
                  <input
                    id="pe-slug"
                    value={form.slug || ""}
                    onChange={(e) => patch({ slug: e.target.value })}
                    placeholder="auto from title if empty"
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="pe-fn">Function name</label>
                  <input
                    id="pe-fn"
                    value={form.functionName || ""}
                    onChange={(e) => patch({ functionName: e.target.value })}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="pe-diff">Difficulty</label>
                  <select
                    id="pe-diff"
                    value={String(form.difficulty || "easy").toLowerCase()}
                    onChange={(e) =>
                      patch({
                        difficulty: e.target.value as AdminProblem["difficulty"],
                      })
                    }
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="pe-cat">Category</label>
                  <input
                    id="pe-cat"
                    value={form.category || ""}
                    onChange={(e) => patch({ category: e.target.value })}
                  />
                </div>
                <div className="admin-field pe-span-2">
                  <label htmlFor="pe-tags">Tags</label>
                  <input
                    id="pe-tags"
                    value={tagText}
                    onChange={(e) =>
                      patch({
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean) as any,
                      })
                    }
                    placeholder="array, hash-map, two-pointers"
                  />
                  <span className="pe-field-hint">Comma-separated</span>
                </div>
              </div>
            </section>

            <section className="pe-card">
              <div className="pe-card-head">
                <h3>Execution Limits</h3>
                <p>Judge resource bounds for submissions</p>
              </div>
              <div className="pe-grid-2">
                <div className="admin-field">
                  <label htmlFor="pe-tl">Time limit (ms)</label>
                  <input
                    id="pe-tl"
                    type="number"
                    min={100}
                    value={form.timeLimitMs ?? 2000}
                    onChange={(e) =>
                      patch({ timeLimitMs: Number(e.target.value) || 2000 })
                    }
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="pe-ml">Memory limit (MB)</label>
                  <input
                    id="pe-ml"
                    type="number"
                    min={16}
                    value={form.memoryLimitMb ?? 256}
                    onChange={(e) =>
                      patch({ memoryLimitMb: Number(e.target.value) || 256 })
                    }
                  />
                </div>
              </div>
            </section>

            <section className="pe-card">
              <div className="pe-card-head">
                <h3>Description</h3>
                <p>Markdown problem statement shown to solvers</p>
              </div>
              <div className="admin-field">
                <textarea
                  className="pe-md"
                  value={form.description || ""}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Write the problem statement in Markdown…"
                  rows={12}
                />
              </div>
            </section>

            <section className="pe-card">
              <div className="pe-card-head">
                <h3>Constraints</h3>
                <p>Input bounds and complexity expectations</p>
              </div>
              <div className="admin-field">
                <textarea
                  className="pe-md"
                  value={form.constraints || ""}
                  onChange={(e) => patch({ constraints: e.target.value })}
                  placeholder={"1 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9"}
                  rows={5}
                />
              </div>
            </section>

            <section className="pe-card">
              <div className="pe-card-head">
                <h3>Editorial / hints</h3>
                <p>Optional guidance and solution notes</p>
              </div>
              <div className="admin-field">
                <textarea
                  className="pe-md"
                  value={form.editorial || ""}
                  onChange={(e) => patch({ editorial: e.target.value })}
                  placeholder="Approach, complexity, edge cases…"
                  rows={6}
                />
              </div>
            </section>

            <section className="pe-card">
              <div className="pe-card-head">
                <h3>Starter template</h3>
                <p>JavaScript user template for the workspace</p>
              </div>
              <div className="admin-field">
                <textarea
                  className="pe-code"
                  value={form.codeStubs?.[0]?.userTemplate || ""}
                  onChange={(e) =>
                    patch({
                      codeStubs: [
                        {
                          language: "javascript",
                          startSnippet: "",
                          userTemplate: e.target.value,
                        },
                      ],
                    })
                  }
                  rows={8}
                  spellCheck={false}
                />
              </div>
            </section>

            <section className="pe-card">
              <div className="pe-card-head">
                <h3>Test cases</h3>
                <p>Official judge cases — hidden cases never leak to clients</p>
              </div>
              <TestCaseManager
                value={form.testcases || []}
                onChange={(testcases) => patch({ testcases })}
              />
            </section>
          </div>

          <aside className="pe-side">
            <section className="pe-card pe-sticky">
              <div className="pe-card-head">
                <h3>Publishing</h3>
                <p>Visibility and review status</p>
              </div>
              <div className="pe-publish-row">
                <span className="pe-muted-label">Status</span>
                <StatusBadge status={status} />
              </div>
              <div className="pe-publish-row">
                <span className="pe-muted-label">Difficulty</span>
                <StatusBadge
                  status={String(form.difficulty || "easy").toLowerCase()}
                />
              </div>
              <div className="pe-publish-meta">
                <div>
                  <span>Test cases</span>
                  <strong>{form.testcases?.length ?? 0}</strong>
                </div>
                <div>
                  <span>Time limit</span>
                  <strong>{form.timeLimitMs ?? 2000} ms</strong>
                </div>
                <div>
                  <span>Memory</span>
                  <strong>{form.memoryLimitMb ?? 256} MB</strong>
                </div>
              </div>
              <p className="pe-side-note">
                Drafts autosave while editing. Publish makes the problem
                visible to users.
              </p>
            </section>

            <section className="pe-card pe-sticky-2">
              <div className="pe-card-head pe-preview-head">
                <div>
                  <h3>
                    <Eye size={14} style={{ marginRight: 6 }} />
                    Live preview
                  </h3>
                </div>
                <div className="admin-seg" role="tablist">
                  <button
                    type="button"
                    className={previewTab === "problem" ? "active" : ""}
                    onClick={() => setPreviewTab("problem")}
                  >
                    Problem
                  </button>
                  <button
                    type="button"
                    className={previewTab === "editorial" ? "active" : ""}
                    onClick={() => setPreviewTab("editorial")}
                  >
                    Editorial
                  </button>
                </div>
              </div>
              <div className="pe-preview">
                {previewTab === "problem" ? (
                  <>
                    <div className="pe-preview-title-row">
                      <h2>{form.title || "Untitled"}</h2>
                      <StatusBadge
                        status={String(form.difficulty || "easy").toLowerCase()}
                      />
                    </div>
                    {form.category ? (
                      <p className="pe-preview-cat">{form.category}</p>
                    ) : null}
                    <ReactMarkdown>
                      {form.description || "_No description yet_"}
                    </ReactMarkdown>
                    {form.constraints ? (
                      <>
                        <h3>Constraints</h3>
                        <ReactMarkdown>{form.constraints}</ReactMarkdown>
                      </>
                    ) : null}
                  </>
                ) : (
                  <ReactMarkdown>
                    {form.editorial || "_No editorial yet_"}
                  </ReactMarkdown>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </PermissionGuard>
  );
};
