import type { EditorTheme } from "./editorSettings";

/** Map app theme → Monaco built-in theme id */
export function toMonacoTheme(theme: EditorTheme): string {
  switch (theme) {
    case "light":
      return "vs";
    case "high-contrast":
      return "hc-black";
    case "dark":
    default:
      return "vs-dark";
  }
}

/** Map platform language id → Monaco language id */
export function toMonacoLanguage(language: string): string {
  switch (language) {
    case "javascript":
    case "js":
      return "javascript";
    case "typescript":
    case "ts":
      return "typescript";
    case "python":
    case "py":
      return "python";
    case "cpp":
    case "c++":
      return "cpp";
    case "c":
      return "c";
    case "java":
      return "java";
    default:
      return "plaintext";
  }
}

/**
 * Apply theme to the whole document via data-theme + .dark.
 * - index.css (product) uses data-theme / :root
 * - globals.css (Admin / shadcn tokens) uses :root (light) + .dark
 */
export function applyAppTheme(theme: EditorTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.removeAttribute("data-theme");
    root.classList.remove("theme-light");
    root.classList.add("dark");
  } else if (theme === "light") {
    root.setAttribute("data-theme", "light");
    root.classList.add("theme-light");
    root.classList.remove("dark");
  } else {
    root.setAttribute("data-theme", "high-contrast");
    root.classList.remove("theme-light");
    root.classList.add("dark");
  }
}

/** Languages with a real Prettier-backed / Monaco TS formatter. */
export function languageSupportsFormatting(language: string): boolean {
  const id = toMonacoLanguage(language);
  return id === "javascript" || id === "typescript" || id === "json";
}
