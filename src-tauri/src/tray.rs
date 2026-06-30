use crate::commands;
use crate::i18n;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    App, AppHandle,
};

pub const TRAY_ID: &str = "main-tray";

pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let audio = MenuItem::with_id(
        app,
        "audio_config",
        &i18n::t("tray.audioConfig"),
        true,
        None::<&str>,
    )?;
    let ocr = MenuItem::with_id(
        app,
        "ocr_permission",
        &i18n::t("tray.ocrPermission"),
        true,
        None::<&str>,
    )?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let prefs = MenuItem::with_id(
        app,
        "preferences",
        &i18n::t("tray.preferences"),
        true,
        Some("Cmd+,"),
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(
        app,
        "quit",
        &i18n::t("tray.quit"),
        true,
        Some("Cmd+Q"),
    )?;

    Menu::with_items(
        app,
        &[&audio, &ocr, &sep1, &prefs, &sep2, &quit],
    )
}

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let icon = app
        .default_window_icon()
        .ok_or_else(|| tauri::Error::Io(std::io::Error::other("missing default window icon")))?
        .clone();

    let menu = build_menu(app.handle())?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip(i18n::t("tray.tooltip"))
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "audio_config" => {
                let _ = commands::show_window_internal(app, "audio-config");
            }
            "ocr_permission" => {
                let _ = commands::show_window_internal(app, "ocr-permission");
            }
            "preferences" => {
                let _ = commands::show_window_internal(app, "preferences");
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn refresh_menu(app: &AppHandle) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| format!("tray not found: {TRAY_ID}"))?;
    let menu = build_menu(app).map_err(|e| e.to_string())?;

    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(&i18n::t("tray.tooltip")))
        .map_err(|e| e.to_string())
}
