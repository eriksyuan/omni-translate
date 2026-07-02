use crate::providers::types::CloudAsrEngine;
use thiserror::Error;

pub mod aliyun;
pub mod sherpa;
pub mod tencent;
#[cfg(feature = "whisper")]
pub mod whisper;

#[derive(Debug, Error)]
pub enum AsrError {
    #[error("unsupported ASR engine")]
    Unsupported,
    #[error("invalid API key format: {0}")]
    InvalidCredentials(String),
    #[error("ASR request failed: {0}")]
    Request(String),
    #[error("ASR returned empty result")]
    Empty,
}

pub trait AsrProvider: Send {
    fn transcribe_pcm16k(&self, pcm: &[i16]) -> Result<String, AsrError>;
}

pub fn build_asr(config: &crate::providers::types::AsrConfig) -> Result<Box<dyn AsrProvider>, AsrError> {
    match config {
        crate::providers::types::AsrConfig::Cloud { engine, api_key } => match engine {
            CloudAsrEngine::CloudAliyun => Ok(Box::new(aliyun::AliyunAsr::new(api_key)?)),
            CloudAsrEngine::CloudTencent => Ok(Box::new(tencent::TencentAsr::new(api_key)?)),
        },
        crate::providers::types::AsrConfig::Whisper { model_path, .. } => {
            #[cfg(feature = "whisper")]
            {
                Ok(Box::new(whisper::WhisperAsr::new(model_path)?))
            }
            #[cfg(not(feature = "whisper"))]
            {
                let _ = model_path;
                Err(AsrError::Request(
                    "Whisper support is not enabled in this build. Rebuild with --features whisper after installing cmake.".into(),
                ))
            }
        }
        crate::providers::types::AsrConfig::Sherpa { .. } => Err(AsrError::Request(
            "Sherpa ASR requires a streaming session; use SherpaSidecarSession instead of build_asr".into(),
        )),
    }
}

/// Generate ~0.5s of silence for connection tests.
pub fn test_pcm_chunk() -> Vec<i16> {
    vec![0_i16; 8_000]
}
