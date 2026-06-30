use crate::audio::{
    blackhole_installed, list_input_devices, AudioCaptureManager, AudioCaptureStatus,
    AudioEnvironmentStatus, AudioSourceKind, MicrophonePermission,
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
) -> Result<AudioCaptureStatus, String> {
    let status = capture.start(app.clone(), source).map_err(|e| e.to_string())?;
    crate::audio::emit_capture_state(&app, &status);
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
