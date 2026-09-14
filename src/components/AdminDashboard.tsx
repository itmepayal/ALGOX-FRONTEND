import { useState, useEffect, type FC } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/authApi";
import { problemApi, type Problem } from "../api/problemApi";
import { submissionApi, type Submission, type SubmissionStatus } from "../api/submissionApi";
import { sampleProblems } from "../data/sampleProblems";
import {
  Plus,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  LogOut,
  ArrowLeft,
  Clock,
  User as UserIcon,
  Sparkles,
  Trash2,
  Code2,
  Search,
} from "lucide-react";

interface AdminDashboardProps {
  onBackToUserView: () => void;
}

type AdminTab = "create" | "manage" | "submissions" | "security";

const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "PENDING",
  "RUNNING",
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "RUNTIME_ERROR",
  "COMPILATION_ERROR",
];

export const AdminDashboard: FC<AdminDashboardProps> = ({ onBackToUserView }) => {
  const { user, signout } = useAuth();
  const [adminTab, setAdminTab] = useState<AdminTab>("create");

  // Problems state
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);

  // Create Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [newCategory, setNewCategory] = useState("Arrays & Hashing");
  const [newTags, setNewTags] = useState("Array, Hash Table");
  const [newDescription, setNewDescription] = useState("");
  const [newTemplate, setNewTemplate] = useState("function solution(nums, target) {\n  // Write your code here\n}");
  const [newTestInput, setNewTestInput] = useState("[2,7,11,15]\n9");
  const [newTestOutput, setNewTestOutput] = useState("[0,1]");

  const [creatingProblem, setCreatingProblem] = useState(false);
  const [importingSamples, setImportingSamples] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [updatingSubmissionId, setUpdatingSubmissionId] = useState<string | null>(null);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);

  const fetchProblems = async () => {
    try {
      setLoadingProblems(true);
      setErrorMsg("");
      const res = await problemApi.getProblems({ limit: 50 });
      if (res && res.data) setProblems(res.data);
    } catch (err: any) {
      console.warn("Fetch problems failed:", err);
      setErrorMsg(err.response?.data?.message || err.message || "Failed to load problems from ProblemService.");
    } finally {
      setLoadingProblems(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await authApi.getSecurityLogs();
      if (res && res.data) setSecurityLogs(res.data as any[]);
    } catch { }
  };

  const fetchSubmissions = async () => {
    try {
      setLoadingSubmissions(true);
      setErrorMsg("");
      const res = submissionSearch.trim()
        ? await submissionApi.searchSubmissions(submissionSearch.trim())
        : await submissionApi.getAllSubmissions({ page: 1, limit: 50 });
      if (res && res.data) setSubmissions(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to load submissions from SubmissionService.");
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleUpdateSubmissionStatus = async (id: string, status: SubmissionStatus) => {
    setUpdatingSubmissionId(id);
    setStatusMsg("");
    setErrorMsg("");
    try {
      await submissionApi.updateSubmission(id, { status });
      setStatusMsg("Submission status updated via SubmissionService.");
      fetchSubmissions();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to update submission.");
    } finally {
      setUpdatingSubmissionId(null);
    }
  };

  const handleDeleteSubmission = async (id?: string) => {
    if (!id) return;
    if (!window.confirm("Delete this submission from SubmissionService MongoDB?")) return;
    setDeletingSubmissionId(id);
    setStatusMsg("");
    setErrorMsg("");
    try {
      await submissionApi.deleteSubmission(id);
      setStatusMsg("Submission deleted successfully.");
      fetchSubmissions();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to delete submission.");
    } finally {
      setDeletingSubmissionId(null);
    }
  };

  useEffect(() => {
    fetchProblems();
    fetchLogs();
  }, []);

  useEffect(() => {
    if (adminTab === "submissions") fetchSubmissions();
  }, [adminTab]);

  const handleImportSampleProblems = async () => {
    if (!window.confirm(`Import ${sampleProblems.length} sample Array questions into ProblemService?`)) return;
    setImportingSamples(true);
    setStatusMsg("");
    setErrorMsg("");
    let imported = 0;
    try {
      for (const problem of sampleProblems) {
        await problemApi.createProblem(problem);
        imported++;
      }
      setStatusMsg(`${imported} sample Array questions imported successfully!`);
      fetchProblems();
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.message ||
          `Imported ${imported}/${sampleProblems.length} before error. Some slugs may already exist.`
      );
      fetchProblems();
    } finally {
      setImportingSamples(false);
    }
  };

  const handleCreateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingProblem(true);
    setStatusMsg("");
    setErrorMsg("");
    try {
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      const tagsArr = newTags.split(",").map((t) => t.trim()).filter(Boolean);

      await problemApi.createProblem({
        title: newTitle,
        slug: slug || `problem-${Date.now()}`,
        difficulty: newDifficulty,
        category: newCategory,
        tags: tagsArr,
        description: newDescription,
        codeStubs: [
          { language: "javascript", startSnippet: "", userTemplate: newTemplate },
        ],
        testcases: [
          { input: newTestInput, output: newTestOutput, isHidden: false },
        ],
      });

      setStatusMsg("Question created & published to ProblemService MongoDB successfully!");
      setNewTitle("");
      setNewDescription("");
      fetchProblems();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to create problem. Admin privileges required.");
    } finally {
      setCreatingProblem(false);
    }
  };

  const handleDeleteProblem = async (id?: string) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this problem from MongoDB?")) return;

    setDeletingId(id);
    setStatusMsg("");
    setErrorMsg("");
    try {
      await problemApi.deleteProblem(id);
      setStatusMsg("Problem deleted successfully from ProblemService MongoDB!");
      fetchProblems();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to delete problem. Admin token required.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-main)", color: "var(--text-main)", fontFamily: "'Poppins', sans-serif" }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: "260px",
          backgroundColor: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 50,
          boxShadow: "2px 0 16px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div>
          {/* Brand & Platform Theme Logo Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", padding: "0 6px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                color: "var(--text-main)",
                fontSize: "0.85rem",
                letterSpacing: "-0.05em",
                boxShadow: "0 2px 10px rgba(99, 102, 241, 0.5)",
              }}
            >
              AP
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", fontFamily: "'Poppins', sans-serif" }}>
                  Algo<span style={{ color: "var(--primary)" }}>Path</span> <span style={{ color: "var(--primary-hover)", fontSize: "0.95rem" }}>Admin</span>
                </span>
              </div>
              <div style={{ fontSize: "0.6rem", backgroundColor: "rgba(99, 102, 241, 0.15)", color: "var(--primary-hover)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "4px", padding: "1px 6px", fontWeight: 500, width: "fit-content", marginTop: "1px" }}>
                ADMIN CONTROL PANEL
              </div>
            </div>
          </div>

          {/* Nav Section Label */}
          <p style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 8px 8px" }}>
            Admin Management
          </p>

          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <button
              onClick={() => setAdminTab("create")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: adminTab === "create" ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: adminTab === "create" ? "var(--primary-hover)" : "var(--text-secondary)",
                fontWeight: adminTab === "create" ? 600 : 400,
                fontSize: "0.85rem",
                fontFamily: "'Poppins', sans-serif",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={16} color={adminTab === "create" ? "var(--primary-hover)" : "var(--text-muted)"} />
              <span>Create Question</span>
            </button>

            <button
              onClick={() => setAdminTab("manage")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: adminTab === "manage" ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: adminTab === "manage" ? "var(--primary-hover)" : "var(--text-secondary)",
                fontWeight: adminTab === "manage" ? 600 : 400,
                fontSize: "0.85rem",
                fontFamily: "'Poppins', sans-serif",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <BookOpen size={16} color={adminTab === "manage" ? "var(--primary-hover)" : "var(--text-muted)"} />
                <span>Manage Problems</span>
              </div>
              <span style={{ fontSize: "0.7rem", backgroundColor: "var(--border-subtle)", color: "var(--text-secondary)", padding: "1px 6px", borderRadius: "6px", fontWeight: 500 }}>
                {problems.length}
              </span>
            </button>

            <button
              onClick={() => setAdminTab("submissions")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: adminTab === "submissions" ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: adminTab === "submissions" ? "var(--primary-hover)" : "var(--text-secondary)",
                fontWeight: adminTab === "submissions" ? 600 : 400,
                fontSize: "0.85rem",
                fontFamily: "'Poppins', sans-serif",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Code2 size={16} color={adminTab === "submissions" ? "var(--primary-hover)" : "var(--text-muted)"} />
                <span>Manage Submissions</span>
              </div>
              <span style={{ fontSize: "0.7rem", backgroundColor: "var(--border-subtle)", color: "var(--text-secondary)", padding: "1px 6px", borderRadius: "6px", fontWeight: 500 }}>
                {submissions.length}
              </span>
            </button>

            <button
              onClick={() => setAdminTab("security")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: adminTab === "security" ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: adminTab === "security" ? "var(--primary-hover)" : "var(--text-secondary)",
                fontWeight: adminTab === "security" ? 600 : 400,
                fontSize: "0.85rem",
                fontFamily: "'Poppins', sans-serif",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Clock size={16} color={adminTab === "security" ? "var(--primary-hover)" : "var(--text-muted)"} />
              <span>System Audit Logs</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer & User Profile Card */}
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Active Admin User Card */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", backgroundColor: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || "Admin"}
                style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--primary)" }}
              />
            ) : (
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(99, 102, 241, 0.2)", color: "var(--primary-hover)", border: "1px solid rgba(99, 102, 241, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.8rem" }}>
                {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={16} />}
              </div>
            )}
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name || "Admin User"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.email || "admin@algox.com"}
              </div>
            </div>
          </div>

          <button
            onClick={onBackToUserView}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              backgroundColor: "rgba(99, 102, 241, 0.06)",
              color: "var(--primary-hover)",
              fontWeight: 500,
              fontSize: "0.825rem",
              fontFamily: "'Poppins', sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <ArrowLeft size={14} color="var(--primary-hover)" />
            <span>Back to User View</span>
          </button>

          <button
            onClick={signout}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              backgroundColor: "rgba(239, 68, 68, 0.06)",
              color: "var(--error)",
              fontWeight: 500,
              fontSize: "0.825rem",
              fontFamily: "'Poppins', sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header Bar */}
        <header
          style={{
            height: "64px",
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            position: "sticky",
            top: 0,
            zIndex: 40,
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-main)", fontFamily: "'Poppins', sans-serif" }}>
              {adminTab === "create" && "Create & Publish New Algorithm Problem"}
              {adminTab === "manage" && "Problem Bank Management (MongoDB)"}
              {adminTab === "submissions" && "SubmissionService Management"}
              {adminTab === "security" && "System Audit & Security Logs"}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ padding: "5px 12px", backgroundColor: "rgba(99, 102, 241, 0.15)", color: "var(--primary-hover)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "16px", fontSize: "0.775rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", fontFamily: "'Poppins', sans-serif" }}>
              <ShieldCheck size={14} />
              <span>Admin Authorized</span>
            </div>

            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 10px 3px 3px", backgroundColor: "var(--bg-card)", borderRadius: "16px", border: "1px solid var(--border-subtle)" }}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 600 }}>
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-main)", fontFamily: "'Poppins', sans-serif" }}>{user.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Workspace Body */}
        <main style={{ padding: "32px", flex: 1, overflowY: "auto" }}>
          {/* Global Alert Messages */}
          {statusMsg && (
            <div style={{ padding: "12px 16px", backgroundColor: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "10px", color: "var(--primary-hover)", fontSize: "0.825rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", fontFamily: "'Poppins', sans-serif" }}>
              <Sparkles size={16} />
              <span>{statusMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div style={{ padding: "12px 16px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "10px", color: "var(--error)", fontSize: "0.825rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", fontFamily: "'Poppins', sans-serif" }}>
              <ShieldAlert size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: CREATE PROBLEM */}
          {adminTab === "create" && (
            <div style={{ maxWidth: "800px", margin: "0 auto", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "16px", padding: "30px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={18} color="var(--primary-hover)" />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--text-main)", fontFamily: "'Poppins', sans-serif" }}>Add New Problem to ProblemService</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.825rem", fontWeight: 400, marginTop: "1px", fontFamily: "'Poppins', sans-serif" }}>
                    Fill out the details below to publish a new question live to all platform users.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "18px", padding: "14px 16px", backgroundColor: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>10 Sample Array Questions</p>
                  <p style={{ fontSize: "0.775rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Two Sum, Find Max, Reverse Array, Sum, Count Even, Duplicate, Move Zeroes, Stock, Subarray, Product
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleImportSampleProblems}
                  disabled={importingSamples}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "var(--primary)",
                    color: "var(--text-main)",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.825rem",
                    cursor: importingSamples ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {importingSamples ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  <span>{importingSamples ? "Importing..." : "Import 10 Array Questions"}</span>
                </button>
              </div>

              <form onSubmit={handleCreateProblem} style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "22px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Problem Title</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. 3Sum"
                      style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 400, fontFamily: "'Poppins', sans-serif", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Difficulty</label>
                    <select
                      value={newDifficulty}
                      onChange={(e: any) => setNewDifficulty(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 400, fontFamily: "'Poppins', sans-serif", outline: "none", boxSizing: "border-box" }}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Category</label>
                    <input
                      type="text"
                      required
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="e.g. Two Pointers"
                      style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 400, fontFamily: "'Poppins', sans-serif", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      placeholder="e.g. Array, Two Pointers, Sorting"
                      style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 400, fontFamily: "'Poppins', sans-serif", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Problem Description & Constraints</label>
                  <textarea
                    required
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Enter detailed problem description..."
                    style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 400, fontFamily: "'Poppins', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Starter Code Stub (JavaScript / Python)</label>
                  <textarea
                    rows={4}
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", backgroundColor: "var(--bg-main)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "8px", color: "var(--primary-hover)", fontSize: "0.825rem", fontWeight: 400, fontFamily: "'Fira Code', monospace", outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Sample Test Input</label>
                    <input
                      type="text"
                      value={newTestInput}
                      onChange={(e) => setNewTestInput(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.825rem", fontWeight: 400, fontFamily: "'Fira Code', monospace", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Expected Output</label>
                    <input
                      type="text"
                      value={newTestOutput}
                      onChange={(e) => setNewTestOutput(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.825rem", fontWeight: 400, fontFamily: "'Fira Code', monospace", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingProblem}
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
                    color: "var(--text-main)",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    fontFamily: "'Poppins', sans-serif",
                    cursor: creatingProblem ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginTop: "6px",
                    boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
                  }}
                >
                  {creatingProblem ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Publishing Problem...</span>
                    </>
                  ) : (
                    <span>Publish Problem to ProblemService</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: MANAGE PROBLEMS */}
          {adminTab === "manage" && (
            <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "16px", padding: "28px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--text-main)", fontFamily: "'Poppins', sans-serif" }}>Problems Bank Management</h3>
                <span style={{ fontSize: "0.775rem", backgroundColor: "rgba(99, 102, 241, 0.15)", color: "var(--primary-hover)", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "3px 10px", borderRadius: "16px", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                  Total Problems: {problems.length}
                </span>
              </div>

              {loadingProblems ? (
                <div style={{ padding: "36px", textAlign: "center", color: "var(--primary-hover)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 400, fontFamily: "'Poppins', sans-serif" }}>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Fetching live problems from MongoDB...</span>
                </div>
              ) : problems.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 400, fontFamily: "'Poppins', sans-serif" }}>No problems recorded in database.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {problems.map((p, idx) => (
                    <div key={p.id || p._id || idx} style={{ padding: "14px 18px", backgroundColor: "var(--bg-main)", borderRadius: "10px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontWeight: 500, color: "var(--text-main)", fontSize: "0.875rem", fontFamily: "'Poppins', sans-serif" }}>{idx + 1}. {p.title}</span>
                          <span style={{ fontSize: "0.725rem", padding: "2px 8px", borderRadius: "6px", backgroundColor: "rgba(99, 102, 241, 0.15)", color: "var(--primary-hover)", fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>{p.category}</span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              backgroundColor: p.difficulty === "easy" ? "rgba(34, 197, 94, 0.15)" : p.difficulty === "medium" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              color: p.difficulty === "easy" ? "var(--success)" : p.difficulty === "medium" ? "var(--warning)" : "var(--error)",
                              textTransform: "uppercase",
                              fontWeight: 600,
                              fontFamily: "'Poppins', sans-serif",
                            }}
                          >
                            {p.difficulty}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400, marginTop: "4px", fontFamily: "'Poppins', sans-serif" }}>Slug: {p.slug}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteProblem(p.id || p._id)}
                        disabled={deletingId === (p.id || p._id)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          borderRadius: "8px",
                          color: "var(--error)",
                          fontSize: "0.775rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        {deletingId === (p.id || p._id) ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {adminTab === "submissions" && (
            <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "16px", padding: "28px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--text-main)", fontFamily: "'Poppins', sans-serif" }}>All Submissions</h3>
                <span style={{ fontSize: "0.775rem", backgroundColor: "rgba(99, 102, 241, 0.15)", color: "var(--primary-hover)", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "3px 10px", borderRadius: "16px", fontWeight: 500 }}>
                  Total: {submissions.length}
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={submissionSearch}
                    onChange={(e) => setSubmissionSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") fetchSubmissions();
                    }}
                    placeholder="Search submissions..."
                    style={{ width: "100%", padding: "10px 12px 10px 38px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <button
                  onClick={fetchSubmissions}
                  style={{ padding: "10px 16px", backgroundColor: "var(--primary)", color: "var(--text-main)", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
                >
                  Search
                </button>
              </div>

              {loadingSubmissions ? (
                <div style={{ padding: "36px", textAlign: "center", color: "var(--primary-hover)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.85rem" }}>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Fetching submissions from SubmissionService...</span>
                </div>
              ) : submissions.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>No submissions recorded in database.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {submissions.map((s, idx) => {
                    const sid = s.id || s._id || "";
                    return (
                      <div key={sid || idx} style={{ padding: "14px 18px", backgroundColor: "var(--bg-main)", borderRadius: "10px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 500, color: "var(--text-main)", fontSize: "0.875rem" }}>#{idx + 1} {s.language}</span>
                            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px", backgroundColor: "rgba(99, 102, 241, 0.15)", color: "var(--primary-hover)" }}>{s.status}</span>
                          </div>
                          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Problem: {s.problemId} · User: {s.userId || "n/a"} · {s.executionTime ?? 0}ms
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <select
                            value={SUBMISSION_STATUSES.includes(s.status as SubmissionStatus) ? s.status : "PENDING"}
                            disabled={updatingSubmissionId === sid}
                            onChange={(e) => handleUpdateSubmissionStatus(sid, e.target.value as SubmissionStatus)}
                            style={{ padding: "6px 8px", backgroundColor: "var(--bg-secondary)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "var(--text-main)", fontSize: "0.75rem" }}
                          >
                            {SUBMISSION_STATUSES.map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleDeleteSubmission(sid)}
                            disabled={deletingSubmissionId === sid}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              borderRadius: "8px",
                              color: "var(--error)",
                              fontSize: "0.775rem",
                              fontWeight: 500,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            {deletingSubmissionId === sid ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYSTEM AUDIT LOGS */}
          {adminTab === "security" && (
            <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "16px", padding: "28px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px", fontFamily: "'Poppins', sans-serif" }}>Security & System Audit Logs</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {securityLogs.map((l: any, idx) => (
                  <div key={idx} style={{ padding: "12px 16px", backgroundColor: "var(--bg-main)", borderRadius: "10px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", fontSize: "0.825rem", alignItems: "center" }}>
                    <span style={{ color: "var(--primary-hover)", fontWeight: 500, fontFamily: "'Fira Code', monospace" }}>{l.action || l.event}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 400, fontFamily: "'Poppins', sans-serif" }}>{l.createdAt ? new Date(l.createdAt).toLocaleString() : "Recent"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
