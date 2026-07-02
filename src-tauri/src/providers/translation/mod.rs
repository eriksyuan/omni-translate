use crate::providers::types::TraditionalMtProvider;
use thiserror::Error;

pub mod deepl_free;
pub mod llm;
pub mod traditional;

#[derive(Debug, Error)]
pub enum MtError {
    #[error("unsupported MT provider")]
    Unsupported,
    #[error("invalid API key format: {0}")]
    InvalidCredentials(String),
    #[error("translation request failed: {0}")]
    Request(String),
    #[error("translation returned empty result")]
    Empty,
}

pub trait MtProvider: Send {
    fn translate(&self, text: &str) -> Result<String, MtError>;

    /// Unstable partial re-translation (throttled). Rate-limited providers should return false.
    fn supports_streaming_partial(&self) -> bool {
        true
    }
}

pub fn build_mt(config: &crate::providers::types::MtConfig) -> Result<Box<dyn MtProvider>, MtError> {
    match config {
        crate::providers::types::MtConfig::Llm {
            base_url,
            api_key,
            model,
            prompt,
        } => Ok(Box::new(llm::LlmMt::new(base_url, api_key, model, prompt)?)),
        crate::providers::types::MtConfig::Traditional { provider, api_key } => {
            Ok(Box::new(traditional::TraditionalMt::new(*provider, api_key)?))
        }
        crate::providers::types::MtConfig::Builtin => {
            Ok(Box::new(deepl_free::DeeplFreeMt::new()?))
        }
    }
}

pub fn build_translation_tokens(translation: &str) -> Option<String> {
    if translation.is_empty() {
        return None;
    }
    Some(translation.to_string())
}
