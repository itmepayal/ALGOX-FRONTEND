import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import {
  AlertCircle,
  Bug,
  Brain,
  ClipboardCopy,
  Eraser,
  FlaskConical,
  Gauge,
  GitCompare,
  Info,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Mic2,
  Scale,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  aiApi,
  type AiFeatureId,
  type AiHistoryItem,
  type AiUsageSnapshot,
} from "../api/aiApi";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { UpgradePrompt } from "./access/UpgradePrompt";
import { PremiumUpgradeModal } from "./access/PremiumUpgradeModal";
import { PremiumBadge } from "./access/PremiumBadge";
import { MonacoCodeEditor } from "./MonacoCodeEditor";
import { DEFAULT_EDITOR_SETTINGS } from "../utils/editorSettings";
import "./ai-assistant.css";

interface Props {
  problemId?: string | null;
  problemTitle?: string | null;
  refreshKey?: number;
}

type Lang = "python" | "javascript" | "cpp" | "java";
type HistFilter = "all" | "success" | "failed";

type FeatureFields = {
  question?: boolean;
  error?: boolean;
  testCase?: boolean;
  code?: boolean;
  codeRequired?: boolean;
};

const FEATURE_FIELDS: Record<AiFeatureId, FeatureFields> = {
  explain_problem: { question: true },
  give_hint: { question: true, code: true },
  explain_error: { error: true, code: true, codeRequired: true, question: true },
  explain_test_case: { testCase: true, code: true, question: true },
  find_bug: { code: true, codeRequired: true, error: true, question: true },
  explain_complexity: { code: true, question: true },
  optimize_approach: { code: true, question: true },
  compare_approaches: { question: true, code: true },
  generate_similar_problem: { question: true },
  interview_mode: { question: true, code: true },
};

const FEATURE_CATEGORIES: Array<{
  id: string;
  label: string;
  features: AiFeatureId[];
}> = [
  {
    id: "understand",
    label: "Understand",
    features: ["explain_problem", "explain_test_case", "explain_complexity"],
  },
  {
    id: "debug",
    label: "Debug",
    features: ["explain_error", "find_bug"],
  },
  {
    id: "improve",
    label: "Improve",
    features: ["give_hint", "optimize_approach", "compare_approaches"],
  },
  {
    id: "practice",
    label: "Practice",
    features: ["generate_similar_problem", "interview_mode"],
  },
];

const FEATURE_ICONS: Record<AiFeatureId, typeof Brain> = {
  explain_problem: MessageSquareQuote,
  give_hint: Lightbulb,
  explain_error: AlertCircle,
  explain_test_case: FlaskConical,
  find_bug: Bug,
  explain_complexity: Gauge,
  optimize_approach: Wand2,
  compare_approaches: GitCompare,
  generate_similar_problem: Sparkles,
  interview_mode: Mic2,
};

const FEATURE_BLURBS: Partial<Record<AiFeatureId, string>> = {
  give_hint: "Next useful step — without the solution.",
  find_bug: "Likely issue and why it happens.",
  explain_complexity: "Understand time and space complexity.",
  optimize_approach: "Improve a working solution without rewriting it.",
  compare_approaches: "Tradeoffs between strategies.",
  interview_mode: "Socratic coaching like a real interview.",
  generate_similar_problem: "Practice the same pattern on a new prompt.",
  explain_problem: "Clarify statement, constraints, and expected goal.",
  explain_error: "Interpret compiler/runtime/judge errors.",
  explain_test_case: "Understand what the case is checking.",
};

const CONTEXT_COPY: Record<
  AiFeatureId,
  { questionLabel?: string; questionPlaceholder?: string; examples?: string[] }
