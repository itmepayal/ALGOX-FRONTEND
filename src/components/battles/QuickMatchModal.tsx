import { useState, useEffect, type FC } from "react";
import { battleApi, type BattleDifficulty } from "../../api/battleApi";
import { Zap, X, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { connectRealtimeSocket } from "../../realtime/socket";

interface QuickMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchFound: (battleId: string) => void;
}

export const QuickMatchModal: FC<QuickMatchModalProps> = ({
  isOpen,
  onClose,
  onMatchFound,
}) => {
  const toast = useToast();
  const [difficulty, setDifficulty] = useState<BattleDifficulty>("medium");
  const [topic, setTopic] = useState<string>("any");
  const [isSearching, setIsSearching] = useState(false);
  const [searchingSeconds, setSearchingSeconds] = useState(0);

  // Check current matchmaking status on mount/open
  useEffect(() => {
    if (!isOpen) return;

    async function checkStatus() {
      try {
        const res = await battleApi.getMatchmakingStatus();
        if (res.success && res.data) {
          if (res.data.status === "SEARCHING") {
            setIsSearching(true);
          } else if (res.data.status === "MATCHED" && res.data.battleId) {
            onMatchFound(res.data.battleId);
            onClose();
          } else if (res.data.status === "IN_BATTLE" && res.data.battleId) {
            onMatchFound(res.data.battleId);
            onClose();
          }
        }
      } catch (err) {
        console.error("Failed to check matchmaking status", err);
      }
    }
    checkStatus();
  }, [isOpen]);

  // Timer effect while searching
  useEffect(() => {
    let interval: any = null;
    if (isSearching) {
      interval = setInterval(() => {
        setSearchingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setSearchingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching]);

  // Socket listener for realtime matchmaking matched event
  useEffect(() => {
    const socket = connectRealtimeSocket();
    if (socket) {
      socket.on("matchmaking:matched", (data: any) => {
        if (data && data.battleId) {
          setIsSearching(false);
          toast.success("🎉 Opponent Found! Launching 1v1 Battle Lobby...");
          onMatchFound(data.battleId);
          onClose();
        }
      });

      socket.on("matchmaking:searching", () => {
        setIsSearching(true);
      });

      socket.on("matchmaking:cancelled", () => {
        setIsSearching(false);
      });
    }

    return () => {
      if (socket) {
        socket.off("matchmaking:matched");
        socket.off("matchmaking:searching");
        socket.off("matchmaking:cancelled");
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleStartSearching = async () => {
    try {
      setIsSearching(true);
      setSearchingSeconds(0);
      const res = await battleApi.joinMatchmaking({
        difficulty,
        topic,
      });

      if (res.success && res.data) {
        if (res.data.status === "MATCHED" && res.data.battleId) {
          setIsSearching(false);
          toast.success("🎉 Opponent Found! Launching 1v1 Battle Lobby...");
          onMatchFound(res.data.battleId);
          onClose();
        } else {
          toast.info("Joined matchmaking queue. Searching for opponent...");
        }
      }
    } catch (err: any) {
      setIsSearching(false);
      toast.error(err?.response?.data?.message || "Failed to join matchmaking queue");
    }
  };

  const handleCancelSearching = async () => {
    try {
      await battleApi.cancelMatchmaking();
      setIsSearching(false);
      toast.info("Matchmaking search cancelled.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to cancel search");
    }
  };

  return (
    <div className="challenge-modal-backdrop">
      <div className="challenge-modal-card">
        {/* Modal Header */}
        <div className="challenge-modal-header">
          <h2 className="challenge-modal-title">
            <Zap size={20} className="text-amber-400" />
            Quick Matchmaking V1
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ax-btn"
            style={{ width: "32px", height: "32px", padding: 0 }}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {isSearching ? (
          /* Searching State UI */
          <div className="ax-empty-card py-8">
            <div className="ax-empty-icon-wrap relative">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
            <h3 className="ax-empty-title flex items-center gap-2">
              Searching for Opponent...
            </h3>
            <p className="ax-empty-sub">
              Criteria: <strong className="capitalize text-indigo-300">{difficulty}</strong> difficulty •{" "}
              <strong className="capitalize text-sky-300">{topic === "any" ? "Any Topic" : topic}</strong>
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400">
              <RefreshCw size={13} className="animate-spin text-amber-400" /> Elapsed time: {searchingSeconds}s
            </div>

            <button
              type="button"
              onClick={handleCancelSearching}
              className="ax-btn danger mt-5"
              style={{ height: "36px" }}
            >
              <X size={14} /> Cancel Search
            </button>
          </div>
        ) : (
          /* Preferences Selection UI */
          <div>
            {/* Section 01: Difficulty */}
            <div className="challenge-section">
              <div className="challenge-section-header">
                <span className="challenge-section-num">01</span>
                <span className="challenge-section-label">SELECT DIFFICULTY</span>
              </div>
              <div className="challenge-segmented-grid cols-4">
                {(["easy", "medium", "hard", "mixed"] as BattleDifficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`challenge-option-btn capitalize ${
                      difficulty === d ? "active" : ""
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 02: Topic Filter */}
            <div className="challenge-section">
              <div className="challenge-section-header">
                <span className="challenge-section-num">02</span>
                <span className="challenge-section-label">TOPIC PREFERENCE</span>
              </div>
              <div className="challenge-segmented-grid cols-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                {[
                  { id: "any", label: "Any Topic" },
                  { id: "array", label: "Arrays" },
                  { id: "string", label: "Strings" },
                  { id: "linkedlist", label: "Linked List" },
                  { id: "tree", label: "Trees" },
                  { id: "dp", label: "Dynamic Programming" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopic(t.id)}
                    className={`challenge-option-btn ${
                      topic === t.id ? "active" : ""
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-3 border-t border-white/10 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="ax-btn flex-1"
                style={{ height: "40px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartSearching}
                className="ax-btn accent flex-1"
                style={{ height: "40px" }}
              >
                <Zap size={15} /> Find Match
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
