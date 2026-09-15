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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refreshPermissions = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
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

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        if (localStorage.getItem("accessToken")) {
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
          }
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

  useEffect(() => {
    if (user && localStorage.getItem("accessToken")) {
      connectRealtimeSocket();
    } else {
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
    await authApi.signout();
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
