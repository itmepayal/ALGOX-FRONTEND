import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PlatformSettingsProvider, usePlatformSettings } from "./context/PlatformSettingsContext";
import { AuthModal } from "./components/AuthModal";
import { Dashboard } from "./components/Dashboard";
import { AdminApp } from "./components/admin/AdminApp";
import { canAccessAdmin } from "./rbac/permissions";
import {
  readProblemSlugFromLocation,
  rememberPendingProblemSlug,
} from "./utils/problemShare";
import { BrandMark } from "./components/BrandLogo";
import { cn } from "./lib/cn";
import "./index.css";

function AppContent() {
  const { user } = useAuth();
  const { settings, isEnabled, flags } = usePlatformSettings();
  const [view, setView] = useState<"dashboard" | "admin">("dashboard");

  const inMaintenance =
    flags.maintenance && !isEnabled("maintenance");

  // If a shared ?problem= link is opened while logged out, remember it for after login
  useEffect(() => {
    if (user) return;
    const slug = readProblemSlugFromLocation();
    if (slug) rememberPendingProblemSlug(slug);
  }, [user]);

  // Sync /admin path when entering admin; restore / when leaving
  useEffect(() => {
    if (view === "admin" && canAccessAdmin(user?.role, user?.permissions)) {
      if (!window.location.pathname.startsWith("/admin")) {
        window.history.replaceState({}, "", "/admin?admin=dashboard");
      }
    } else if (view === "dashboard" && window.location.pathname.startsWith("/admin")) {
      window.history.replaceState({}, "", "/");
    }
  }, [view, user?.role, user?.permissions]);

  // Drop admin view if role cannot access
  useEffect(() => {
    if (view === "admin" && user && !canAccessAdmin(user.role, user.permissions)) {
      setView("dashboard");
    }
  }, [view, user]);

  // Deep-link: land on admin if URL is /admin
  useEffect(() => {
    if (
      user &&
      canAccessAdmin(user.role, user.permissions) &&
      window.location.pathname.startsWith("/admin")
    ) {
      setView("admin");
    }
  }, [user]);

  if (user) {
    if (view === "admin" && canAccessAdmin(user.role, user.permissions)) {
      return (
        <AdminApp
          onBackToUserView={() => {
            window.history.replaceState({}, "", "/");
            setView("dashboard");
          }}
        />
      );
    }
    if (inMaintenance) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-bold">Under maintenance</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            {settings?.maintenanceMessage ||
              "AlgoPath is under maintenance. Please check back soon."}
          </p>
          {canAccessAdmin(user.role, user.permissions) ? (
            <button
              type="button"
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => {
                window.history.replaceState({}, "", "/admin?admin=dashboard");
                setView("admin");
              }}
            >
              Open Admin Console
            </button>
          ) : null}
        </div>
      );
    }
    return (
      <Dashboard
        onOpenAdmin={
          canAccessAdmin(user.role, user.permissions)
            ? () => {
                window.history.replaceState({}, "", "/admin?admin=dashboard");
                setView("admin");
              }
            : undefined
        }
      />
    );
  }

  if (inMaintenance) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">Under maintenance</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          {settings?.maintenanceMessage ||
            "AlgoPath is under maintenance. Please check back soon."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-6 font-primary text-foreground">
      <header className="mb-6 text-center">
        <div
          className={cn(
            "mb-4 inline-flex items-center gap-2.5 rounded-full border border-border",
            "bg-card px-3.5 py-1 text-xs sm:text-sm font-medium text-muted-foreground shadow-md backdrop-blur-md",
          )}
        >
          <BrandMark size={20} />
          <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />
          <span className="font-semibold text-foreground">
            Algo<span className="text-primary">Path</span> Platform
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-primary-hover">v2.4 Production Active</span>
        </div>

        <h1 className="font-primary text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
          Master Coding & System Design on{" "}
          <span className="text-primary">
            Algo<span className="text-primary-hover">Path</span>
          </span>
        </h1>
        <p className="mx-auto mt-1.5 max-w-lg font-primary text-xs text-muted-foreground sm:text-sm md:text-base">
          Ultra-fast microservice algorithm execution, live contests & real-time analytics
        </p>
      </header>

      <main className="w-full max-w-md">
        <AuthModal />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <PlatformSettingsProvider>
        <AppContent />
      </PlatformSettingsProvider>
    </AuthProvider>
  );
}

export default App;
