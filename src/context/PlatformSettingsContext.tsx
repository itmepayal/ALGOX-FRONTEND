import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import {
  adminSettingsApi,
  type PublicPlatformSettings,
} from "../api/adminSettingsApi";
import { useAuth } from "./AuthContext";
import { isStaffRole } from "../rbac/permissions";

export type FeatureFlagKey =
  | "contests"
  | "discussions"
  | "submissions"
  | "registration"
  | "maintenance"
  | "newEditor"
  | "notifications";

type FeatureFlags = Record<FeatureFlagKey, boolean>;

const DEFAULT_FLAGS: FeatureFlags = {
  contests: true,
  discussions: true,
  submissions: true,
  registration: true,
  maintenance: false,
  newEditor: true,
  notifications: true,
};

interface PlatformSettingsContextValue {
  settings: PublicPlatformSettings | null;
  flags: FeatureFlags;
  loading: boolean;
  isEnabled: (flag: FeatureFlagKey) => boolean;
  refresh: () => Promise<void>;
}

const PlatformSettingsContext =
  createContext<PlatformSettingsContextValue | null>(null);

export const PlatformSettingsProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PublicPlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await adminSettingsApi.getPublic();
      setSettings(res.data || null);
    } catch {
      // keep last known / defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const flags = useMemo<FeatureFlags>(() => {
    const ff = (settings as any)?.featureFlags || {};
    return {
      contests: ff.contests ?? DEFAULT_FLAGS.contests,
      discussions:
        ff.discussions ??
        settings?.discussionsEnabled ??
        DEFAULT_FLAGS.discussions,
      submissions: ff.submissions ?? DEFAULT_FLAGS.submissions,
      registration:
        ff.registration ??
        settings?.registrationEnabled ??
        DEFAULT_FLAGS.registration,
      maintenance:
        Boolean(ff.maintenance) ||
        Boolean(settings?.maintenanceMode) ||
        DEFAULT_FLAGS.maintenance,
      newEditor: ff.newEditor ?? DEFAULT_FLAGS.newEditor,
      notifications: ff.notifications ?? DEFAULT_FLAGS.notifications,
    };
  }, [settings]);

  const isEnabled = useCallback(
    (flag: FeatureFlagKey) => {
      if (flag === "maintenance") {
        if (!flags.maintenance) return true; // not in maintenance
        const bypass =
          Boolean(settings?.allowAdminBypass) && isStaffRole(user?.role);
        return bypass; // "enabled" for staff means they can use the app
      }
      return flags[flag] !== false;
    },
    [flags, settings?.allowAdminBypass, user?.role]
  );

  const value = useMemo(
    () => ({ settings, flags, loading, isEnabled, refresh }),
    [settings, flags, loading, isEnabled, refresh]
  );

  return (
    <PlatformSettingsContext.Provider value={value}>
      {children}
    </PlatformSettingsContext.Provider>
  );
};

export function usePlatformSettings(): PlatformSettingsContextValue {
  const ctx = useContext(PlatformSettingsContext);
  if (!ctx) {
    return {
      settings: null,
      flags: DEFAULT_FLAGS,
      loading: false,
      isEnabled: () => true,
      refresh: async () => {},
    };
  }
  return ctx;
}
