#[cfg(feature = "whisper")]
use super::{AsrError, AsrProvider};
#[cfg(feature = "whisper")]
use std::path::Path;
#[cfg(feature = "whisper")]
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

#[cfg(feature = "whisper")]
pub struct WhisperAsr {
    context: WhisperContext,
}

#[cfg(feature = "whisper")]
impl WhisperAsr {
    pub fn new(model_path: &str) -> Result<Self, AsrError> {
        if model_path.trim().is_empty() {
            return Err(AsrError::InvalidCredentials(
                "whisper model path is empty".into(),
            ));
        }
        if !Path::new(model_path).exists() {
            return Err(AsrError::InvalidCredentials(format!(
                "whisper model not found: {model_path}"
            )));
        }

        let params = WhisperContextParameters::default();
        let context = WhisperContext::new_with_params(model_path, params)
            .map_err(|e| AsrError::Request(format!("whisper init: {e}")))?;

        Ok(Self { context })
    }
}

#[cfg(feature = "whisper")]
impl AsrProvider for WhisperAsr {
    fn transcribe_pcm16k(&self, pcm: &[i16]) -> Result<String, AsrError> {
        if pcm.is_empty() {
            return Err(AsrError::Empty);
        }

        let mut state = self
            .context
            .create_state()
            .map_err(|e| AsrError::Request(format!("whisper state: {e}")))?;

        let samples: Vec<f32> = pcm.iter().map(|&s| s as f32 / i16::MAX as f32).collect();

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_n_threads(4);
        params.set_language(Some("auto"));
        params.set_translate(false);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        state
            .full(params, &samples)
            .map_err(|e| AsrError::Request(format!("whisper infer: {e}")))?;

        let n = state.full_n_segments();
        let mut text = String::new();
        for i in 0..n {
            if let Ok(segment) = state.full_get_segment_text(i) {
                text.push_str(segment.trim());
                text.push(' ');
            }
        }

        let text = text.trim().to_string();
        if text.is_empty() {
            return Err(AsrError::Empty);
        }
        Ok(text)
    }
}
