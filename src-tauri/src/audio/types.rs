use serde::{Deserialize, Serialize};

/// Preferred PCM format for downstream ASR pipelines (e.g. Whisper).
pub const TARGET_SAMPLE_RATE: u32 = 16_000;
pub const TARGET_CHANNELS: u16 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInputDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub is_blackhole: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioSourceKind {
    Blackhole,
    Mic,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioCaptureStatus {
    pub active: bool,
    pub source: Option<AudioSourceKind>,
    pub device_name: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub chunks_emitted: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioChunkPayload {
    pub sequence: u64,
    pub sample_rate: u32,
    pub channels: u16,
    /// Interleaved signed 16-bit PCM samples.
    pub samples: Vec<i16>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MicrophonePermission {
    Granted,
    Denied,
    Restricted,
    NotDetermined,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioEnvironmentStatus {
    pub microphone: MicrophonePermission,
    pub blackhole_installed: bool,
    pub input_devices: Vec<AudioInputDevice>,
}
