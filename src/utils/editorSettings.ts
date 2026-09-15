/**
 * Code editor + app theme settings — localStorage persistence.
 * Key: leetcode-editor-settings (also migrates legacy algox:editor-font-size).
 * Consumed by MonacoCodeEditor and CSS data-theme on <html>.
 */

export type EditorTheme = "dark" | "light" | "high-contrast";
export type WordWrapMode = "on" | "off";
export type TabSizeOption = 2 | 4 | 8;

export interface EditorSettings {
  theme: EditorTheme;
  fontSize: number;
  tabSize: TabSizeOption;
  wordWrap: WordWrapMode;
  minimap: boolean;
  lineNumbers: boolean;
  autoCloseBrackets: boolean;
  formatOnType: boolean;
}

export const EDITOR_SETTINGS_KEY = "leetcode-editor-settings";
const LEGACY_FONT_KEY = "algox:editor-font-size";

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = 14;

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  theme: "dark",
  fontSize: FONT_SIZE_DEFAULT,
  tabSize: 4,
  wordWrap: "off",
  minimap: false,
  lineNumbers: true,
  autoCloseBrackets: true,
  formatOnType: false,
};

function clampFontSize(n: number): number {
  if (!Number.isFinite(n)) return FONT_SIZE_DEFAULT;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n)));
}

function normalizeTabSize(n: unknown): TabSizeOption {
  if (n === 2 || n === 4 || n === 8) return n;
  if (n === "2" || n === "4" || n === "8") return Number(n) as TabSizeOption;
  return 4;
}

function normalizeTheme(v: unknown): EditorTheme {
  if (v === "dark" || v === "light" || v === "high-contrast") return v;
  return "dark";
}

function normalizeWordWrap(v: unknown): WordWrapMode {
  if (v === "on" || v === true) return "on";
  return "off";
}

export function sanitizeEditorSettings(
  raw: Partial<EditorSettings> | null | undefined,
): EditorSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EDITOR_SETTINGS };
  return {
    theme: normalizeTheme(raw.theme),
    fontSize: clampFontSize(Number(raw.fontSize)),
    tabSize: normalizeTabSize(raw.tabSize),
    wordWrap: normalizeWordWrap(raw.wordWrap),
    minimap: Boolean(raw.minimap),
    lineNumbers: raw.lineNumbers !== false,
    autoCloseBrackets: raw.autoCloseBrackets !== false,
    formatOnType: Boolean(raw.formatOnType),
  };
}

function readLegacyFontSize(): number | null {
  try {
    const n = Number(localStorage.getItem(LEGACY_FONT_KEY));
    if (Number.isFinite(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) return Math.round(n);
  } catch {
    // ignore
  }
  return null;
}

export function loadEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(EDITOR_SETTINGS_KEY);
    if (raw) {
      return sanitizeEditorSettings(JSON.parse(raw) as Partial<EditorSettings>);
    }
  } catch {
    // fall through
  }

  const legacyFont = readLegacyFontSize();
  if (legacyFont != null) {
    const migrated = sanitizeEditorSettings({
      ...DEFAULT_EDITOR_SETTINGS,
      fontSize: legacyFont,
    });
    saveEditorSettings(migrated);
    return migrated;
  }

  return { ...DEFAULT_EDITOR_SETTINGS };
}

export function saveEditorSettings(settings: EditorSettings): void {
  const clean = sanitizeEditorSettings(settings);
  try {
    localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(clean));
    localStorage.setItem(LEGACY_FONT_KEY, String(clean.fontSize));
  } catch {
    // quota / private mode
  }
}

export type EditorSettingKey = keyof EditorSettings;

export function patchEditorSetting<K extends EditorSettingKey>(
  current: EditorSettings,
  key: K,
  value: EditorSettings[K],
): EditorSettings {
  return sanitizeEditorSettings({ ...current, [key]: value });
}
