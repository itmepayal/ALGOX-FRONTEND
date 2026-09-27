import { useState, useEffect, useMemo, type FC } from "react";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Search,
  RefreshCw,
  Sparkles,
  BarChart2,
  ChevronRight,
  X,
  Target,
  BookOpen,
} from "lucide-react";
import {
  skillApi,
  type UserSkillProfileData,
  type TopicSkillSummary,
  type SkillConfidence,
  type SkillTrend,
} from "../../api/skillApi";
import { useToast } from "../../context/ToastContext";

interface SkillProfilePanelProps {
  onNavigateToTopic?: (topic: string) => void;
}

export const SkillProfilePanel: FC<SkillProfilePanelProps> = ({
  onNavigateToTopic,
}) => {
  const toast = useToast();
  const [profile, setProfile] = useState<UserSkillProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"rating" | "solved" | "acceptance" | "topic">("rating");
  const [selectedTopic, setSelectedTopic] = useState<TopicSkillSummary | null>(null);

  const fetchSkillProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await skillApi.getMyProfile();
      setProfile(data);
    } catch (err: any) {
      console.error("Failed to load skill profile", err);
      setError(err?.response?.data?.message || "Failed to load skill profile");
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const data = await skillApi.recalculateMyProfile();
      setProfile(data);
      toast.success("Skill ratings successfully recalculated!");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Recalculation failed");
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    fetchSkillProfile();
  }, []);

  const filteredTopics = useMemo(() => {
    if (!profile?.topics) return [];
    let list = profile.topics.filter((t) =>
      t.topic.toLowerCase().includes(search.toLowerCase())
    );

    list.sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "solved") return b.problemsSolved - a.problemsSolved;
      if (sortBy === "acceptance") return b.acceptanceRate - a.acceptanceRate;
      if (sortBy === "topic") return a.topic.localeCompare(b.topic);
      return 0;
    });

    return list;
  }, [profile, search, sortBy]);

  const renderConfidenceBadge = (confidence: SkillConfidence, solved: number) => {
    if (solved < 3 || confidence === "LOW") {
      return (
        <span className="ax-badge text-xs bg-gray-500/10 text-gray-400 border border-gray-500/20">
          Low Confidence
        </span>
      );
    }
    if (confidence === "MEDIUM") {
      return (
        <span className="ax-badge text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Medium Confidence
        </span>
      );
    }
    return (
      <span className="ax-badge text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        High Confidence
      </span>
    );
  };

  const renderTrendBadge = (trend: SkillTrend) => {
    if (trend === "IMPROVING") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          <TrendingUp className="w-3.5 h-3.5" /> Improving
        </span>
      );
    }
    if (trend === "DECLINING") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
          <TrendingDown className="w-3.5 h-3.5" /> Declining
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-500/10 px-2 py-0.5 rounded-full border border-gray-500/20">
        <Minus className="w-3.5 h-3.5" /> Stable
      </span>
    );
  };

  const getRatingColorClass = (rating: number, solved: number) => {
    if (solved === 0) return "text-gray-400";
    if (rating >= 1700) return "text-purple-400";
    if (rating >= 1500) return "text-emerald-400";
    if (rating >= 1300) return "text-cyan-400";
    if (rating >= 1100) return "text-amber-400";
    return "text-gray-300";
  };

  if (loading) {
    return (
      <div className="ax-workspace animate-fade-in py-12 flex flex-col items-center justify-center text-gray-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-cyan-400" />
        <p className="text-sm">Evaluating topic skill ratings...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="ax-workspace animate-fade-in py-12 text-center">
        <div className="ax-card max-w-md mx-auto p-6 text-center border-rose-500/30">
          <Zap className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Unable to load skills</h3>
          <p className="text-sm text-gray-400 mb-4">{error || "Skill profile not available."}</p>
          <button onClick={fetchSkillProfile} className="ax-btn ax-btn-primary mx-auto">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { overall } = profile;

  return (
    <div className="ax-workspace animate-fade-in space-y-6">
      {/* Header Banner */}
      <div className="ax-hero-compact flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Topic-wise Skill Rating V1</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DSA Skill Profile</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xl">
            Deterministic DSA strength breakdown across canonical problem topics, powered by your real submission history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="ax-btn ax-btn-primary inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
            <span>{recalculating ? "Recalculating..." : "Recalculate Skills"}</span>
          </button>
        </div>
      </div>

      {/* Top Stat Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Average Skill Rating</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{overall.averageRating}</div>
          <div className="text-xs text-gray-500 mt-1">Across evaluated topics</div>
        </div>

        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Strongest Topic</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 truncate">
            {overall.strongestTopic || "Not Enough Data"}
          </div>
          <div className="text-xs text-gray-500 mt-1">Highest evaluated topic rating</div>
        </div>

        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Needs Practice</span>
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 truncate">
            {overall.weakestTopic || "Not Enough Data"}
          </div>
          <div className="text-xs text-gray-500 mt-1">Focus recommended</div>
        </div>

        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Solved Problems</span>
            <BarChart2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{overall.totalSolved}</div>
          <div className="text-xs text-gray-500 mt-1">{overall.evaluatedTopicsCount} topics active</div>
        </div>
      </div>

      {/* Controls Bar: Search & Sort */}
      <div className="ax-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search topic (e.g. Arrays, Graphs)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900/80 border border-gray-700/60 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-gray-400 font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-gray-900/80 border border-gray-700/60 text-sm text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="rating">Skill Rating</option>
            <option value="solved">Problems Solved</option>
            <option value="acceptance">Acceptance Rate</option>
            <option value="topic">Topic Name</option>
          </select>
        </div>
      </div>

      {/* Topics Grid */}
      {filteredTopics.length === 0 ? (
        <div className="ax-card py-12 text-center text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p className="text-base font-medium text-white mb-1">
            {search ? "No matching topics found" : "Your topic skill profile is building"}
          </p>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
            {search
              ? `No DSA topic matches "${search}".`
              : "Solve problems across different DSA topics to unlock reliable topic skill ratings."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.map((t) => {
            const hasData = t.problemsAttempted > 0;
            return (
              <div
                key={t.topic}
                onClick={() => setSelectedTopic(t)}
                className="ax-card p-4 hover:border-cyan-500/40 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {t.topic}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {renderConfidenceBadge(t.confidence, t.problemsSolved)}
                        {renderTrendBadge(t.trend)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-2xl font-black ${getRatingColorClass(
                          t.rating,
                          t.problemsSolved
                        )}`}
                      >
                        {hasData && t.problemsSolved >= 1 ? t.rating : "—"}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                        {hasData && t.problemsSolved >= 1 ? "Rating" : "No Data"}
                      </div>
                    </div>
                  </div>

                  {/* Difficulty Breakdown Bar */}
                  {hasData && (
                    <div className="space-y-1.5 my-3">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Solved: <strong className="text-white">{t.problemsSolved}</strong> / {t.problemsAttempted}</span>
                        <span>{t.acceptanceRate}% acc</span>
                      </div>

                      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex">
                        <div
                          style={{
                            width: `${(t.easySolved / Math.max(1, t.problemsSolved)) * 100}%`,
                          }}
                          className="bg-emerald-500 h-full"
                          title={`Easy: ${t.easySolved}`}
                        />
                        <div
                          style={{
                            width: `${(t.mediumSolved / Math.max(1, t.problemsSolved)) * 100}%`,
                          }}
                          className="bg-amber-500 h-full"
                          title={`Medium: ${t.mediumSolved}`}
                        />
                        <div
                          style={{
                            width: `${(t.hardSolved / Math.max(1, t.problemsSolved)) * 100}%`,
                          }}
                          className="bg-rose-500 h-full"
                          title={`Hard: ${t.hardSolved}`}
                        />
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-0.5">
                        <span className="text-emerald-400">{t.easySolved} Easy</span>
                        <span className="text-amber-400">{t.mediumSolved} Med</span>
                        <span className="text-rose-400">{t.hardSolved} Hard</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-800/80 text-xs text-gray-400 group-hover:text-cyan-400">
                  <span>View Details</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Topic Detail Modal */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="ax-card max-w-lg w-full p-6 relative border-cyan-500/30">
            <button
              onClick={() => setSelectedTopic(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedTopic.topic}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {renderConfidenceBadge(selectedTopic.confidence, selectedTopic.problemsSolved)}
                  {renderTrendBadge(selectedTopic.trend)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 my-4 p-4 rounded-xl bg-gray-900/80 border border-gray-800">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Topic Rating</div>
                <div className={`text-2xl font-extrabold ${getRatingColorClass(selectedTopic.rating, selectedTopic.problemsSolved)}`}>
                  {selectedTopic.problemsSolved >= 1 ? selectedTopic.rating : "Not enough data"}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Acceptance Rate</div>
                <div className="text-2xl font-extrabold text-white">
                  {selectedTopic.acceptanceRate}%
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Problem Breakdown</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-lg font-bold text-emerald-400">{selectedTopic.easySolved}</div>
                  <div className="text-xs text-gray-400">Easy Solved</div>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-lg font-bold text-amber-400">{selectedTopic.mediumSolved}</div>
                  <div className="text-xs text-gray-400">Medium Solved</div>
                </div>

                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <div className="text-lg font-bold text-rose-400">{selectedTopic.hardSolved}</div>
                  <div className="text-xs text-gray-400">Hard Solved</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800 text-xs text-gray-300 flex items-center justify-between">
                <span>Total Attempts Submitted:</span>
                <strong className="text-white">{selectedTopic.totalAttempts}</strong>
              </div>
            </div>

            {/* Recommendation Box */}
            <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 mb-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Recommendation
              </h4>
              <p className="text-xs text-gray-300">
                {selectedTopic.problemsSolved < 3
                  ? `Solve at least 3 problems in ${selectedTopic.topic} to establish a reliable skill rating baseline.`
                  : selectedTopic.mediumSolved < selectedTopic.easySolved
                  ? `Transition to Medium ${selectedTopic.topic} problems to accelerate rating improvement.`
                  : `Focus on Hard ${selectedTopic.topic} challenges to boost rating towards peak level.`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedTopic(null)}
                className="ax-btn ax-btn-secondary"
              >
                Close
              </button>
              {onNavigateToTopic && (
                <button
                  onClick={() => {
                    const topName = selectedTopic.topic;
                    setSelectedTopic(null);
                    onNavigateToTopic(topName);
                  }}
                  className="ax-btn ax-btn-primary inline-flex items-center gap-2"
                >
                  <span>Practice {selectedTopic.topic}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
