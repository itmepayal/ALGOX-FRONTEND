import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "../../ui/button";
import { EmptyState } from "../../ui/empty-state";
import { adminProblemApi, type AdminProblem } from "../../../api/adminProblemApi";
import { adminContentApi } from "../../../api/adminContentApi";
import { useToast } from "../../../context/ToastContext";
import { cn } from "../../../lib/cn";
import { usePermission } from "../../../rbac/usePermission";

function problemIdOf(p: AdminProblem): string {
  return String(p.id || (p as { _id?: string })._id || "");
}

function topicsOf(p: AdminProblem): string[] {
  if (Array.isArray(p.tags) && p.tags.length) {
    return p.tags.map(String);
  }
  if (p.category) return [String(p.category)];
  return [];
}

export type AddCompanyProblemDialogProps = {
  open: boolean;
  companyId: string;
  companyName: string;
  companyRoles?: string[];
  attachedProblemIds: Set<string>;
  onClose: () => void;
  onAttached: () => void;
};

/**
 * Select an existing AlgoPath problem and attach it to a company interview set.
 * Uses Problem Management admin list API — does not create problems.
 */
export const AddCompanyProblemDialog: FC<AddCompanyProblemDialogProps> = ({
  open,
  companyId,
  companyName,
  companyRoles = [],
  attachedProblemIds,
  onClose,
  onAttached,
}) => {
  const toast = useToast();
  const { can } = usePermission();
  const canViewProblems = can("problems:view");
  const titleId = useId();
  const descId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<AdminProblem[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<AdminProblem | null>(null);
  const [role, setRole] = useState("");
  const [frequency, setFrequency] = useState("");
  const [lastSeenAt, setLastSeenAt] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  const loadProblems = useCallback(async () => {
    if (!open || !canViewProblems) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError("");
    try {
      const res = await adminProblemApi.list({
        page,
        limit: 20,
        status: "published",
        search: debounced || undefined,
      });
      if (seq !== requestSeq.current) return;
      setResults(res.data || []);
      setMeta({
        total: Number(res.meta?.total || 0),
        totalPages: Number(res.meta?.totalPages || 1),
      });
    } catch (err: unknown) {
      if (seq !== requestSeq.current) return;
      setResults([]);
      setLoadError("Something went wrong while loading problems.");
      toast.apiError(err, "Unable to load problems");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [open, canViewProblems, page, debounced, toast]);

  useEffect(() => {
    void loadProblems();
  }, [loadProblems]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setDebounced("");
    setPage(1);
    setSelected(null);
    setRole("");
    setFrequency("");
    setLastSeenAt("");
    setIsPremium(false);
    setAttaching(false);
    const prev = document.activeElement as HTMLElement | null;
    window.setTimeout(() => searchRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !attaching) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose, attaching]);

  if (!open) return null;

  const onOverlayClick = (e: ReactMouseEvent) => {
    if (e.target === e.currentTarget && !attaching) onClose();
  };

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const selectProblem = (p: AdminProblem) => {
    const pid = problemIdOf(p);
    if (attachedProblemIds.has(pid)) return;
    setSelected(p);
    setIsPremium(Boolean(p.isPremium));
  };

  const attach = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!selected || attaching) return;
    const pid = problemIdOf(selected);
    if (!pid || attachedProblemIds.has(pid)) return;
    setAttaching(true);
    try {
      const payload: Record<string, unknown> = {
        problemId: pid,
        title: selected.title,
        slug: selected.slug || undefined,
        difficulty: String(selected.difficulty || "medium").toLowerCase(),
        topics: topicsOf(selected),
        role: role || undefined,
        isPremium,
        order: 0,
      };
      if (frequency.trim() !== "") {
        payload.frequency = Number(frequency);
      }
      if (lastSeenAt.trim() !== "") {
        payload.lastSeenAt = lastSeenAt;
      }
      await adminContentApi.createCompanyQuestion(companyId, payload);
      toast.success(`Problem added to ${companyName} successfully.`);
      onAttached();
      onClose();
    } catch (err: unknown) {
      toast.apiError(err, "Attach failed");
    } finally {
      setAttaching(false);
    }
  };

  const roleOptions =
    companyRoles.length > 0
      ? companyRoles
      : ["SDE", "SDE I", "SDE II", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer"];

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onOverlayClick}
    >
      <div
        ref={panelRef}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(ev) => ev.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        <div className="border-b border-border px-5 py-4">
          <h3 id={titleId} className="text-lg font-semibold tracking-tight">
            Add Problem to {companyName}
          </h3>
          <p id={descId} className="mt-1 text-sm text-muted-foreground">
            Select an existing AlgoPath problem and configure optional company
            interview metadata.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!canViewProblems ? (
            <EmptyState
              title="Problem search unavailable"
              description="You need problems:view permission to search the problem catalog."
            />
          ) : selected ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Selected problem
                    </p>
                    <h4 className="mt-1 text-base font-semibold">{selected.title}</h4>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Problem ID: {problemIdOf(selected)}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Difficulty:{" "}
                      <span className="capitalize text-foreground">
                        {String(selected.difficulty)}
                      </span>
                      {" · "}
                      Topics:{" "}
                      {topicsOf(selected).length
                        ? topicsOf(selected).join(", ")
                        : "—"}
                      {" · "}
                      Access: {selected.isPremium ? "Premium" : "Free"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={attaching}
                    onClick={() => setSelected(null)}
                  >
                    Change Problem
                  </Button>
                </div>
              </div>

              <form
                id="attach-company-problem"
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(ev) => void attach(ev)}
              >
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Role (optional)</span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={attaching}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  >
                    <option value="">—</option>
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Frequency (optional)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    placeholder="0–100"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    disabled={attaching}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Last seen (optional)</span>
                  <input
                    type="date"
                    value={lastSeenAt}
                    onChange={(e) => setLastSeenAt(e.target.value)}
                    disabled={attaching}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isPremium}
                    onChange={(e) => setIsPremium(e.target.checked)}
                    disabled={attaching}
                  />
                  Company question premium flag
                </label>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="relative block">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search problems by title, ID, topic, or slug..."
                  aria-label="Search problems"
                  className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
                />
              </label>

              {loading ? (
                <p
                  className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2 size={14} className="animate-spin" /> Searching
                  problems…
                </p>
              ) : loadError ? (
                <EmptyState
                  title="Unable to load problems"
                  description={loadError}
                  action={
                    <Button type="button" variant="secondary" onClick={() => void loadProblems()}>
                      Retry
                    </Button>
                  }
                />
              ) : results.length === 0 ? (
                <EmptyState
                  title="No problems found"
                  description="Try another title, problem ID, topic, or slug."
                />
              ) : (
                <ul className="space-y-2">
                  {results.map((p) => {
                    const pid = problemIdOf(p);
                    const attached = attachedProblemIds.has(pid);
                    return (
                      <li
                        key={pid}
                        className={cn(
                          "rounded-lg border border-border p-3",
                          attached && "opacity-70"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold">{p.title}</p>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                              {pid}
                              {p.slug ? ` · ${p.slug}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              <span className="capitalize">{String(p.difficulty)}</span>
                              {topicsOf(p).length
                                ? ` · ${topicsOf(p).join(" · ")}`
                                : ""}
                              {" · "}
                              {p.isPremium ? "Premium" : "Free"}
                            </p>
                          </div>
                          {attached ? (
                            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium">
                              Attached
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => selectProblem(p)}
                            >
                              Select
                            </Button>
                          )}
                        </div>
                        {attached ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Already attached to this company
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}

              {meta.totalPages > 1 && !loadError ? (
                <div className="flex items-center justify-between pt-2 text-sm">
                  <span className="text-muted-foreground">
                    Page {page} of {meta.totalPages} · {meta.total} problems
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={page >= meta.totalPages || loading}
                      onClick={() =>
                        setPage((p) => Math.min(meta.totalPages, p + 1))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={attaching}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="attach-company-problem"
            variant="primary"
            disabled={!selected || attaching}
            aria-busy={attaching}
            onClick={() => {
              if (selected) void attach();
            }}
          >
            {attaching ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Attaching…
              </>
            ) : (
              "Attach Problem"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
