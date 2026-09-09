import { useState, type FC } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/authApi";
import {
  Trophy,
  Flame,
  CheckCircle2,
  Clock,
  Play,
  User as UserIcon,
  BookOpen,
  MessageSquare,
  Search,
  Sparkles,
  LogOut,
  Camera,
  Upload,
  Loader2,
} from "lucide-react";

interface Problem {
  id: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  acceptance: string;
  category: string;
  status?: "solved" | "attempted" | "todo";
  tags: string[];
}

const MOCK_PROBLEMS: Problem[] = [
  { id: 1, title: "Two Sum", difficulty: "Easy", acceptance: "51.8%", category: "Arrays & Hashing", status: "solved", tags: ["Array", "Hash Table"] },
  { id: 2, title: "Add Two Numbers", difficulty: "Medium", acceptance: "42.1%", category: "Linked List", status: "solved", tags: ["Linked List", "Math"] },
  { id: 3, title: "Longest Substring Without Repeating Characters", difficulty: "Medium", acceptance: "34.5%", category: "Sliding Window", status: "attempted", tags: ["Hash Table", "String", "Sliding Window"] },
  { id: 4, title: "Median of Two Sorted Arrays", difficulty: "Hard", acceptance: "38.9%", category: "Binary Search", status: "todo", tags: ["Array", "Binary Search", "Divide & Conquer"] },
  { id: 5, title: "Longest Palindromic Substring", difficulty: "Medium", acceptance: "33.7%", category: "Dynamic Programming", status: "todo", tags: ["String", "Dynamic Programming"] },
  { id: 6, title: "Container With Most Water", difficulty: "Medium", acceptance: "54.2%", category: "Two Pointers", status: "solved", tags: ["Array", "Two Pointers", "Greedy"] },
  { id: 7, title: "Trapping Rain Water", difficulty: "Hard", acceptance: "60.4%", category: "Two Pointers", status: "todo", tags: ["Array", "Two Pointers", "Stack"] },
  { id: 8, title: "3Sum", difficulty: "Medium", acceptance: "34.1%", category: "Two Pointers", status: "todo", tags: ["Array", "Two Pointers", "Sorting"] },
  { id: 9, title: "Remove Nth Node From End of List", difficulty: "Medium", acceptance: "44.6%", category: "Linked List", status: "todo", tags: ["Linked List", "Two Pointers"] },
  { id: 10, title: "Valid Parentheses", difficulty: "Easy", acceptance: "40.3%", category: "Stack", status: "solved", tags: ["String", "Stack"] },
];

