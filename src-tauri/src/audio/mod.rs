mod capture;
mod devices;
mod types;

pub use capture::{
    emit_capture_state, AudioCaptureManager, AUDIO_CHUNK_EVENT, AUDIO_ERROR_EVENT,
    AUDIO_STATE_EVENT,
};
pub use devices::{blackhole_installed, list_input_devices};
pub use types::{
    AudioCaptureStatus, AudioChunkPayload, AudioEnvironmentStatus, AudioInputDevice,
    AudioSourceKind, MicrophonePermission, TARGET_CHANNELS, TARGET_SAMPLE_RATE,
};
