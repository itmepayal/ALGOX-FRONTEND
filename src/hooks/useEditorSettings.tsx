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
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  loadEditorSettings,
  patchEditorSetting,
  saveEditorSettings,
  type EditorSettingKey,
  type EditorSettings,
} from "../utils/editorSettings";
import { applyAppTheme } from "../utils/monacoTheme";

interface EditorSettingsContextValue {
  settings: EditorSettings;
  setEditorSetting: <K extends EditorSettingKey>(
    key: K,
    value: EditorSettings[K],
  ) => void;
  bumpFontSize: (delta: number) => void;
  resetEditorSettings: () => void;
  fontSizeMin: number;
  fontSizeMax: number;
}

const EditorSettingsContext = createContext<EditorSettingsContextValue | null>(
  null,
);

export const EditorSettingsProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<EditorSettings>(() => {
    const initial = loadEditorSettings();
    applyAppTheme(initial.theme);
    return initial;
  });

  useEffect(() => {
    saveEditorSettings(settings);
    applyAppTheme(settings.theme);
  }, [settings]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "leetcode-editor-settings" && e.newValue) {
        try {
          const next = loadEditorSettings();
          setSettings(next);
          applyAppTheme(next.theme);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setEditorSetting = useCallback(
    <K extends EditorSettingKey>(key: K, value: EditorSettings[K]) => {
      setSettings((prev) => patchEditorSetting(prev, key, value));
    },
    [],
  );

  const bumpFontSize = useCallback((delta: number) => {
    setSettings((prev) =>
      patchEditorSetting(
        prev,
        "fontSize",
        Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, prev.fontSize + delta)),
      ),
    );
  }, []);

  const resetEditorSettings = useCallback(() => {
    const next = loadEditorSettings();
    setSettings(next);
    applyAppTheme(next.theme);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setEditorSetting,
      bumpFontSize,
      resetEditorSettings,
      fontSizeMin: FONT_SIZE_MIN,
      fontSizeMax: FONT_SIZE_MAX,
    }),
    [settings, setEditorSetting, bumpFontSize, resetEditorSettings],
  );

  return (
    <EditorSettingsContext.Provider value={value}>
      {children}
    </EditorSettingsContext.Provider>
  );
};

/**
 * Single source of truth for editor + app theme settings.
 * Must be used under EditorSettingsProvider.
 */
export function useEditorSettings(): EditorSettingsContextValue {
  const ctx = useContext(EditorSettingsContext);
  if (!ctx) {
    throw new Error(
      "useEditorSettings must be used within EditorSettingsProvider",
    );
  }
  return ctx;
}
