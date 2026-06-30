import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeSync } from "@/app/ThemeSync";
import { WindowRoot } from "@/app/WindowRoot";
import "@/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeSync />
    <WindowRoot />
  </StrictMode>,
);
