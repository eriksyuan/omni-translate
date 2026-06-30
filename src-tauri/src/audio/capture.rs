use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

use crate::{log_debug, log_error};

use super::buffer::PcmWindowBuffer;
use super::devices::{list_input_devices, resolve_device};
use super::integrated_feeder::IntegratedPcmInput;
use super::session::{forward_chunk_to_integrated, forward_chunk_to_pipeline};
use super::types::{
    AudioCaptureStatus, AudioChunkPayload, AudioInputDevice, AudioSourceKind,
};

const EVENT_AUDIO_CHUNK: &str = "audio://chunk";
const EVENT_AUDIO_ERROR: &str = "audio://error";
const EVENT_AUDIO_STATE: &str = "audio://state";

pub enum PipelineFeed {
    Modular(Sender<Vec<i16>>),
    Integrated(Sender<IntegratedPcmInput>),
}

#[derive(Debug, Error)]
pub enum CaptureError {
    #[error(transparent)]
    Device(#[from] super::devices::DeviceError),
    #[error("audio capture is already running")]
    AlreadyRunning,
    #[error("audio capture is not running")]
    NotRunning,
    #[error("failed to query device config: {0}")]
    Config(String),
    #[error("failed to build input stream: {0}")]
    BuildStream(String),
    #[error("failed to start input stream: {0}")]
    PlayStream(String),
    #[error("capture thread stopped unexpectedly")]
    ThreadStopped,
}

struct CaptureRuntime {
    stop_tx: Sender<()>,
    capture_thread: JoinHandle<Result<(), String>>,
    emitter_thread: JoinHandle<()>,
}

pub struct AudioCaptureManager {
    runtime: Mutex<Option<CaptureRuntime>>,
    status: Arc<Mutex<AudioCaptureStatus>>,
}

impl Default for AudioCaptureManager {
    fn default() -> Self {
        Self {
            runtime: Mutex::new(None),
            status: Arc::new(Mutex::new(AudioCaptureStatus::default())),
        }
    }
}

impl AudioCaptureManager {
    pub fn status(&self) -> AudioCaptureStatus {
        self.status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_default()
    }

    pub fn start(
        &self,
        app: AppHandle,
        source: AudioSourceKind,
        device_id: Option<String>,
        pipeline_feed: Option<PipelineFeed>,
    ) -> Result<AudioCaptureStatus, CaptureError> {
        let mut runtime_guard = self
            .runtime
            .lock()
            .map_err(|_| CaptureError::ThreadStopped)?;

        if runtime_guard.is_some() {
            return Err(CaptureError::AlreadyRunning);
        }

        let devices = list_input_devices()?;
        let device = resolve_device(&devices, source, device_id.as_deref())?;
        let device_name = device.name().map_err(|e| CaptureError::Config(e.to_string()))?;

        let supported = device
            .default_input_config()
            .map_err(|e| CaptureError::Config(e.to_string()))?;
        let sample_format = supported.sample_format();
        let stream_config: StreamConfig = supported.clone().into();
        let sample_rate = stream_config.sample_rate.0;
        let channels = stream_config.channels;

        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let (sample_tx, sample_rx) = mpsc::channel::<Vec<i16>>();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

        let app_for_errors = app.clone();
        let capture_device_name = device_name.clone();
        let capture_thread = thread::spawn(move || {
            run_capture_thread(
                device,
                stream_config,
                sample_format,
                sample_tx,
                stop_rx,
                capture_device_name,
                app_for_errors,
                ready_tx,
            )
        });

        match ready_rx.recv_timeout(Duration::from_secs(3)) {
            Ok(Ok(())) => {}
            Ok(Err(message)) => {
                let _ = ready_rx.recv_timeout(Duration::from_millis(0));
                let _ = stop_tx.send(());
                let _ = capture_thread.join();
                eprintln!("[audio] capture failed to start on {device_name}: {message}");
                log_error!("capture", "failed to start on {device_name}: {message}");
                emit_capture_error(&app, message.clone());
                return Err(CaptureError::PlayStream(message));
            }
            Err(_) => {
                let _ = stop_tx.send(());
                let _ = capture_thread.join();
                let message = "audio input stream did not start in time (check microphone permission)"
                    .to_string();
                eprintln!("[audio] capture start timed out on {device_name}");
                log_error!("capture", "start timed out on {device_name}");
                emit_capture_error(&app, message.clone());
                return Err(CaptureError::PlayStream(message));
            }
        }

        let status = AudioCaptureStatus {
            active: true,
            source: Some(source),
            device_name: Some(device_name),
            sample_rate: Some(sample_rate),
            channels: Some(channels),
            chunks_emitted: 0,
        };

        if let Ok(mut shared_status) = self.status.lock() {
            *shared_status = status.clone();
        }

        let emitter_status = Arc::clone(&self.status);
        let emitter_app = app.clone();
        let _ = emit_capture_state(&emitter_app, &status);
        let emitter_thread = thread::spawn(move || {
            emit_samples_loop(emitter_app, sample_rx, emitter_status, pipeline_feed);
        });

        *runtime_guard = Some(CaptureRuntime {
            stop_tx,
            capture_thread,
            emitter_thread,
        });

        Ok(status)
    }

