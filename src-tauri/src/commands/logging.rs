use crate::logging::{self, LogEntry, LogLevel};

#[tauri::command]
pub fn get_recent_logs(limit: Option<usize>, min_level: Option<String>) -> Vec<LogEntry> {
    let min = min_level.and_then(|value| LogLevel::from_str(&value));
    logging::recent_logs(limit.unwrap_or(500).clamp(1, 3_000), min)
}

#[tauri::command]
pub fn get_log_file_path() -> Option<String> {
    logging::log_file_path().map(|path| path.display().to_string())
}

#[tauri::command]
pub fn clear_recent_logs() {
    logging::clear_buffer();
    logging::record(
        LogLevel::Info,
        "logging",
        "in-memory log buffer cleared",
    );
}
