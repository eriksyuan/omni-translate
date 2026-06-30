mod tencent_languages;
mod tencent_ws;

pub use tencent_ws::{run_integrated_worker, test_speech_translate_connection, TencentSpeechTranslateSession};

use crate::providers::SpeechTranslateConfig;

pub fn build_session(config: &SpeechTranslateConfig) -> Result<TencentSpeechTranslateSession, String> {
    match config {
        SpeechTranslateConfig::TencentRealtime {
            app_id,
            secret_id,
            secret_key,
            source,
            target,
            trans_model,
            hotword_list,
            noise_threshold,
            domain,
        } => TencentSpeechTranslateSession::new(
            app_id,
            secret_id,
            secret_key,
            source,
            target,
            trans_model,
            hotword_list.as_deref(),
            *noise_threshold,
            *domain,
        ),
    }
}

pub fn test_connection(config: &SpeechTranslateConfig) -> Result<(), String> {
    test_speech_translate_connection(config)
}
