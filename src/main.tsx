import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeSync } from "@/app/ThemeSync";
import { WindowRoot } from "@/app/WindowRoot";
import { syncLocaleFromBackend } from "@/i18n";
import "@/i18n";
import "@/styles/global.css";

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
