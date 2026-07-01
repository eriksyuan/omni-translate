mod macros;

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;

pub use macros::{log_debug, log_error, log_info, log_trace, log_warn};

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn from_str(value: &str) -> Option<Self> {
        match value.to_lowercase().as_str() {
            "trace" => Some(Self::Trace),
            "debug" => Some(Self::Debug),
            "info" => Some(Self::Info),
            "warn" | "warning" => Some(Self::Warn),
            "error" => Some(Self::Error),
            _ => None,
        }
    }

    fn as_label(self) -> &'static str {
        match self {
            Self::Trace => "TRACE",
            Self::Debug => "DEBUG",
            Self::Info => "INFO",
            Self::Warn => "WARN",
            Self::Error => "ERROR",
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub target: String,
    pub message: String,
}

struct LoggerState {
    file: Mutex<File>,
    buffer: Mutex<Vec<LogEntry>>,
    path: PathBuf,
}

static LOGGER: OnceLock<LoggerState> = OnceLock::new();

const MAX_BUFFER: usize = 3_000;

pub fn init(app: &AppHandle) -> Result<PathBuf, String> {
    if LOGGER.get().is_some() {
        return log_file_path().ok_or_else(|| "logger path unavailable".into());
    }

    let log_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    let date = chrono::Local::now().format("%Y%m%d");
    let path = log_dir.join(format!("omnitranslate-{date}.log"));
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;

    LOGGER
        .set(LoggerState {
            file: Mutex::new(file),
            buffer: Mutex::new(Vec::with_capacity(256)),
            path: path.clone(),
        })
        .map_err(|_| "logger already initialized".to_string())?;

    record(
        LogLevel::Info,
        "logging",
        &format!("logging initialized: {}", path.display()),
    );
    Ok(path)
}

pub fn record(level: LogLevel, target: &str, message: &str) {
    let timestamp = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S%.3f")
        .to_string();
    let entry = LogEntry {
        timestamp: timestamp.clone(),
        level,
        target: target.to_string(),
        message: message.to_string(),
    };
    let line = format!(
        "[{}] {:5} {}: {}\n",
        timestamp,
        level.as_label(),
        target,
        message
    );

    if let Some(state) = LOGGER.get() {
        if let Ok(mut file) = state.file.lock() {
            let _ = file.write_all(line.as_bytes());
            let _ = file.flush();
        }
        if let Ok(mut buffer) = state.buffer.lock() {
            buffer.push(entry);
            let excess = buffer.len().saturating_sub(MAX_BUFFER);
            if excess > 0 {
                buffer.drain(0..excess);
            }
        }
    }

    #[cfg(debug_assertions)]
    if level >= LogLevel::Warn {
        eprint!("{line}");
    }
}

pub fn recent_logs(limit: usize, min_level: Option<LogLevel>) -> Vec<LogEntry> {
    let Some(state) = LOGGER.get() else {
        return Vec::new();
    };
    let Ok(buffer) = state.buffer.lock() else {
        return Vec::new();
    };

    let min = min_level.unwrap_or(LogLevel::Trace);
    let take = limit.max(1).min(MAX_BUFFER);
    buffer
        .iter()
        .rev()
        .filter(|entry| entry.level >= min)
        .take(take)
        .cloned()
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}

pub fn log_file_path() -> Option<PathBuf> {
    LOGGER.get().map(|state| state.path.clone())
}

pub fn clear_buffer() {
    if let Some(state) = LOGGER.get() {
        if let Ok(mut buffer) = state.buffer.lock() {
            buffer.clear();
        }
    }
}

pub fn preview(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let short: String = trimmed.chars().take(max_chars).collect();
    format!("{short}…")
}
