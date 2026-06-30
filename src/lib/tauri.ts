import { invoke } from "@tauri-apps/api/core";
import type { Locale } from "@/i18n";

export interface AppInfo {
  name: string;
  version: string;
  identifier: string;
}

export function getAppInfo() {
  return invoke<AppInfo>("get_app_info");
}

export function getPlatform() {
  return invoke<string>("get_platform");
}

export function getLocale() {
  return invoke<Locale>("get_locale");
}

export function setLocale(locale: Locale) {
  return invoke<void>("set_locale", { locale });
}

export function showWindow(label: string) {
  return invoke<void>("show_window", { label });
}

export function hideWindow(label: string) {
  return invoke<void>("hide_window", { label });
}

export function toggleWindow(label: string) {
  return invoke<boolean>("toggle_window", { label });
}

export function quitApp() {
  return invoke<void>("quit_app");
}
