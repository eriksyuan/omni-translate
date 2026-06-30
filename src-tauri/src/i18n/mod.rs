use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistConfig {
    rust_filename: String,
    #[allow(dead_code)]
    web_storage_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct I18nMeta {
    default_locale: String,
    fallback_locale: String,
    supported_locales: Vec<String>,
    persist: PersistConfig,
}

static META: OnceLock<I18nMeta> = OnceLock::new();
static CURRENT_LOCALE: OnceLock<RwLock<String>> = OnceLock::new();
static MESSAGES: OnceLock<HashMap<String, Value>> = OnceLock::new();

fn meta() -> &'static I18nMeta {
    META.get_or_init(|| {
        serde_json::from_str(include_str!("../../resources/locales/meta.json"))
            .expect("invalid meta.json")
    })
}

fn messages() -> &'static HashMap<String, Value> {
    MESSAGES.get_or_init(|| {
        HashMap::from([
            (
                "zh-CN".into(),
                serde_json::from_str(include_str!("../../resources/locales/zh-CN.json"))
                    .expect("invalid zh-CN locale file"),
            ),
            (
                "en".into(),
                serde_json::from_str(include_str!("../../resources/locales/en.json"))
                    .expect("invalid en locale file"),
            ),
        ])
    })
}

pub fn is_supported(locale: &str) -> bool {
    meta().supported_locales.iter().any(|item| item == locale)
}

pub fn detect_system_locale() -> String {
    if let Ok(lang) = std::env::var("LANG") {
        if lang.starts_with("zh") {
            return "zh-CN".to_string();
        }
    }

    meta().fallback_locale.clone()
}

fn locale_file_name() -> &'static str {
    &meta().persist.rust_filename
}

fn load_stored_locale(app: &AppHandle) -> Option<String> {
    let path = app.path().app_config_dir().ok()?.join(locale_file_name());
    let stored = std::fs::read_to_string(path).ok()?;
    let locale = stored.trim().to_string();
    is_supported(&locale).then_some(locale)
}

fn save_locale(app: &AppHandle, locale: &str) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(locale_file_name()), locale).map_err(|e| e.to_string())
}

pub fn resolve_locale(app: &AppHandle) -> String {
    load_stored_locale(app).unwrap_or_else(detect_system_locale)
}

pub fn init(app: &AppHandle, locale: String) {
    let locale = if is_supported(&locale) {
        locale
    } else {
        meta().default_locale.clone()
    };

    CURRENT_LOCALE
        .get_or_init(|| RwLock::new(locale.clone()))
        .write()
        .expect("locale lock poisoned")
        .clone_from(&locale);

    let _ = save_locale(app, &locale);
}

pub fn get_locale() -> String {
    CURRENT_LOCALE
        .get()
        .and_then(|lock| lock.read().ok().map(|guard| guard.clone()))
        .unwrap_or_else(|| meta().default_locale.clone())
}

fn lookup_message(locale: &str, key: &str) -> Option<String> {
    let mut current = messages().get(locale)?;

    for part in key.split('.') {
        current = current.get(part)?;
    }

    current.as_str().map(str::to_string)
}

pub fn t(key: &str) -> String {
    let locale = get_locale();
    let fallback = &meta().fallback_locale;

    lookup_message(&locale, key)
        .or_else(|| lookup_message(fallback, key))
        .unwrap_or_else(|| key.to_string())
}

pub fn set_locale(app: &AppHandle, locale: &str) -> Result<(), String> {
    if !is_supported(locale) {
        return Err(format!("unsupported locale: {locale}"));
    }

    CURRENT_LOCALE
        .get_or_init(|| RwLock::new(locale.to_string()))
        .write()
        .map_err(|_| "locale lock poisoned".to_string())?
        .clone_from(&locale.to_string());

    save_locale(app, locale)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_meta_config() {
        assert!(meta().supported_locales.contains(&"zh-CN".to_string()));
        assert_eq!(meta().default_locale, "zh-CN");
    }

    #[test]
    fn loads_zh_cn_tray_messages() {
        assert_eq!(
            lookup_message("zh-CN", "tray.audioConfig"),
            Some("音频实时翻译…".to_string())
        );
    }

    #[test]
    fn loads_en_tray_messages() {
        assert_eq!(
            lookup_message("en", "tray.quit"),
            Some("Quit OmniTranslate".to_string())
        );
    }

    #[test]
    fn detects_zh_system_locale() {
        std::env::set_var("LANG", "zh_CN.UTF-8");
        assert_eq!(detect_system_locale(), "zh-CN");
    }
}
