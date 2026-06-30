use std::io::ErrorKind;
use std::sync::mpsc::Receiver;
use std::thread;
use std::time::{Duration, Instant};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha1::Sha1;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{connect, Error as WsError, Message, WebSocket};
use uuid::Uuid;

use tauri::Emitter;

use super::tencent_languages::validate_language_pair;
use crate::audio::{normalized_rms, SILENCE_RMS_THRESHOLD};
use crate::providers::{
    PipelineErrorPayload, SpeechTranslateConfig, SubtitleUpdatePayload, EVENT_PIPELINE_ERROR,
    EVENT_SUBTITLE_UPDATE,
};
use crate::providers::translation::build_translation_tokens;
use crate::logging;
use crate::{log_debug, log_error, log_info, log_warn};

type HmacSha1 = Hmac<Sha1>;

const HOST: &str = "asr.cloud.tencent.com";
const PCM_CHUNK_BYTES: usize = 6400;
const PACE_INTERVAL: Duration = Duration::from_millis(200);
const READ_POLL_TIMEOUT: Duration = Duration::from_millis(50);
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(1);
const STOP_DRAIN_TIMEOUT: Duration = Duration::from_secs(3);

type WsStream = WebSocket<MaybeTlsStream<std::net::TcpStream>>;

enum WsPoll {
    Idle,
    Final,
    Closed,
    Failed,
}

#[derive(Debug, Deserialize)]
struct HandshakeResponse {
    code: i32,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TranslateResponse {
    code: i32,
    message: Option<String>,
    sentence_id: Option<String>,
    #[serde(default, rename = "final")]
    final_: Option<i32>,
    result: Option<TranslateResult>,
}

#[derive(Debug, Deserialize)]
struct TranslateResult {
    source_text: Option<String>,
    target_text: Option<String>,
    #[serde(default)]
    sentence_end: bool,
}

pub struct TencentSpeechTranslateSession {
    app_id: String,
    secret_id: String,
    secret_key: String,
    source: String,
    target: String,
    trans_model: String,
    hotword_list: Option<String>,
    noise_threshold: Option<f64>,
    domain: Option<i32>,
}

impl TencentSpeechTranslateSession {
    pub fn new(
        app_id: &str,
        secret_id: &str,
        secret_key: &str,
        source: &str,
        target: &str,
        trans_model: &str,
        hotword_list: Option<&str>,
        noise_threshold: Option<f64>,
        domain: Option<i32>,
    ) -> Result<Self, String> {
        if app_id.trim().is_empty() || secret_id.trim().is_empty() || secret_key.trim().is_empty() {
            return Err("AppId, SecretId and SecretKey are required".into());
        }
        validate_language_pair(source, target)?;

        let hotword = hotword_list
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        Ok(Self {
            app_id: app_id.trim().to_string(),
            secret_id: secret_id.trim().to_string(),
            secret_key: secret_key.trim().to_string(),
            source: source.to_string(),
            target: target.to_string(),
            trans_model: trans_model.to_string(),
            hotword_list: hotword,
            noise_threshold,
            domain,
        })
    }

    pub fn connect(&self) -> Result<(WsStream, String), String> {
        let voice_id = Uuid::new_v4().simple().to_string();
        let url = build_ws_url(
            &self.app_id,
            &self.secret_id,
            &self.secret_key,
            &voice_id,
            &self.source,
            &self.target,
            &self.trans_model,
            self.hotword_list.as_deref(),
            self.noise_threshold,
            self.domain,
        )?;
        let (mut socket, _) = connect(url).map_err(|e| format!("websocket connect failed: {e}"))?;

        match socket.read() {
            Ok(Message::Text(text)) => {
                let payload: HandshakeResponse =
                    serde_json::from_str(&text).map_err(|e| format!("invalid handshake json: {e}"))?;
                if payload.code != 0 {
                    return Err(payload
                        .message
                        .unwrap_or_else(|| format!("handshake failed with code {}", payload.code)));
                }
            }
            Ok(other) => return Err(format!("unexpected handshake message: {other:?}")),
            Err(e) => return Err(format!("handshake read failed: {e}")),
        }

        set_socket_read_timeout(&mut socket, Some(READ_POLL_TIMEOUT))?;
        Ok((socket, voice_id))
    }