export const Dashboard: FC = () => {
  const { user, signout, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"problems" | "contests" | "discuss" | "profile">("problems");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [dashTab, setDashTab] = useState<"overview" | "sessions" | "security">("overview");
  const [sessions, setSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [msg, setMsg] = useState("");

  const [editName, setEditName] = useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatar || "");
  const [avatarBase64, setAvatarBase64] = useState<string>("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setProfileMsg("File size must be under 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        setAvatarBase64(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileMsg("");
    try {
      const res = await authApi.updateProfile({
        name: editName,
        avatar: avatarBase64 || undefined,
      });
      setProfileMsg("Profile updated successfully!");
      if (res.data && user) {
        setUser({
          ...user,
          name: res.data.name,
          avatar: res.data.avatar,
        });
      }
    } catch (err: any) {
      setProfileMsg(err.response?.data?.message || "Failed to update profile");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await authApi.getActiveSessions();
      if (res && res.data) setSessions(res.data as any[]);
    } catch (err) {
      console.warn("Sessions fetch failed silently:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await authApi.getSecurityLogs();
      if (res && res.data) setSecurityLogs(res.data as any[]);
    } catch (err) {
      console.warn("Security logs fetch failed silently:", err);
    }
  };

  const handleTabChange = (tab: "overview" | "sessions" | "security") => {
    setDashTab(tab);
    if (tab === "sessions") fetchSessions();
    if (tab === "security") fetchLogs();
  };

  const handleToggle2FA = async (enable: boolean) => {
    try {
      const res = await authApi.toggle2FA(enable);
      setMsg(res.message);
      if (user) setUser({ ...user, twoFactorEnabled: enable });
    } catch (err: any) {
      setMsg(err.response?.data?.message || "Failed 2FA toggle");
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      await authApi.revokeSession(id);
      fetchSessions();
    } catch { }
  };

  const filteredProblems = MOCK_PROBLEMS.filter((p) => {
    const matchesDiff = selectedDifficulty === "All" || p.difficulty === selectedDifficulty;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDiff && matchesSearch;
  });

  const easyCount = MOCK_PROBLEMS.filter((p) => p.difficulty === "Easy" && p.status === "solved").length;
  const medCount = MOCK_PROBLEMS.filter((p) => p.difficulty === "Medium" && p.status === "solved").length;
  const hardCount = MOCK_PROBLEMS.filter((p) => p.difficulty === "Hard" && p.status === "solved").length;
  const totalSolved = easyCount + medCount + hardCount;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0B0F14", color: "#F8FAFC", fontFamily: "'Poppins', sans-serif" }}>
      <nav
        style={{
          height: "64px",
          backgroundColor: "#151B23",
          borderBottom: "1px solid #27303D",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => setActiveTab("problems")}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #6366F1 0%, #4338CA 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                color: "#FFFFFF",
                fontSize: "0.95rem",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.45)",
              }}
            >
              aX
            </div>
            <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#F8FAFC" }}>
              algo<span style={{ color: "#6366F1" }}>X</span>
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setActiveTab("problems")}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: activeTab === "problems" ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: activeTab === "problems" ? "#818CF8" : "#94A3B8",
                fontWeight: activeTab === "problems" ? 600 : 500,
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <BookOpen size={17} />
              <span>Problems</span>
            </button>

            <button
              onClick={() => setActiveTab("contests")}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: activeTab === "contests" ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: activeTab === "contests" ? "#818CF8" : "#94A3B8",
                fontWeight: activeTab === "contests" ? 600 : 500,
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Trophy size={17} />
              <span>Contests</span>
            </button>

            <button
              onClick={() => setActiveTab("discuss")}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: activeTab === "discuss" ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: activeTab === "discuss" ? "#818CF8" : "#94A3B8",
                fontWeight: activeTab === "discuss" ? 600 : 500,
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <MessageSquare size={17} />
              <span>Discuss</span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "20px",
              color: "#F59E0B",
              fontSize: "0.825rem",
              fontWeight: 600,
            }}
          >
            <Flame size={17} fill="#F59E0B" />
            <span>7 Day Streak</span>
          </div>

          <button
            onClick={() => setActiveTab("profile")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "5px 16px 5px 6px",
              backgroundColor: activeTab === "profile" ? "rgba(99, 102, 241, 0.2)" : "#111827",
              border: "1px solid #27303D",
              borderRadius: "20px",
              color: "#F8FAFC",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <UserIcon size={16} color="#818CF8" />
            )}
            <span>{user?.name || "Developer"}</span>
          </button>
        </div>
      </nav>

      <main style={{ width: "100%", padding: "32px 40px" }}>
        {activeTab === "profile" ? (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "28px", width: "100%", alignItems: "start" }}>
            <div style={{ backgroundColor: "#151B23", border: "1px solid #27303D", borderRadius: "18px", padding: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ position: "relative", width: "84px", height: "84px", margin: "0 auto 12px" }}>
                  <div style={{ width: "84px", height: "84px", borderRadius: "50%", backgroundColor: "rgba(99, 102, 241, 0.2)", border: "2px solid rgba(99, 102, 241, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818CF8", fontWeight: 700, fontSize: "2rem", overflow: "hidden" }}>
                    {avatarPreview || user?.avatar ? (
                      <img src={avatarPreview || user?.avatar} alt={user?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      user?.name?.charAt(0) || "U"
                    )}
                  </div>
                  <label htmlFor="avatarInput" style={{ position: "absolute", bottom: "0", right: "0", backgroundColor: "#6366F1", color: "#FFF", borderRadius: "50%", padding: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                    <Camera size={14} />
                    <input id="avatarInput" type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                  </label>
                </div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#F8FAFC" }}>{user?.name}</h2>
                <p style={{ color: "#94A3B8", fontSize: "0.825rem", fontFamily: "'Fira Code', monospace", wordBreak: "break-all", marginTop: "4px" }}>{user?.email}</p>

                <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "12px" }}>
                  <span style={{ padding: "3px 10px", backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22C55E", borderRadius: "12px", fontSize: "0.725rem", fontWeight: 600 }}>Verified</span>
                  <span style={{ padding: "3px 10px", backgroundColor: "rgba(99, 102, 241, 0.15)", color: "#818CF8", borderRadius: "12px", fontSize: "0.725rem", fontWeight: 600 }}>algoX Pro</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid #27303D", paddingTop: "16px" }}>
                <button
                  onClick={() => handleTabChange("overview")}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: dashTab === "overview" ? "#6366F1" : "transparent",
                    color: dashTab === "overview" ? "#FFFFFF" : "#94A3B8",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Account Overview
                </button>

                <button
                  onClick={() => handleTabChange("sessions")}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: dashTab === "sessions" ? "#6366F1" : "transparent",
                    color: dashTab === "sessions" ? "#FFFFFF" : "#94A3B8",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Active Sessions ({sessions.length})
                </button>

                <button
                  onClick={() => handleTabChange("security")}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: dashTab === "security" ? "#6366F1" : "transparent",
                    color: dashTab === "security" ? "#FFFFFF" : "#94A3B8",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  Audit Logs
                </button>

                <button
                  onClick={signout}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    color: "#EF4444",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "16px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.18)";
                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.6)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.08)";
                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.35)";
                  }}
                >
                  <LogOut size={16} color="#EF4444" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: "#151B23", border: "1px solid #27303D", borderRadius: "18px", padding: "28px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              {msg && <div style={{ padding: "12px 16px", backgroundColor: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "10px", color: "#22C55E", marginBottom: "20px", fontSize: "0.875rem" }}>{msg}</div>}

              {dashTab === "overview" && (
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "8px" }}>Account & Security Center</h3>
                  <p style={{ color: "#94A3B8", fontSize: "0.85rem", marginBottom: "20px" }}>Manage your profile details, avatar, authentication preferences and security</p>

                  {/* Profile Edit Form */}
                  <form onSubmit={handleUpdateProfile} style={{ padding: "20px", backgroundColor: "#111827", borderRadius: "12px", border: "1px solid #27303D", marginBottom: "24px" }}>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#F8FAFC", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Camera size={18} color="#818CF8" />
                      <span>Edit User Profile & Photo</span>
                    </h4>

                    {profileMsg && (
                      <div style={{ padding: "10px 14px", backgroundColor: profileMsg.includes("success") ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)", border: `1px solid ${profileMsg.includes("success") ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`, borderRadius: "8px", color: profileMsg.includes("success") ? "#22C55E" : "#EF4444", marginBottom: "16px", fontSize: "0.825rem" }}>
                        {profileMsg}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", color: "#94A3B8", marginBottom: "6px" }}>Full Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Enter your name"
                          style={{ width: "100%", padding: "10px 14px", backgroundColor: "#151B23", border: "1px solid #27303D", borderRadius: "8px", color: "#F8FAFC", fontSize: "0.875rem", outline: "none" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", color: "#94A3B8", marginBottom: "6px" }}>Profile Avatar (Cloudinary)</label>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", backgroundColor: "#151B23", border: "1px dashed #6366F1", borderRadius: "8px", color: "#818CF8", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600 }}>
                          <Upload size={16} />
                          <span>{avatarBase64 ? "New Photo Selected" : "Choose New Photo"}</span>
                          <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={updatingProfile}
                      style={{ padding: "9px 24px", backgroundColor: "#6366F1", color: "#FFFFFF", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "0.875rem", cursor: updatingProfile ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      {updatingProfile ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Uploading to Cloudinary...</span>
                        </>
                      ) : (
                        <span>Save Profile Changes</span>
                      )}
                    </button>
                  </form>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px", backgroundColor: "#111827", borderRadius: "12px", border: "1px solid #27303D", marginBottom: "24px" }}>
                    <div>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#F8FAFC" }}>Two-Factor Authentication (2FA)</h4>
                      <p style={{ fontSize: "0.825rem", color: "#94A3B8", marginTop: "2px" }}>Status: <span style={{ color: user?.twoFactorEnabled ? "#22C55E" : "#F59E0B", fontWeight: 600 }}>{user?.twoFactorEnabled ? "Active (Protected)" : "Disabled"}</span></p>
                    </div>
                    <button onClick={() => handleToggle2FA(!user?.twoFactorEnabled)} style={{ padding: "9px 20px", backgroundColor: user?.twoFactorEnabled ? "#EF4444" : "#6366F1", color: "#FFF", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                      {user?.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                    </button>
                  </div>
                </div>
              )}

              {dashTab === "sessions" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#F8FAFC" }}>Active Login Sessions</h3>
                      <p style={{ color: "#94A3B8", fontSize: "0.85rem", marginTop: "2px" }}>Devices currently authenticated to your account</p>
                    </div>
                  </div>

                  {sessions.length === 0 ? <p style={{ color: "#94A3B8", fontSize: "0.9rem" }}>No active sessions recorded.</p> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {sessions.map((s: any, idx) => (
                        <div key={idx} style={{ padding: "16px 20px", backgroundColor: "#111827", borderRadius: "12px", border: "1px solid #27303D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: "0.925rem", color: "#F8FAFC" }}>{s.userAgent || "Browser Session"}</p>
                            <p style={{ fontSize: "0.775rem", color: "#64748B", marginTop: "2px" }}>IP Address: {s.ip || "127.0.0.1"}</p>
                          </div>
                          <button onClick={() => handleRevokeSession(s.id)} style={{ padding: "6px 14px", backgroundColor: "transparent", color: "#EF4444", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Revoke</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {dashTab === "security" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#F8FAFC" }}>Security Audit Logs</h3>
                      <p style={{ color: "#94A3B8", fontSize: "0.85rem", marginTop: "2px" }}>Real-time security log events recorded for your account</p>
                    </div>
                    {securityLogs.length > 6 && (
                      <button
                        onClick={() => setShowAllLogs(!showAllLogs)}
                        style={{ padding: "6px 14px", backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#818CF8", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        {showAllLogs ? "Show Top 6" : `View All (${securityLogs.length})`}
                      </button>
                    )}
                  </div>

                  {securityLogs.length === 0 ? <p style={{ color: "#94A3B8", fontSize: "0.9rem" }}>No security events logged yet.</p> : (
                    <div style={{ maxHeight: "380px", overflowY: "auto", paddingRight: "6px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(showAllLogs ? securityLogs : securityLogs.slice(0, 6)).map((l: any, idx) => {
                        const dateStr = l.createdAt || l.timestamp || l.date;
                        const formattedTime = dateStr && !isNaN(new Date(dateStr).getTime())
                          ? new Date(dateStr).toLocaleString()
                          : "Recent Activity";

                        const actionName = l.action || l.event || "Security Event";
                        let badgeBg = "rgba(99, 102, 241, 0.15)";
                        let badgeColor = "#818CF8";
                        if (actionName.includes("LOGIN")) { badgeBg = "rgba(34, 197, 94, 0.15)"; badgeColor = "#22C55E"; }
                        if (actionName.includes("2FA")) { badgeBg = "rgba(168, 85, 247, 0.15)"; badgeColor = "#A855F7"; }
                        if (actionName.includes("REVOKED") || actionName.includes("FAILED")) { badgeBg = "rgba(239, 68, 68, 0.15)"; badgeColor = "#EF4444"; }

                        return (
                          <div key={idx} style={{ padding: "12px 18px", backgroundColor: "#111827", borderRadius: "12px", border: "1px solid #27303D", display: "flex", justifyContent: "space-between", fontSize: "0.85rem", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ padding: "4px 10px", backgroundColor: badgeBg, color: badgeColor, borderRadius: "6px", fontWeight: 600, fontSize: "0.775rem", fontFamily: "'Fira Code', monospace" }}>
                                {actionName}
                              </span>
                            </div>
                            <span style={{ color: "#64748B", fontSize: "0.775rem" }}>{formattedTime}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "36px", width: "100%" }}>
            <div>
              <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#64748B" }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search questions by title, category, or tags..."
                    style={{
                      width: "100%",
                      padding: "12px 16px 12px 46px",
                      backgroundColor: "#151B23",
                      border: "1px solid #27303D",
                      borderRadius: "12px",
                      color: "#F8FAFC",
                      fontSize: "0.925rem",
                      outline: "none",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  {["All", "Easy", "Medium", "Hard"].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setSelectedDifficulty(diff)}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "10px",
                        border: "1px solid #27303D",
                        backgroundColor: selectedDifficulty === diff ? "#6366F1" : "#151B23",
                        color: selectedDifficulty === diff ? "#FFFFFF" : "#94A3B8",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                        boxShadow: selectedDifficulty === diff ? "0 4px 12px rgba(99, 102, 241, 0.4)" : "none",
                        transition: "all 0.2s",
                      }}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: "#151B23", border: "1px solid #27303D", borderRadius: "18px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 180px 100px 100px", padding: "16px 24px", borderBottom: "1px solid #27303D", color: "#64748B", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>Status</span>
                  <span>Title</span>
                  <span>Category</span>
                  <span>Acceptance</span>
                  <span>Difficulty</span>
                </div>

                {filteredProblems.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
                    No problems match your current search filters.
                  </div>
                ) : (
                  filteredProblems.map((prob) => (
                    <div
                      key={prob.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "60px 1fr 180px 100px 100px",
                        padding: "18px 24px",
                        borderBottom: "1px solid rgba(39, 48, 61, 0.5)",
                        alignItems: "center",
                        fontSize: "0.925rem",
                        transition: "all 0.15s ease",
                        cursor: "pointer",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.08)")}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <span>
                        {prob.status === "solved" ? (
                          <CheckCircle2 size={20} color="#22C55E" />
                        ) : prob.status === "attempted" ? (
                          <Clock size={20} color="#F59E0B" />
                        ) : (
                          <span style={{ color: "#334155" }}>—</span>
                        )}
                      </span>

                      <div>
                        <span style={{ color: "#F8FAFC", fontWeight: 600 }}>
                          {prob.id}. {prob.title}
                        </span>
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                          {prob.tags.map((tag) => (
                            <span key={tag} style={{ fontSize: "0.7rem", color: "#64748B", backgroundColor: "#111827", padding: "2px 6px", borderRadius: "4px" }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <span style={{ color: "#94A3B8", fontSize: "0.85rem" }}>
                        {prob.category}
                      </span>

                      <span style={{ color: "#64748B", fontSize: "0.85rem", fontFamily: "'Fira Code', monospace" }}>
                        {prob.acceptance}
                      </span>

                      <span>
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: "14px",
                            fontSize: "0.775rem",
                            fontWeight: 600,
                            backgroundColor:
                              prob.difficulty === "Easy"
                                ? "rgba(34, 197, 94, 0.15)"
                                : prob.difficulty === "Medium"
                                  ? "rgba(245, 158, 11, 0.15)"
                                  : "rgba(239, 68, 68, 0.15)",
                            color:
                              prob.difficulty === "Easy"
                                ? "#22C55E"
                                : prob.difficulty === "Medium"
                                  ? "#F59E0B"
                                  : "#EF4444",
                          }}
                        >
                          {prob.difficulty}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              <div
                style={{
                  padding: "24px",
                  backgroundColor: "#151B23",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  borderRadius: "20px",
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(21, 27, 35, 1) 100%)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#818CF8", fontSize: "0.825rem", fontWeight: 600, marginBottom: "10px" }}>
                  <Sparkles size={16} />
                  <span>DAILY CODING CHALLENGE</span>
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "8px" }}>
                  Two Sum II - Input Array Is Sorted
                </h3>
                <p style={{ color: "#94A3B8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  Earn 50 algoX points & maintain your daily coding streak!
                </p>

                <button className="btn-primary-advanced" style={{ padding: "12px 18px" }}>
                  <Play size={16} fill="#FFFFFF" />
                  <span>Solve Daily Problem</span>
                </button>
              </div>

              <div style={{ padding: "24px", backgroundColor: "#151B23", border: "1px solid #27303D", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                <h4 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#F8FAFC", marginBottom: "16px" }}>
                  Session Progress
                </h4>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "2rem", fontWeight: 800, color: "#F8FAFC" }}>{totalSolved}</span>
                    <span style={{ fontSize: "0.8rem", color: "#64748B" }}>Solved / {MOCK_PROBLEMS.length} Problems</span>
                  </div>
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", border: "6px solid #22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#22C55E", fontWeight: 700, fontSize: "0.85rem" }}>
                    40%
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                      <span style={{ color: "#22C55E", fontWeight: 600 }}>Easy</span>
                      <span style={{ color: "#94A3B8" }}>{easyCount} / 2</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#111827", borderRadius: "3px" }}>
                      <div style={{ width: "100%", height: "100%", backgroundColor: "#22C55E", borderRadius: "3px" }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                      <span style={{ color: "#F59E0B", fontWeight: 600 }}>Medium</span>
                      <span style={{ color: "#94A3B8" }}>{medCount} / 6</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#111827", borderRadius: "3px" }}>
                      <div style={{ width: "33%", height: "100%", backgroundColor: "#F59E0B", borderRadius: "3px" }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                      <span style={{ color: "#EF4444", fontWeight: 600 }}>Hard</span>
                      <span style={{ color: "#94A3B8" }}>{hardCount} / 2</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#111827", borderRadius: "3px" }}>
                      <div style={{ width: "0%", height: "100%", backgroundColor: "#EF4444", borderRadius: "3px" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
