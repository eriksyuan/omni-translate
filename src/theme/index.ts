import { isTauri } from "@tauri-apps/api/core";
import { setTheme as setTauriTheme } from "@tauri-apps/api/app";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "omni-translate.theme";
export const THEME_CHANGE_EVENT = "omni-translate:theme-change";
export const DEFAULT_THEME: ThemePreference = "system";

export const SUPPORTED_THEMES: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];

function isThemePreference(value: string): value is ThemePreference {
  return SUPPORTED_THEMES.includes(value as ThemePreference);
}

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && isThemePreference(stored)) {
    return stored;
  }
  return DEFAULT_THEME;
}

export function resolveTheme(preference?: ThemePreference): ResolvedTheme {
  const pref = preference ?? getThemePreference();
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

export function applyTheme(preference?: ThemePreference) {
  document.documentElement.setAttribute(
    "data-theme",
    resolveTheme(preference),
  );
  void syncNativeTheme(preference);
}

async function syncNativeTheme(preference?: ThemePreference) {
  if (!isTauri()) {
    return;
  }

  const pref = preference ?? getThemePreference();
  await setTauriTheme(pref === "system" ? null : pref);
}

export function setThemePreference(preference: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyTheme(preference);
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: preference }),
  );
}
