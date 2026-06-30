use crate::audio::{
    blackhole_installed, list_input_devices, test_asr_connection, test_mt_connection,
    test_speech_translate_connection, AsrConfig, AudioCaptureManager, AudioCaptureStatus,
    AudioEnvironmentStatus, AudioSessionConfig, AudioSessionManager, AudioSourceKind,
    AudioTranslationPipeline, MicrophonePermission, MtConfig, SpeechTranslateConfig,
};
use crate::platform::audio as platform_audio;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn list_audio_input_devices() -> Result<Vec<crate::audio::AudioInputDevice>, String> {
    list_input_devices().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_audio_environment() -> Result<AudioEnvironmentStatus, String> {
    let input_devices = list_input_devices().map_err(|e| e.to_string())?;
    let blackhole_installed = blackhole_installed().map_err(|e| e.to_string())?;

    Ok(AudioEnvironmentStatus {
        microphone: platform_audio::microphone_permission_status(),
        blackhole_installed,
        input_devices,
    })
}

#[tauri::command]
pub fn get_microphone_permission() -> MicrophonePermission {
    platform_audio::microphone_permission_status()
}

#[tauri::command]
pub fn request_microphone_permission() -> Result<MicrophonePermission, String> {
    platform_audio::request_microphone_permission_sync()
}

#[tauri::command]
pub fn get_audio_capture_status(
    capture: State<'_, AudioCaptureManager>,
) -> AudioCaptureStatus {
    capture.status()
}

#[tauri::command]
pub fn start_audio_capture(
    app: AppHandle,
    capture: State<'_, AudioCaptureManager>,
    source: AudioSourceKind,
    device_id: Option<String>,
) -> Result<AudioCaptureStatus, String> {
    let status = capture
        .start(app.clone(), source, device_id, None)
        .map_err(|e| e.to_string())?;
    Ok(status)
}

#[tauri::command]
pub fn stop_audio_capture(
    app: AppHandle,
    capture: State<'_, AudioCaptureManager>,
) -> Result<AudioCaptureStatus, String> {
    let status = capture.stop().map_err(|e| e.to_string())?;
    crate::audio::emit_capture_state(&app, &status);
    Ok(status)
}

#[tauri::command]
pub fn start_audio_session(
    app: AppHandle,
    capture: State<'_, AudioCaptureManager>,
    pipeline: State<'_, AudioTranslationPipeline>,
    source: AudioSourceKind,
    device_id: Option<String>,
    session_config: AudioSessionConfig,
) -> Result<AudioCaptureStatus, String> {
    AudioSessionManager::start(
        &app,
        &capture,
        &pipeline,
        source,
        device_id,
        session_config,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_audio_session(
    app: AppHandle,
    capture: State<'_, AudioCaptureManager>,
    pipeline: State<'_, AudioTranslationPipeline>,
) -> Result<AudioCaptureStatus, String> {
    AudioSessionManager::stop(&app, &capture, &pipeline).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_asr_connection_cmd(asr_config: AsrConfig) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || test_asr_connection(&asr_config))
        .await
        .map_err(|e| format!("asr test task failed: {e}"))?
}

#[tauri::command]
pub async fn test_mt_connection_cmd(mt_config: MtConfig) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || test_mt_connection(&mt_config))
        .await
        .map_err(|e| format!("mt test task failed: {e}"))?
}

#[tauri::command]
pub async fn test_speech_translate_connection_cmd(
    speech_config: SpeechTranslateConfig,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || test_speech_translate_connection(&speech_config))
        .await
        .map_err(|e| format!("speech translate test task failed: {e}"))?
}
