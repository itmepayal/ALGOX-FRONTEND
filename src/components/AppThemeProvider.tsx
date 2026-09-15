import { applyAppTheme } from "../utils/monacoTheme";
import { loadEditorSettings } from "../utils/editorSettings";

/** Apply persisted theme before first paint to avoid a dark→light flash. */
export function bootstrapAppTheme(): void {
  try {
    applyAppTheme(loadEditorSettings().theme);
  } catch {
    // ignore
  }
}
