import { invoke } from "@tauri-apps/api/core";

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
