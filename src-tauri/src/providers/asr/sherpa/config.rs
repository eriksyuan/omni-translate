use std::path::PathBuf;

use tauri::{AppHandle, Manager};
use thiserror::Error;

use crate::assets::model_manager;

#[derive(Debug, Error)]
pub enum SherpaConfigError {
    #[error(transparent)]
    Model(#[from] crate::assets::model_manager::ModelError),
    #[error("sidecar binary not found")]
    SidecarNotFound,
    #[error("sidecar lib directory not found")]
    LibNotFound,
    #[error("{0}")]
    Other(String),
}

#[derive(Debug, Clone)]
pub struct ResolvedSherpaConfig {
    pub model_id: String,
    pub model_dir: PathBuf,
    pub tokens: PathBuf,
    pub encoder: PathBuf,
    pub decoder: PathBuf,
    pub joiner: PathBuf,
    pub sidecar_bin: PathBuf,
    pub lib_dir: PathBuf,
    pub port: u16,
}

pub fn resolve_sherpa_config(
    app: &AppHandle,
    model_id: &str,
) -> Result<ResolvedSherpaConfig, SherpaConfigError> {
    let model_dir = model_manager::ensure_model(app, model_id)?;
    let files = model_manager::model_file_paths(app, model_id)?;

    let sidecar_bin = resolve_sidecar_binary(app)?;
    let lib_dir = resolve_lib_dir(app)?;

    Ok(ResolvedSherpaConfig {
        model_id: model_id.into(),
        tokens: model_dir.join(&files.tokens),
        encoder: model_dir.join(&files.encoder),
        decoder: model_dir.join(&files.decoder),
        joiner: model_dir.join(&files.joiner),
        model_dir,
        sidecar_bin,
        lib_dir,
        port: pick_port()?,
    })
}

pub fn resolve_sherpa_config_for_test(
    app: &AppHandle,
    model_id: &str,
) -> Result<ResolvedSherpaConfig, SherpaConfigError> {
    if !model_manager::is_model_installed(app, model_id)? {
        return Err(SherpaConfigError::Other(format!(
            "model not installed: {model_id}"
        )));
    }
    resolve_sherpa_config(app, model_id)
}

fn pick_port() -> Result<u16, SherpaConfigError> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| SherpaConfigError::Other(e.to_string()))?;
    let port = listener
        .local_addr()
        .map_err(|e| SherpaConfigError::Other(e.to_string()))?
        .port();
    drop(listener);
    Ok(port)
}

fn resolve_sidecar_binary(app: &AppHandle) -> Result<PathBuf, SherpaConfigError> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            if let Ok(triple) = tauri::utils::platform::target_triple() {
                let bundled = dir.join(format!("sherpa-onnx-online-websocket-server-{triple}"));
                if bundled.exists() {
                    return Ok(bundled);
                }
            }
            let plain = dir.join("sherpa-onnx-online-websocket-server");
            if plain.exists() {
                return Ok(plain);
            }
        }
    }

    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("sherpa-onnx-online-websocket-server");
    if dev.exists() {
        return Ok(dev);
    }

    let _ = app;
    Err(SherpaConfigError::SidecarNotFound)
}

fn resolve_lib_dir(app: &AppHandle) -> Result<PathBuf, SherpaConfigError> {
    if let Ok(resource) = app.path().resource_dir() {
        let bundled = resource.join("sherpa-lib");
        if bundled.exists() {
            return Ok(bundled);
        }
    }

    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join("lib");
    if dev.exists() {
        return Ok(dev);
    }

    Err(SherpaConfigError::LibNotFound)
}