> = {
  explain_problem: {
    questionLabel: "What should we clarify?",
    questionPlaceholder:
      "Describe the part of the statement, constraints, or examples you want explained…",
    examples: [
      "What does this problem actually ask for?",
      "Can you restate the constraints simply?",
    ],
  },
  give_hint: {
    questionLabel: "What are you stuck on?",
    questionPlaceholder:
      "Describe what you've tried, where you're stuck, or what you don't understand…",
    examples: [
      "Why does my two-pointer approach fail?",
      "Give me one hint without the solution.",
      "Why is this O(n²)?",
    ],
  },
  explain_error: {
    questionLabel: "What else should we know?",
    questionPlaceholder: "Optional: what you expected vs what happened…",
  },
  explain_test_case: {
    questionLabel: "What confused you about this case?",
    questionPlaceholder: "Optional: which part of the case is unclear…",
  },
  find_bug: {
    questionLabel: "What behavior seems wrong?",
    questionPlaceholder:
      "Describe the unexpected behavior, failing case, or suspicion…",
  },
  explain_complexity: {
    questionLabel: "What approach should we analyze?",
    questionPlaceholder: "Briefly describe your approach or paste code below…",
  },
  optimize_approach: {
    questionLabel: "What do you want to improve?",
    questionPlaceholder:
      "Describe bottlenecks or what feels inefficient about your solution…",
  },
  compare_approaches: {
    questionLabel: "Which approaches should we compare?",
    questionPlaceholder: "e.g. brute force vs two pointers vs hashing…",
  },
  generate_similar_problem: {
    questionLabel: "Which pattern or topic?",
    questionPlaceholder:
      "Tell us which pattern/topic you want to practice…",
    examples: ["Arrays + two pointers", "Binary search on answer"],
  },
  interview_mode: {
    questionLabel: "Interview context",
    questionPlaceholder:
      "Describe the problem or interview scenario you want to practice…",
  },
};

function categoryForFeature(id: AiFeatureId): string {
  for (const cat of FEATURE_CATEGORIES) {
    if (cat.features.includes(id)) return cat.id;
  }
  return FEATURE_CATEGORIES[0].id;
}

function isPremiumRequiredError(err: any): boolean {
  const code = err?.response?.data?.code || err?.response?.data?.details?.code;
  const status = err?.response?.status;
  return status === 403 && code === "PREMIUM_REQUIRED";
}

function safeUserError(err: any): string {
  const raw =
    err?.response?.data?.message || err?.message || "Assist failed";
  const s = String(raw);
  if (
    /api.?key|openai|gemini|provider|ECONN|BLOCKED|GEMINI|OPENAI/i.test(s)
  ) {
    return "AlgoPath AI couldn't complete this request. Please try again.";
  }
  return s;
}

function featureLabel(
  id: string,
  features: AiUsageSnapshot["features"] | undefined
) {
  const meta = features?.find((f) => f.id === id);
  return meta?.label || id.replace(/_/g, " ");
}

function relativeTime(iso: string) {
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function nextUtcResetLabel(dateKey: string) {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
    return next.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return "UTC midnight";
  }
}

