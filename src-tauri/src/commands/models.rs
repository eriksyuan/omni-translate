use tauri::AppHandle;

use crate::assets::{
    delete_model, download_model, get_model_folder, get_model_status, list_model_statuses,
    pause_download, resume_download, SherpaModelStatus,
};

#[tauri::command]
pub fn get_sherpa_model_status(
    app: AppHandle,
    model_id: String,
) -> Result<SherpaModelStatus, String> {
    get_model_status(&app, &model_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_sherpa_model_statuses(app: AppHandle) -> Result<Vec<SherpaModelStatus>, String> {
    list_model_statuses(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sherpa_model_folder(app: AppHandle, model_id: String) -> Result<String, String> {
    get_model_folder(&app, &model_id)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_sherpa_model(app: AppHandle, model_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || download_model(app, model_id))
        .await
        .map_err(|e| format!("download task failed: {e}"))?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pause_sherpa_model_download(app: AppHandle, model_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || pause_download(&app, &model_id))
        .await
        .map_err(|e| format!("pause task failed: {e}"))?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resume_sherpa_model_download(app: AppHandle, model_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || resume_download(app, model_id))
        .await
        .map_err(|e| format!("resume task failed: {e}"))?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_sherpa_model(app: AppHandle, model_id: String) -> Result<(), String> {
    delete_model(&app, &model_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ensure_sherpa_model(app: AppHandle, model_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::assets::ensure_model(&app, &model_id).map(|_| ())
    })
    .await
    .map_err(|e| format!("ensure task failed: {e}"))?
    .map_err(|e| e.to_string())
}
