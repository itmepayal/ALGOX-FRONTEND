import { useMemo, type FC, type ReactNode } from "react";
import { Play, Save, Send } from "lucide-react";

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  return /Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS X/i.test(ua);
}

export function shortcutModLabel(): string {
  return isApplePlatform() ? "⌘" : "Ctrl";
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="lc-kbd">{children}</kbd>;
}

interface ShortcutItemProps {
  label: string;
  tooltip: string;
  icon: ReactNode;
  keys: string[];
}

function ShortcutItem({ label, tooltip, icon, keys }: ShortcutItemProps) {
  const ariaKeys = keys.join(" + ");
  return (
    <div className="lc-shortcut-item" title={tooltip}>
      <span className="lc-shortcut-action">
        <span className="lc-shortcut-icon" aria-hidden>
          {icon}
        </span>
        <span className="lc-shortcut-label">{label}</span>
      </span>
      <span className="lc-shortcut-keys" aria-label={`${label}: ${ariaKeys}`}>
        {keys.map((key) => (
          <Kbd key={`${label}-${key}`}>{key}</Kbd>
        ))}
      </span>
    </div>
  );
}

/** Compact editor footer showing platform-aware keyboard shortcuts (display only). */
export const EditorShortcutBar: FC = () => {
  const mod = useMemo(() => shortcutModLabel(), []);

  return (
    <div
      className="lc-shortcut-bar"
      role="group"
      aria-label="Keyboard shortcuts"
    >
      <ShortcutItem
        label="Run"
        tooltip="Run Code"
        icon={<Play size={11} strokeWidth={2} fill="currentColor" />}
        keys={[mod, "Enter"]}
      />
      <ShortcutItem
        label="Submit"
        tooltip="Submit Solution"
        icon={<Send size={11} strokeWidth={2} />}
        keys={[mod, "Shift", "Enter"]}
      />
      <ShortcutItem
        label="Save"
        tooltip="Save Code"
        icon={<Save size={11} strokeWidth={2} />}
        keys={[mod, "S"]}
      />
    </div>
  );
};
