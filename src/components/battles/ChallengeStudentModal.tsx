import { useState, useEffect, type FC } from "react";
import { battleApi, type StudentSearchResult, type BattleDifficulty } from "../../api/battleApi";
import { Search, Swords, X, Loader2 } from "lucide-react";
import { useToast } from "../../context/ToastContext";

interface ChallengeStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeCreated: (battleId: string) => void;
}

export const ChallengeStudentModal: FC<ChallengeStudentModalProps> = ({
  isOpen,
  onClose,
  onChallengeCreated,
}) => {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);

  const [difficulty, setDifficulty] = useState<BattleDifficulty>("medium");
  const [problemCount, setProblemCount] = useState<number>(3);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await battleApi.searchStudents(searchQuery);
        if (res.success) {
          setSearchResults(res.data || []);
        }
      } catch (err: any) {
        console.error("Failed to search students", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleSendChallenge = async () => {
    if (!selectedStudent) {
      toast.error("Please select a student to challenge.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await battleApi.createChallenge({
        opponentId: selectedStudent.id,
        difficulty,
        problemCount,
        durationSeconds: durationMinutes * 60,
      });

      if (res.success && res.data) {
        toast.success(`Challenge sent to ${selectedStudent.name}!`);
        onChallengeCreated(res.data.id);
        onClose();
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err.message || "Failed to send challenge";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="challenge-modal-backdrop">
      <div className="challenge-modal-card">
        {/* Modal Header */}
        <div className="challenge-modal-header">
          <h2 className="challenge-modal-title">
            <Swords size={20} className="text-indigo-400" />
            Challenge Student to 1v1 Battle
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

        <div>
          {/* Section 01: Student Search */}
          <div className="challenge-section">
            <div className="challenge-section-header">
              <span className="challenge-section-num">01</span>
              <span className="challenge-section-label">SEARCH REGISTERED STUDENT</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Type name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-indigo-400" />
              )}
            </div>

            {/* Results list */}
            {searchResults.length > 0 && !selectedStudent && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-slate-900 p-1">
                {searchResults.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(student);
                      setSearchQuery(student.name);
                      setSearchResults([]);
                    }}
                    className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{student.name}</div>
                        <div className="text-xs text-slate-400">{student.email}</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-indigo-400">Select</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected student badge */}
            {selectedStudent && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{selectedStudent.name}</div>
                    <div className="text-[11px] text-indigo-200">{selectedStudent.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setSearchQuery("");
                  }}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Section 02: Difficulty Selection */}
          <div className="challenge-section">
            <div className="challenge-section-header">
              <span className="challenge-section-num">02</span>
              <span className="challenge-section-label">SELECT PROBLEM DIFFICULTY</span>
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

          {/* Section 03: Problem Count */}
          <div className="challenge-section">
            <div className="challenge-section-header">
              <span className="challenge-section-num">03</span>
              <span className="challenge-section-label">NUMBER OF PROBLEMS</span>
            </div>
            <div className="challenge-segmented-grid cols-5">
              {[1, 2, 3, 4, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setProblemCount(cnt)}
                  className={`challenge-option-btn ${
                    problemCount === cnt ? "active" : ""
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Section 04: Battle Duration */}
          <div className="challenge-section">
            <div className="challenge-section-header">
              <span className="challenge-section-num">04</span>
              <span className="challenge-section-label">BATTLE DURATION</span>
            </div>
            <div className="challenge-segmented-grid cols-4">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`challenge-option-btn ${
                    durationMinutes === mins ? "active" : ""
                  }`}
                >
                  {mins} mins
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
              onClick={handleSendChallenge}
              disabled={isSubmitting || !selectedStudent}
              className="ax-btn accent flex-1"
              style={{ height: "40px" }}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Swords className="h-4 w-4" />
              )}
              Send Challenge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