export const AiAssistantPanel: FC<Props> = ({
  problemId,
  problemTitle,
  refreshKey = 0,
}) => {
  const [usage, setUsage] = useState<AiUsageSnapshot | null>(null);
  const [history, setHistory] = useState<AiHistoryItem[]>([]);
  const [histFilter, setHistFilter] = useState<HistFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feature, setFeature] = useState<AiFeatureId>("give_hint");
  const [category, setCategory] = useState(() => categoryForFeature("give_hint"));
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [testCase, setTestCase] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [language, setLanguage] = useState<Lang>("python");
  const [reply, setReply] = useState("");
  const [replyFeature, setReplyFeature] = useState<AiFeatureId | null>(null);
  const [requestSummary, setRequestSummary] = useState<{
    feature: AiFeatureId;
    language?: Lang;
    hadCode: boolean;
    preview?: string;
  } | null>(null);
  const [showRequestContext, setShowRequestContext] = useState(false);
  const [refusedDump, setRefusedDump] = useState(false);
  const [busy, setBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  const fields = FEATURE_FIELDS[feature];

  const loadHistory = useCallback(async (status: HistFilter) => {
    try {
      const hist = await aiApi.getHistory(30, status);
      setHistory(hist.data?.items || []);
    } catch {
      /* keep prior */
    }
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const [usageRes, histRes] = await Promise.allSettled([
        aiApi.getUsage(),
        aiApi.getHistory(30, histFilter),
      ]);
      if (usageRes.status === "fulfilled") {
        const next = usageRes.value.data ?? null;
        setUsage(next);
        const feats = next?.features || [];
        setFeature((prev) => {
          const resolved =
            feats.length && !feats.find((f) => f.id === prev)
              ? feats[0].id
              : prev;
          setCategory(categoryForFeature(resolved));
          return resolved;
        });
      } else {
        setUsage(null);
        throw usageRes.reason;
      }
      if (histRes.status === "fulfilled") {
        setHistory(histRes.value.data?.items || []);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load AI usage"
      );
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, [histFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps -- initial + external refresh

  const histFilterMounted = useRef(false);
  useEffect(() => {
    if (!histFilterMounted.current) {
      histFilterMounted.current = true;
      return;
    }
    void loadHistory(histFilter);
  }, [histFilter, loadHistory]);

  const openUpgrade = () => setUpgradeOpen(true);

  const startCheckout = async () => {
    setUpgradeBusy(true);
    try {
      const { startPremiumCheckout } = await import(
        "../billing/startPremiumCheckout"
      );
      const result = await startPremiumCheckout();
      if (!result.ok) openUpgrade();
    } catch {
      openUpgrade();
    } finally {
      setUpgradeBusy(false);
    }
  };

  const validationError = useMemo(() => {
    if (fields.codeRequired && !codeSnippet.trim()) {
      return "Add a code snippet for this request type.";
    }
    if (fields.error && feature === "explain_error" && !errorMsg.trim()) {
      return "Paste the error message to continue.";
    }
    if (
      fields.testCase &&
      feature === "explain_test_case" &&
      !testCase.trim()
    ) {
      return "Add the test case context to continue.";
    }
    if (codeSnippet.length > 4000) return "Code snippet exceeds 4000 characters.";
    if (message.length > 2000) return "Question exceeds 2000 characters.";
    if (errorMsg.length > 2000) return "Error message exceeds 2000 characters.";
    if (testCase.length > 2000) return "Test case exceeds 2000 characters.";
    return "";
  }, [fields, codeSnippet, errorMsg, testCase, message, feature]);

  const handleAssist = async () => {
    if (busy) return;
    if (!usage?.premiumFeatures) {
      openUpgrade();
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    if (usage.remaining <= 0) {
      setError(
        `You've used today's AI allowance (${usage.used}/${usage.quota}). Resets at UTC midnight.`
      );
      return;
    }

    setBusy(true);
    setError("");
    setReply("");
    setRefusedDump(false);
    try {
      const res = await aiApi.assist({
        feature,
        problemId: problemId || undefined,
        userMessage: message.trim() || undefined,
        errorMessage: fields.error
          ? errorMsg.trim() || undefined
          : undefined,
        testCase: fields.testCase
          ? testCase.trim() || undefined
          : undefined,
        codeSnippet: fields.code
          ? codeSnippet.trim() || undefined
          : undefined,
        language: fields.code && codeSnippet.trim() ? language : undefined,
      });
      if (res.data) {
        setReply(String(res.data.reply || ""));
        setReplyFeature(res.data.feature);
        setRefusedDump(Boolean(res.data.refusedDump));
        setRequestSummary({
          feature,
          language: fields.code && codeSnippet.trim() ? language : undefined,
          hadCode: Boolean(fields.code && codeSnippet.trim()),
          preview: message.trim().slice(0, 120) || undefined,
        });
        setShowRequestContext(false);
        setUsage((prev) =>
          prev
            ? {
                ...prev,
                used: res.data!.usage.used,
                remaining: res.data!.usage.remaining,
                quota: res.data!.usage.quota,
                failed: res.data!.usage.failed,
                dateKey: res.data!.usage.dateKey || prev.dateKey,
              }
            : prev
        );
        await loadHistory(histFilter);
      }
    } catch (err: any) {
      if (isPremiumRequiredError(err)) {
        openUpgrade();
        setError("");
      } else {
        setError(safeUserError(err));
        try {
          const u = await aiApi.getUsage();
          if (u.data) setUsage(u.data);
        } catch {
          /* keep */
        }
        await loadHistory(histFilter);
      }
    } finally {
      setBusy(false);
    }
  };

  const copyReply = async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="co-page ai-page" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <div className="ai-layout" style={{ marginTop: 14 }}>
          <Skeleton className="h-80 w-full" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="co-page ai-page">
        <EmptyState
          title="Sign in for AlgoPath AI"
          description="Guests cannot use AI. AlgoPath AI is available to Premium members only."
        />
        {error ? (
          <p className="ai-section-meta" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const isPremium = usage.premiumFeatures;
  const remaining = usage.remaining;
  const quota = usage.quota;
  const usedPct =
    quota > 0 ? Math.min(100, Math.round((usage.used / quota) * 100)) : 0;
  const creditTone =
    remaining <= 0 ? "empty" : remaining <= Math.max(5, quota * 0.2) ? "low" : "ok";
  const aiUnavailable = isPremium && !usage.providerConfigured;
  const canAsk =
    isPremium &&
    !busy &&
    remaining > 0 &&
    !aiUnavailable &&
    !validationError;

  const metaById = Object.fromEntries(
    (usage.features || []).map((f) => [f.id, f])
  ) as Record<AiFeatureId, AiUsageSnapshot["features"][number]>;

  return (
    <div className="co-page ai-page">
      <header className="ai-header">
        <div>
          <p className="ai-kicker">Learning assistant</p>
          <h1 className="co-title">
            <Brain size={22} aria-hidden className="ai-icon" />
            AlgoPath AI
          </h1>
          <p className="ai-lede">
            Your personal DSA learning assistant. Get hints, explanations,
            debugging guidance, and interview practice without giving away the
            solution.
          </p>
          <div className="ai-trust-row">
            <span className="ai-section-meta" style={{ margin: 0 }}>
              Guided help for understanding — not a solution vending machine.
            </span>
            <button
              type="button"
              className="ai-info-btn"
              title="AlgoPath AI is designed to help you understand the problem and improve your approach. It avoids directly solving problems for you when possible."
              aria-label="About AlgoPath AI learning policy"
            >
              <Info size={14} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="ai-alert" role="alert">
          <AlertCircle size={16} aria-hidden />
          <div style={{ flex: 1 }}>
            <strong>AlgoPath AI couldn&apos;t complete this request</strong>
            <p>{error}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void handleAssist()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="ai-layout">
        <div className="ai-main">
          <section className="co-panel ai-panel ai-workspace" aria-label="Ask AlgoPath AI">
            <div className="ai-ws-head">
              <div>
                <p className="ai-kicker">AI learning assistant</p>
                <h2 className="ai-section-title">Ask AlgoPath AI</h2>
                <p className="ai-section-meta">
                  {problemTitle
                    ? `Working on: ${problemTitle}`
                    : "Select what you need, provide context, then ask."}
                </p>
              </div>
              {isPremium ? (
                <span className="ai-ws-credit-pill" title={`${remaining} credits remaining today`}>
                  1 credit
                </span>
              ) : null}
            </div>

            {!isPremium ? (
              <UpgradePrompt
                feature="premium.ai"
                title="Unlock AlgoPath AI Premium"
                description="Get advanced debugging help, optimization guidance, interview mode, deeper explanations, and daily AI credits."
                ctaLabel={upgradeBusy ? "Starting…" : "Explore Premium"}
                onUpgradeClick={() => void startCheckout()}
              />
            ) : null}

            <nav className="ai-ws-steps" aria-label="Workspace steps">
              <span className="ai-ws-step is-active">
                <em>01</em> Help type
              </span>
              <span className="ai-ws-step-sep" aria-hidden>
                →
              </span>
              <span className="ai-ws-step">
                <em>02</em> Context
              </span>
              <span className="ai-ws-step-sep" aria-hidden>
                →
              </span>
              <span className="ai-ws-step">
                <em>03</em> Ask
              </span>
              <span className="ai-ws-steps-mobile" aria-hidden>
                01 / 03
              </span>
            </nav>

            <div className="ai-ws-block">
              <p className="ai-ws-label">What do you need help with?</p>
              <div
                className="ai-cat-tabs"
                role="tablist"
                aria-label="Help categories"
              >
                {FEATURE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={category === cat.id}
                    className={`ai-cat-tab${category === cat.id ? " is-active" : ""}`}
                    disabled={!isPremium}
                    onClick={() => {
                      setCategory(cat.id);
                      if (!cat.features.includes(feature)) {
                        setFeature(cat.features[0]);
                      }
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div
                className="ai-feature-grid ai-feature-grid--compact"
                role="radiogroup"
                aria-label={`${FEATURE_CATEGORIES.find((c) => c.id === category)?.label || "Help"} options`}
              >
                {(
                  FEATURE_CATEGORIES.find((c) => c.id === category)?.features ||
                  []
                ).map((id) => {
                  const Icon = FEATURE_ICONS[id];
                  const meta = metaById[id];
                  const active = feature === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`ai-feature${active ? " is-active" : ""}`}
                      disabled={!isPremium}
                      onClick={() => {
                        setFeature(id);
                        setCategory(categoryForFeature(id));
                      }}
                    >
                      <div className="ai-feature-top">
                        <span className="ai-feature-icon">
                          <Icon size={14} aria-hidden />
                        </span>
                        {active ? (
                          <span className="ai-feature-check" aria-hidden>
                            ✓
                          </span>
                        ) : !isPremium && meta?.premiumOnly ? (
                          <PremiumBadge feature="premium.ai" label="Premium" />
                        ) : null}
                      </div>
                      <strong>{meta?.label || id}</strong>
                      <span>
                        {FEATURE_BLURBS[id] ||
                          meta?.description ||
                          "Learning-focused guidance"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="ai-ws-selected-note">
                <strong>
                  {metaById[feature]?.label || featureLabel(feature, usage.features)}
                </strong>
                {" — "}
                {FEATURE_BLURBS[feature] ||
                  metaById[feature]?.description ||
                  "Guided help without dumping a full solution."}
              </p>
            </div>

            <div className="ai-ws-block ai-form">
              <p className="ai-ws-label">Context</p>

              {fields.question ? (
                <label>
                  {CONTEXT_COPY[feature].questionLabel || "What are you stuck on?"}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      CONTEXT_COPY[feature].questionPlaceholder ||
                      "Describe what you've tried, where you're stuck, or what you don't understand…"
                    }
                    disabled={!isPremium}
                    rows={3}
                    maxLength={2000}
                  />
                  <span className="ai-char-count">{message.length}/2000</span>
                </label>
              ) : null}

              {fields.question &&
              (CONTEXT_COPY[feature].examples || []).length > 0 ? (
                <div className="ai-examples" aria-label="Example prompts">
                  <span className="ai-examples-label">Try asking:</span>
                  {(CONTEXT_COPY[feature].examples || []).map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      className="ai-example-chip"
                      disabled={!isPremium}
                      onClick={() => setMessage(ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              ) : null}

              {fields.error ? (
                <label>
                  Error message
                  <textarea
                    className="ai-mono"
                    value={errorMsg}
                    onChange={(e) => setErrorMsg(e.target.value)}
                    placeholder="Paste the compiler/runtime/judge error here…"
                    disabled={!isPremium}
                    rows={3}
                    maxLength={2000}
                  />
                </label>
              ) : null}

              {fields.testCase ? (
                <label>
                  Test case
                  <textarea
                    className="ai-mono"
                    value={testCase}
                    onChange={(e) => setTestCase(e.target.value)}
                    placeholder={"Input:\nExpected:\nActual:"}
                    disabled={!isPremium}
                    rows={4}
                    maxLength={2000}
                  />
                </label>
              ) : null}

              {fields.code ? (
                <div className="ai-code-block">
                  <div className="ai-code-head">
                    <div>
                      <p className="ai-ws-label" style={{ margin: 0 }}>
                        Code{" "}
                        <span className="ai-optional">
                          {fields.codeRequired ? "Required" : "Optional"}
                        </span>
                      </p>
                    </div>
                    <div className="ai-code-actions">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Lang)}
                        disabled={!isPremium}
                        aria-label="Code language"
                      >
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript</option>
                        <option value="cpp">C++</option>
                        <option value="java">Java</option>
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!codeSnippet}
                        onClick={() => setCodeSnippet("")}
                      >
                        <Eraser size={14} aria-hidden />
                        Clear
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!codeSnippet}
                        onClick={() =>
                          void navigator.clipboard.writeText(codeSnippet)
                        }
                      >
                        <ClipboardCopy size={14} aria-hidden />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div
                    className="ai-code-shell"
                    aria-label="Ephemeral code editor"
                  >
                    <MonacoCodeEditor
                      value={codeSnippet}
                      language={language}
                      settings={{
                        ...DEFAULT_EDITOR_SETTINGS,
                        minimap: false,
                        wordWrap: "on",
                        fontSize: 13,
                      }}
                      readOnly={!isPremium}
                      onChange={(v) => setCodeSnippet(v.slice(0, 4000))}
                      style={{ height: 320 }}
                    />
                  </div>
                  <p className="ai-privacy">
                    <Scale size={12} aria-hidden />
                    Ephemeral input · Your code is used for this request and is
                    not stored in AI history.
                    <button
                      type="button"
                      className="ai-info-btn"
                      style={{ width: 22, height: 22 }}
                      title="Your snippet is sent only as context for this request and is not saved as persistent AI history."
                      aria-label="Ephemeral code privacy"
                    >
                      <Info size={12} aria-hidden />
                    </button>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="ai-ws-footer">
              <div className="ai-ws-footer-meta">
                {isPremium ? (
                  <>
                    <span>Uses 1 AI credit</span>
                    <span className="ai-meta">
                      {remaining} remaining
                      {remaining <= 0
                        ? ` · Resets ${nextUtcResetLabel(usage.dateKey)}`
                        : ""}
                    </span>
                  </>
                ) : (
                  <span>Premium required to ask AlgoPath AI</span>
                )}
              </div>
              <Button
                type="button"
                className="ai-ws-cta"
                disabled={!canAsk && isPremium}
                onClick={() => void handleAssist()}
              >
                {!isPremium ? (
                  <>Ask AI (Premium)</>
                ) : busy ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                    Analyzing…
                  </>
                ) : remaining <= 0 ? (
                  "Quota exhausted"
                ) : aiUnavailable ? (
                  "AI temporarily unavailable"
                ) : (
                  <>
                    <Send size={14} aria-hidden />
                    Ask AlgoPath AI · 1 credit
                  </>
                )}
              </Button>
            </div>

            {busy ? (
              <div className="ai-thinking" role="status" aria-live="polite">
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Thinking through your request…
              </div>
            ) : null}

            {reply ? (
              <article className="ai-response" aria-label="AI response">
                {requestSummary ? (
                  <div className="ai-request-chip-row">
                    <span className="ai-request-chip">
                      {featureLabel(requestSummary.feature, usage.features)}
                    </span>
                    {requestSummary.language ? (
                      <span className="ai-request-chip">
                        {requestSummary.language === "cpp"
                          ? "C++"
                          : requestSummary.language === "javascript"
                            ? "JavaScript"
                            : requestSummary.language.charAt(0).toUpperCase() +
                              requestSummary.language.slice(1)}
                      </span>
                    ) : null}
                    {requestSummary.hadCode ? (
                      <span className="ai-request-chip">Code attached</span>
                    ) : null}
                    {requestSummary.preview ? (
                      <button
                        type="button"
                        className="ai-request-chip ai-request-chip--btn"
                        onClick={() => setShowRequestContext((v) => !v)}
                      >
                        {showRequestContext
                          ? "Hide request context"
                          : "View request context"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {showRequestContext && requestSummary?.preview ? (
                  <p className="ai-request-preview">{requestSummary.preview}</p>
                ) : null}
                <div className="ai-response-head">
                  <div>
                    <p className="ai-kicker" style={{ margin: 0 }}>
                      AlgoPath AI
                      {replyFeature
                        ? ` · ${featureLabel(replyFeature, usage.features)}`
                        : ""}
                    </p>
                    {refusedDump ? (
                      <p className="ai-section-meta">
                        Learning policy: full solution dump declined.
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void copyReply()}
                  >
                    <ClipboardCopy size={14} aria-hidden />
                    Copy
                  </Button>
                </div>
                <pre className="ai-response-body">{reply}</pre>
                {feature === "give_hint" || replyFeature === "give_hint" ? (
                  <p className="ai-section-meta" style={{ marginTop: 10 }}>
                    Need another hint? Ask again after trying this step —
                    AlgoPath AI will not dump the full solution.
                  </p>
                ) : null}
              </article>
            ) : null}
          </section>
        </div>

        <aside className="ai-side" aria-label="Credits and activity">
          <section className="co-panel ai-panel" aria-label="AI credits">
            <div className="ai-section-head">
              <div>
                <p className="ai-kicker">Usage</p>
                <h2 className="ai-section-title">AI Credits</h2>
              </div>
            </div>
            {isPremium ? (
              <div className="ai-credit">
                <div className="ai-credit-top">
                  <span
                    className={`ai-credit-value${
                      creditTone === "low"
                        ? " is-low"
                        : creditTone === "empty"
                          ? " is-empty"
                          : ""
                    }`}
                  >
                    {remaining} / {quota}
                  </span>
                  <span className="ai-section-meta" style={{ margin: 0 }}>
                    remaining
                  </span>
                </div>
                <div
                  className={`ai-progress${
                    creditTone === "low"
                      ? " is-low"
                      : creditTone === "empty"
                        ? " is-empty"
                        : ""
                  }`}
                  role="progressbar"
                  aria-valuenow={remaining}
                  aria-valuemin={0}
                  aria-valuemax={quota}
                  aria-label={`${remaining} of ${quota} credits remaining`}
                >
                  <span style={{ width: `${Math.max(0, 100 - usedPct)}%` }} />
                </div>
                <div className="ai-credit-meta">
                  <span>
                    {usage.used} used today ({usage.dateKey} UTC)
                  </span>
                  <span>Resets {nextUtcResetLabel(usage.dateKey)}</span>
                  {usage.failed > 0 ? (
                    <span>
                      {usage.failed} failed request
                      {usage.failed === 1 ? "" : "s"} logged
                    </span>
                  ) : null}
                </div>
                {remaining <= 0 ? (
                  <p className="ai-section-meta">
                    You&apos;ve used today&apos;s AI allowance. Credits refresh at
                    UTC midnight.
                  </p>
                ) : null}
                {aiUnavailable ? (
                  <p className="ai-section-meta" role="status">
                    AlgoPath AI is temporarily unavailable. Please try again
                    later.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="ai-section-meta">
                Daily AI credits unlock with Premium.
              </p>
            )}
          </section>

          <section className="co-panel ai-panel" aria-label="Recent AI activity">
            <div className="ai-section-head">
              <div>
                <p className="ai-kicker">Activity</p>
                <h2 className="ai-section-title">Recent AI activity</h2>
                <p className="ai-section-meta">
                  {history.length} request{history.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="ai-hist-filters" role="tablist" aria-label="History filter">
              {(
                [
                  ["all", "All"],
                  ["success", "Successful"],
                  ["failed", "Failed"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={histFilter === id}
                  className={`ai-chip${histFilter === id ? " is-active" : ""}`}
                  onClick={() => setHistFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {history.length === 0 ? (
              <EmptyState
                compact
                title="No AI sessions yet"
                description="Ask AlgoPath AI for a hint, explanation, or debugging help. Successful and failed requests appear here."
              />
            ) : (
              <ul className="ai-hist-list">
                {history.map((h, i) => (
                  <li
                    key={`${h.createdAt}-${h.feature}-${i}`}
                    className="ai-hist-item"
                  >
                    <div className="ai-hist-item-top">
                      <strong>
                        {featureLabel(h.feature, usage.features)}
                      </strong>
                      <span
                        className={`ai-status ${
                          h.success ? "ai-status--ok" : "ai-status--fail"
                        }`}
                      >
                        {h.success ? "Successful" : "Failed"}
                      </span>
                    </div>
                    <p className="ai-hist-meta">
                      {h.createdAt ? relativeTime(h.createdAt) : "—"}
                      {h.hadCodeSnippet ? " · included code context" : ""}
                      {!h.success && h.failureReason
                        ? ` · ${h.failureReason}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="co-panel ai-panel" aria-label="How to get better AI help">
            <div className="ai-section-head">
              <div>
                <p className="ai-kicker">Guidance</p>
                <h2 className="ai-section-title">How to get better AI help</h2>
              </div>
            </div>
            <ol className="ai-tips">
              <li>Explain what you already tried.</li>
              <li>Include the exact error when debugging.</li>
              <li>Ask for a hint before a full explanation.</li>
              <li>Try the suggestion yourself before asking again.</li>
              <li>Use Optimize Approach after you have a working solution.</li>
            </ol>
            {feature === "interview_mode" ? (
              <p className="ai-section-meta" style={{ marginTop: 10 }}>
                Interview Mode uses Socratic coaching. Prefer Mock Interviews
                for a full timed session experience.
              </p>
            ) : null}
            {feature === "generate_similar_problem" ? (
              <p className="ai-section-meta" style={{ marginTop: 10 }}>
                Generated practice prompts are AI-authored guidance — not
                official AlgoPath problem records.
              </p>
            ) : null}
          </section>
        </aside>
      </div>

      <PremiumUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="premium.ai"
        title="Premium Feature"
        description="AlgoPath AI is available to Premium members only."
      />
    </div>
  );
};
