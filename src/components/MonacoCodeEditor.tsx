import {
  useEffect,
  useRef,
  type CSSProperties,
  type FC,
} from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { EditorSettings } from "../utils/editorSettings";
import { registerMonacoFormatters } from "../utils/monacoFormatters";
import {
  languageSupportsFormatting,
  toMonacoLanguage,
  toMonacoTheme,
} from "../utils/monacoTheme";
import { cn } from "../lib/cn";

export interface MonacoCodeEditorProps {
  value: string;
  language: string;
  settings: EditorSettings;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Monaco-backed code editor for the problem workspace.
 * Consumes editor settings (theme, font, minimap, wrap, etc.) without remounting.
 */
export const MonacoCodeEditor: FC<MonacoCodeEditorProps> = ({
  value,
  language,
  settings,
  readOnly = false,
  onChange,
  className,
  style,
}) => {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const monacoLanguage = toMonacoLanguage(language);
  const monacoTheme = toMonacoTheme(settings.theme);
  const canFormat = languageSupportsFormatting(language);

  const onMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    registerMonacoFormatters(monaco);
    ed.updateOptions(buildOptions(settings, readOnly, canFormat));
    // Ensure layout fills flex container
    requestAnimationFrame(() => ed.layout());
  };

  // Sync options when settings / readonly change — no remount
  useEffect(() => {
    editorRef.current?.updateOptions(
      buildOptions(settings, readOnly, canFormat),
    );
  }, [settings, readOnly, canFormat]);

  // Theme must be set on monaco API as well as Editor theme prop
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    // @monaco-editor/react also sets theme via prop; keep in sync for hot updates
    const monaco = (window as unknown as { monaco?: typeof import("monaco-editor") })
      .monaco;
    monaco?.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // ResizeObserver so Monaco fills panel when split / fullscreen changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      editorRef.current?.layout();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("lc-monaco-host", className)}
      style={style}
      data-monaco-theme={monacoTheme}
    >
      <Editor
        height="100%"
        width="100%"
        language={monacoLanguage}
        theme={monacoTheme}
        value={value}
        path={`algopath://${monacoLanguage}/main`}
        loading={
          <div className="lc-monaco-loading" aria-busy="true">
            Loading editor…
          </div>
        }
        options={buildOptions(settings, readOnly, canFormat)}
        onMount={onMount}
        onChange={(v) => {
          if (!readOnly) onChange?.(v ?? "");
        }}
      />
    </div>
  );
};

function buildOptions(
  settings: EditorSettings,
  readOnly: boolean,
  canFormat: boolean,
): MonacoEditor.IStandaloneEditorConstructionOptions {
  return {
    fontSize: settings.fontSize,
    fontFamily: 'var(--font-mono), "Fira Code", ui-monospace, monospace',
    fontLigatures: true,
    tabSize: settings.tabSize,
    insertSpaces: true,
    detectIndentation: false,
    wordWrap: settings.wordWrap,
    lineNumbers: settings.lineNumbers ? "on" : "off",
    minimap: {
      enabled: settings.minimap,
      size: "proportional",
      showSlider: "mouseover",
      renderCharacters: true,
    },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    readOnly,
    domReadOnly: readOnly,
    autoClosingBrackets: settings.autoCloseBrackets ? "languageDefined" : "never",
    autoClosingQuotes: settings.autoCloseBrackets ? "languageDefined" : "never",
    // Real format-on-type only when a formatter exists for the language
    formatOnType: settings.formatOnType && canFormat,
    formatOnPaste: settings.formatOnType && canFormat,
    renderLineHighlight: "line",
    padding: { top: 12, bottom: 12 },
    smoothScrolling: true,
    cursorBlinking: "smooth",
    bracketPairColorization: { enabled: true },
    suggestOnTriggerCharacters: true,
    quickSuggestions: !readOnly,
    contextmenu: true,
    // Shift+Alt+F is Monaco's default for Format Document
  };
}

export default MonacoCodeEditor;
