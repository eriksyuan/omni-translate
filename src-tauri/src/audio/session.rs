use std::sync::mpsc::Sender;

use tauri::AppHandle;
use thiserror::Error;

use crate::providers::AudioSessionConfig;

use crate::{log_error, log_info};

use super::capture::{emit_capture_state, AudioCaptureManager, CaptureError, PipelineFeed};
use super::integrated_feeder::IntegratedPcmInput;
use super::pipeline::{AudioTranslationPipeline, PipelineError};
use super::types::AudioCaptureStatus;
use super::buffer::PcmWindowBuffer;

#[derive(Debug, Error)]
pub enum SessionError {
    #[error(transparent)]
    Capture(#[from] CaptureError),
    #[error(transparent)]
    Pipeline(#[from] PipelineError),
    #[error("failed to start session: {0}")]
    Start(String),
}

pub struct AudioSessionManager;

impl AudioSessionManager {
    pub fn start(
        app: &AppHandle,
        capture: &AudioCaptureManager,
        pipeline: &AudioTranslationPipeline,
        source: super::types::AudioSourceKind,
        device_id: Option<String>,
        session_config: AudioSessionConfig,
    ) -> Result<AudioCaptureStatus, SessionError> {
        eprintln!("[session] starting audio session (source={source:?})");
        log_info!("session", "starting audio session source={source:?}");

        if let Err(err) = pipeline.start(app.clone(), session_config) {
            eprintln!("[session] pipeline start failed: {err}");
            log_error!("session", "pipeline start failed: {err}");
            return Err(err.into());
        }

        let pipeline_feed = match pipeline.modular_feed() {
            Some(feed) => PipelineFeed::Modular {
                tx: feed.tx,
                streaming: feed.streaming,
            },
            None => {
                let pcm_tx = pipeline
                    .integrated_pcm_sender()
                    .ok_or_else(|| SessionError::Start("pipeline channel unavailable".into()))?;
                PipelineFeed::Integrated(pcm_tx)
            }
        };

        match capture.start(app.clone(), source, device_id, Some(pipeline_feed)) {
            Ok(status) => {
                eprintln!("[session] capture started on {:?}", status.device_name);
                log_info!(
                    "session",
                    "capture started device={:?} rate={:?} channels={:?}",
                    status.device_name,
                    status.sample_rate,
                    status.channels
                );
                Ok(status)
            }
            Err(err) => {
                eprintln!("[session] capture start failed: {err}");
                log_error!("session", "capture start failed: {err}");
                let _ = pipeline.stop();
                Err(err.into())
            }
        }
    }

    pub fn stop(
        app: &AppHandle,
        capture: &AudioCaptureManager,
        pipeline: &AudioTranslationPipeline,
    ) -> Result<AudioCaptureStatus, SessionError> {
        eprintln!("[session] stopping audio session");
        log_info!("session", "stopping audio session");
        // Stop capture first so PCM stops flowing before the pipeline worker shuts down.
        let status = capture.stop()?;
        let _ = pipeline.stop();
        emit_capture_state(app, &status);
        eprintln!("[session] audio session stopped");
        log_info!(
            "session",
            "audio session stopped chunks_emitted={}",
            status.chunks_emitted
        );
        Ok(status)
    }
}

/// Fan-out from capture chunks into fixed PCM windows for the modular translation pipeline.
pub fn forward_chunk_to_pipeline(
    buffer: &mut PcmWindowBuffer,
    pipeline_tx: &Option<Sender<Vec<i16>>>,
    samples: &[i16],
    sample_rate: u32,
    channels: u16,
) {
    let Some(tx) = pipeline_tx else {
        return;
    };
    buffer.update_format(sample_rate, channels);
    for window in buffer.push_interleaved(samples) {
        let _ = tx.send(window);
    }
}

/// Forward raw capture chunks to the integrated speech translation feeder.
pub fn forward_chunk_to_integrated(
    pipeline_tx: &Option<Sender<IntegratedPcmInput>>,
    samples: &[i16],
    sample_rate: u32,
    channels: u16,
) {
    let Some(tx) = pipeline_tx else {
        return;
    };
    let _ = tx.send(IntegratedPcmInput {
        samples: samples.to_vec(),
        sample_rate,
        channels,
    });
}
