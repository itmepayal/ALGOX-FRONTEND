import { useCallback, useEffect, useState, type FC } from "react";
import { Brain, Loader2, Send } from "lucide-react";
import {
  aiApi,
  type AiFeatureId,
  type AiUsageSnapshot,
} from "../api/aiApi";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Skeleton } from "./ui/skeleton";
import { UpgradePrompt } from "./access/UpgradePrompt";

interface Props {
  problemId?: string | null;
  problemTitle?: string | null;
  refreshKey?: number;
}

type AiHistoryItem = {
  feature: string;
  success: boolean;
  failureReason?: string;
  createdAt: string;
  provider?: string;
};

export const AiAssistantPanel: FC<Props> = ({
  problemId,
  problemTitle,
  refreshKey = 0,
}) => {
  const [usage, setUsage] = useState<AiUsageSnapshot | null>(null);
  const [history, setHistory] = useState<AiHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feature, setFeature] = useState<AiFeatureId>("give_hint");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [testCase, setTestCase] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [usageRes, histRes] = await Promise.allSettled([
        aiApi.getUsage(),
        aiApi.getHistory(30),
      ]);
      if (usageRes.status === "fulfilled") {
        setUsage(usageRes.value.data ?? null);
        const feats = usageRes.value.data?.features || [];
        if (feats.length && !feats.find((f) => f.id === feature)) {
          setFeature(feats[0].id);
        }
      } else {
        setUsage(null);
        throw usageRes.reason;
      }
      if (histRes.status === "fulfilled") {
        setHistory(histRes.value.data?.items || []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load AI usage");
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, [feature]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

  const handleAssist = async () => {
    setBusy(true);
    setError("");
    setReply("");
    try {
      const res = await aiApi.assist({
        feature,
        problemId: problemId || undefined,
        userMessage: message || undefined,
        errorMessage: errorMsg || undefined,
        testCase: testCase || undefined,
        codeSnippet: codeSnippet || undefined,
      });
      if (res.data) {
        setReply(res.data.reply);
        setUsage((prev) =>
          prev
            ? {
                ...prev,
                used: res.data!.usage.used,
                remaining: res.data!.usage.remaining,
                quota: res.data!.usage.quota,
                failed: res.data!.usage.failed,
              }
            : prev
        );
        try {
          const hist = await aiApi.getHistory(30);
          setHistory(hist.data?.items || []);
        } catch {
          /* keep prior history */
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Assist failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="free-home" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="free-home">
        <EmptyState
          title="Sign in for AlgoPath AI"
          description="Guests cannot use AI. Free accounts get limited daily credits; Premium gets a larger allowance."
        />
        {error ? <p className="free-home-muted">{error}</p> : null}
      </div>
    );
  }

  const selectedMeta = usage.features.find((f) => f.id === feature);
  const lockedPremium =
    selectedMeta?.premiumOnly && !usage.premiumFeatures;

  return (
    <div className="free-home">
      <header className="free-home-welcome">
        <div>
          <p className="free-home-kicker">Learning assistant</p>
          <h1 className="free-home-title">
            <Brain size={22} aria-hidden /> AlgoPath AI
          </h1>
          <p className="free-home-lede">
            Guided help for understanding — not a solution vending machine. Quotas
            are enforced on the server.
          </p>
        </div>
      </header>

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>Daily credits</h2>
          <span className="free-home-muted">
            {usage.accessTier} · {usage.used}/{usage.quota} used ·{" "}
            {usage.remaining} left ({usage.dateKey} UTC)
          </span>
        </div>
        <p className="free-home-muted">
          Failures logged: {usage.failed}
          {usage.providerConfigured
            ? " · AI provider configured"
            : " · AI unavailable — provider not configured on server"}
        </p>
        {!usage.providerConfigured ? (
          <p className="free-home-alert" role="status" style={{ marginTop: 8 }}>
            Real AI replies are disabled until an administrator configures the
            provider. Learning policy still blocks full solution dumps.
          </p>
        ) : null}
        {!usage.premiumFeatures ? (
          <div style={{ marginTop: 12 }}>
            <UpgradePrompt
              feature="premium.ai"
              title="Larger AI allowance + premium features"
              description="Upgrade for a higher daily quota and Interview Mode / optimize tools."
            />
          </div>
        ) : null}
      </section>

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>Ask for help</h2>
          {problemTitle ? (
            <span className="free-home-muted">Context: {problemTitle}</span>
          ) : null}
        </div>

        <div className="mock-interview-form">
          <label>
            Feature
            <select
              value={feature}
              onChange={(e) => setFeature(e.target.value as AiFeatureId)}
            >
              {usage.features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                  {f.premiumOnly ? " (Premium)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Question (optional)
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What are you stuck on?"
            />
          </label>
          <label>
            Error message
            <input
              value={errorMsg}
              onChange={(e) => setErrorMsg(e.target.value)}
              placeholder="Paste judge/compiler error"
            />
          </label>
          <label>
            Test case
            <input
              value={testCase}
              onChange={(e) => setTestCase(e.target.value)}
              placeholder="Failing / sample case"
            />
          </label>
        </div>
        <label className="free-home-muted" style={{ display: "block", marginBottom: 8 }}>
          Code snippet (ephemeral — not stored on server)
          <textarea
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            rows={5}
            style={{
              width: "100%",
              marginTop: 4,
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              padding: 8,
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-elevated)",
              color: "var(--text-main)",
            }}
            placeholder="Optional truncated snippet for Find Bug / Explain Error"
          />
        </label>

        {lockedPremium ? (
          <UpgradePrompt feature="premium.ai" title="Premium AI feature" />
        ) : (
          <Button
            type="button"
            disabled={busy || usage.remaining <= 0 || !usage.providerConfigured}
            onClick={() => void handleAssist()}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {!usage.providerConfigured
              ? "AI unavailable"
              : usage.remaining <= 0
                ? "Quota exhausted"
                : "Ask AI"}
          </Button>
        )}

        {error ? (
          <p className="free-home-alert" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}

        {reply ? (
          <div className="free-home-card" style={{ marginTop: 14 }}>
            <h3 className="free-home-section-title">Response</h3>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {reply}
            </pre>
          </div>
        ) : null}
      </section>

      <section className="free-home-card">
        <div className="free-home-card-head">
          <h2>Recent AI history</h2>
          <span className="free-home-muted">{history.length} server records</span>
        </div>
        {history.length === 0 ? (
          <EmptyState
            compact
            title="No AI requests yet"
            description="Successful and failed assists appear here from the server log."
          />
        ) : (
          <ul className="free-home-activity">
            {history.map((h, i) => (
              <li key={`${h.createdAt}-${h.feature}-${i}`}>
                <strong>{h.feature}</strong>
                <span className="free-home-muted">
                  {" "}
                  · {h.success ? "ok" : "failed"}
                  {h.provider ? ` · ${h.provider}` : ""}
                  {h.failureReason ? ` · ${h.failureReason}` : ""}
                  {" · "}
                  {h.createdAt
                    ? new Date(h.createdAt).toLocaleString()
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
