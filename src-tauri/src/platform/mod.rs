pub mod audio;

#[cfg(target_os = "macos")]
pub fn current_platform() -> &'static str {
    "macos"
}

#[cfg(target_os = "windows")]
pub fn current_platform() -> &'static str {
    "windows"
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn current_platform() -> &'static str {
    "unknown"
}
