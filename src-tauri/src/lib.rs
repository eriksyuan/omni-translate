mod commands;
mod i18n;
mod platform;
mod providers;
mod tray;

use tauri::{Manager, Window, WindowEvent};

fn hide_window_on_close_request(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_platform,
            commands::get_locale,
            commands::set_locale,
            commands::show_window,
            commands::hide_window,
            commands::toggle_window,
            commands::quit_app,
        ])
        .on_window_event(|window, event| hide_window_on_close_request(window, event))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let locale = i18n::resolve_locale(app.handle());
            i18n::init(app.handle(), locale);

            tray::setup_tray(app)?;

            for label in [
                "audio-config",
                "ocr-permission",
                "ocr-overlay",
                "subtitle",
                "preferences",
            ] {
                if let Some(window) = app.get_webview_window(label) {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running OmniTranslate");
}
