import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type FC,
} from "react";
import { authApi, type User } from "../api/authApi";
import { adminAuthApi } from "../api/adminAuthApi";
import {
  refreshAccessToken,
  SESSION_CLEARED_EVENT,
} from "../api/authClient";
import { hasAccessToken } from "../api/accessToken";
import { clearLearningCache } from "../utils/learningPersistence";
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
} from "../realtime/socket";
import { isStaffRole } from "../rbac/permissions";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signin: (credentials: { email: string; password: string }) => Promise<any>;
  signup: (userData: {
    name: string;
    email: string;
    password: string;
  }) => Promise<any>;
  signout: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshPermissions: () => Promise<void>;
  /** Re-fetch /me so localStorage plan forgeries cannot stick. */
  refreshEntitlements: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refreshPermissions = useCallback(async () => {
    if (!hasAccessToken()) return;
    try {
      const res = await adminAuthApi.getMyPermissions();
      const permissions = res.data?.permissions || [];
      setUser((prev) => {
        if (!prev || !isStaffRole(prev.role)) return prev;
        const next = {
          ...prev,
          permissions,
          role: res.data?.role || prev.role,
        };
        localStorage.setItem("user", JSON.stringify(next));
        return next;
      });
    } catch {
      // Keep role-based fallback
    }
  }, []);

  /**
   * Replace advisory entitlement fields from Auth SoT.
   * Client-forged accessTier/features in localStorage are overwritten.
   */
  const refreshEntitlements = useCallback(async () => {
    if (!hasAccessToken()) return;
    try {
      const res = await authApi.getProfile();
      if (!res.data) return;
      const server = res.data as User;
      setUser((prev) => {
        const next: User = {
          ...(prev || server),
          ...server,
          // Never keep client-only premium flags over server snapshot
          subscription: server.subscription,
          accessTier: server.accessTier,
          features: server.features,
        };
        localStorage.setItem("user", JSON.stringify(next));
        return next;
      });
    } catch {
      /* keep last known; APIs still enforce */
    }
  }, []);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Memory is empty on hard reload — restore access via httpOnly refresh cookie.
        if (!hasAccessToken()) {
          const token = await refreshAccessToken();
          if (!token) {
            setUser(null);
            disconnectRealtimeSocket();
            return;
          }
        }

        const res = await authApi.getProfile();
        if (res.data) {
          let next = res.data as User;
          if (isStaffRole(next.role)) {
            try {
              const perms = await adminAuthApi.getMyPermissions();
              next = {
                ...next,
                role: perms.data?.role || next.role,
                permissions: perms.data?.permissions || [],
              };
            } catch {
              // ignore
            }
          }
          setUser(next);
          localStorage.setItem("user", JSON.stringify(next));
          connectRealtimeSocket();
        } else {
          setUser(null);
          disconnectRealtimeSocket();
        }
      } catch {
        setUser(null);
        disconnectRealtimeSocket();
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  // Revalidate entitlements when tab gains focus (defeats stale forged localStorage)
  useEffect(() => {
    const onFocus = () => {
      void refreshEntitlements();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshEntitlements]);

  // Interceptor cleared access token after failed refresh — drop in-memory user.
  useEffect(() => {
    const onSessionCleared = () => {
      setUser(null);
      disconnectRealtimeSocket();
      try {
        localStorage.removeItem("user");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
    return () =>
      window.removeEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
  }, []);

  useEffect(() => {
    if (user && hasAccessToken()) {
      connectRealtimeSocket();
    } else if (!user) {
      disconnectRealtimeSocket();
    }
  }, [user]);

  const signin = async (credentials: { email: string; password: string }) => {
    const res = await authApi.signin(credentials);
    if (res.data?.user) {
      let next = res.data.user as User;
      if (isStaffRole(next.role)) {
        try {
          const perms = await adminAuthApi.getMyPermissions();
          next = {
            ...next,
            role: perms.data?.role || next.role,
            permissions: perms.data?.permissions || [],
          };
          localStorage.setItem("user", JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      setUser(next);
      connectRealtimeSocket();
    }
    return res;
  };

  const signup = async (userData: {
    name: string;
    email: string;
    password: string;
  }) => {
    const res = await authApi.signup(userData);
    if (res.data?.user) {
      setUser(res.data.user);
      connectRealtimeSocket();
    }
    return res;
  };

  const signout = async () => {
    const uid = user?.id || (user as { _id?: string } | null)?._id;
    await authApi.signout();
    clearLearningCache(uid ? String(uid) : undefined);
    disconnectRealtimeSocket();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signin,
        signup,
        signout,
        setUser,
        refreshPermissions,
        refreshEntitlements,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
