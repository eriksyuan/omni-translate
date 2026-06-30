import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeSync } from "@/app/ThemeSync";
import { WindowRoot } from "@/app/WindowRoot";
import { syncLocaleFromBackend } from "@/i18n";
import { applyTheme } from "@/theme";
import "@/i18n";

applyTheme();
import "virtual:uno.css";
import "@/styles/global.css";
import "virtual:uno.css";

async function bootstrap() {
  await syncLocaleFromBackend();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeSync />
      <WindowRoot />
    </StrictMode>,
  );
}

void bootstrap();
