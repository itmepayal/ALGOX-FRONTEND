import { createContext, useContext, useState, useEffect, type ReactNode, type FC } from "react";
import { authApi, type User } from "../api/authApi";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signin: (credentials: { email: string; password: string }) => Promise<any>;
  signup: (userData: { name: string; email: string; password: string }) => Promise<any>;
  signout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        if (localStorage.getItem("accessToken")) {
          const res = await authApi.getProfile();
          if (res.data) {
            setUser(res.data as any);
            localStorage.setItem("user", JSON.stringify(res.data));
          }
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const signin = async (credentials: { email: string; password: string }) => {
    const res = await authApi.signin(credentials);
    if (res.data?.user) {
      setUser(res.data.user);
    }
    return res;
  };

  const signup = async (userData: { name: string; email: string; password: string }) => {
    const res = await authApi.signup(userData);
    if (res.data?.user) {
      setUser(res.data.user);
    }
    return res;
  };

  const signout = async () => {
    await authApi.signout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signin, signup, signout, setUser }}>
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
