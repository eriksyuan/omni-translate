use super::{AsrError, AsrProvider};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use hmac::{Hmac, Mac};
use reqwest::blocking::Client;
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

/// Credentials format: `SecretId:SecretKey`
pub struct TencentAsr {
    secret_id: String,
    secret_key: String,
    client: Client,
}

impl TencentAsr {
    pub fn new(api_key: &str) -> Result<Self, AsrError> {
        let Some((secret_id, secret_key)) = api_key.split_once(':') else {
            return Err(AsrError::InvalidCredentials(
                "expected SecretId:SecretKey".into(),
            ));
        };
        Ok(Self {
            secret_id: secret_id.trim().to_string(),
            secret_key: secret_key.trim().to_string(),
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| AsrError::Request(e.to_string()))?,
        })
    }

    fn signed_request(&self, payload: &serde_json::Value) -> Result<serde_json::Value, AsrError> {
        let host = "asr.tencentcloudapi.com";
        let service = "asr";
        let action = "SentenceRecognition";
        let version = "2019-06-14";
        let region = "ap-guangzhou";
        let timestamp = chrono::Utc::now().timestamp();
        let date = chrono::Utc::now().format("%Y-%m-%d").to_string();

        let body = payload.to_string();
        let hashed_payload = hex_sha256(body.as_bytes());

        let canonical_headers = format!("content-type:application/json; charset=utf-8\nhost:{host}\n");
        let signed_headers = "content-type;host";
        let canonical_request = format!(
            "POST\n/\n\n{canonical_headers}\n{signed_headers}\n{hashed_payload}"
        );

        let credential_scope = format!("{date}/{service}/tc3_request");
        let string_to_sign = format!(
            "TC3-HMAC-SHA256\n{timestamp}\n{credential_scope}\n{}",
            hex_sha256(canonical_request.as_bytes())
        );

        let secret_date = hmac_sha256(format!("TC3{}", self.secret_key).as_bytes(), date.as_bytes());
        let secret_service = hmac_sha256(&secret_date, service.as_bytes());
        let secret_signing = hmac_sha256(&secret_service, b"tc3_request");
        let signature = hex::encode(hmac_sha256(&secret_signing, string_to_sign.as_bytes()));

        let authorization = format!(
            "TC3-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
            self.secret_id, credential_scope, signed_headers, signature
        );

        let response = self
            .client
            .post(format!("https://{host}"))
            .header("Authorization", authorization)
            .header("Content-Type", "application/json; charset=utf-8")
            .header("Host", host)
            .header("X-TC-Action", action)
            .header("X-TC-Version", version)
            .header("X-TC-Timestamp", timestamp.to_string())
            .header("X-TC-Region", region)
            .body(body)
            .send()
            .map_err(|e| AsrError::Request(e.to_string()))?;

        let status = response.status();
        let text = response
            .text()
            .map_err(|e| AsrError::Request(e.to_string()))?;

        if !status.is_success() {
            return Err(AsrError::Request(format!("HTTP {status}: {text}")));
        }

        serde_json::from_str(&text).map_err(|e| AsrError::Request(format!("JSON parse: {e}: {text}")))
    }
}

impl AsrProvider for TencentAsr {
    fn transcribe_pcm16k(&self, pcm: &[i16]) -> Result<String, AsrError> {
        if pcm.is_empty() {
            return Err(AsrError::Empty);
        }

        let bytes: Vec<u8> = pcm.iter().flat_map(|s| s.to_le_bytes()).collect();
        let encoded = STANDARD.encode(&bytes);

        let payload = serde_json::json!({
            "ProjectId": 0,
            "SubServiceType": 2,
            "EngSerViceType": "16k_en",
            "SourceType": 1,
            "VoiceFormat": "pcm",
            "UsrAudioKey": format!("omni-{}", chrono::Utc::now().timestamp_millis()),
            "Data": encoded,
            "DataLen": bytes.len(),
        });

        let json = self.signed_request(&payload)?;

        if let Some(err) = json.get("Response").and_then(|r| r.get("Error")) {
            return Err(AsrError::Request(err.to_string()));
        }

        let text = json
            .pointer("/Response/Result")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        if text.is_empty() {
            return Err(AsrError::Empty);
        }
        Ok(text)
    }
}

fn hex_sha256(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key size");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}
