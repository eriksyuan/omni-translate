use super::{MtError, MtProvider};
use reqwest::blocking::Client;
use serde_json::json;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const DEEPL_FREE_URL: &str = "https://www2.deepl.com/jsonrpc";
const SOURCE_LANG: &str = "EN";
const TARGET_LANG: &str = "ZH";
/// DeepL free tier is aggressively rate-limited; keep a safe gap between calls.
const MIN_REQUEST_INTERVAL: Duration = Duration::from_secs(2);
const RATE_LIMIT_COOLDOWN: Duration = Duration::from_secs(45);

struct DeeplRateLimiter {
    last_call: Option<Instant>,
    blocked_until: Option<Instant>,
}

impl DeeplRateLimiter {
    fn wait_turn(&mut self) -> Result<(), MtError> {
        let now = Instant::now();
        if let Some(until) = self.blocked_until {
            if now < until {
                return Err(MtError::Request(format!(
                    "DeepL free rate limited; retry after {}s",
                    until.duration_since(now).as_secs().max(1)
                )));
            }
            self.blocked_until = None;
        }
        if let Some(last) = self.last_call {
            let elapsed = last.elapsed();
            if elapsed < MIN_REQUEST_INTERVAL {
                std::thread::sleep(MIN_REQUEST_INTERVAL - elapsed);
            }
        }
        Ok(())
    }

    fn record_success(&mut self) {
        self.last_call = Some(Instant::now());
    }

    fn on_rate_limited(&mut self) {
        self.blocked_until = Some(Instant::now() + RATE_LIMIT_COOLDOWN);
        self.last_call = Some(Instant::now());
    }
}

pub struct DeeplFreeMt {
    client: Client,
    rate: Mutex<DeeplRateLimiter>,
}

impl DeeplFreeMt {
    pub fn new() -> Result<Self, MtError> {
        Ok(Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| MtError::Request(e.to_string()))?,
            rate: Mutex::new(DeeplRateLimiter {
                last_call: None,
                blocked_until: None,
            }),
        })
    }
}

impl MtProvider for DeeplFreeMt {
    fn translate(&self, text: &str) -> Result<String, MtError> {
        if text.trim().is_empty() {
            return Err(MtError::Empty);
        }
        self.translate_deepl_free(text)
    }

    fn supports_streaming_partial(&self) -> bool {
        false
    }
}

impl DeeplFreeMt {
    fn translate_deepl_free(&self, text: &str) -> Result<String, MtError> {
        {
            let mut rate = self
                .rate
                .lock()
                .map_err(|e| MtError::Request(e.to_string()))?;
            rate.wait_turn()?;
        }

        let id = random_id();
        let i_count = i_count(text);
        let timestamp = timestamp(i_count);
        let body = build_request_json(id, text, timestamp);

        let response = self
            .client
            .post(DEEPL_FREE_URL)
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .map_err(|e| MtError::Request(e.to_string()))?;

        let status = response.status();
        let raw = response
            .text()
            .map_err(|e| MtError::Request(e.to_string()))?;

        if status.as_u16() == 429 || raw.contains("Too many requests") {
            if let Ok(mut rate) = self.rate.lock() {
                rate.on_rate_limited();
            }
            return Err(MtError::Request(format!("DeepL free HTTP {status}: {raw}")));
        }

        if !status.is_success() {
            return Err(MtError::Request(format!("DeepL free HTTP {status}: {raw}")));
        }

        let parsed: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| MtError::Request(format!("JSON parse: {e}")))?;

        if let Some(err) = parsed.get("error") {
            let err_str = err.to_string();
            if err_str.contains("Too many requests") {
                if let Ok(mut rate) = self.rate.lock() {
                    rate.on_rate_limited();
                }
            }
            return Err(MtError::Request(format!("DeepL free RPC error: {err}")));
        }

        let translated = parsed
            .pointer("/result/texts/0/text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        if translated.is_empty() {
            return Err(MtError::Empty);
        }

        if let Ok(mut rate) = self.rate.lock() {
            rate.record_success();
        }
        Ok(translated)
    }
}

fn i_count(text: &str) -> u64 {
    text.chars().filter(|c| *c == 'i' || *c == 'I').count() as u64
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn random_id() -> u64 {
    let ts = now_millis();
    let rand = ts.wrapping_mul(1_103_515_245).wrapping_add(12_345) % 99_999 + 100_000;
    rand * 1000
}

fn timestamp(i_count: u64) -> u64 {
    let ts = now_millis();
    if i_count == 0 {
        return ts;
    }
    let adjusted = i_count + 1;
    ts - (ts % adjusted) + adjusted
}

fn build_request_json(id: u64, text: &str, timestamp: u64) -> String {
    let payload = json!({
        "jsonrpc": "2.0",
        "method": "LMT_handle_texts",
        "id": id,
        "params": {
            "texts": [{
                "text": text,
                "requestAlternatives": 3
            }],
            "splitting": "newlines",
            "lang": {
                "source_lang_user_selected": SOURCE_LANG,
                "target_lang": TARGET_LANG
            },
            "timestamp": timestamp
        }
    });

    let mut body = payload.to_string();
    body = format_method_spacing(id, body);
    body
}

fn format_method_spacing(id: u64, json: String) -> String {
    if (id + 5) % 29 == 0 || (id + 3) % 13 == 0 {
        json.replace("\"method\":\"", "\"method\" : \"")
    } else {
        json.replace("\"method\":\"", "\"method\": \"")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deepl_free_disables_streaming_partial() {
        let mt = DeeplFreeMt::new().expect("client");
        assert!(!mt.supports_streaming_partial());
    }

    #[test]
    fn timestamp_zero_i_count_returns_current_ts() {
        let ts = timestamp(0);
        assert!(ts > 0);
    }

    #[test]
    fn timestamp_with_i_count_adjusts() {
        let ts = timestamp(5);
        let adjusted = 6_u64;
        assert_eq!(ts % adjusted, adjusted % adjusted);
    }

    #[test]
    fn format_method_spacing_special_id() {
        let id = 24_u64; // (24+5) % 29 == 0
        let json = r#"{"method":"LMT_handle_texts"}"#.to_string();
        assert!(format_method_spacing(id, json).contains("\"method\" : \""));
    }

    #[test]
    fn format_method_spacing_normal_id() {
        let id = 100_000_u64;
        let json = r#"{"method":"LMT_handle_texts"}"#.to_string();
        assert!(format_method_spacing(id, json).contains("\"method\": \""));
    }

    #[test]
    #[ignore = "requires network access to DeepL"]
    fn live_translate_hello() {
        let mt = DeeplFreeMt::new().expect("client");
        let result = mt.translate("Hello").expect("translate");
        assert!(!result.is_empty());
        eprintln!("live_translate_hello: {result}");
    }
}