    pub fn stop(&self) -> Result<AudioCaptureStatus, CaptureError> {
        let runtime = self
            .runtime
            .lock()
            .map_err(|_| CaptureError::ThreadStopped)?
            .take()
            .ok_or(CaptureError::NotRunning)?;

        let _ = runtime.stop_tx.send(());

        match runtime.capture_thread.join() {
            Ok(Ok(())) => {}
            Ok(Err(message)) => {
                return Err(CaptureError::BuildStream(message));
            }
            Err(_) => return Err(CaptureError::ThreadStopped),
        }

        let _ = runtime.emitter_thread.join();

        let status = AudioCaptureStatus {
            active: false,
            source: None,
            device_name: None,
            sample_rate: None,
            channels: None,
            chunks_emitted: self
                .status
                .lock()
                .map(|status| status.chunks_emitted)
                .unwrap_or(0),
        };

        if let Ok(mut shared_status) = self.status.lock() {
            *shared_status = status.clone();
        }

        Ok(status)
    }
}

impl Default for AudioCaptureStatus {
    fn default() -> Self {
        Self {
            active: false,
            source: None,
            device_name: None,
            sample_rate: None,
            channels: None,
            chunks_emitted: 0,
        }
    }
}

fn run_capture_thread(
    device: cpal::Device,
    config: StreamConfig,
    sample_format: SampleFormat,
    sample_tx: Sender<Vec<i16>>,
    stop_rx: Receiver<()>,
    device_name: String,
    app: AppHandle,
    ready_tx: Sender<Result<(), String>>,
) -> Result<(), String> {
    let err_fn = move |err| {
        eprintln!("[audio] stream error on {device_name}: {err}");
        log_error!("capture", "stream error on {device_name}: {err}");
        emit_capture_error(&app, format!("stream error: {err}"));
    };

    let started: Result<cpal::Stream, String> = (|| {
        let stream = match sample_format {
            SampleFormat::F32 => device.build_input_stream(
                &config,
                move |data: &[f32], _| send_samples(&sample_tx, data.iter().copied().map(f32_to_i16)),
                err_fn,
                None,
            ),
            SampleFormat::I16 => device.build_input_stream(
                &config,
                move |data: &[i16], _| send_samples(&sample_tx, data.iter().copied()),
                err_fn,
                None,
            ),
            SampleFormat::U16 => device.build_input_stream(
                &config,
                move |data: &[u16], _| {
                    send_samples(&sample_tx, data.iter().copied().map(u16_to_i16))
                },
                err_fn,
                None,
            ),
            other => {
                return Err(format!("unsupported sample format: {other:?}"));
            }
        }
        .map_err(|e| format!("build input stream: {e}"))?;

        stream
            .play()
            .map_err(|e| format!("start input stream: {e}"))?;

        Ok(stream)
    })();

    let _ = ready_tx.send(started.as_ref().map(|_| ()).map_err(|e| e.clone()));

    let stream = match started {
        Ok(stream) => stream,
        Err(err) => return Err(err),
    };

    while stop_rx.recv_timeout(Duration::from_millis(50)).is_err() {}

    drop(stream);
    Ok(())
}

fn send_samples<I>(sample_tx: &Sender<Vec<i16>>, samples: I)
where
    I: Iterator<Item = i16>,
{
    let chunk: Vec<i16> = samples.collect();
    if chunk.is_empty() {
        return;
    }
    let _ = sample_tx.send(chunk);
}

fn emit_samples_loop(
    app: AppHandle,
    sample_rx: Receiver<Vec<i16>>,
    status: Arc<Mutex<AudioCaptureStatus>>,
    pipeline_feed: Option<PipelineFeed>,
) {
    let mut sequence = 0_u64;
    let mut window_buffer = PcmWindowBuffer::new(0, 1);
    let (modular_tx, integrated_tx) = match pipeline_feed {
        Some(PipelineFeed::Modular(tx)) => (Some(tx), None),
        Some(PipelineFeed::Integrated(tx)) => (None, Some(tx)),
        None => (None, None),
    };

    while let Ok(samples) = sample_rx.recv() {
        let (sample_rate, channels) = {
            let Ok(guard) = status.lock() else {
                break;
            };
            (
                guard.sample_rate.unwrap_or(0),
                guard.channels.unwrap_or(0),
            )
        };

        if modular_tx.is_some() {
            forward_chunk_to_pipeline(
                &mut window_buffer,
                &modular_tx,
                &samples,
                sample_rate,
                channels,
            );
        } else {
            forward_chunk_to_integrated(&integrated_tx, &samples, sample_rate, channels);
        }

        sequence += 1;
        let sample_count = samples.len();
        let payload = AudioChunkPayload {
            sequence,
            sample_rate,
            channels,
            samples,
        };

        if let Ok(mut guard) = status.lock() {
            guard.chunks_emitted = sequence;
        }

        if app.emit(EVENT_AUDIO_CHUNK, payload).is_err() {
            break;
        }

        if sequence == 1 || sequence.is_multiple_of(50) {
            log_debug!(
                "capture",
                "chunk seq={sequence} samples={sample_count} rate={sample_rate} ch={channels}",
            );
        }
    }
}

pub fn emit_capture_error(app: &AppHandle, message: impl Into<String>) {
    let _ = app.emit(EVENT_AUDIO_ERROR, message.into());
}

pub fn emit_capture_state(app: &AppHandle, status: &AudioCaptureStatus) {
    let _ = app.emit(EVENT_AUDIO_STATE, status.clone());
}

fn f32_to_i16(sample: f32) -> i16 {
    let clamped = sample.clamp(-1.0, 1.0);
    (clamped * i16::MAX as f32) as i16
}

fn u16_to_i16(sample: u16) -> i16 {
    (sample as i32 - i16::MAX as i32) as i16
}

pub fn list_devices() -> Result<Vec<AudioInputDevice>, CaptureError> {
    list_input_devices().map_err(CaptureError::from)
}

pub const AUDIO_CHUNK_EVENT: &str = EVENT_AUDIO_CHUNK;
pub const AUDIO_ERROR_EVENT: &str = EVENT_AUDIO_ERROR;
pub const AUDIO_STATE_EVENT: &str = EVENT_AUDIO_STATE;
