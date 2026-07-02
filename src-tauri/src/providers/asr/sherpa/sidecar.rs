use std::net::TcpStream;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::AppHandle;
use tungstenite::{connect, stream::MaybeTlsStream, Message, WebSocket};

use super::config::{resolve_sherpa_config, resolve_sherpa_config_for_test, ResolvedSherpaConfig};
use crate::providers::asr::AsrError;

/// Decoder / search tuning for Zipformer streaming ASR (see sherpa-onnx-online-websocket-server --help).
const DECODING_METHOD: &str = "modified_beam_search";
const MAX_ACTIVE_PATHS: &str = "4";
const ONNX_NUM_THREADS: &str = "4";
const MODEL_TYPE: &str = "zipformer2";

#[derive(Debug, Clone)]
pub struct SherpaPartial {
    pub text: String,
    pub is_final: bool,
}

#[derive(Debug, Deserialize)]
struct SherpaWsResponse {
    text: String,
    #[serde(default)]
    is_final: bool,
    #[serde(default)]
    is_eof: bool,
}

pub struct SherpaSidecarSession {
    _config: ResolvedSherpaConfig,
    child: Child,
    ws: WebSocket<MaybeTlsStream<TcpStream>>,
}

impl SherpaSidecarSession {
    pub fn start(app: &AppHandle, model_id: &str) -> Result<Self, AsrError> {
        let config = resolve_sherpa_config(app, model_id).map_err(map_config_err)?;
        Self::start_with_config(config)
    }

    pub fn start_for_test(app: &AppHandle, model_id: &str) -> Result<Self, AsrError> {
        let config = resolve_sherpa_config_for_test(app, model_id).map_err(map_config_err)?;
        Self::start_with_config(config)
    }

    fn start_with_config(config: ResolvedSherpaConfig) -> Result<Self, AsrError> {
        let child = spawn_sidecar(&config)?;
        wait_for_port(config.port, Duration::from_secs(15))?;
        let ws_url = format!("ws://127.0.0.1:{}", config.port);
        let (ws, _) = connect(&ws_url).map_err(|e| AsrError::Request(format!("ws connect: {e}")))?;

        Ok(Self {
            _config: config,
            child,
            ws,
        })
    }

    pub fn send_pcm16k(&mut self, pcm: &[i16]) -> Result<Vec<SherpaPartial>, AsrError> {
        if pcm.is_empty() {
            return Ok(Vec::new());
        }
        let bytes = pcm16_to_f32_bytes(pcm);
        self.ws
            .send(Message::Binary(bytes))
            .map_err(|e| AsrError::Request(format!("ws send: {e}")))?;
        poll_partials(&mut self.ws, Duration::from_millis(150))
    }

    pub fn finalize(&mut self) -> Result<Vec<SherpaPartial>, AsrError> {
        self.ws
            .send(Message::Text("Done".into()))
            .map_err(|e| AsrError::Request(format!("ws done: {e}")))?;
        poll_partials(&mut self.ws, Duration::from_millis(500))
    }

    pub fn shutdown(mut self) -> Result<(), AsrError> {
        let _ = self.ws.close(None);
        let _ = self.ws.flush();
        let _ = self.child.kill();
        let _ = self.child.wait();
        Ok(())
    }
}

impl Drop for SherpaSidecarSession {
    fn drop(&mut self) {
        let _ = self.ws.close(None);
        let _ = self.child.kill();
    }
}

fn map_config_err(err: super::config::SherpaConfigError) -> AsrError {
    AsrError::Request(err.to_string())
}

fn spawn_sidecar(config: &ResolvedSherpaConfig) -> Result<Child, AsrError> {
    let lib_dir = config.lib_dir.to_string_lossy();
    let child = Command::new(&config.sidecar_bin)
        .env("DYLD_LIBRARY_PATH", lib_dir.as_ref())
        .arg(format!("--port={}", config.port))
        .arg("--max-batch-size=1")
        .arg("--loop-interval-ms=10")
        .arg(format!("--tokens={}", path_arg(&config.tokens)))
        .arg(format!("--encoder={}", path_arg(&config.encoder)))
        .arg(format!("--decoder={}", path_arg(&config.decoder)))
        .arg(format!("--joiner={}", path_arg(&config.joiner)))
        .arg(format!("--decoding-method={DECODING_METHOD}"))
        .arg(format!("--max-active-paths={MAX_ACTIVE_PATHS}"))
        .arg(format!("--num-threads={ONNX_NUM_THREADS}"))
        .arg(format!("--model-type={MODEL_TYPE}"))
        .arg("--enable-endpoint=1")
        .arg("--rule1-min-utterance-length=0")
        .arg("--rule2-min-trailing-silence=0.5")
        .arg("--rule2-min-utterance-length=0")
        .arg("--rule3-min-utterance-length=20")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| AsrError::Request(format!("spawn sidecar: {e}")))?;
    Ok(child)
}

fn path_arg(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn wait_for_port(port: u16, timeout: Duration) -> Result<(), AsrError> {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    Err(AsrError::Request(format!(
        "sidecar did not listen on port {port} within {timeout:?}"
    )))
}

fn pcm16_to_f32_bytes(pcm: &[i16]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(pcm.len() * 4);
    for &sample in pcm {
        let f = sample as f32 / i16::MAX as f32;
        bytes.extend_from_slice(&f.to_le_bytes());
    }
    bytes
}

fn poll_partials(
    ws: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    timeout: Duration,
) -> Result<Vec<SherpaPartial>, AsrError> {
    let deadline = Instant::now() + timeout;
    let mut results = Vec::new();

    while Instant::now() < deadline {
        set_read_timeout(ws, Some(Duration::from_millis(50)));

        match ws.read() {
            Ok(Message::Text(text)) => {
                if text == "Done!" {
                    break;
                }
                if let Ok(parsed) = serde_json::from_str::<SherpaWsResponse>(&text) {
                    results.push(SherpaPartial {
                        text: parsed.text.trim().to_string(),
                        is_final: parsed.is_final || parsed.is_eof,
                    });
                    if parsed.is_final || parsed.is_eof {
                        break;
                    }
                }
            }
            Ok(Message::Binary(_)) | Ok(Message::Ping(_)) | Ok(Message::Pong(_)) => {}
            Ok(Message::Close(_)) | Ok(Message::Frame(_)) => break,
            Err(tungstenite::Error::Io(ref err))
                if err.kind() == std::io::ErrorKind::WouldBlock
                    || err.kind() == std::io::ErrorKind::TimedOut =>
            {
                if !results.is_empty() {
                    break;
                }
            }
            Err(tungstenite::Error::Io(_)) => break,
            Err(_) => break,
        }
    }

    Ok(results)
}

fn set_read_timeout(ws: &mut WebSocket<MaybeTlsStream<TcpStream>>, timeout: Option<Duration>) {
    if let MaybeTlsStream::Plain(stream) = ws.get_mut() {
        let _ = stream.set_read_timeout(timeout);
    }
}

pub fn test_sherpa_connection(app: &AppHandle, model_id: &str) -> Result<(), AsrError> {
    let mut session = SherpaSidecarSession::start_for_test(app, model_id)?;
    let silence = vec![0_i16; 8_000];
    let _ = session.send_pcm16k(&silence)?;
    let _ = session.finalize()?;
    session.shutdown()?;
    Ok(())
}
