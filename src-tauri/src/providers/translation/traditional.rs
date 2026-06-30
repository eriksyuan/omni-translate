use super::{MtError, MtProvider};
use crate::providers::types::TraditionalMtProvider;
use reqwest::blocking::Client;
use serde_json::json;

pub struct TraditionalMt {
    provider: TraditionalMtProvider,
    api_key: String,
    client: Client,
}

impl TraditionalMt {
    pub fn new(provider: TraditionalMtProvider, api_key: &str) -> Result<Self, MtError> {
        if api_key.trim().is_empty() {
            return Err(MtError::InvalidCredentials("API key is required".into()));
        }
        Ok(Self {
            provider,
            api_key: api_key.trim().to_string(),
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| MtError::Request(e.to_string()))?,
        })
    }
}

impl MtProvider for TraditionalMt {
    fn translate(&self, text: &str) -> Result<String, MtError> {
        if text.trim().is_empty() {
            return Err(MtError::Empty);
        }

        match self.provider {
            TraditionalMtProvider::Google => self.translate_google(text),
            TraditionalMtProvider::Deepl => self.translate_deepl(text),
        }
    }
}

impl TraditionalMt {
    fn translate_google(&self, text: &str) -> Result<String, MtError> {
        let url = format!(
            "https://translation.googleapis.com/language/translate/v2?key={}&target=zh-CN",
            urlencoding(&self.api_key)
        );

        let response = self
            .client
            .post(&url)
            .json(&json!({ "q": text, "format": "text" }))
            .send()
            .map_err(|e| MtError::Request(e.to_string()))?;

        let status = response.status();
        let raw = response
            .text()
            .map_err(|e| MtError::Request(e.to_string()))?;

        if !status.is_success() {
            return Err(MtError::Request(format!("Google HTTP {status}: {raw}")));
        }

        let parsed: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| MtError::Request(format!("JSON parse: {e}")))?;

        let translated = parsed
            .pointer("/data/translations/0/translatedText")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        if translated.is_empty() {
            return Err(MtError::Empty);
        }
        Ok(translated)
    }

    fn translate_deepl(&self, text: &str) -> Result<String, MtError> {
        let base = if self.api_key.ends_with(":fx") {
            "https://api-free.deepl.com/v2/translate"
        } else {
            "https://api.deepl.com/v2/translate"
        };

        let response = self
            .client
            .post(base)
            .header("Authorization", format!("DeepL-Auth-Key {}", self.api_key))
            .form(&[
                ("text", text),
                ("target_lang", "ZH"),
                ("source_lang", "EN"),
            ])
            .send()
            .map_err(|e| MtError::Request(e.to_string()))?;

        let status = response.status();
        let raw = response
            .text()
            .map_err(|e| MtError::Request(e.to_string()))?;

        if !status.is_success() {
            return Err(MtError::Request(format!("DeepL HTTP {status}: {raw}")));
        }

        let parsed: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| MtError::Request(format!("JSON parse: {e}")))?;

        let translated = parsed
            .pointer("/translations/0/text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        if translated.is_empty() {
            return Err(MtError::Empty);
        }
        Ok(translated)
    }
}

fn urlencoding(input: &str) -> String {
    let mut out = String::new();
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}
