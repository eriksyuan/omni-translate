import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function ThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      root.setAttribute("data-theme", media.matches ? "dark" : "light");
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const window = getCurrentWindow();

    void window.onFocusChanged(({ payload: focused }) => {
      if (!focused && window.label === "tray-menu") {
        void window.hide();
      }
    });
  }, []);

  return null;
}
