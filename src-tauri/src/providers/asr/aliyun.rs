use super::{AsrError, AsrProvider};
use hmac::{Hmac, Mac};
use reqwest::blocking::Client;
use sha1::Sha1;

type HmacSha1 = Hmac<Sha1>;

/// Credentials format: `AppKey:AccessKeyId:AccessKeySecret`
pub struct AliyunAsr {
    app_key: String,
    access_key_id: String,
    access_key_secret: String,
    client: Client,
}

impl AliyunAsr {
    pub fn new(api_key: &str) -> Result<Self, AsrError> {
        let parts: Vec<&str> = api_key.splitn(3, ':').collect();
        if parts.len() != 3 {
            return Err(AsrError::InvalidCredentials(
                "expected AppKey:AccessKeyId:AccessKeySecret".into(),
            ));
        }
        Ok(Self {
            app_key: parts[0].trim().to_string(),
            access_key_id: parts[1].trim().to_string(),
            access_key_secret: parts[2].trim().to_string(),
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| AsrError::Request(e.to_string()))?,
        })
    }

    fn fetch_token(&self) -> Result<String, AsrError> {
        let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let nonce = format!("{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
        let params = [
            ("AccessKeyId", self.access_key_id.as_str()),
            ("Action", "CreateToken"),
            ("Format", "JSON"),
            ("RegionId", "cn-shanghai"),
            ("SignatureMethod", "HMAC-SHA1"),
            ("SignatureNonce", nonce.as_str()),
            ("SignatureVersion", "1.0"),
            ("Timestamp", timestamp.as_str()),
            ("Version", "2019-02-28"),
        ];

        let canonical = percent_encode_params(&params);
        let string_to_sign = format!("GET&%2F&{}", urlencode(&canonical));
        let signature = hmac_sha1_sign(&self.access_key_secret, &string_to_sign);

        let url = format!(
            "https://nls-meta.cn-shanghai.aliyuncs.com/?{}&Signature={}",
            canonical,
            urlencode(&signature)
        );

        let response = self
            .client
            .get(&url)
            .send()
            .map_err(|e| AsrError::Request(e.to_string()))?;
        let status = response.status();
        let body = response
            .text()
            .map_err(|e| AsrError::Request(e.to_string()))?;

        if !status.is_success() {
            return Err(AsrError::Request(format!("token HTTP {status}: {body}")));
        }

        extract_json_string(&body, "Token", "Id")
            .ok_or_else(|| AsrError::Request(format!("token parse failed: {body}")))
    }
}

impl AsrProvider for AliyunAsr {
    fn transcribe_pcm16k(&self, pcm: &[i16]) -> Result<String, AsrError> {
        if pcm.is_empty() {
            return Err(AsrError::Empty);
        }

        let token = self.fetch_token()?;
        let bytes: Vec<u8> = pcm.iter().flat_map(|s| s.to_le_bytes()).collect();

        let url = format!(
            "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?appkey={}&format=pcm&sample_rate=16000&enable_punctuation_prediction=true&enable_inverse_text_normalization=true",
            urlencode(&self.app_key)
        );

        let response = self
            .client
            .post(&url)
            .header("X-NLS-Token", &token)
            .header("Content-Type", "application/octet-stream")
            .body(bytes)
            .send()
            .map_err(|e| AsrError::Request(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .map_err(|e| AsrError::Request(e.to_string()))?;

        if !status.is_success() {
            return Err(AsrError::Request(format!("ASR HTTP {status}: {body}")));
        }

        let text = extract_json_string(&body, "result", "")
            .unwrap_or_default()
            .trim()
            .to_string();

        if text.is_empty() {
            return Err(AsrError::Empty);
        }
        Ok(text)
    }
}

fn hmac_sha1_sign(secret: &str, data: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let key = format!("{secret}&");
    let mut mac =
        HmacSha1::new_from_slice(key.as_bytes()).expect("HMAC can take key of any size");
    mac.update(data.as_bytes());
    STANDARD.encode(mac.finalize().into_bytes())
}

fn percent_encode_params(params: &[(&str, &str)]) -> String {
    let mut pairs: Vec<(String, String)> = params
        .iter()
        .map(|(k, v)| (urlencode(k), urlencode(v)))
        .collect();
    pairs.sort_by(|a, b| a.0.cmp(&b.0));
    pairs
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("&")
}

fn urlencode(input: &str) -> String {
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

fn extract_json_string(body: &str, key: &str, nested: &str) -> Option<String> {
    let pattern = format!("\"{key}\"");
    let start = body.find(&pattern)?;
    let after_key = &body[start + pattern.len()..];
    let colon = after_key.find(':')?;
    let rest = after_key[colon + 1..].trim_start();

    if !nested.is_empty() {
        let nested_pattern = format!("\"{nested}\"");
        let nstart = rest.find(&nested_pattern)?;
        let nafter = &rest[nstart + nested_pattern.len()..];
        let ncolon = nafter.find(':')?;
        return parse_json_string_value(nafter[ncolon + 1..].trim_start());
    }
    parse_json_string_value(rest)
}

fn parse_json_string_value(rest: &str) -> Option<String> {
    if !rest.starts_with('"') {
        return None;
    }
    let mut out = String::new();
    let mut chars = rest[1..].chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(next) = chars.next() {
                out.push(next);
            }
        } else if ch == '"' {
            break;
        } else {
            out.push(ch);
        }
    }
    Some(out)
}
