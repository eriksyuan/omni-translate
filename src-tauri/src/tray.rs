use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let icon = app
        .default_window_icon()
        .ok_or_else(|| tauri::Error::Io(std::io::Error::other("missing default window icon")))?
        .clone();

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("OmniTranslate")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(menu) = app.get_webview_window("tray-menu") {
                    let visible = menu.is_visible().unwrap_or(false);
                    if visible {
                        let _ = menu.hide();
                    } else {
                        let _ = menu.show();
                        let _ = menu.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
