import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tailwind.css";
import "./index.css";
import "./styles/globals.css";
import "./styles/platform.css";
import "./styles/striver-sheet.css";
import "./styles/workspace-premium.css";
import "./styles/typography.css";
import App from "./App.tsx";
import { EditorSettingsProvider } from "./hooks/useEditorSettings";
import { bootstrapAppTheme } from "./components/AppThemeProvider";

bootstrapAppTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EditorSettingsProvider>
      <App />
    </EditorSettingsProvider>
  </StrictMode>,
);
