import { emit } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import type { PreferencesSection } from "@/lib/settings/types";
import { showWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";

export const PREFERENCES_NAVIGATE_EVENT = "preferences://navigate";
export const SETTINGS_VERIFIED_CHANGED_EVENT = "settings://verified-changed";

const PREFERENCES_SECTION_KEY = "omnitranslate:preferences:section";

export function readPendingPreferencesSection(): PreferencesSection | null {
  const value = localStorage.getItem(PREFERENCES_SECTION_KEY);
  if (value === "general" || value === "ocr" || value === "asr" || value === "mt") {
    return value;
  }
  return null;
}

export function clearPendingPreferencesSection() {
  localStorage.removeItem(PREFERENCES_SECTION_KEY);
}

export async function openPreferencesSection(section: PreferencesSection) {
  localStorage.setItem(PREFERENCES_SECTION_KEY, section);

  if (isTauri()) {
    await showWindow(WINDOW_LABELS.PREFERENCES);
    await emit(PREFERENCES_NAVIGATE_EVENT, { section });
    return;
  }

  window.dispatchEvent(new CustomEvent(PREFERENCES_NAVIGATE_EVENT, { detail: { section } }));
}

export async function notifyVerifiedProvidersChanged() {
  if (isTauri()) {
    await emit(SETTINGS_VERIFIED_CHANGED_EVENT, null);
    return;
  }
  window.dispatchEvent(new CustomEvent(SETTINGS_VERIFIED_CHANGED_EVENT));
}
