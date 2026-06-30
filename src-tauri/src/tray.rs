use crate::commands;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    App,
};

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let icon = app
        .default_window_icon()
        .ok_or_else(|| tauri::Error::Io(std::io::Error::other("missing default window icon")))?
        .clone();

    let audio = MenuItem::with_id(app, "audio_config", "音频实时翻译…", true, None::<&str>)?;
    let ocr = MenuItem::with_id(
        app,
        "ocr_permission",
        "屏幕区域 OCR 翻译",
        true,
        None::<&str>,
    )?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let prefs = MenuItem::with_id(
        app,
        "preferences",
        "服务设置…",
        true,
        Some("Cmd+,"),
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(
        app,
        "quit",
        "退出 OmniTranslate",
        true,
        Some("Cmd+Q"),
    )?;
    let menu = Menu::with_items(
        app,
        &[&audio, &ocr, &sep1, &prefs, &sep2, &quit],
    )?;

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("OmniTranslate")
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
