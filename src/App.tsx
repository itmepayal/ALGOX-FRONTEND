import { useState, useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PlatformSettingsProvider, usePlatformSettings } from "./context/PlatformSettingsContext";
import { AuthPromptProvider } from "./context/AuthPromptContext";
import { ToastProvider } from "./context/ToastContext";
import { Dashboard } from "./components/Dashboard";
import { BillingReturnHandler } from "./components/BillingReturnHandler";
import { GuestApp } from "./components/guest/GuestApp";
import { canAccessAdmin } from "./rbac/permissions";
import {
  readProblemSlugFromLocation,
  rememberPendingProblemSlug,
} from "./utils/problemShare";
import "./index.css";
import "./styles/guest.css";

const AdminApp = lazy(() =>
  import("./components/admin/AdminApp").then((m) => ({ default: m.AdminApp }))
);

function AdminBootFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      Loading admin…
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { settings, isEnabled, flags } = usePlatformSettings();
  const [view, setView] = useState<"dashboard" | "admin">("dashboard");

  const inMaintenance =
    flags.maintenance && !isEnabled("maintenance");

  useEffect(() => {
    if (user) return;
    const slug = readProblemSlugFromLocation();
    if (slug) rememberPendingProblemSlug(slug);
  }, [user]);

  useEffect(() => {
    if (view === "admin" && canAccessAdmin(user?.role, user?.permissions)) {
      if (!window.location.pathname.startsWith("/admin")) {
        window.history.replaceState({}, "", "/admin?admin=dashboard");
      }
    } else if (view === "dashboard" && window.location.pathname.startsWith("/admin")) {
      window.history.replaceState({}, "", "/");
    }
  }, [view, user?.role, user?.permissions]);

  useEffect(() => {
    if (view === "admin" && user && !canAccessAdmin(user.role, user.permissions)) {
      setView("dashboard");
    }
  }, [view, user]);

  useEffect(() => {
    if (
      user &&
      canAccessAdmin(user.role, user.permissions) &&
      window.location.pathname.startsWith("/admin")
    ) {
      setView("admin");
    }
  }, [user]);

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        Loading…
      </div>
    );
  }

  if (user) {
    if (view === "admin" && canAccessAdmin(user.role, user.permissions)) {
      return (
        <Suspense fallback={<AdminBootFallback />}>
          <AdminApp
            onBackToUserView={() => {
              window.history.replaceState({}, "", "/");
              setView("dashboard");
            }}
          />
        </Suspense>
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
      <>
        <BillingReturnHandler />
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
      </>
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

  return <GuestApp />;
}

function App() {
  return (
    <AuthProvider>
      <PlatformSettingsProvider>
        <AuthPromptProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthPromptProvider>
      </PlatformSettingsProvider>
    </AuthProvider>
  );
}

export default App;
