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
}

impl TencentSpeechTranslateSession {
    pub fn new(
        app_id: &str,
        secret_id: &str,
        secret_key: &str,
        source: &str,
        target: &str,
        trans_model: &str,
    ) -> Result<Self, String> {
        if app_id.trim().is_empty() || secret_id.trim().is_empty() || secret_key.trim().is_empty() {
            return Err("AppId, SecretId and SecretKey are required".into());
        }
        Ok(Self {
            app_id: app_id.trim().to_string(),
            secret_id: secret_id.trim().to_string(),
            secret_key: secret_key.trim().to_string(),
            source: source.to_string(),
            target: target.to_string(),
            trans_model: trans_model.to_string(),
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

    pub fn send_pcm_chunk(
        socket: &mut WsStream,
        chunk: &[u8],
    ) -> Result<(), String> {
        socket
            .send(Message::Binary(chunk.to_vec()))
            .map_err(|e| format!("send pcm failed: {e}"))
    }

    pub fn send_end(
        socket: &mut WsStream,
    ) -> Result<(), String> {
        socket
            .send(Message::Text(r#"{"type":"end"}"#.into()))
            .map_err(|e| format!("send end failed: {e}"))
    }

    pub fn read_message(
        socket: &mut WsStream,
    ) -> Result<Option<TranslateResponse>, String> {
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
                        "ws result end={} src=\"{}\" tgt=\"{}\"",
                        result.sentence_end,
                        logging::preview(&original, 80),
                        logging::preview(&translation, 80),
                    );
                    let payload = SubtitleUpdatePayload {
                        original: original.clone(),
                        translation: translation.clone(),
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

pub fn test_speech_translate_connection(config: &SpeechTranslateConfig) -> Result<(), String> {
    let SpeechTranslateConfig::TencentRealtime {
        app_id,
        secret_id,
        secret_key,
        source,
        target,
        trans_model,
    } = config;

    let session = TencentSpeechTranslateSession::new(
        app_id,
        secret_id,
        secret_key,
        source,
        target,
        trans_model,
    )?;

    let (mut socket, _voice_id) = session.connect()?;

    let silence = vec![0_u8; PCM_CHUNK_BYTES];
    for _ in 0..3 {
        TencentSpeechTranslateSession::send_pcm_chunk(&mut socket, &silence)?;
        std::thread::sleep(PACE_INTERVAL);
    }

    TencentSpeechTranslateSession::send_end(&mut socket)?;

    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        match TencentSpeechTranslateSession::read_message(&mut socket) {
            Ok(Some(msg)) => {
                if msg.code != 0 {
                    return Err(msg
                        .message
                        .unwrap_or_else(|| format!("error code {}", msg.code)));
                }
                if msg.final_.unwrap_or(0) >= 1 {
                    let _ = socket.close(None);
                    return Ok(());
                }
            }
            Ok(None) => continue,
            Err(err) if err.contains("closed") => return Ok(()),
            Err(err) => return Err(err),
        }
    }

    let _ = socket.close(None);
    Ok(())
}

pub fn run_integrated_worker(
    app: tauri::AppHandle,
    config: SpeechTranslateConfig,
    pcm_rx: Receiver<crate::audio::IntegratedPcmInput>,
    stop_rx: Receiver<()>,
) {
    let SpeechTranslateConfig::TencentRealtime {
        app_id,
        secret_id,
        secret_key,
        source,
        target,
        trans_model,
    } = config;

    let session = match TencentSpeechTranslateSession::new(
        &app_id,
        &secret_id,
        &secret_key,
        &source,
        &target,
        &trans_model,
    ) {
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
        "connected voice_id={voice_id} source={source} target={target} model={trans_model}"
    );

    let mut feeder = crate::audio::IntegratedPcmFeeder::new();
    let mut last_send = Instant::now() - PACE_INTERVAL;
    let mut graceful_end = false;
    let mut pcm_sent = 0_u64;
    let mut pcm_input_batches = 0_u64;
    let mut last_starve_log = Instant::now() - Duration::from_secs(10);

    loop {
        if stop_rx.try_recv().is_ok() {
            log_info!("speech", "stop requested sent_pcm={pcm_sent} pending={}", feeder.pending_samples());
            let _ = socket.close(None);
            return;
        }

        while let Ok(chunk) = pcm_rx.try_recv() {
            pcm_input_batches += 1;
            feeder.push_interleaved(&chunk.samples, chunk.sample_rate, chunk.channels);
        }

        // Drain all pending server messages before sending the next PCM chunk.
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
        // Send at 1:1 realtime (200ms audio every 200ms). Catch up when buffered.
        while now.duration_since(last_send) >= PACE_INTERVAL {
            let Some(packet) = feeder.take_pcm_bytes(PCM_CHUNK_BYTES) else {
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
                    feeder.pending_samples()
                );
            }
        }

        thread::sleep(Duration::from_millis(10));
    }

    if !graceful_end {
        let _ = socket.close(None);
        return;
    }

    if let Err(err) = TencentSpeechTranslateSession::send_end(&mut socket) {
        log_warn!("speech", "send_end failed: {err}");
    }

    let deadline = Instant::now() + Duration::from_secs(3);
    while Instant::now() < deadline {
        match poll_ws_message(&app, &mut socket) {
            WsPoll::Final | WsPoll::Closed => break,
            WsPoll::Failed => return,
            WsPoll::Idle => thread::sleep(Duration::from_millis(10)),
        }
    }

    let _ = socket.close(None);
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
) -> Result<String, String> {
    let timestamp = chrono::Utc::now().timestamp();
    let expired = timestamp + 86_400;
    let nonce = (timestamp as u32) ^ 0x5A17_0000;

    let sign_plain = format!(
        "{HOST}/asr/speech_translate/{app_id}?expired={expired}&nonce={nonce}&secretid={secret_id}&source={source}&target={target}&timestamp={timestamp}&trans_model={trans_model}&voice_format=1&voice_id={voice_id}",
    );

    let mut mac = HmacSha1::new_from_slice(secret_key.as_bytes())
        .map_err(|e| format!("invalid secret key: {e}"))?;
    mac.update(sign_plain.as_bytes());
    let signature = STANDARD.encode(mac.finalize().into_bytes());

    Ok(format!(
        "wss://{HOST}/asr/speech_translate/{app_id}?expired={expired}&nonce={nonce}&secretid={secretid}&source={source}&target={target}&timestamp={timestamp}&trans_model={trans_model}&voice_format=1&voice_id={voice_id}&signature={signature}",
        secretid = urlencoding::encode(secret_id),
        source = urlencoding::encode(source),
        target = urlencoding::encode(target),
        trans_model = urlencoding::encode(trans_model),
        voice_id = urlencoding::encode(voice_id),
        signature = urlencoding::encode(&signature),
    ))
}
