import { useEffect, useState, type FC } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  HardDrive,
  Code2,
  Brain,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { aiApi, type AiCodeReviewPayload, type AiCodeReviewResponse } from "../api/aiApi";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { UpgradePrompt } from "./access/UpgradePrompt";

interface Props {
  submissionId: string;
  problemId?: string;
  onClose?: () => void;
}

export const AiCodeReviewPanel: FC<Props> = ({ submissionId }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [review, setReview] = useState<AiCodeReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPremiumRequired, setIsPremiumRequired] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);

  const fetchReview = async (refresh = false) => {
    if (!submissionId) return;
    try {
      if (refresh) {
        setGenerating(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setIsPremiumRequired(false);

      // Check stored review first if not refreshing
      if (!refresh) {
        const stored = await aiApi.getStoredCodeReview(submissionId);
        if (stored.data) {
          setReview(stored.data);
          setLoading(false);
          return;
        }
      }

      // Generate new review
      const res = await aiApi.getCodeReview(submissionId, refresh);
      if (res.success && res.data) {
        setReview(res.data);
      } else {
        setError(res.message || "Failed to generate AI Code Review");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Error generating review";
      if (msg.toLowerCase().includes("premium") || err?.response?.status === 403) {
        setIsPremiumRequired(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchReview(false);
  }, [submissionId]);

  if (isPremiumRequired) {
    return (
      <div className="p-4">
        <UpgradePrompt
          feature="premium.ai"
          title="AI Code Review V1"
          description="Unlock detailed time/space complexity analysis, code quality scoring, edge-case analysis, and AI learning insights for all your submissions."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-indigo-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium text-sm">Analyzing code submission & running AI Code Review...</span>
        </div>
        <Skeleton className="h-20 w-full rounded-xl bg-slate-800/60" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-xl bg-slate-800/60" />
          <Skeleton className="h-32 w-full rounded-xl bg-slate-800/60" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl bg-slate-800/60" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="ax-card p-5 border-rose-500/30 bg-rose-500/5 text-rose-300 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h4 className="font-semibold text-rose-200">AI Code Review Unavailable</h4>
          </div>
          <p className="text-sm opacity-90">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchReview(true)}
            disabled={generating}
            className="mt-2 border border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Review
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="p-3 bg-indigo-500/10 rounded-full w-fit mx-auto border border-indigo-500/20">
          <Sparkles className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-100">AI Code Review Available</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Get structured feedback on complexity, code quality, edge cases, and optimization steps.
          </p>
        </div>
        <Button
          onClick={() => fetchReview(true)}
          disabled={generating}
          className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 text-sm"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Review...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate AI Code Review
            </>
          )}
        </Button>
      </div>
    );
  }

  const p: AiCodeReviewPayload = review.reviewPayload;

  return (
    <div className="p-5 space-y-6 text-slate-200 text-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
              AI Code Review V1
              {review.cached && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Cached
                </span>
              )}
            </h3>
            <span className="text-xs text-slate-400">Structured educational submission analysis</span>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchReview(true)}
          disabled={generating}
          className="text-xs border-slate-700 hover:bg-slate-800 gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
          Re-Analyze
        </Button>
      </div>


      {/* 1. Overall Assessment */}
      <div className="ax-card p-4 bg-gradient-to-r from-indigo-950/30 via-slate-900/60 to-purple-950/30 border border-indigo-500/20 rounded-xl space-y-2">
        <div className="flex items-center gap-2 text-indigo-300 font-medium text-xs uppercase tracking-wider">
          <Brain className="w-4 h-4 text-indigo-400" />
          Overall Assessment
        </div>
        <p className="text-slate-200 text-sm leading-relaxed">{p.overallAssessment}</p>
      </div>

      {/* 2. Correctness & Execution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="ax-card p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Correctness</span>
            {p.correctness.status === "correct" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Correct
              </span>
            ) : p.correctness.status === "partial" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5" /> Partial
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <XCircle className="w-3.5 h-3.5" /> Incorrect
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 leading-normal">{p.correctness.summary}</p>
        </div>

        {/* Code Quality Score */}
        <div className="ax-card p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Code Quality Score</span>
            <span className="text-sm font-bold font-mono text-indigo-400">
              {p.codeQuality.score} / 10
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                p.codeQuality.score >= 8
                  ? "bg-emerald-500"
                  : p.codeQuality.score >= 5
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${p.codeQuality.score * 10}%` }}
            />
          </div>
          {p.codeQuality.issues.length > 0 && (
            <ul className="text-xs text-slate-400 list-disc list-inside space-y-0.5">
              {p.codeQuality.issues.slice(0, 2).map((issue, idx) => (
                <li key={idx} className="truncate">{issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 3. Complexity Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Time Complexity */}
        <div className="ax-card p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Clock className="w-4 h-4 text-cyan-400" />
            Time Complexity
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
              Current: {p.timeComplexity.current}
            </span>
            {p.timeComplexity.expected && p.timeComplexity.expected !== "N/A" && (
              <span className="font-mono text-xs text-slate-400">
                Expected: {p.timeComplexity.expected}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-normal">{p.timeComplexity.explanation}</p>
        </div>

        {/* Space Complexity */}
        <div className="ax-card p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <HardDrive className="w-4 h-4 text-purple-400" />
            Space Complexity
          </div>
          <span className="font-mono text-sm font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded inline-block">
            Current: {p.spaceComplexity.current}
          </span>
          <p className="text-xs text-slate-400 leading-normal">{p.spaceComplexity.explanation}</p>
        </div>
      </div>

      {/* 4. Edge Cases & Optimization Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Edge Cases */}
        {p.edgeCases.length > 0 && (
          <div className="ax-card p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Critical Edge Cases
            </div>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
              {p.edgeCases.map((ec, idx) => (
                <li key={idx}>{ec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Optimizations */}
        {p.optimizationSuggestions.length > 0 && (
          <div className="ax-card p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Code2 className="w-4 h-4 text-emerald-400" />
              Optimization Directions
            </div>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
              {p.optimizationSuggestions.map((opt, idx) => (
                <li key={idx}>{opt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 5. Educational Feedback & Recommended Next Step */}
      <div className="ax-card p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-indigo-300 font-medium text-xs uppercase tracking-wider">
          <Lightbulb className="w-4 h-4 text-indigo-400" />
          Learning Insight & Next Steps
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{p.learningFeedback}</p>
        
        <div className="flex items-center justify-between pt-2 border-t border-indigo-500/20 text-xs">
          <span className="text-indigo-200 font-medium flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            {p.recommendedNextStep}
          </span>
        </div>
      </div>
    </div>
  );
};
