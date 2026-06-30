import { useEffect } from "react";
import {
  applyTheme,
  getThemePreference,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
} from "@/theme";

export function ThemeSync() {
  useEffect(() => {
    applyTheme();

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const onSystemChange = () => {
      if (getThemePreference() === "system") {
        applyTheme();
      }
    };

    const onPreferenceChange = () => applyTheme();

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        onPreferenceChange();
      }
    };

    media.addEventListener("change", onSystemChange);
    window.addEventListener(THEME_CHANGE_EVENT, onPreferenceChange);
    window.addEventListener("storage", onStorage);

    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onPreferenceChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
