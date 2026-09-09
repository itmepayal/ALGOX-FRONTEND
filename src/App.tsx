import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthModal } from "./components/AuthModal";
import { Dashboard } from "./components/Dashboard";
import "./index.css";

function AppContent() {
  const { user } = useAuth();

  if (user) {
    return <Dashboard />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0B0F14",
        color: "#F8FAFC",
        fontFamily: "'Poppins', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "28px" }}>
        {/* Stylish Compact Logo + Engine Active Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 16px",
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "30px",
            fontSize: "0.825rem",
            fontWeight: 500,
            color: "#94A3B8",
            marginBottom: "20px",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 15px rgba(99, 102, 241, 0.15)",
          }}
        >
          {/* Compact Stylish Logo Icon */}
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #6366F1 0%, #4338CA 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#FFFFFF",
              fontSize: "0.7rem",
              letterSpacing: "-0.05em",
              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.5)",
            }}
          >
            aX
          </div>

          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#22C55E", boxShadow: "0 0 8px #22C55E" }}></span>
          
          <span style={{ color: "#F8FAFC", fontWeight: 600 }}>
            algo<span style={{ color: "#6366F1" }}>X</span> Platform
          </span>
          <span style={{ color: "#64748B" }}>|</span>
          <span style={{ color: "#818CF8", fontFamily: "'Poppins', sans-serif" }}>v2.4 Production Active</span>
        </div>

        {/* Premium Main Title */}
        <h1
          style={{
            fontSize: "1.85rem",
            fontWeight: 700,
            color: "#F8FAFC",
            letterSpacing: "-0.02em",
            fontFamily: "'Poppins', sans-serif",
            lineHeight: 1.3,
          }}
        >
          Master Coding & System Design on{" "}
          <span
            style={{
              color: "#6366F1",
              fontWeight: 800,
              textShadow: "0 0 25px rgba(99, 102, 241, 0.4)",
            }}
          >
            algo<span style={{ color: "#818CF8" }}>X</span>
          </span>
        </h1>
        <p style={{ color: "#94A3B8", fontSize: "0.9rem", fontFamily: "'Poppins', sans-serif", maxWidth: "500px", margin: "8px auto 0" }}>
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


