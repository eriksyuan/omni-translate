use std::fs::{self, File, OpenOptions};
use std::io::{copy, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use bzip2::read::BzDecoder;
use reqwest::header::RANGE;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use tar::Archive;
use thiserror::Error;

pub const EVENT_MODEL_PROGRESS: &str = "model://progress";

const PROGRESS_EMIT_INTERVAL_MS: u128 = 200;

#[derive(Debug, Error)]
pub enum ModelError {
    #[error("unknown model: {0}")]
    UnknownModel(String),
    #[error("model not installed: {0}")]
    NotInstalled(String),
    #[error("download already in progress for {0}")]
    DownloadInProgress(String),
    #[error("no active download for {0}")]
    NoActiveDownload(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("checksum mismatch for {0}")]
    Checksum(String),
    #[error("extract failed: {0}")]
    Extract(String),
    #[error("network error: {0}")]
    Network(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadPhase {
    Idle,
    Downloading,
    Paused,
    Verifying,
    Extracting,
    Installed,
    Error,
}

impl DownloadPhase {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::Downloading => "downloading",
            Self::Paused => "paused",
            Self::Verifying => "verifying",
            Self::Extracting => "extracting",
            Self::Installed => "installed",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
struct SherpaManifest {
    version: u32,
    models: std::collections::HashMap<String, SherpaModelEntry>,
}

#[derive(Debug, Clone, Deserialize)]
struct SherpaModelEntry {
    version: String,
    #[serde(rename = "sizeBytes")]
    size_bytes: u64,
    url: String,
    sha256: String,
    #[serde(rename = "archiveRoot")]
    archive_root: String,
    files: SherpaModelFiles,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SherpaModelFileNames {
    pub tokens: String,
    pub encoder: String,
    pub decoder: String,
    pub joiner: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct SherpaModelFiles {
    tokens: String,
    encoder: String,
    decoder: String,
    joiner: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SherpaModelStatus {
    pub model_id: String,
    pub installed: bool,
    pub version: Option<String>,
    pub size_bytes: u64,
    pub phase: String,
    pub downloaded_bytes: u64,
    pub resumable: bool,
    /// Deprecated: kept for compatibility; use phase + downloaded_bytes.
    pub downloading: bool,
    pub download_progress: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProgressPayload {
    pub model_id: String,
    pub downloaded: u64,
    pub total: u64,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadMeta {
    downloaded: u64,
    total: u64,
    phase: DownloadPhase,
    updated_at: u64,
}

struct ActiveDownload {
    phase: DownloadPhase,
    downloaded: u64,
    total: u64,
    cancel: Arc<AtomicBool>,
}

static ACTIVE_DOWNLOADS: OnceLock<Mutex<std::collections::HashMap<String, ActiveDownload>>> =
    OnceLock::new();

fn active_downloads() -> &'static Mutex<std::collections::HashMap<String, ActiveDownload>> {
    ACTIVE_DOWNLOADS.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

fn manifest() -> Result<SherpaManifest, ModelError> {
    let raw = include_str!("../../resources/models/sherpa-manifest.json");
    serde_json::from_str(raw).map_err(|e| ModelError::Io(e.to_string()))
}

pub fn all_model_ids() -> Vec<String> {
    manifest()
        .map(|m| m.models.keys().cloned().collect())
        .unwrap_or_default()
}

fn entry(model_id: &str) -> Result<SherpaModelEntry, ModelError> {
    manifest()?
        .models
        .get(model_id)
        .cloned()
        .ok_or_else(|| ModelError::UnknownModel(model_id.into()))
}

pub fn models_dir(app: &AppHandle) -> Result<PathBuf, ModelError> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("models").join("sherpa"))
        .map_err(|e| ModelError::Io(e.to_string()))
}

fn model_base_dir(app: &AppHandle, model_id: &str) -> Result<PathBuf, ModelError> {
    Ok(models_dir(app)?.join(model_id))
}

fn model_install_dir(app: &AppHandle, model_id: &str) -> Result<PathBuf, ModelError> {
    let entry = entry(model_id)?;
    Ok(model_base_dir(app, model_id)?.join(&entry.version))
}

fn partial_archive_path(app: &AppHandle, model_id: &str) -> Result<PathBuf, ModelError> {
    Ok(model_base_dir(app, model_id)?.join(format!("{model_id}.tar.bz2.partial")))
}

fn download_meta_path(app: &AppHandle, model_id: &str) -> Result<PathBuf, ModelError> {
    Ok(model_base_dir(app, model_id)?.join("download.meta.json"))
}

fn installed_manifest_path(dir: &Path) -> PathBuf {
    dir.join("manifest.json")
}

#[derive(Debug, Serialize, Deserialize)]
struct InstalledManifest {
    model_id: String,
    version: String,
    files: SherpaModelFiles,
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn read_download_meta(app: &AppHandle, model_id: &str) -> Option<DownloadMeta> {
    let path = download_meta_path(app, model_id).ok()?;
    if !path.exists() {
        return None;
    }
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_download_meta(
    app: &AppHandle,
    model_id: &str,
    downloaded: u64,
    total: u64,
    phase: DownloadPhase,
) -> Result<(), ModelError> {
    let base = model_base_dir(app, model_id)?;
    fs::create_dir_all(&base).map_err(|e| ModelError::Io(e.to_string()))?;
    let meta = DownloadMeta {
        downloaded,
        total,
        phase,
        updated_at: now_unix_ms(),
    };
    fs::write(
        download_meta_path(app, model_id)?,
        serde_json::to_string_pretty(&meta).map_err(|e| ModelError::Io(e.to_string()))?,
    )
    .map_err(|e| ModelError::Io(e.to_string()))
}

fn clear_download_meta(app: &AppHandle, model_id: &str) {
    if let Ok(path) = download_meta_path(app, model_id) {
        let _ = fs::remove_file(path);
    }
}

fn partial_bytes(app: &AppHandle, model_id: &str) -> u64 {
    partial_archive_path(app, model_id)
        .ok()
        .filter(|p| p.exists())
        .and_then(|p| p.metadata().ok())
        .map(|m| m.len())
        .unwrap_or(0)
}

pub fn is_model_installed(app: &AppHandle, model_id: &str) -> Result<bool, ModelError> {
    let _ = try_repair_installation(app, model_id);
    let dir = model_install_dir(app, model_id)?;
    let meta_path = installed_manifest_path(&dir);
    if !meta_path.exists() {
        return Ok(false);
    }
    let entry = entry(model_id)?;
    let meta: InstalledManifest = serde_json::from_str(
        &fs::read_to_string(&meta_path).map_err(|e| ModelError::Io(e.to_string()))?,
    )
    .map_err(|e| ModelError::Io(e.to_string()))?;

    for name in [
        &entry.files.tokens,
        &entry.files.encoder,
        &entry.files.decoder,
        &entry.files.joiner,
    ] {
        if !dir.join(name).exists() {
            return Ok(false);
        }
    }

    Ok(meta.model_id == model_id && meta.version == entry.version)
}

fn build_status(app: &AppHandle, model_id: &str) -> Result<SherpaModelStatus, ModelError> {
    let _ = try_repair_installation(app, model_id);
    let entry = entry(model_id)?;
    let installed = is_model_installed(app, model_id)?;
    let total = entry.size_bytes;

    if installed {
        return Ok(SherpaModelStatus {
            model_id: model_id.into(),
            installed: true,
            version: Some(entry.version),
            size_bytes: total,
            phase: DownloadPhase::Installed.as_str().into(),
            downloaded_bytes: total,
            resumable: false,
            downloading: false,
            download_progress: Some(1.0),
        });
    }

    if let Ok(guard) = active_downloads().lock() {
        if let Some(active) = guard.get(model_id) {
            let progress = if active.total > 0 {
                Some(active.downloaded as f64 / active.total as f64)
            } else {
                None
            };
            return Ok(SherpaModelStatus {
                model_id: model_id.into(),
                installed: false,
                version: None,
                size_bytes: total,
                phase: active.phase.as_str().into(),
                downloaded_bytes: active.downloaded,
                resumable: active.phase == DownloadPhase::Paused,
                downloading: active.phase == DownloadPhase::Downloading,
                download_progress: progress,
            });
        }
    }

    let partial = partial_bytes(app, model_id);
    if let Some(meta) = read_download_meta(app, model_id) {
        let downloaded = partial.max(meta.downloaded);
        let progress = if meta.total > 0 {
            Some(downloaded as f64 / meta.total as f64)
        } else {
            None
        };
        let resumable = partial > 0
            && matches!(
                meta.phase,
                DownloadPhase::Paused | DownloadPhase::Error | DownloadPhase::Idle
            );
        return Ok(SherpaModelStatus {
            model_id: model_id.into(),
            installed: false,
            version: None,
            size_bytes: total,
            phase: meta.phase.as_str().into(),
            downloaded_bytes: downloaded,
            resumable,
            downloading: false,
            download_progress: progress,
        });
    }

    let resumable = partial > 0;
    let phase = if resumable {
        DownloadPhase::Paused
    } else {
        DownloadPhase::Idle
    };
    let progress = if total > 0 && partial > 0 {
        Some(partial as f64 / total as f64)
    } else {
        None
    };

    Ok(SherpaModelStatus {
        model_id: model_id.into(),
        installed: false,
        version: None,
        size_bytes: total,
        phase: phase.as_str().into(),
        downloaded_bytes: partial,
        resumable,
        downloading: false,
        download_progress: progress,
    })
}

pub fn get_model_status(app: &AppHandle, model_id: &str) -> Result<SherpaModelStatus, ModelError> {
    build_status(app, model_id)
}

pub fn list_model_statuses(app: &AppHandle) -> Result<Vec<SherpaModelStatus>, ModelError> {
    all_model_ids()
        .into_iter()
        .map(|id| build_status(app, &id))
        .collect()
}

pub fn get_model_folder(app: &AppHandle, model_id: &str) -> Result<PathBuf, ModelError> {
    if is_model_installed(app, model_id)? {
        return model_install_dir(app, model_id);
    }
    model_base_dir(app, model_id)
}

fn emit_progress(app: &AppHandle, model_id: &str, downloaded: u64, total: u64, status: &str) {
    let _ = app.emit(
        EVENT_MODEL_PROGRESS,
        ModelProgressPayload {
            model_id: model_id.into(),
            downloaded,
            total,
            status: status.into(),
        },
    );
}

fn register_active(
    model_id: &str,
    phase: DownloadPhase,
    downloaded: u64,
    total: u64,
    cancel: Arc<AtomicBool>,
) {
    if let Ok(mut guard) = active_downloads().lock() {
        guard.insert(
            model_id.into(),
            ActiveDownload {
                phase,
                downloaded,
                total,
                cancel,
            },
        );
    }
}

fn update_active(model_id: &str, phase: DownloadPhase, downloaded: u64, total: u64) {
    if let Ok(mut guard) = active_downloads().lock() {
        if let Some(active) = guard.get_mut(model_id) {
            active.phase = phase;
            active.downloaded = downloaded;
            active.total = total;
        }
    }
}

fn clear_active(model_id: &str) {
    if let Ok(mut guard) = active_downloads().lock() {
        guard.remove(model_id);
    }
}

fn is_downloading(model_id: &str) -> bool {
    active_downloads()
        .lock()
        .ok()
        .and_then(|guard| guard.get(model_id).map(|a| a.phase == DownloadPhase::Downloading))
        .unwrap_or(false)
}

pub fn pause_download(_app: &AppHandle, model_id: &str) -> Result<(), ModelError> {
    let cancel = {
        let guard = active_downloads().lock().map_err(|_| ModelError::Io("lock".into()))?;
        let active = guard
            .get(model_id)
            .ok_or_else(|| ModelError::NoActiveDownload(model_id.into()))?;
        if active.phase != DownloadPhase::Downloading {
            return Err(ModelError::NoActiveDownload(model_id.into()));
        }
        active.cancel.clone()
    };
    cancel.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn ensure_model(app: &AppHandle, model_id: &str) -> Result<PathBuf, ModelError> {
    if is_model_installed(app, model_id)? {
        return model_install_dir(app, model_id);
    }
    download_model(app.clone(), model_id.to_string())?;
    model_install_dir(app, model_id)
}

pub fn download_model(app: AppHandle, model_id: String) -> Result<(), ModelError> {
    run_download(app, model_id, false)
}

pub fn resume_download(app: AppHandle, model_id: String) -> Result<(), ModelError> {
    run_download(app, model_id, true)
}

fn run_download(app: AppHandle, model_id: String, force_resume: bool) -> Result<(), ModelError> {
    if is_model_installed(&app, &model_id)? {
        return Ok(());
    }

    if is_downloading(&model_id) {
        return Err(ModelError::DownloadInProgress(model_id));
    }

    let entry = entry(&model_id)?;
    let total = entry.size_bytes;
    let partial_path = partial_archive_path(&app, &model_id)?;
    let install_dir = model_install_dir(&app, &model_id)?;
    let mut existing_bytes = partial_bytes(&app, &model_id);
    let resume = force_resume || (existing_bytes > 0 && read_download_meta(&app, &model_id).is_some());

    // Only discard partial when it is clearly oversized (corrupt).
    if resume && existing_bytes > total.saturating_add(4096) {
        let _ = fs::remove_file(&partial_path);
        clear_download_meta(&app, &model_id);
        existing_bytes = 0;
    }

    fs::create_dir_all(model_base_dir(&app, &model_id)?).map_err(|e| ModelError::Io(e.to_string()))?;

    let cancel = Arc::new(AtomicBool::new(false));

    // Archive already on disk — skip HTTP and verify/extract directly.
    if existing_bytes >= total.saturating_sub(4096) && partial_path.exists() {
        register_active(
            &model_id,
            DownloadPhase::Verifying,
            existing_bytes,
            total,
            Arc::clone(&cancel),
        );
        let result = install_from_partial(
            &app,
            &model_id,
            &entry,
            &partial_path,
            &install_dir,
            total,
        );
        clear_active(&model_id);
        return match result {
            Ok(()) => {
                clear_download_meta(&app, &model_id);
                if !is_model_installed(&app, &model_id)? {
                    return Err(ModelError::Extract(
                        "model files missing after install".into(),
                    ));
                }
                emit_progress(&app, &model_id, total, total, "complete");
                Ok(())
            }
            Err(err) => {
                let downloaded = partial_bytes(&app, &model_id);
                let _ = write_download_meta(&app, &model_id, downloaded, total, DownloadPhase::Error);
                emit_progress(
                    &app,
                    &model_id,
                    downloaded,
                    total,
                    &format!("error: {err}"),
                );
                Err(err)
            }
        };
    }

    let start_bytes = if resume { existing_bytes } else { 0 };

    register_active(
        &model_id,
        DownloadPhase::Downloading,
        start_bytes,
        total,
        Arc::clone(&cancel),
    );
    emit_progress(&app, &model_id, start_bytes, total, "starting");
    let _ = write_download_meta(&app, &model_id, start_bytes, total, DownloadPhase::Downloading);

    let result = download_and_install(
        &app,
        &model_id,
        &entry,
        &partial_path,
        &install_dir,
        total,
        start_bytes,
        resume,
        &cancel,
    );

    clear_active(&model_id);

    match result {
        Ok(()) => {
            clear_download_meta(&app, &model_id);
            if !is_model_installed(&app, &model_id)? {
                return Err(ModelError::Extract(
                    "model files missing after install".into(),
                ));
            }
            emit_progress(&app, &model_id, total, total, "complete");
            Ok(())
        }
        Err(ModelError::Network(msg)) if msg == "paused" => {
            let downloaded = partial_bytes(&app, &model_id);
            let _ = write_download_meta(&app, &model_id, downloaded, total, DownloadPhase::Paused);
            emit_progress(&app, &model_id, downloaded, total, "paused");
            Ok(())
        }
        Err(err) => {
            let downloaded = partial_bytes(&app, &model_id);
            let _ = write_download_meta(&app, &model_id, downloaded, total, DownloadPhase::Error);
            emit_progress(
                &app,
                &model_id,
                downloaded,
                total,
                &format!("error: {err}"),
            );
            Err(err)
        }
    }
}

fn install_from_partial(
    app: &AppHandle,
    model_id: &str,
    entry: &SherpaModelEntry,
    partial_path: &Path,
    install_dir: &Path,
    total: u64,
) -> Result<(), ModelError> {
    let downloaded = fs::metadata(partial_path)
        .map(|m| m.len())
        .map_err(|e| ModelError::Io(e.to_string()))?;

    update_active(model_id, DownloadPhase::Verifying, downloaded, total);
    emit_progress(app, model_id, downloaded, total, "verifying");
    let _ = write_download_meta(app, model_id, downloaded, total, DownloadPhase::Verifying);
    verify_sha256(partial_path, &entry.sha256)?;

    update_active(model_id, DownloadPhase::Extracting, downloaded, total);
    emit_progress(app, model_id, downloaded, total, "extracting");
    let _ = write_download_meta(app, model_id, downloaded, total, DownloadPhase::Extracting);

    if install_dir.exists() {
        fs::remove_dir_all(install_dir).map_err(|e| ModelError::Io(e.to_string()))?;
    }
    fs::create_dir_all(install_dir).map_err(|e| ModelError::Io(e.to_string()))?;
    extract_tar_bz2(partial_path, install_dir, &entry.archive_root)?;
    verify_installed_files(install_dir, &entry.files)?;
    write_installed_manifest(install_dir, model_id, entry)?;

    let _ = fs::remove_file(partial_path);
    Ok(())
}

fn download_and_install(
    app: &AppHandle,
    model_id: &str,
    entry: &SherpaModelEntry,
    partial_path: &Path,
    install_dir: &Path,
    total: u64,
    start_bytes: u64,
    resume: bool,
    cancel: &Arc<AtomicBool>,
) -> Result<(), ModelError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| ModelError::Network(e.to_string()))?;

    let mut request = client.get(&entry.url);
    if resume && start_bytes > 0 {
        request = request.header(RANGE, format!("bytes={start_bytes}-"));
    }

    let response = request
        .send()
        .map_err(|e| ModelError::Network(e.to_string()))?;

    let status = response.status();
    if status.as_u16() == 416 {
        let on_disk = fs::metadata(partial_path).map(|m| m.len()).unwrap_or(0);
        if on_disk >= total.saturating_sub(4096) {
            return install_from_partial(app, model_id, entry, partial_path, install_dir, total);
        }
        let _ = fs::remove_file(partial_path);
        return download_and_install(app, model_id, entry, partial_path, install_dir, total, 0, false, cancel);
    }

    if !status.is_success() {
        return Err(ModelError::Network(format!("HTTP {status}")));
    }

    let mut file = if resume && start_bytes > 0 {
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(partial_path)
            .map_err(|e| ModelError::Io(e.to_string()))?
    } else {
        File::create(partial_path).map_err(|e| ModelError::Io(e.to_string()))?
    };

    let mut downloaded = start_bytes;
    let mut reader = response;
    let mut buffer = [0_u8; 64 * 1024];
    let mut last_emit = Instant::now();

    update_active(model_id, DownloadPhase::Downloading, downloaded, total);
    emit_progress(app, model_id, downloaded, total, "downloading");

    loop {
        if cancel.load(Ordering::SeqCst) {
            file.flush().map_err(|e| ModelError::Io(e.to_string()))?;
            return Err(ModelError::Network("paused".into()));
        }

        let read = reader
            .read(&mut buffer)
            .map_err(|e| ModelError::Network(e.to_string()))?;
        if read == 0 {
            break;
        }

        file.write_all(&buffer[..read])
            .map_err(|e| ModelError::Io(e.to_string()))?;
        downloaded += read as u64;

        update_active(model_id, DownloadPhase::Downloading, downloaded, total);

        if last_emit.elapsed().as_millis() >= PROGRESS_EMIT_INTERVAL_MS || downloaded >= total {
            emit_progress(app, model_id, downloaded, total, "downloading");
            last_emit = Instant::now();
        }
    }
    drop(file);

    install_from_partial(app, model_id, entry, partial_path, install_dir, total)
}

pub fn delete_model(app: &AppHandle, model_id: &str) -> Result<(), ModelError> {
    if let Ok(guard) = active_downloads().lock() {
        if let Some(active) = guard.get(model_id) {
            active.cancel.store(true, Ordering::SeqCst);
        }
    }

    let dir = model_base_dir(app, model_id)?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| ModelError::Io(e.to_string()))?;
    }
    clear_active(model_id);
    Ok(())
}

fn verify_installed_files(dir: &Path, files: &SherpaModelFiles) -> Result<(), ModelError> {
    for name in [
        &files.tokens,
        &files.encoder,
        &files.decoder,
        &files.joiner,
    ] {
        if !dir.join(name).exists() {
            return Err(ModelError::Extract(format!("missing extracted file: {name}")));
        }
    }
    Ok(())
}

fn write_installed_manifest(
    install_dir: &Path,
    model_id: &str,
    entry: &SherpaModelEntry,
) -> Result<(), ModelError> {
    let installed = InstalledManifest {
        model_id: model_id.into(),
        version: entry.version.clone(),
        files: entry.files.clone(),
    };
    fs::write(
        installed_manifest_path(install_dir),
        serde_json::to_string_pretty(&installed).map_err(|e| ModelError::Io(e.to_string()))?,
    )
    .map_err(|e| ModelError::Io(e.to_string()))
}

/// If files were extracted but manifest write failed (e.g. wrong filenames in manifest),
/// finalize the install when the expected files are already on disk.
fn try_repair_installation(app: &AppHandle, model_id: &str) -> Result<(), ModelError> {
    let install_dir = model_install_dir(app, model_id)?;
    if installed_manifest_path(&install_dir).exists() {
        return Ok(());
    }
    let entry = entry(model_id)?;
    if verify_installed_files(&install_dir, &entry.files).is_err() {
        return Ok(());
    }

    write_installed_manifest(&install_dir, model_id, &entry)?;

    if let Ok(partial_path) = partial_archive_path(app, model_id) {
        let _ = fs::remove_file(partial_path);
    }
    clear_download_meta(app, model_id);
    Ok(())
}

fn verify_sha256(path: &Path, expected: &str) -> Result<(), ModelError> {
    let mut file = File::open(path).map_err(|e| ModelError::Io(e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|e| ModelError::Io(e.to_string()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let digest = hex::encode(hasher.finalize());
    if digest.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err(ModelError::Checksum(path.display().to_string()))
    }
}

fn extract_tar_bz2(archive: &Path, dest: &Path, root: &str) -> Result<(), ModelError> {
    let file = File::open(archive).map_err(|e| ModelError::Io(e.to_string()))?;
    let decoder = BzDecoder::new(file);
    let mut tar = Archive::new(decoder);

    for entry in tar.entries().map_err(|e| ModelError::Extract(e.to_string()))? {
        let mut entry = entry.map_err(|e| ModelError::Extract(e.to_string()))?;
        let path = entry.path().map_err(|e| ModelError::Extract(e.to_string()))?;
        let Some(stripped) = path.strip_prefix(root).ok() else {
            continue;
        };
        if stripped.as_os_str().is_empty() {
            continue;
        }
        let out = dest.join(stripped);
        if entry.header().entry_type().is_dir() {
            fs::create_dir_all(&out).map_err(|e| ModelError::Io(e.to_string()))?;
        } else {
            if let Some(parent) = out.parent() {
                fs::create_dir_all(parent).map_err(|e| ModelError::Io(e.to_string()))?;
            }
            let mut out_file = File::create(&out).map_err(|e| ModelError::Io(e.to_string()))?;
            copy(&mut entry, &mut out_file).map_err(|e| ModelError::Io(e.to_string()))?;
        }
    }

    Ok(())
}

pub fn model_file_paths(app: &AppHandle, model_id: &str) -> Result<SherpaModelFileNames, ModelError> {
    let dir = ensure_model(app, model_id)?;
    let meta: InstalledManifest = serde_json::from_str(
        &fs::read_to_string(installed_manifest_path(&dir))
            .map_err(|e| ModelError::Io(e.to_string()))?,
    )
    .map_err(|e| ModelError::Io(e.to_string()))?;
    Ok(SherpaModelFileNames {
        tokens: meta.files.tokens,
        encoder: meta.files.encoder,
        decoder: meta.files.decoder,
        joiner: meta.files.joiner,
    })
}

pub fn model_dir(app: &AppHandle, model_id: &str) -> Result<PathBuf, ModelError> {
    ensure_model(app, model_id)
}
