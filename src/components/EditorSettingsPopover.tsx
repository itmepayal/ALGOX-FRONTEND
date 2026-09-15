import {
  useEffect,
  useRef,
  useState,
  type FC,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Minus, Plus, Settings } from "lucide-react";
import { cn } from "../lib/cn";
import type {
  EditorSettingKey,
  EditorSettings,
  EditorTheme,
  TabSizeOption,
  WordWrapMode,
} from "../utils/editorSettings";

interface EditorSettingsPopoverProps {
  settings: EditorSettings;
  setEditorSetting: <K extends EditorSettingKey>(
    key: K,
    value: EditorSettings[K],
  ) => void;
  bumpFontSize: (delta: number) => void;
  fontSizeMin: number;
  fontSizeMax: number;
  className?: string;
}

function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="lc-es-row">
      <div className="lc-es-row-text">
        <span className="lc-es-label">{label}</span>
        {hint ? <span className="lc-es-hint">{hint}</span> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn("lc-es-switch", checked && "is-on")}
        onClick={() => onChange(!checked)}
      >
        <span className="lc-es-switch-knob" />
        <span className="lc-es-switch-text">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

/**
 * Anchored editor-settings popover for the workspace Settings gear.
 * Editor is a textarea — options map to CSS / keyboard helpers, not Monaco.
 */
export const EditorSettingsPopover: FC<EditorSettingsPopoverProps> = ({
  settings,
  setEditorSetting,
  bumpFontSize,
  fontSizeMin,
  fontSizeMax,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onToggle = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div
      className={cn("lc-editor-settings", open && "is-open", className)}
      ref={rootRef}
    >
      <button
        type="button"
        className={cn("lc-icon-btn", open && "is-active")}
        aria-label="Editor settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-tooltip={open ? undefined : "Settings"}
        onClick={onToggle}
      >
        <Settings size={15} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          className="lc-es-popover"
          role="dialog"
          aria-label="Editor Settings"
        >
          <header className="lc-es-header">Editor Settings</header>

          <div className="lc-es-body">
            <div className="lc-es-field">
              <label className="lc-es-label" htmlFor="lc-es-theme">
                Theme
              </label>
              <select
                id="lc-es-theme"
                className="lc-es-select"
                value={settings.theme}
                onChange={(e) =>
                  setEditorSetting("theme", e.target.value as EditorTheme)
                }
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="high-contrast">High Contrast</option>
              </select>
            </div>

            <div className="lc-es-field">
              <span className="lc-es-label">Font Size</span>
              <div className="lc-es-stepper">
                <button
                  type="button"
                  className="lc-es-step-btn"
                  aria-label="Decrease font size"
                  disabled={settings.fontSize <= fontSizeMin}
                  onClick={() => bumpFontSize(-1)}
                >
                  <Minus size={14} strokeWidth={2} />
                </button>
                <span className="lc-es-step-value font-technical">
                  {settings.fontSize}
                </span>
                <button
                  type="button"
                  className="lc-es-step-btn"
                  aria-label="Increase font size"
                  disabled={settings.fontSize >= fontSizeMax}
                  onClick={() => bumpFontSize(1)}
                >
                  <Plus size={14} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="lc-es-field">
              <span className="lc-es-label">Tab Size</span>
              <div className="lc-es-seg">
                {([2, 4, 8] as TabSizeOption[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={cn(
                      "lc-es-seg-btn font-technical",
                      settings.tabSize === size && "is-active",
                    )}
                    aria-pressed={settings.tabSize === size}
                    onClick={() => setEditorSetting("tabSize", size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <ToggleRow
              label="Word Wrap"
              checked={settings.wordWrap === "on"}
              onChange={(on) =>
                setEditorSetting("wordWrap", (on ? "on" : "off") as WordWrapMode)
              }
            />

            <ToggleRow
              label="Minimap"
              checked={settings.minimap}
              onChange={(on) => setEditorSetting("minimap", on)}
              hint="Monaco scroll-synced map"
            />

            <ToggleRow
              label="Line Numbers"
              checked={settings.lineNumbers}
              onChange={(on) => setEditorSetting("lineNumbers", on)}
            />

            <ToggleRow
              label="Auto Close Brackets"
              checked={settings.autoCloseBrackets}
              onChange={(on) => setEditorSetting("autoCloseBrackets", on)}
            />

            <ToggleRow
              label="Format On Type"
              checked={settings.formatOnType}
              onChange={(on) => setEditorSetting("formatOnType", on)}
              hint="Prettier for JS/TS · Shift+Alt+F formats document"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorSettingsPopover;
