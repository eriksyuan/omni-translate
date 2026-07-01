#[macro_export]
macro_rules! log_trace {
    ($target:expr, $($arg:tt)*) => {{
        $crate::logging::record(
            $crate::logging::LogLevel::Trace,
            $target,
            &format!($($arg)*),
        );
    }};
}

#[macro_export]
macro_rules! log_debug {
    ($target:expr, $($arg:tt)*) => {{
        $crate::logging::record(
            $crate::logging::LogLevel::Debug,
            $target,
            &format!($($arg)*),
        );
    }};
}

#[macro_export]
macro_rules! log_info {
    ($target:expr, $($arg:tt)*) => {{
        $crate::logging::record(
            $crate::logging::LogLevel::Info,
            $target,
            &format!($($arg)*),
        );
    }};
}

#[macro_export]
macro_rules! log_warn {
    ($target:expr, $($arg:tt)*) => {{
        $crate::logging::record(
            $crate::logging::LogLevel::Warn,
            $target,
            &format!($($arg)*),
        );
    }};
}

#[macro_export]
macro_rules! log_error {
    ($target:expr, $($arg:tt)*) => {{
        $crate::logging::record(
            $crate::logging::LogLevel::Error,
            $target,
            &format!($($arg)*),
        );
    }};
}

pub use log_debug;
pub use log_error;
pub use log_info;
pub use log_trace;
pub use log_warn;
