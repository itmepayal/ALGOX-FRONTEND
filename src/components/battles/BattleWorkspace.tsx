import { useState, useEffect, type FC } from "react";
import type { Battle, BattleProblemItem, BattleParticipant } from "../../api/battleApi";
import { battleApi } from "../../api/battleApi";
import type { ProgrammingLanguage } from "../../api/submissionApi";
import { submissionApi } from "../../api/submissionApi";
import { MonacoCodeEditor } from "../MonacoCodeEditor";
import { connectRealtimeSocket } from "../../realtime/socket";
import { getStarterTemplate, loadSavedCode, saveCode } from "../../utils/workspacePersistence";
import { loadEditorSettings } from "../../utils/editorSettings";
import { Swords, Clock, Play, Send, CheckCircle2, Loader2, Eye } from "lucide-react";
import { useToast } from "../../context/ToastContext";

interface BattleWorkspaceProps {
  battleId: string;
  currentUserId: string;
  onBattleFinished: () => void;
  onForfeit: () => void;
}

export const BattleWorkspace: FC<BattleWorkspaceProps> = ({
  battleId,
  currentUserId,
  onBattleFinished,
  onForfeit,
}) => {
  const toast = useToast();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [problems, setProblems] = useState<BattleProblemItem[]>([]);
  const [participants, setParticipants] = useState<BattleParticipant[]>([]);
  const [activeProblemIdx, setActiveProblemIdx] = useState(0);

  const [language, setLanguage] = useState<ProgrammingLanguage>("javascript");
  const [code, setCode] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Solved & Attempting status maps: problemId -> boolean/status
  const [solvedMap, setSolvedMap] = useState<Record<string, boolean>>({});
  const [oppStatusMap, setOppStatusMap] = useState<Record<string, "Not Started" | "Attempting" | "Solved">>({});

  // Fetch initial battle & problem set
  const loadWorkspace = async () => {
    try {
      const bRes = await battleApi.getBattleById(battleId);
      if (bRes.success && bRes.data) {
        setBattle(bRes.data);
        if (["FINISHED", "RESULT_PUBLISHED", "FORFEITED"].includes(bRes.data.status)) {
          onBattleFinished();
          return;
        }
      }

      const pRes = await battleApi.getBattleProblems(battleId);
      if (pRes.success && pRes.data) {
        setProblems(pRes.data);
      }

      const lRes = await battleApi.joinLobby(battleId);
      if (lRes.success && lRes.data) {
        setParticipants(lRes.data.participants || []);
      }
    } catch (err: any) {
      console.error("Failed to load battle workspace", err);
      toast.error(err?.response?.data?.message || "Failed to load battle workspace");
    }
  };

  useEffect(() => {
    loadWorkspace();

    const socket = connectRealtimeSocket();
    if (socket) {
      socket.emit("room.join", { room: `battle:${battleId}` });

      socket.on("battle:problem_solved", (data: any) => {
        if (data.battleId === battleId) {
          if (data.userId === currentUserId) {
            setSolvedMap((prev) => ({ ...prev, [data.problemId]: true }));
            toast.success(`You solved Problem! +${data.pointsAwarded} pts`);
          } else {
            setOppStatusMap((prev) => ({ ...prev, [data.problemId]: "Solved" }));
            toast.info("Opponent solved a problem!");
          }
          // Refresh participants score
          loadWorkspace();
        }
      });

      socket.on("battle:submission_result", (data: any) => {
        if (data.battleId === battleId && data.userId !== currentUserId) {
          if (data.status !== "ACCEPTED") {
            setOppStatusMap((prev) => ({
              ...prev,
              [data.problemId]: prev[data.problemId] === "Solved" ? "Solved" : "Attempting",
            }));
          }
        }
      });

      socket.on("battle:finished", (data: any) => {
        if (data.battleId === battleId) {
          toast.info("Battle finished!");
          onBattleFinished();
        }
      });

      socket.on("battle:forfeit", (data: any) => {
        if (data.battleId === battleId) {
          onBattleFinished();
        }
      });
    }

    return () => {
      if (socket) {
        socket.emit("room.leave", { room: `battle:${battleId}` });
        socket.off("battle:problem_solved");
        socket.off("battle:submission_result");
        socket.off("battle:finished");
        socket.off("battle:forfeit");
      }
    };
  }, [battleId]);

  // Server-authoritative timer countdown
  useEffect(() => {
    if (!battle?.endsAt) return;

    const calcRemaining = () => {
      const diff = Math.floor((new Date(battle.endsAt!).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setRemainingSeconds(0);
        onBattleFinished();
      } else {
        setRemainingSeconds(diff);
      }
    };

    calcRemaining();
    const interval = setInterval(calcRemaining, 1000);
    return () => clearInterval(interval);
  }, [battle?.endsAt]);

  // Load starter code for active problem
  const currentProblem = problems[activeProblemIdx];

  useEffect(() => {
    if (!currentProblem) return;
    const saved = loadSavedCode(currentUserId, currentProblem.problemId, language);
    if (saved) {
      setCode(saved);
    } else {
      const template = getStarterTemplate(currentProblem as any, language);
      setCode(template);
    }
    setRunOutput(null);
  }, [currentProblem?.id, language]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (currentProblem) {
      saveCode(currentUserId, currentProblem.problemId, language, newCode);
    }
  };

  const handleRun = async () => {
    if (!currentProblem || isRunning) return;
    setIsRunning(true);
    setRunOutput("Running test cases...");

    try {
      const res = await submissionApi.createSubmission({
        problemId: currentProblem.problemId,
        language,
        code,
        source: "run",
        battleId,
      });

      const sub = res.data;

      if (sub.status === "ACCEPTED") {
        setRunOutput("✅ Test cases passed!\n" + (sub.output || ""));
      } else {
        setRunOutput(`❌ ${sub.status}\n${sub.error || sub.output || ""}`);
      }
    } catch (err: any) {
      setRunOutput("Error: " + (err.message || "Failed to run code"));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentProblem || isSubmitting) return;
    setIsSubmitting(true);
    setRunOutput("Submitting to official judge...");

    try {
      const res = await submissionApi.createSubmission({
        problemId: currentProblem.problemId,
        language,
        code,
        source: "submit",
        battleId,
      });

      const sub = res.data;
      const submissionId = sub.id || sub._id;

      if (!submissionId) {
        setRunOutput("Submission received.");
        setIsSubmitting(false);
        return;
      }

      // Poll for final verdict
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await submissionApi.getSubmissionById(submissionId);
          const updated = pollRes.data;

          if (updated && updated.status !== "PENDING" && updated.status !== "RUNNING") {
            clearInterval(pollInterval);
            setIsSubmitting(false);

            if (updated.status === "ACCEPTED") {
              setRunOutput(`🎉 ACCEPTED! All ${updated.totalTestCases || 0} test cases passed.`);
              setSolvedMap((prev) => ({ ...prev, [currentProblem.problemId]: true }));
            } else {
              setRunOutput(`❌ Verdict: ${updated.status}\nPassed: ${updated.testCasesPassed || 0}/${updated.totalTestCases || 0}\n${updated.error || ""}`);
            }
          }
        } catch {
          /* retry */
        }

        if (attempts > 20) {
          clearInterval(pollInterval);
          setIsSubmitting(false);
          setRunOutput("Submission evaluation timeout. Please check your submission status.");
        }
      }, 1500);
    } catch (err: any) {
      setIsSubmitting(false);
      setRunOutput("Error: " + (err.message || "Failed to submit code"));
    }
  };

  if (!battle || problems.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  const isCreator = battle.creatorId === currentUserId;
  const oppName = isCreator ? battle.opponentName : battle.creatorName;

  const mePart = participants.find((p) => p.userId === currentUserId);
  const oppPart = participants.find((p) => p.userId !== currentUserId);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Swords className="h-5 w-5 text-sky-400" />
          <span className="font-bold text-white text-sm">1v1 DSA Battle</span>

          {/* Problem Tabs */}
          <div className="flex gap-1 ml-4">
            {problems.map((prob, idx) => (
              <button
                key={prob.id}
                type="button"
                onClick={() => setActiveProblemIdx(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeProblemIdx === idx
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                Problem {idx + 1}
                {solvedMap[prob.problemId] && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scores & Server Timer */}
        <div className="flex items-center gap-4">
          <div className="text-xs font-semibold text-slate-300">
            You: <span className="font-bold text-sky-400 text-sm">{mePart?.score || 0} pts</span> | {oppName}: <span className="font-bold text-purple-400 text-sm">{oppPart?.score || 0} pts</span>
          </div>

          <div className="battle-timer-badge">
            <Clock className="h-4 w-4" />
            {formatTime(remainingSeconds)}
          </div>

          <button
            type="button"
            onClick={onForfeit}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
          >
            Forfeit
          </button>
        </div>
      </div>

      {/* Opponent Progress Bar */}
      <div className="opponent-progress-drawer px-4 py-2 bg-slate-900/60 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Eye className="h-4 w-4 text-purple-400" />
          <span className="font-bold text-slate-200">{oppName}'s Live Status:</span>
        </div>
        <div className="flex gap-4">
          {problems.map((p, idx) => {
            const st = oppStatusMap[p.problemId] || "Not Started";
            return (
              <div key={p.id} className="text-xs flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">P{idx + 1}:</span>
                <span
                  className={`status-indicator ${
                    st === "Solved"
                      ? "status-solved"
                      : st === "Attempting"
                      ? "status-attempting"
                      : "status-not-started"
                  }`}
                >
                  {st === "Solved" ? "✓ Solved" : st === "Attempting" ? "🟡 Attempting" : "○ Not Started"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workspace Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Problem Description */}
        <div className="w-1/2 overflow-y-auto p-5 border-r border-white/10 bg-slate-900/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-white">{currentProblem.title}</h2>
            <div className="flex gap-2">
              <span className="capitalize text-xs font-bold px-2.5 py-1 rounded bg-white/10 text-slate-300">
                {currentProblem.difficulty}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                {currentProblem.points} Points
              </span>
            </div>
          </div>

          <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
            {currentProblem.description}
          </div>

          {currentProblem.examples && currentProblem.examples.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Examples</h3>
              {currentProblem.examples.map((ex, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-slate-950 p-3 text-xs font-mono">
                  <div className="text-slate-400">Input: <span className="text-white">{JSON.stringify(ex.input)}</span></div>
                  <div className="text-slate-400 mt-1">Output: <span className="text-emerald-400">{ex.output}</span></div>
                  {ex.explanation && (
                    <div className="text-slate-500 mt-1 italic font-sans">{ex.explanation}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {currentProblem.constraints && (
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Constraints</h3>
              <div className="rounded-xl border border-white/10 bg-slate-950 p-3 text-xs font-mono text-slate-300">
                {currentProblem.constraints}
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Code Editor & Execution Output */}
        <div className="w-1/2 flex flex-col bg-slate-950">
          {/* Editor Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 py-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python 3</option>
              <option value="cpp">C++ 17</option>
              <option value="java">Java 17</option>
            </select>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRun}
                disabled={isRunning || isSubmitting}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
              >
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
                Run Code
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isRunning}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Submit Solution
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 relative">
            <MonacoCodeEditor
              value={code}
              language={language}
              settings={loadEditorSettings()}
              onChange={handleCodeChange}
            />
          </div>

          {/* Execution Console Output */}
          {runOutput && (
            <div className="h-40 border-t border-white/10 bg-slate-900/90 p-3 overflow-y-auto font-mono text-xs text-slate-200">
              <div className="font-bold text-slate-400 mb-1">Execution Output:</div>
              <pre className="whitespace-pre-wrap">{runOutput}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
