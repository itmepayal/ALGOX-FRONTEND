import { useState, useEffect, type FC } from "react";
import { teamApi, type TeamBattleDto } from "../../api/teamApi";
import { type Problem } from "../../api/problemApi";
import { submissionApi } from "../../api/submissionApi";
import { connectRealtimeSocket } from "../../realtime/socket";
import { useToast } from "../../context/ToastContext";
import { MonacoCodeEditor } from "../MonacoCodeEditor";
import { DEFAULT_EDITOR_SETTINGS } from "../../utils/editorSettings";
import {
  Clock,
  Play,
  Loader2,
  Trophy,
  ArrowLeft,
  Code2,
  Terminal,
} from "lucide-react";

interface TeamBattleWorkspaceProps {
  battleId: string;
  currentUserId: string;
  onBattleFinished: () => void;
  onLeave: () => void;
}

export const TeamBattleWorkspace: FC<TeamBattleWorkspaceProps> = ({
  battleId,
  currentUserId,
  onBattleFinished,
  onLeave,
}) => {
  const toast = useToast();
  const [battle, setBattle] = useState<TeamBattleDto | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblemIdx, setSelectedProblemIdx] = useState(0);
  const [code, setCode] = useState<string>("// Write code here...\n\nfunction solution() {\n  return 0;\n}");
  const [language, setLanguage] = useState("javascript");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);
  const [submissionOutput, setSubmissionOutput] = useState<any | null>(null);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      const res = await teamApi.getBattleById(battleId);
      if (res.success && res.data) {
        setBattle(res.data);
        if (Array.isArray(res.data.problemIds)) {
          setProblems(res.data.problemIds as any);
        }

        if (res.data.endsAt) {
          const endMs = new Date(res.data.endsAt).getTime();
          const nowMs = Date.now();
          setTimeLeftSec(Math.max(0, Math.floor((endMs - nowMs) / 1000)));
        }
      }
    } catch (err) {
      console.error("Failed to load workspace", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();

    const socket = connectRealtimeSocket();
    if (socket) {
      socket.emit("room.join", { room: `battle:${battleId}` });

      socket.on("team:submission_status", (data: any) => {
        if (data.solved) {
          toast.success(`Problem solved by ${data.teamId === battle?.teamAId?.id ? "Team A" : "Team B"}!`);
        }
        loadWorkspace();
      });

      socket.on("team:battle_state", (data: any) => {
        if (data.state === "COMPLETED") {
          onBattleFinished();
        } else {
          loadWorkspace();
        }
      });

      socket.on("team:battle_ended", () => {
        toast.info("Team battle completed!");
        onBattleFinished();
      });
    }

    return () => {
      if (socket) {
        socket.off("team:submission_status");
        socket.off("team:battle_state");
        socket.off("team:battle_ended");
      }
    };
  }, [battleId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeftSec === null || timeLeftSec <= 0) return;

    const interval = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          void teamApi.finishBattle(battleId).then(() => onBattleFinished());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeftSec]);

  const handleSubmitSolution = async () => {
    const currentProblem = problems[selectedProblemIdx];
    if (!currentProblem || !code.trim()) return;

    try {
      setSubmitting(true);
      setSubmissionOutput(null);

      const problemIdStr = currentProblem.id || (currentProblem as any)._id;
      const subRes = await submissionApi.createSubmission({
        problemId: problemIdStr,
        code,
        language,
        battleId,
      });

      if (subRes.success && subRes.data) {
        const subData = subRes.data;
        setSubmissionOutput(subData);

        const status = subData.status || "ACCEPTED";
        const points = currentProblem.difficulty === "hard" ? 300 : currentProblem.difficulty === "medium" ? 200 : 100;

        await teamApi.recordSubmission(battleId, {
          userId: currentUserId,
          problemId: problemIdStr,
          submissionId: subData.id || subData._id || "sub_123",
          status,
          points,
        });

        if (status === "ACCEPTED") {
          toast.success(`Solution ACCEPTED! Awarded ${points} points.`);
        } else {
          toast.warning(`Verdict: ${status}`);
        }

        loadWorkspace();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishEarly = async () => {
    try {
      await teamApi.finishBattle(battleId);
      onBattleFinished();
    } catch (err) {
      console.error("Failed to finish battle", err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const currentProblem = problems[selectedProblemIdx];
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const teamAName = battle?.teamAId?.name || "Team A";
  const teamBName = battle?.teamBId?.name || "Team B";

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-3 animate-fade-in">
      {/* SCOREBOARD HEADER BAR */}
      <header className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onLeave} className="ax-btn text-xs">
            <ArrowLeft size={13} /> Exit Workspace
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-300">{teamAName}</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-extrabold text-sm border border-indigo-500/30">
              {battle?.teamAScore || 0}
            </span>
          </div>

          <span className="text-xs text-slate-500 font-bold">VS</span>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-extrabold text-sm border border-purple-500/30">
              {battle?.teamBScore || 0}
            </span>
            <span className="text-xs font-bold text-purple-300">{teamBName}</span>
          </div>
        </div>

        {/* TIMER & FINISH */}
        <div className="flex items-center gap-3">
          {timeLeftSec !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
              <Clock size={13} /> {formatTime(timeLeftSec)}
            </div>
          )}

          <button
            type="button"
            onClick={handleFinishEarly}
            className="ax-btn text-xs text-amber-400"
          >
            <Trophy size={13} /> Settle Battle
          </button>
        </div>
      </header>

      {/* PROBLEM SELECTION TABS */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {problems.map((prob, idx) => (
          <button
            key={prob.id || idx}
            type="button"
            onClick={() => setSelectedProblemIdx(idx)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              selectedProblemIdx === idx
                ? "bg-indigo-600 text-white shadow-lg"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            <Code2 size={13} />
            <span>Problem #{idx + 1}: {prob.title || `Problem ${idx + 1}`}</span>
            <span className="capitalize text-[10px] opacity-75">({prob.difficulty || "medium"})</span>
          </button>
        ))}
      </div>

      {/* MAIN WORKSPACE GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
        {/* LEFT PANEL: PROBLEM STATEMENT */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 overflow-y-auto space-y-4 text-xs">
          {currentProblem ? (
            <>
              <div>
                <h2 className="text-base font-bold text-white mb-1">
                  {currentProblem.title}
                </h2>
                <span className="ax-tag-pill capitalize">
                  Difficulty: {currentProblem.difficulty}
                </span>
              </div>

              <div className="text-slate-300 whitespace-pre-line leading-relaxed border-t border-white/5 pt-3">
                {currentProblem.description || "Solve this competitive DSA problem."}
              </div>
            </>
          ) : (
            <div className="text-slate-500">No problem statement loaded.</div>
          )}
        </div>

        {/* RIGHT PANEL: CODE EDITOR & CONSOLE */}
        <div className="flex flex-col rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between p-2.5 bg-black/40 border-b border-white/5">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-2 py-1 rounded bg-slate-800 text-xs text-white border border-slate-700"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>

            <button
              type="button"
              onClick={handleSubmitSolution}
              disabled={submitting}
              className="ax-btn accent text-xs"
              style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <><Play size={13} /> Submit Solution</>}
            </button>
          </div>

          <div className="flex-1 min-h-[300px]">
            <MonacoCodeEditor
              value={code}
              onChange={(val) => setCode(val || "")}
              language={language}
              settings={DEFAULT_EDITOR_SETTINGS}
            />
          </div>

          {/* VERDICT / OUTPUT BAR */}
          {submissionOutput && (
            <div className="p-3 bg-black/80 border-t border-white/10 text-xs font-mono">
              <div className="flex items-center gap-2 mb-1">
                <Terminal size={14} className="text-indigo-400" />
                <span className="font-bold text-white">Execution Result:</span>
                <span className={`font-bold ${submissionOutput.status === "ACCEPTED" ? "text-emerald-400" : "text-rose-400"}`}>
                  {submissionOutput.status}
                </span>
              </div>
              {submissionOutput.output && (
                <div className="text-slate-400">{submissionOutput.output}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
