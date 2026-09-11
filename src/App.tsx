import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthModal } from "./components/AuthModal";
import { Dashboard } from "./components/Dashboard";
import { AdminDashboard } from "./components/AdminDashboard";
import {
  readProblemSlugFromLocation,
  rememberPendingProblemSlug,
} from "./utils/problemShare";
import "./index.css";

function AppContent() {
  const { user } = useAuth();
  const [view, setView] = useState<"dashboard" | "admin">("dashboard");

  // If a shared ?problem= link is opened while logged out, remember it for after login
  useEffect(() => {
    if (user) return;
    const slug = readProblemSlugFromLocation();
    if (slug) rememberPendingProblemSlug(slug);
  }, [user]);

  if (user) {
    if (view === "admin") {
      return <AdminDashboard onBackToUserView={() => setView("dashboard")} />;
    }
    return <Dashboard onOpenAdmin={() => setView("admin")} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-main)",
        color: "var(--text-main)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "28px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 16px",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "30px",
            fontSize: "0.825rem",
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: "20px",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 15px var(--primary-glow)",
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "var(--text-main)",
              fontSize: "0.7rem",
              letterSpacing: "-0.05em",
              boxShadow: "0 2px 8px var(--primary-glow)",
            }}
          >
            aX
          </div>

          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "var(--success)",
              boxShadow: "0 0 8px var(--success)",
            }}
          />

          <span style={{ color: "var(--text-main)", fontWeight: 600 }}>
            algo<span style={{ color: "var(--primary)" }}>X</span> Platform
          </span>
          <span style={{ color: "var(--text-muted)" }}>|</span>
          <span style={{ color: "var(--primary-hover)", fontFamily: "var(--font-sans)" }}>
            v2.4 Production Active
          </span>
        </div>

        <h1
          style={{
            fontSize: "1.85rem",
            fontWeight: 700,
            color: "var(--text-main)",
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-sans)",
            lineHeight: 1.3,
          }}
        >
          Master Coding & System Design on{" "}
          <span
            style={{
              color: "var(--primary)",
              fontWeight: 800,
              textShadow: "0 0 25px var(--primary-glow)",
            }}
          >
            algo<span style={{ color: "var(--primary-hover)" }}>X</span>
          </span>
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
            fontFamily: "var(--font-sans)",
            maxWidth: "500px",
            margin: "8px auto 0",
          }}
        >
          Ultra-fast microservice algorithm execution, live contests & real-time analytics
        </p>
      </header>

      <main style={{ width: "100%" }}>
        <AuthModal />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
