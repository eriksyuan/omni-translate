use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use tauri::{AppHandle, Emitter};
use thiserror::Error;

use crate::providers::{
    asr::{self, AsrProvider},
    speech_translate,
    translation::{self, MtProvider},
    AudioSessionConfig, AsrConfig, MtConfig, PipelineErrorPayload, PipelineStatePayload,
    SpeechTranslateConfig, SubtitleUpdatePayload, EVENT_PIPELINE_ERROR, EVENT_PIPELINE_STATE,
    EVENT_SUBTITLE_UPDATE,
};
use crate::providers::translation::build_translation_tokens;

use super::buffer::{normalized_rms, SILENCE_RMS_THRESHOLD};
use super::integrated_feeder::IntegratedPcmInput;

#[derive(Debug, Error)]
pub enum PipelineError {
    #[error("pipeline is already running")]
    AlreadyRunning,
    #[error("pipeline is not running")]
    NotRunning,
    #[error("failed to initialize ASR: {0}")]
    AsrInit(String),
    #[error("failed to initialize MT: {0}")]
    MtInit(String),
    #[error("failed to initialize speech translate: {0}")]
    SpeechInit(String),
    #[error("pipeline thread stopped unexpectedly")]
    ThreadStopped,
}

enum PipelineRuntime {
    Modular {
        stop_tx: Sender<()>,
        chunk_tx: Sender<Vec<i16>>,
        worker: JoinHandle<()>,
    },
    Integrated {
        stop_tx: Sender<()>,
        pcm_tx: Sender<IntegratedPcmInput>,
        worker: JoinHandle<()>,
    },
}

pub struct AudioTranslationPipeline {
    runtime: Mutex<Option<PipelineRuntime>>,
    consecutive_errors: Arc<Mutex<u32>>,
}

impl Default for AudioTranslationPipeline {
    fn default() -> Self {
        Self {
            runtime: Mutex::new(None),
            consecutive_errors: Arc::new(Mutex::new(0)),
        }
    }
}

impl AudioTranslationPipeline {
    pub fn is_running(&self) -> bool {
        self.runtime
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }

    pub fn modular_chunk_sender(&self) -> Option<Sender<Vec<i16>>> {
        self.runtime.lock().ok().and_then(|guard| match guard.as_ref()? {
            PipelineRuntime::Modular { chunk_tx, .. } => Some(chunk_tx.clone()),
            PipelineRuntime::Integrated { .. } => None,
        })
    }

    pub fn integrated_pcm_sender(&self) -> Option<Sender<IntegratedPcmInput>> {
        self.runtime.lock().ok().and_then(|guard| match guard.as_ref()? {
            PipelineRuntime::Modular { .. } => None,
            PipelineRuntime::Integrated { pcm_tx, .. } => Some(pcm_tx.clone()),
        })
    }

    pub fn start(&self, app: AppHandle, session_config: AudioSessionConfig) -> Result<(), PipelineError> {
        match session_config {
            AudioSessionConfig::Modular { asr_config, mt_config } => {
                self.start_modular(app, asr_config, mt_config)
            }
            AudioSessionConfig::Integrated { speech_config } => {
                self.start_integrated(app, speech_config)
            }
        }
    }

    pub fn start_modular(
        &self,
        app: AppHandle,
        asr_config: AsrConfig,
        mt_config: MtConfig,
    ) -> Result<(), PipelineError> {
        let mut guard = self
            .runtime
            .lock()
            .map_err(|_| PipelineError::ThreadStopped)?;

        if guard.is_some() {
            return Err(PipelineError::AlreadyRunning);
        }

        let asr = asr::build_asr(&asr_config).map_err(|e| PipelineError::AsrInit(e.to_string()))?;
        let mt =
            translation::build_mt(&mt_config).map_err(|e| PipelineError::MtInit(e.to_string()))?;

        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let (chunk_tx, chunk_rx) = mpsc::channel::<Vec<i16>>();

        if let Ok(mut errors) = self.consecutive_errors.lock() {
            *errors = 0;
        }

        let consecutive_errors = Arc::clone(&self.consecutive_errors);
        let worker = thread::spawn(move || {
            run_modular_worker(app, asr, mt, chunk_rx, stop_rx, consecutive_errors);
        });

        *guard = Some(PipelineRuntime::Modular {
            stop_tx,
            chunk_tx,
            worker,
        });

        Ok(())
    }

    pub fn start_integrated(
        &self,
        app: AppHandle,
        speech_config: SpeechTranslateConfig,
    ) -> Result<(), PipelineError> {
        speech_translate::build_session(&speech_config)
            .map_err(|e| PipelineError::SpeechInit(e))?;

        let mut guard = self
            .runtime
            .lock()
            .map_err(|_| PipelineError::ThreadStopped)?;

        if guard.is_some() {
            return Err(PipelineError::AlreadyRunning);
        }

        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let (pcm_tx, pcm_rx) = mpsc::channel::<IntegratedPcmInput>();

        if let Ok(mut errors) = self.consecutive_errors.lock() {
            *errors = 0;
        }

        let worker = thread::spawn(move || {
            speech_translate::run_integrated_worker(app, speech_config, pcm_rx, stop_rx);
        });

        *guard = Some(PipelineRuntime::Integrated {
            stop_tx,
            pcm_tx,
            worker,
        });

        Ok(())
    }

