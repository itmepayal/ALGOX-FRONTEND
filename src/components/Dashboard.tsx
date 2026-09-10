import { useState, useEffect, type FC } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/authApi";
import { problemApi, type Problem } from "../api/problemApi";
import { submissionApi, type ProgrammingLanguage, type Submission } from "../api/submissionApi";
import { ProblemsSheet } from "./ProblemsSheet";
import { ProblemWorkspace } from "./ProblemWorkspace";
import { ProfilePanel } from "./ProfilePanel";
import {
  Flame,
  Home,
  MessageSquare,
  ShieldCheck,
  Trophy,
  User as UserIcon,
} from "lucide-react";

interface DashboardProps {
  onOpenAdmin?: () => void;
}

export const Dashboard: FC<DashboardProps> = ({ onOpenAdmin }) => {
  const { user, signout, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"problems" | "contests" | "discuss" | "profile">("problems");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  const [userCode, setUserCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [submittingCode, setSubmittingCode] = useState(false);
  const [activeSubmissionResult, setActiveSubmissionResult] = useState<Submission | null>(null);
  const [submissionError, setSubmissionError] = useState("");

  const [dashTab, setDashTab] = useState<"overview" | "submissions" | "sessions" | "security">("overview");
  const [sessions, setSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("mine");
  const [submissionLangFilter, setSubmissionLangFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [problemSubmissions, setProblemSubmissions] = useState<Submission[]>([]);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);

  const [editName, setEditName] = useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
  const [avatarBase64, setAvatarBase64] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const fetchProblems = async () => {
    try {
      setLoadingProblems(true);
      const res = await problemApi.getProblems({ limit: 50 });
      if (res?.data) setProblems(res.data);
    } catch (err) {
      console.warn("Fetch problems failed:", err);
    } finally {
      setLoadingProblems(false);
    }
  };

  const fetchUserSubmissions = async () => {
    if (!user) return;
    const userId = user.id || (user as any)._id;
    if (!userId) return;
    try {
      const res = await submissionApi.getByUserId(userId);
      if (res?.data) setUserSubmissions(res.data);
    } catch (err) {
      console.warn("Fetch user submissions failed:", err);
    }
  };

  const loadSubmissionsList = async () => {
    try {
      setLoadingSubmissions(true);
      let res;
      if (submissionSearch.trim()) {
        res = await submissionApi.searchSubmissions(submissionSearch.trim());
      } else if (submissionStatusFilter !== "mine" && submissionStatusFilter !== "all") {
        res = await submissionApi.getByStatus(submissionStatusFilter);
      } else if (submissionLangFilter !== "all") {
        res = await submissionApi.getByLanguage(submissionLangFilter);
      } else if (submissionStatusFilter === "all") {
        res = await submissionApi.getAllSubmissions({ page: 1, limit: 50 });
      } else {
        const userId = user?.id || (user as any)?._id;
        if (!userId) return;
        res = await submissionApi.getByUserId(userId);
      }
      if (res?.data) setUserSubmissions(res.data);
    } catch (err) {
      console.warn("Load submissions failed:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const fetchProblemSubmissions = async (problemId: string) => {
    try {
      const res = await submissionApi.getByProblemId(problemId);
      if (res?.data) setProblemSubmissions(res.data);
    } catch {
      setProblemSubmissions([]);
    }
  };

  const pollSubmissionStatus = async (id: string) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const latest = await submissionApi.getSubmissionById(id);
        if (latest?.data) {
          setActiveSubmissionResult(latest.data);
          if (latest.data.status !== "PENDING" && latest.data.status !== "RUNNING") {
            fetchUserSubmissions();
            return;
          }
        }
      } catch {
        // continue polling
      }
    }
    setSubmissionError("Evaluation is taking longer than expected. Check Submissions tab for status.");
  };

  useEffect(() => {
    fetchProblems();
    fetchUserSubmissions();
  }, []);

  useEffect(() => {
    if (selectedProblem) {
      const stub =
        selectedProblem.codeStubs?.find((s) => s.language === selectedLanguage)?.userTemplate ||
        selectedProblem.codeStubs?.[0]?.userTemplate ||
        `function solution(nums) {\n  // Write your code here\n}`;
      setUserCode(stub);
      setActiveSubmissionResult(null);
      setSubmissionError("");
      const pid = selectedProblem.id || selectedProblem._id;
      if (pid) fetchProblemSubmissions(pid);
    }
  }, [selectedProblem, selectedLanguage]);

  const handleSubmitCode = async () => {
    if (!selectedProblem || !user) return;
    setSubmittingCode(true);
    setActiveSubmissionResult(null);
    setSubmissionError("");
    try {
      const userId = user.id || (user as any)._id;
      const problemId = selectedProblem.id || selectedProblem._id;
      if (!userId || !problemId) return;

      const res = await submissionApi.createSubmission({
        userId,
        problemId,
        code: userCode,
        language: selectedLanguage as ProgrammingLanguage,
      });

      if (res?.data) {
        setActiveSubmissionResult(res.data);
        const sid = res.data.id || res.data._id;
        if (sid) await pollSubmissionStatus(sid);
        const pid = selectedProblem.id || selectedProblem._id;
        if (pid) fetchProblemSubmissions(pid);
      }
    } catch (err: any) {
      setSubmissionError(err.response?.data?.message || err.message || "Submission failed.");
    } finally {
      setSubmittingCode(false);
    }
  };

  const handleTabChange = (tab: typeof dashTab) => {
    setDashTab(tab);
    if (tab === "submissions") loadSubmissionsList();
    if (tab === "sessions") authApi.getActiveSessions().then((r) => r.data && setSessions(r.data as any[])).catch(() => {});
    if (tab === "security") authApi.getSecurityLogs().then((r) => r.data && setSecurityLogs(r.data as any[])).catch(() => {});
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileMsg("");
    try {
      const res = await authApi.updateProfile({ name: editName, avatar: avatarBase64 || undefined });
      setProfileMsg("Profile updated successfully!");
      if (res.data && user) setUser({ ...user, name: res.data.name, avatar: res.data.avatar });
    } catch (err: any) {
      setProfileMsg(err.response?.data?.message || "Failed to update profile");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const navItems = [
    { id: "problems" as const, icon: Home, label: "Sheet" },
    { id: "contests" as const, icon: Trophy, label: "Contest" },
    { id: "discuss" as const, icon: MessageSquare, label: "Discuss" },
    { id: "profile" as const, icon: UserIcon, label: "Profile" },
  ];

  return (
    <div className="platform-root">
      <aside className="platform-sidebar platform-sidebar-labeled">
        <div className="platform-sidebar-logo">aX</div>
        <nav className="platform-sidebar-nav">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`platform-nav-item ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <span className="platform-nav-icon"><Icon size={20} /></span>
              <span className="platform-nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="platform-sidebar-bottom">
          {onOpenAdmin && (
            <button type="button" className="platform-nav-item" onClick={onOpenAdmin}>
              <span className="platform-nav-icon"><ShieldCheck size={20} /></span>
              <span className="platform-nav-label">Admin</span>
            </button>
          )}
          <button type="button" className="platform-nav-item" onClick={() => setActiveTab("profile")}>
            <span className="platform-nav-icon platform-nav-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                user?.name?.charAt(0) || "U"
              )}
            </span>
            <span className="platform-nav-label">{user?.name?.split(" ")[0] || "You"}</span>
          </button>
        </div>
      </aside>

      <div className="platform-main">
        {activeTab !== "problems" && (
          <header className="platform-topbar">
            <span className="platform-topbar-title">
              {activeTab === "contests" && "Contests"}
              {activeTab === "discuss" && "Discuss"}
              {activeTab === "profile" && "Profile & Settings"}
            </span>
            <div className="platform-topbar-actions">
              <span className="platform-chip platform-chip-streak">
                <Flame size={14} fill="currentColor" /> 7 Day Streak
              </span>
            </div>
          </header>
        )}

        <main className={`platform-content ${activeTab === "problems" ? "platform-content-sheet" : ""}`}>
          {activeTab === "problems" && (
            <ProblemsSheet
              problems={problems}
              loading={loadingProblems}
              submissions={userSubmissions}
              searchQuery={searchQuery}
              selectedDifficulty={selectedDifficulty}
              onSearchChange={setSearchQuery}
              onDifficultyChange={setSelectedDifficulty}
              onSelectProblem={setSelectedProblem}
              onOpenAdmin={onOpenAdmin}
            />
          )}

          {activeTab === "contests" && (
            <div className="placeholder-tab">
              <Trophy size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
              <h2>Contests Coming Soon</h2>
              <p>Weekly coding contests will appear here.</p>
            </div>
          )}

          {activeTab === "discuss" && (
            <div className="placeholder-tab">
              <MessageSquare size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
              <h2>Discussion Forum</h2>
              <p>Share solutions and ask questions with the community.</p>
            </div>
          )}

          {activeTab === "profile" && (
            <ProfilePanel
              user={user}
              dashTab={dashTab}
              onTabChange={handleTabChange}
              editName={editName}
              avatarPreview={avatarPreview}
              profileMsg={profileMsg}
              updatingProfile={updatingProfile}
              userSubmissions={userSubmissions}
              loadingSubmissions={loadingSubmissions}
              submissionSearch={submissionSearch}
              submissionStatusFilter={submissionStatusFilter}
              submissionLangFilter={submissionLangFilter}
              selectedSubmission={selectedSubmission}
              deletingSubmissionId={deletingSubmissionId}
              sessions={sessions}
              securityLogs={securityLogs}
              onNameChange={setEditName}
              onAvatarChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  setAvatarPreview(result);
                  setAvatarBase64(result);
                };
                reader.readAsDataURL(file);
              }}
              onUpdateProfile={handleUpdateProfile}
              onLoadSubmissions={loadSubmissionsList}
              onSubmissionSearchChange={setSubmissionSearch}
              onStatusFilterChange={setSubmissionStatusFilter}
              onLangFilterChange={setSubmissionLangFilter}
              onViewSubmission={async (id) => {
                if (!id) return;
                try {
                  const res = await submissionApi.getSubmissionById(id);
                  if (res?.data) setSelectedSubmission(res.data);
                } catch { /* ignore */ }
              }}
              onDeleteSubmission={async (id) => {
                if (!id || !window.confirm("Delete submission?")) return;
                setDeletingSubmissionId(id);
                try {
                  await submissionApi.deleteSubmission(id);
                  setUserSubmissions((p) => p.filter((s) => (s.id || s._id) !== id));
                } finally {
                  setDeletingSubmissionId(null);
                }
              }}
              onClearSelectedSubmission={() => setSelectedSubmission(null)}
              onRevokeSession={async (id) => {
                await authApi.revokeSession(id);
                setSessions((p) => p.filter((s) => s.id !== id));
              }}
              onLogoutAllSessions={async () => {
                await authApi.logoutAllSessions();
                setSessions([]);
                signout();
              }}
              onToggle2FA={async (enable) => {
                const res = await authApi.toggle2FA(enable);
                if (user) setUser({ ...user, twoFactorEnabled: enable });
                setProfileMsg(res.message);
              }}
              onChangePassword={async (curr, next) => {
                await authApi.changePassword({ currentPassword: curr, newPassword: next });
              }}
              onSignout={signout}
            />
          )}
        </main>
      </div>

      {selectedProblem && (
        <ProblemWorkspace
          problem={selectedProblem}
          userCode={userCode}
          selectedLanguage={selectedLanguage}
          submittingCode={submittingCode}
          activeSubmissionResult={activeSubmissionResult}
          submissionError={submissionError}
          problemSubmissions={problemSubmissions}
          onBack={() => setSelectedProblem(null)}
          onCodeChange={setUserCode}
          onLanguageChange={setSelectedLanguage}
          onSubmit={handleSubmitCode}
        />
      )}
    </div>
  );
};
