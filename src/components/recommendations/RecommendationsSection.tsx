import { useState, useEffect, type FC } from "react";
import {
  Brain,
  Sparkles,
  ArrowRight,
  Target,
  RefreshCw,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import type { Problem } from "../../api/problemApi";
import {
  recommendationApi,
  type RecommendationData,
  type RecommendationItem,
} from "../../api/recommendationApi";

interface RecommendationsSectionProps {
  onSelectProblem?: (problem: Problem) => void;
  onNavigateToTopic?: (topic: string) => void;
}

export const RecommendationsSection: FC<RecommendationsSectionProps> = ({
  onSelectProblem,
  onNavigateToTopic,
}) => {
  const [data, setData] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await recommendationApi.getRecommendations({ limit: 5 });
      setData(res);
    } catch (err: any) {
      console.error("Failed to load recommendations", err);
      setError(err?.response?.data?.message || "Failed to generate personalized recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const renderDifficultyBadge = (diff: string) => {
    const d = diff.toLowerCase();
    if (d === "easy") {
      return (
        <span className="ax-badge text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
          Easy
        </span>
      );
    }
    if (d === "medium") {
      return (
        <span className="ax-badge text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 capitalize">
          Medium
        </span>
      );
    }
    return (
      <span className="ax-badge text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 capitalize">
        Hard
      </span>
    );
  };

  if (loading) {
    return (
      <div className="ax-card p-6 border-cyan-500/20 animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-gray-800 rounded-md" />
          <div className="h-5 w-24 bg-gray-800 rounded-md" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-900/80 rounded-xl border border-gray-800/60" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ax-card p-6 border-rose-500/20 text-center">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <p className="text-sm text-gray-300 mb-3">{error || "Unable to generate recommendations."}</p>
        <button
          onClick={fetchRecommendations}
          className="ax-btn ax-btn-secondary text-xs inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const { summary, recommendations } = data;

  return (
    <div className="ax-card p-6 border-cyan-500/30 space-y-5 animate-fade-in relative overflow-hidden">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-1.5">
            <Brain className="w-3.5 h-3.5" />
            <span>Adaptive Engine V1</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Recommended For You</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Personalized problem progression based on your topic ratings and submission activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {summary.focusTopic && (
            <button
              onClick={() => onNavigateToTopic && onNavigateToTopic(summary.focusTopic!)}
              className="text-xs bg-gray-900 text-gray-300 border border-gray-700/60 hover:border-cyan-500/40 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              <span>Focus: <strong>{summary.focusTopic}</strong></span>
            </button>
          )}

          <button
            onClick={fetchRecommendations}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors"
            title="Refresh Recommendations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recommendations List */}
      {recommendations.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          <BookOpen className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-white mb-1">No recommendations ready yet</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Solve a few problems to help AlgoPath analyze your topic strengths and generate personalized problem suggestions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((item: RecommendationItem, idx: number) => (
            <div
              key={item.problemId}
              className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                    #{idx + 1} Match ({item.score}%)
                  </span>
                  <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                    {item.title}
                  </h3>
                  {renderDifficultyBadge(item.difficulty)}
                  <span className="text-xs bg-gray-800/80 text-gray-400 px-2 py-0.5 rounded-md">
                    {item.category || item.primaryTopic}
                  </span>
                </div>

                {/* Reason Explanation */}
                <p className="text-xs text-gray-300 flex items-start gap-1.5 bg-gray-950/50 p-2 rounded-lg border border-gray-800/50">
                  <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{item.reason}</span>
                </p>
              </div>

              <div className="flex items-center justify-end shrink-0">
                <button
                  onClick={() =>
                    onSelectProblem &&
                    onSelectProblem({
                      _id: item.problemId,
                      id: item.problemId,
                      slug: item.slug,
                      title: item.title,
                      difficulty: item.difficulty,
                      category: item.category || item.primaryTopic,
                      tags: item.tags || [],
                      description: "",
                    } as Problem)
                  }
                  className="ax-btn ax-btn-primary text-xs inline-flex items-center gap-1.5 group-hover:bg-cyan-500 transition-colors"
                >
                  <span>Solve Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