    pub fn stop(&self) -> Result<(), PipelineError> {
        let runtime = self
            .runtime
            .lock()
            .map_err(|_| PipelineError::ThreadStopped)?
            .take()
            .ok_or(PipelineError::NotRunning)?;

        match runtime {
            PipelineRuntime::Modular {
                stop_tx,
                worker, ..
            }
            | PipelineRuntime::Integrated {
                stop_tx,
                worker, ..
            } => {
                let _ = stop_tx.send(());
                let _ = worker.join();
            }
        }

        Ok(())
    }
}

fn run_modular_worker(
    app: AppHandle,
    asr: Box<dyn AsrProvider>,
    mt: Box<dyn MtProvider>,
    chunk_rx: Receiver<Vec<i16>>,
    stop_rx: Receiver<()>,
    consecutive_errors: Arc<Mutex<u32>>,
) {
    let mut last_transcript = String::new();

    loop {
        if stop_rx.try_recv().is_ok() {
            break;
        }

        match chunk_rx.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(pcm) => {
                if normalized_rms(&pcm) < SILENCE_RMS_THRESHOLD {
                    continue;
                }

                emit_pipeline_state(&app, true, false);

                match asr.transcribe_pcm16k(&pcm) {
                    Ok(text) => {
                        let text = text.trim().to_string();
                        if text.is_empty() || text == last_transcript {
                            emit_pipeline_state(&app, false, false);
                            continue;
                        }
                        last_transcript.clone_from(&text);

                        emit_pipeline_state(&app, false, true);
                        match mt.translate(&text) {
                            Ok(translation) => {
                                if let Ok(mut errors) = consecutive_errors.lock() {
                                    *errors = 0;
                                }
                                let payload = SubtitleUpdatePayload {
                                    original: text,
                                    translation: translation.clone(),
                                    tokens: build_translation_tokens(&translation),
                                };
                                let _ = app.emit(EVENT_SUBTITLE_UPDATE, payload);
                            }
                            Err(err) => {
                                if mt.translate(&text).is_ok_and(|translation| {
                                    if let Ok(mut errors) = consecutive_errors.lock() {
                                        *errors = 0;
                                    }
                                    let payload = SubtitleUpdatePayload {
                                        original: text.clone(),
                                        translation: translation.clone(),
                                        tokens: build_translation_tokens(&translation),
                                    };
                                    let _ = app.emit(EVENT_SUBTITLE_UPDATE, payload);
                                    true
                                }) {
                                    continue;
                                }
                                handle_pipeline_error(
                                    &app,
                                    &consecutive_errors,
                                    "mt",
                                    &err.to_string(),
                                );
                            }
                        }
                    }
                    Err(asr::AsrError::Empty) => {}
                    Err(err) => {
                        handle_pipeline_error(&app, &consecutive_errors, "asr", &err.to_string());
                    }
                }

                emit_pipeline_state(&app, false, false);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn handle_pipeline_error(
    app: &AppHandle,
    consecutive_errors: &Arc<Mutex<u32>>,
    code: &str,
    message: &str,
) {
    let count = consecutive_errors
        .lock()
        .map(|mut c| {
            *c += 1;
            *c
        })
        .unwrap_or(1);

    let _ = app.emit(
        EVENT_PIPELINE_ERROR,
        PipelineErrorPayload {
            code: code.to_string(),
            message: message.to_string(),
        },
    );

    if count >= 5 {
        let _ = app.emit(
            EVENT_PIPELINE_ERROR,
            PipelineErrorPayload {
                code: "pipeline_stopped".into(),
                message: "Too many consecutive errors; stopping session.".into(),
            },
        );
    }
}

fn emit_pipeline_state(app: &AppHandle, asr_pending: bool, mt_pending: bool) {
    let _ = app.emit(
        EVENT_PIPELINE_STATE,
        PipelineStatePayload {
            asr_pending,
            mt_pending,
        },
    );
}

pub fn test_asr_connection(asr_config: &AsrConfig) -> Result<(), String> {
    let asr = asr::build_asr(asr_config).map_err(|e| e.to_string())?;
    match asr.transcribe_pcm16k(&asr::test_pcm_chunk()) {
        Ok(_) | Err(asr::AsrError::Empty) => Ok(()),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("401") || msg.contains("403") || msg.contains("Auth") || msg.contains("Invalid") {
                Err(msg)
            } else {
                Ok(())
            }
        }
    }
}

pub fn test_mt_connection(mt_config: &MtConfig) -> Result<String, String> {
    let mt = translation::build_mt(mt_config).map_err(|e| e.to_string())?;
    mt.translate("Hello").map_err(|e| e.to_string())
}

pub fn test_speech_translate_connection(config: &SpeechTranslateConfig) -> Result<(), String> {
    speech_translate::test_connection(config)
}
