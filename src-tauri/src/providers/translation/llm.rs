use super::{MtError, MtProvider};
use reqwest::blocking::Client;
use serde_json::json;

pub struct LlmMt {
    endpoint: String,
    api_key: String,
    model: String,
    prompt: String,
    client: Client,
}

impl LlmMt {
    pub fn new(base_url: &str, api_key: &str, model: &str, prompt: &str) -> Result<Self, MtError> {
        if api_key.trim().is_empty() || model.trim().is_empty() || base_url.trim().is_empty() {
            return Err(MtError::InvalidCredentials(
                "LLM baseUrl, apiKey and model are required".into(),
            ));
        }

        let endpoint = normalize_chat_endpoint(base_url);

        Ok(Self {
            endpoint,
            api_key: api_key.trim().to_string(),
            model: model.trim().to_string(),
            prompt: prompt.trim().to_string(),
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .map_err(|e| MtError::Request(e.to_string()))?,
        })
    }
}

impl MtProvider for LlmMt {
    fn translate(&self, text: &str) -> Result<String, MtError> {
        if text.trim().is_empty() {
            return Err(MtError::Empty);
        }

        let user_content = self.prompt.replace("{{text}}", text);

        let body = json!({
            "model": self.model,
            "messages": [
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.2,
        });

        let response = self
            .client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .map_err(|e| MtError::Request(e.to_string()))?;

        let status = response.status();
        let raw = response
            .text()
            .map_err(|e| MtError::Request(e.to_string()))?;

        if !status.is_success() {
            return Err(MtError::Request(format!("HTTP {status}: {raw}")));
        }

        let parsed: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| MtError::Request(format!("JSON parse: {e}: {raw}")))?;

        let content = parsed
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        if content.is_empty() {
            return Err(MtError::Empty);
        }
        Ok(content)
    }
}

fn normalize_chat_endpoint(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/chat/completions")
    } else {
        format!("{trimmed}/v1/chat/completions")
    }
}
