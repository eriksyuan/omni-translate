pub mod audio;
pub mod logging;

use crate::platform;
use crate::{i18n, tray};
use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewWindow};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub identifier: String,
}

#[tauri::command]
pub fn get_app_info(app: AppHandle) -> AppInfo {
    let config = app.config();
    AppInfo {
        name: config
            .product_name
            .clone()
            .unwrap_or_else(|| "OmniTranslate".into()),
        version: config.version.clone().unwrap_or_else(|| "0.1.0".into()),
        identifier: config.identifier.clone(),
    }
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn get_platform() -> &'static str {
    platform::current_platform()
}

#[tauri::command]
pub fn get_locale() -> String {
    i18n::get_locale()
}

#[tauri::command]
pub fn set_locale(app: AppHandle, locale: String) -> Result<(), String> {
    i18n::set_locale(&app, &locale)?;
    tray::refresh_menu(&app)
}

pub(crate) fn show_window_internal(app: &AppHandle, label: &str) -> Result<(), String> {
    let window = window_by_label(app, label)?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_window(app: AppHandle, label: String) -> Result<(), String> {
    show_window_internal(&app, &label)
}

#[tauri::command]
pub fn hide_window(app: AppHandle, label: String) -> Result<(), String> {
    window_by_label(&app, &label)?
        .hide()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_window(app: AppHandle, label: String) -> Result<bool, String> {
    let window = window_by_label(&app, &label)?;
    let visible = window.is_visible().map_err(|e| e.to_string())?;
    if visible {
        window.hide().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

fn window_by_label(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("window not found: {label}"))
}
