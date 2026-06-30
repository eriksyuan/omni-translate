use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AsrConfig {
    Cloud {
        engine: CloudAsrEngine,
        #[serde(rename = "apiKey")]
        api_key: String,
    },
    Whisper {
        model: String,
        #[serde(rename = "modelPath")]
        model_path: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CloudAsrEngine {
    CloudAliyun,
    CloudTencent,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MtConfig {
    Traditional {
        provider: TraditionalMtProvider,
        #[serde(rename = "apiKey")]
        api_key: String,
    },
    Llm {
        #[serde(rename = "baseUrl")]
        base_url: String,
        #[serde(rename = "apiKey")]
        api_key: String,
        model: String,
        prompt: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TraditionalMtProvider {
    Google,
    Deepl,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleUpdatePayload {
    pub original: String,
    pub translation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineErrorPayload {
    pub code: String,
    pub message: String,
}

pub const EVENT_SUBTITLE_UPDATE: &str = "subtitle://update";
pub const EVENT_PIPELINE_ERROR: &str = "pipeline://error";
pub const EVENT_PIPELINE_STATE: &str = "pipeline://state";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStatePayload {
    pub asr_pending: bool,
    pub mt_pending: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "provider", rename_all = "camelCase")]
pub enum SpeechTranslateConfig {
    TencentRealtime {
        #[serde(rename = "appId")]
        app_id: String,
        #[serde(rename = "secretId")]
        secret_id: String,
        #[serde(rename = "secretKey")]
        secret_key: String,
        source: String,
        target: String,
        #[serde(rename = "transModel")]
        trans_model: String,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum AudioSessionConfig {
    #[serde(rename_all = "camelCase")]
    Modular {
        asr_config: AsrConfig,
        mt_config: MtConfig,
    },
    #[serde(rename_all = "camelCase")]
    Integrated {
        speech_config: SpeechTranslateConfig,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_integrated_session_config_from_camel_case() {
        let json = r#"{
            "mode": "integrated",
            "speechConfig": {
                "provider": "tencentRealtime",
                "appId": "1259220000",
                "secretId": "AKIDxxx",
                "secretKey": "secret",
                "source": "en",
                "target": "zh",
                "transModel": "hunyuan-translation-lite"
            }
        }"#;

        let config: AudioSessionConfig = serde_json::from_str(json).expect("deserialize integrated");
        match config {
            AudioSessionConfig::Integrated { speech_config } => match speech_config {
                SpeechTranslateConfig::TencentRealtime { app_id, .. } => {
                    assert_eq!(app_id, "1259220000");
                }
            },
            AudioSessionConfig::Modular { .. } => panic!("expected integrated"),
        }
    }
}
