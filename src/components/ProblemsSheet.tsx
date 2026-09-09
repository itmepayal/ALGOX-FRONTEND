import { useState, type FC } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  Shuffle,
  Upload,
} from "lucide-react";
import type { Problem } from "../api/problemApi";
import type { Submission } from "../api/submissionApi";
import { computeProgress, groupByCategory, isSolved, normalizeDifficulty } from "../utils/problemUtils";

interface ProblemsSheetProps {
  problems: Problem[];
  loading: boolean;
  submissions: Submission[];
  searchQuery: string;
  selectedDifficulty: string;
  onSearchChange: (q: string) => void;
  onDifficultyChange: (d: string) => void;
  onSelectProblem: (p: Problem) => void;
  onOpenAdmin?: () => void;
}

export const ProblemsSheet: FC<ProblemsSheetProps> = ({
  problems,
  loading,
  submissions,
  searchQuery,
  selectedDifficulty,
  onSearchChange,
  onDifficultyChange,
  onSelectProblem,
  onOpenAdmin,
}) => {
  const [sheetTab, setSheetTab] = useState<"all" | "revision">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = problems.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.tags?.some((t) => t.toLowerCase().includes(q));
    const matchDiff =
      selectedDifficulty === "All" ||
      normalizeDifficulty(p.difficulty) === selectedDifficulty.toLowerCase();
    const matchRevision =
      sheetTab === "all" || isSolved(p.id || p._id, submissions);
    return matchSearch && matchDiff && matchRevision;
  });

  const grouped = groupByCategory(filtered);
  const progress = computeProgress(problems, submissions);
  const progressDeg = `${(progress.pct / 100) * 360}deg`;
  const lastUpdated = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const toggleCategory = (cat: string) => {
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleReset = () => {
    onSearchChange("");
    onDifficultyChange("All");
    setSheetTab("all");
    setExpanded({});
  };

  const pickRandom = () => {
    if (filtered.length === 0) return;
    onSelectProblem(filtered[Math.floor(Math.random() * filtered.length)]);
  };

  let globalIndex = 0;

  return (
    <div className="striver-layout animate-fade-in">
      <div className="striver-main">
        {/* Header row */}
        <header className="striver-hero">
          <div className="striver-hero-text">
            <h1>algoX Array Sheet — Learn DSA from A to Z</h1>
            <p>
              This sheet covers all important array problems from basics to advanced.
              Practice with live code submission, evaluation & track your progress.
            </p>
          </div>
          <div className="striver-hero-actions">
            <div className="striver-hero-btn-row">
              <button type="button" className="striver-outline-btn" onClick={handleReset}>
                <RotateCcw size={15} />
                Reset
              </button>
              {onOpenAdmin && (
                <button type="button" className="striver-outline-btn striver-outline-primary" onClick={onOpenAdmin}>
                  <Upload size={15} />
                  Import
                </button>
              )}
            </div>
            <span className="striver-updated">Last updated: {lastUpdated}</span>
          </div>
        </header>

        {/* Controls bar — tabs + search + filters in one card */}
        <div className="striver-controls-card">
          <div className="striver-tabs">
            <button type="button" className={`striver-tab ${sheetTab === "all" ? "active" : ""}`} onClick={() => setSheetTab("all")}>
              All Problems
            </button>
            <button type="button" className={`striver-tab ${sheetTab === "revision" ? "active" : ""}`} onClick={() => setSheetTab("revision")}>
              Revision
            </button>
          </div>

          <div className="striver-controls-right">
            <div className="striver-search-inline">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <select className="striver-select" value={selectedDifficulty} onChange={(e) => onDifficultyChange(e.target.value)}>
              <option value="All">All problems</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <button type="button" className="striver-random-btn" onClick={pickRandom} disabled={filtered.length === 0}>
              <Shuffle size={15} />
              Random Problem
            </button>
          </div>
        </div>

        {/* Overall progress — 3 column grid */}
        <div className="striver-progress-banner">
          <div className="striver-progress-left">
            <div className="striver-progress-ring" data-label={`${progress.pct}%`} style={{ ["--progress-deg" as string]: progressDeg }} />
            <div className="striver-progress-center">
              <span className="striver-progress-label">Overall Progress</span>
              <span className="striver-progress-count">{progress.solved} / {progress.total}</span>
            </div>
          </div>

          <div className="striver-progress-divider" />

          <div className="striver-progress-breakdown">
            <div className="striver-diff-pill easy">
              <span className="dot" />
              <span>Easy</span>
              <b>{progress.byDiff.easy.solved}/{progress.byDiff.easy.total}</b>
            </div>
            <div className="striver-diff-pill medium">
              <span className="dot" />
              <span>Medium</span>
              <b>{progress.byDiff.medium.solved}/{progress.byDiff.medium.total}</b>
            </div>
            <div className="striver-diff-pill hard">
              <span className="dot" />
              <span>Hard</span>
              <b>{progress.byDiff.hard.solved}/{progress.byDiff.hard.total}</b>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-center">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="striver-empty">
            <p>No problems found.</p>
            <p>Admin → Import 10 Array Questions to get started.</p>
          </div>
        ) : (
          <div className="striver-topics">
            {Object.entries(grouped).map(([category, items]) => {
              const catSolved = items.filter((p) => isSolved(p.id || p._id, submissions)).length;
              const catPct = items.length ? Math.round((catSolved / items.length) * 100) : 0;
              const open = expanded[category] === true;

              return (
                <div key={category} className="striver-topic-group">
                  <button type="button" className="striver-topic-row" onClick={() => toggleCategory(category)}>
                    <span className="striver-topic-left">
                      <ChevronRight size={18} className={`striver-chevron ${open ? "open" : ""}`} />
                      <span className="striver-topic-name">{category}</span>
                    </span>
                    <span className="striver-topic-right">
                      <span className="striver-topic-bar">
                        <span className="striver-topic-bar-fill" style={{ width: `${catPct}%` }} />
                      </span>
                      <span className="striver-topic-fraction">{catSolved} / {items.length}</span>
                    </span>
                  </button>

                  {open && (
                    <div className="striver-problem-list">
                      {items.map((prob, itemIdx) => {
                        globalIndex += 1;
                        const pid = prob.id || prob._id;
                        const solved = isSolved(pid, submissions);
                        const diff = normalizeDifficulty(prob.difficulty);
                        const rowParity = itemIdx % 2 === 0 ? "row-odd" : "row-even";

                        return (
                          <button
                            key={pid || globalIndex}
                            type="button"
                            className={`striver-problem-item ${rowParity} ${solved ? "solved" : ""}`}
                            onClick={() => onSelectProblem(prob)}
                          >
                            <span className="striver-problem-status">
                              {solved ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                            </span>
                            <span className="striver-problem-name">{globalIndex}. {prob.title}</span>
                            <span className={`diff-badge ${diff}`}>{diff}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="striver-rail">
        <div className="striver-rail-card">
          <h3 className="striver-rail-title">DSA Progress</h3>
          <div className="striver-dsa-gauge" style={{ ["--progress-deg" as string]: progressDeg }}>
            <div className="striver-dsa-gauge-inner">
              <strong>{progress.solved}</strong>
              <span>/ {progress.total}</span>
            </div>
          </div>
          <div className="striver-rail-legend">
            <div><span className="leg-dot easy" />Easy <b>{progress.byDiff.easy.solved}/{progress.byDiff.easy.total}</b></div>
            <div><span className="leg-dot medium" />Medium <b>{progress.byDiff.medium.solved}/{progress.byDiff.medium.total}</b></div>
            <div><span className="leg-dot hard" />Hard <b>{progress.byDiff.hard.solved}/{progress.byDiff.hard.total}</b></div>
          </div>
        </div>

        <div className="striver-locked-list">
          {["Calendar + Roadmap", "Sessions", "Daily Planner"].map((label) => (
            <div key={label} className="striver-locked-item">
              <span>{label}</span>
              <Lock size={14} />
            </div>
          ))}
        </div>

        <div className="striver-quote-card">
          <p className="striver-quote-text">
            Don&apos;t cry in a corner if you want something — <em>mehnat kar</em>, best ban aur cheen le.
          </p>
          <span className="striver-quote-author">— algoX</span>
        </div>
      </aside>
    </div>
  );
};
