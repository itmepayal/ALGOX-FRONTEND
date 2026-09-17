import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";

export type AuthPromptTab = "login" | "signup";

export type AuthPromptOptions = {
  tab?: AuthPromptTab;
  /** Contextual line shown above the form */
  message?: string;
  title?: string;
};

type AuthPromptContextValue = {
  open: boolean;
  options: AuthPromptOptions;
  openAuth: (opts?: AuthPromptOptions) => void;
  closeAuth: () => void;
};

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null);

export const AuthPromptProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AuthPromptOptions>({});

  const openAuth = useCallback((opts?: AuthPromptOptions) => {
    setOptions(opts || {});
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ open, options, openAuth, closeAuth }),
    [open, options, openAuth, closeAuth]
  );

  return (
    <AuthPromptContext.Provider value={value}>
      {children}
    </AuthPromptContext.Provider>
  );
};

export function useAuthPrompt(): AuthPromptContextValue {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) {
    return {
      open: false,
      options: {},
      openAuth: () => undefined,
      closeAuth: () => undefined,
    };
  }
  return ctx;
}