    pub fn send_pcm_chunk(socket: &mut WsStream, chunk: &[u8]) -> Result<(), String> {
        socket
            .send(Message::Binary(chunk.to_vec()))
            .map_err(|e| format!("send pcm failed: {e}"))
    }

    pub fn send_end(socket: &mut WsStream) -> Result<(), String> {
        socket
            .send(Message::Text(r#"{"type":"end"}"#.into()))
            .map_err(|e| format!("send end failed: {e}"))
    }

    pub fn read_message(socket: &mut WsStream) -> Result<Option<TranslateResponse>, String> {
        match socket.read() {
            Ok(Message::Text(text)) => {
                let payload: TranslateResponse =
                    serde_json::from_str(&text).map_err(|e| format!("invalid response json: {e}"))?;
                Ok(Some(payload))
            }
            Ok(Message::Binary(_)) => Ok(None),
            Ok(Message::Ping(data)) => {
                let _ = socket.send(Message::Pong(data));
                Ok(None)
            }
            Ok(Message::Pong(_)) | Ok(Message::Frame(_)) => Ok(None),
            Ok(Message::Close(_)) => Err("websocket closed".into()),
            Err(WsError::Io(io_err))
                if matches!(io_err.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) =>
            {
                Ok(None)
            }
            Err(e) => Err(format!("read failed: {e}")),
        }
    }
}

fn set_socket_read_timeout(socket: &mut WsStream, timeout: Option<Duration>) -> Result<(), String> {
    match socket.get_mut() {
        MaybeTlsStream::Plain(stream) => stream
            .set_read_timeout(timeout)
            .map_err(|e| e.to_string()),
        MaybeTlsStream::Rustls(stream) => stream
            .get_ref()
            .set_read_timeout(timeout)
            .map_err(|e| e.to_string()),
        _ => Ok(()),
    }
}

fn poll_ws_message(app: &tauri::AppHandle, socket: &mut WsStream) -> WsPoll {
    match TencentSpeechTranslateSession::read_message(socket) {
        Ok(Some(msg)) => {
            if msg.code != 0 {
                let message = msg
                    .message
                    .unwrap_or_else(|| format!("code {}", msg.code));
                log_error!("speech", "ws error code={} message={message}", msg.code);
                emit_speech_error(app, "speech_translate", &message);
                return WsPoll::Failed;
            }

            if let Some(result) = msg.result {
                let original = result.source_text.unwrap_or_default();
                let translation = result.target_text.unwrap_or_default();
                if !original.is_empty() || !translation.is_empty() {
                    log_info!(
                        "speech",
                        "ws result sid={:?} end={} src=\"{}\" tgt=\"{}\"",
                        msg.sentence_id,
                        result.sentence_end,
                        logging::preview(&original, 80),
                        logging::preview(&translation, 80),
                    );
                    let payload = SubtitleUpdatePayload {
                        original: original.clone(),
                        translation: translation.clone(),
                        sentence_id: msg.sentence_id.clone(),
                        sentence_end: result.sentence_end,
                        tokens: build_translation_tokens(&translation),
                    };
                    let _ = app.emit(EVENT_SUBTITLE_UPDATE, payload);
                }
            }

            if msg.final_.unwrap_or(0) >= 1 {
                log_info!("speech", "ws session final={}", msg.final_.unwrap_or(0));
                WsPoll::Final
            } else {
                WsPoll::Idle
            }
        }
        Ok(None) => WsPoll::Idle,
        Err(err) if err.contains("closed") => {
            log_warn!("speech", "ws closed by server");
            WsPoll::Closed
        }
        Err(err) => {
            log_error!("speech", "ws read failed: {err}");
            emit_speech_error(app, "speech_translate", &err);
            WsPoll::Failed
        }
    }
}

fn drain_ws_until_final(
    app: &tauri::AppHandle,
    socket: &mut WsStream,
    deadline: Instant,
) -> WsPoll {
    while Instant::now() < deadline {
        match poll_ws_message(app, socket) {
            WsPoll::Final | WsPoll::Closed => return WsPoll::Final,
            WsPoll::Failed => return WsPoll::Failed,
            WsPoll::Idle => thread::sleep(Duration::from_millis(10)),
        }
    }
    WsPoll::Idle
}

fn silence_pcm_chunk() -> Vec<u8> {
    vec![0_u8; PCM_CHUNK_BYTES]
}

fn maybe_silence_pcm_packet(packet: Vec<u8>) -> Vec<u8> {
    let sample_count = packet.len() / 2;
    if sample_count == 0 {
        return packet;
    }
    let mut samples = Vec::with_capacity(sample_count);
    for chunk in packet.chunks_exact(2) {
        samples.push(i16::from_le_bytes([chunk[0], chunk[1]]));
    }
    if normalized_rms(&samples) < SILENCE_RMS_THRESHOLD {
        silence_pcm_chunk()
    } else {
        packet
    }
}

pub fn test_speech_translate_connection(config: &SpeechTranslateConfig) -> Result<(), String> {
    let session = build_session_from_config(config)?;
    let (mut socket, _voice_id) = session.connect()?;
    let _ = socket.close(None);
    Ok(())
}

pub fn run_integrated_worker(
    app: tauri::AppHandle,
    config: SpeechTranslateConfig,
    pcm_rx: Receiver<crate::audio::IntegratedPcmInput>,
    stop_rx: Receiver<()>,
) {
    let session = match build_session_from_config(&config) {
        Ok(session) => session,
        Err(err) => {
            log_error!("speech", "init failed: {err}");
            emit_speech_error(&app, "speech_init", &err);
            return;
        }
    };

    let (mut socket, voice_id) = match session.connect() {
        Ok(pair) => pair,
        Err(err) => {
            log_error!("speech", "connect failed: {err}");
            emit_speech_error(&app, "speech_connect", &err);
            return;
        }
    };

    log_info!(
        "speech",
        "connected voice_id={voice_id} source={} target={} model={}",
        session.source,
        session.target,
        session.trans_model
    );

    let mut feeder = crate::audio::IntegratedPcmFeeder::new();
    let mut last_send = Instant::now() - PACE_INTERVAL;
    let mut graceful_end = false;
    let mut stop_requested = false;
    let mut pcm_sent = 0_u64;
    let mut pcm_input_batches = 0_u64;
    let mut last_starve_log = Instant::now() - Duration::from_secs(10);

    loop {
        if stop_rx.try_recv().is_ok() {
            stop_requested = true;
            log_info!(
                "speech",
                "stop requested sent_pcm={pcm_sent} pending={}",
                feeder.pending_samples()
            );
            break;
        }

        while let Ok(chunk) = pcm_rx.try_recv() {
            pcm_input_batches += 1;
            feeder.push_interleaved(&chunk.samples, chunk.sample_rate, chunk.channels);
        }

        loop {
            match poll_ws_message(&app, &mut socket) {
                WsPoll::Failed => return,
                WsPoll::Final => {
                    graceful_end = true;
                    break;
                }
                WsPoll::Closed => return,
                WsPoll::Idle => break,
            }
        }

        if graceful_end {
            break;
        }

        let now = Instant::now();
        while now.duration_since(last_send) >= PACE_INTERVAL {
            let packet = if let Some(packet) = feeder.take_pcm_bytes(PCM_CHUNK_BYTES) {
                maybe_silence_pcm_packet(packet)
            } else if now.duration_since(last_send) >= KEEPALIVE_INTERVAL {
                silence_pcm_chunk()
            } else {
                if now.duration_since(last_send) >= Duration::from_secs(1)
                    && last_starve_log.elapsed() >= Duration::from_secs(2)
                {
                    log_warn!(
                        "speech",
                        "pcm send starved pending={} samples waited_ms={} input_batches={pcm_input_batches}",
                        feeder.pending_samples(),
                        now.duration_since(last_send).as_millis(),
                    );
                    last_starve_log = now;
                }
                break;
            };

            if let Err(err) = TencentSpeechTranslateSession::send_pcm_chunk(&mut socket, &packet) {
                log_error!(
                    "speech",
                    "send pcm failed after {pcm_sent} packets pending={}: {err}",
                    feeder.pending_samples()
                );
                emit_speech_error(&app, "speech_send", &err);
                return;
            }
            pcm_sent += 1;
            last_send += PACE_INTERVAL;
            if pcm_sent == 1 || pcm_sent.is_multiple_of(25) {
                log_debug!(
                    "speech",
                    "sent pcm packet #{pcm_sent} pending={} input_batches={pcm_input_batches}",
                    feeder.pending_samples(),
                );
            }
        }

        thread::sleep(Duration::from_millis(10));
    }

    if stop_requested {
        if let Err(err) = TencentSpeechTranslateSession::send_end(&mut socket) {
            log_warn!("speech", "send_end on stop failed: {err}");
        } else {
            let _ = drain_ws_until_final(&app, &mut socket, Instant::now() + STOP_DRAIN_TIMEOUT);
        }
        let _ = socket.close(None);
        return;
    }

    if !graceful_end {
        let _ = socket.close(None);
        return;
    }

    if let Err(err) = TencentSpeechTranslateSession::send_end(&mut socket) {
        log_warn!("speech", "send_end failed: {err}");
    }

    let _ = drain_ws_until_final(&app, &mut socket, Instant::now() + STOP_DRAIN_TIMEOUT);
    let _ = socket.close(None);
}

fn build_session_from_config(config: &SpeechTranslateConfig) -> Result<TencentSpeechTranslateSession, String> {
    match config {
        SpeechTranslateConfig::TencentRealtime {
            app_id,
            secret_id,
            secret_key,
            source,
            target,
            trans_model,
            hotword_list,
            noise_threshold,
            domain,
        } => TencentSpeechTranslateSession::new(
            app_id,
            secret_id,
            secret_key,
            source,
            target,
            trans_model,
            hotword_list.as_deref(),
            *noise_threshold,
            *domain,
        ),
    }
}

fn emit_speech_error(app: &tauri::AppHandle, code: &str, message: &str) {
    log_error!("speech", "pipeline error code={code} message={message}");
    let _ = app.emit(
        EVENT_PIPELINE_ERROR,
        PipelineErrorPayload {
            code: code.to_string(),
            message: message.to_string(),
        },
    );
}

fn build_ws_url(
    app_id: &str,
    secret_id: &str,
    secret_key: &str,
    voice_id: &str,
    source: &str,
    target: &str,
    trans_model: &str,
    hotword_list: Option<&str>,
    noise_threshold: Option<f64>,
    domain: Option<i32>,
) -> Result<String, String> {
    let timestamp = chrono::Utc::now().timestamp();
    let expired = timestamp + 86_400;
    let nonce = (timestamp as u32) ^ 0x5A17_0000;

    let mut pairs: Vec<(&str, String)> = vec![
        ("expired", expired.to_string()),
        ("nonce", nonce.to_string()),
        ("secretid", secret_id.to_string()),
        ("source", source.to_string()),
        ("target", target.to_string()),
        ("timestamp", timestamp.to_string()),
        ("trans_model", trans_model.to_string()),
        ("voice_format", "1".to_string()),
        ("voice_id", voice_id.to_string()),
    ];

    if let Some(value) = domain {
        pairs.push(("domain", value.to_string()));
    }
    if let Some(value) = hotword_list {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            pairs.push(("hotword_list", trimmed.to_string()));
        }
    }
    if let Some(value) = noise_threshold {
        if value != 0.0 {
            pairs.push(("noise_threshold", format_noise_threshold(value)));
        }
    }

    pairs.sort_by(|a, b| a.0.cmp(b.0));

    let query_plain = pairs
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("&");

    let sign_plain = format!("{HOST}/asr/speech_translate/{app_id}?{query_plain}");

    let mut mac = HmacSha1::new_from_slice(secret_key.as_bytes())
        .map_err(|e| format!("invalid secret key: {e}"))?;
    mac.update(sign_plain.as_bytes());
    let signature = STANDARD.encode(mac.finalize().into_bytes());

    let query_encoded = pairs
        .iter()
        .map(|(key, value)| {
            format!(
                "{key}={}",
                urlencoding::encode(value)
            )
        })
        .collect::<Vec<_>>()
        .join("&");

    Ok(format!(
        "wss://{HOST}/asr/speech_translate/{app_id}?{query_encoded}&signature={}",
        urlencoding::encode(&signature)
    ))
}

fn format_noise_threshold(value: f64) -> String {
    let clamped = value.clamp(-2.0, 2.0);
    if (clamped - clamped.round()).abs() < f64::EPSILON {
        clamped.round().to_string()
    } else {
        format!("{clamped:.2}")
    }
}
