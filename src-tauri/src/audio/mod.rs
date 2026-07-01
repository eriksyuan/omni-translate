mod buffer;
mod capture;
mod devices;
mod integrated_feeder;
mod pipeline;
mod session;
mod types;

pub use buffer::{normalized_rms, SILENCE_RMS_THRESHOLD};
pub use integrated_feeder::{IntegratedPcmFeeder, IntegratedPcmInput};

pub use capture::{
    emit_capture_error, emit_capture_state, AudioCaptureManager, AUDIO_CHUNK_EVENT,
    AUDIO_ERROR_EVENT, AUDIO_STATE_EVENT,
};
pub use devices::{blackhole_installed, list_input_devices};
pub use pipeline::{
    test_asr_connection, test_mt_connection, test_speech_translate_connection,
    AudioTranslationPipeline,
};
pub use session::AudioSessionManager;
pub use types::{
    AudioCaptureStatus, AudioChunkPayload, AudioEnvironmentStatus, AudioInputDevice,
    AudioSourceKind, MicrophonePermission, TARGET_CHANNELS, TARGET_SAMPLE_RATE,
};

pub use crate::providers::{
    AsrConfig, AudioSessionConfig, MtConfig, PipelineErrorPayload, PipelineStatePayload,
    SpeechTranslateConfig, SubtitleUpdatePayload, EVENT_PIPELINE_ERROR, EVENT_PIPELINE_STATE,
    EVENT_SUBTITLE_UPDATE,
};
