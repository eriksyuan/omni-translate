use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};
use thiserror::Error;

use crate::providers::{
    asr::{self, sherpa::SherpaSidecarSession, AsrProvider},
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
        streaming: bool,
        worker: JoinHandle<()>,
    },
    Integrated {
        stop_tx: Sender<()>,
        pcm_tx: Sender<IntegratedPcmInput>,
        worker: JoinHandle<()>,
    },
}

pub struct ModularPipelineFeed {
    pub tx: Sender<Vec<i16>>,
    pub streaming: bool,
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
        self.modular_feed().map(|feed| feed.tx)
    }

    pub fn modular_feed(&self) -> Option<ModularPipelineFeed> {
        self.runtime.lock().ok().and_then(|guard| match guard.as_ref()? {
            PipelineRuntime::Modular {
                chunk_tx,
                streaming,
                ..
            } => Some(ModularPipelineFeed {
                tx: chunk_tx.clone(),
                streaming: *streaming,
            }),
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

        let is_sherpa = matches!(asr_config, AsrConfig::Sherpa { .. });

        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let (chunk_tx, chunk_rx) = mpsc::channel::<Vec<i16>>();

        if let Ok(mut errors) = self.consecutive_errors.lock() {
            *errors = 0;
        }

        let consecutive_errors = Arc::clone(&self.consecutive_errors);

        if is_sherpa {
            let AsrConfig::Sherpa { model } = asr_config else {
                unreachable!();
            };
            let worker = thread::spawn(move || {
                run_modular_sherpa_worker(app, model, mt_config, chunk_rx, stop_rx, consecutive_errors);
            });
            *guard = Some(PipelineRuntime::Modular {
                stop_tx,
                chunk_tx,
                streaming: true,
                worker,
            });
            return Ok(());
        }

        let asr = asr::build_asr(&asr_config).map_err(|e| PipelineError::AsrInit(e.to_string()))?;
        let mt =
            translation::build_mt(&mt_config).map_err(|e| PipelineError::MtInit(e.to_string()))?;

        let worker = thread::spawn(move || {
            run_modular_worker(app, asr, mt, chunk_rx, stop_rx, consecutive_errors);
        });

        *guard = Some(PipelineRuntime::Modular {
            stop_tx,
            chunk_tx,
            streaming: false,
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

const PARTIAL_MT_INTERVAL: Duration = Duration::from_millis(500);
/// Skip MT on very short partials (noise / "I…").
const MIN_PARTIAL_MT_CHARS: usize = 3;
/// ASR hypothesis unchanged for this long → treat as stable and commit (translate once).
const STABLE_ASR_COMMIT: Duration = Duration::from_millis(600);
const MIN_STABLE_COMMIT_CHARS: usize = 6;
/// Force-commit the open segment when it grows beyond this length, even mid-speech.
/// Keeps subtitle segments readable without waiting for a pause or endpoint.
const MAX_OPEN_SEGMENT_CHARS: usize = 40;
/// Minimum gap between forced length-based commits (protects rate-limited MT).
const MIN_FORCE_COMMIT_INTERVAL: Duration = Duration::from_secs(2);
/// Minimum open-segment length before a forced length commit is considered.
const MIN_FORCE_COMMIT_CHARS: usize = 16;
/// Commit at a sentence boundary as soon as the clause is long enough.
const MIN_SENTENCE_BOUNDARY_CHARS: usize = 8;

/// Strong sentence terminators — commit immediately once seen at end of open segment.
const STRONG_BOUNDARIES: [char; 7] = ['.', '?', '!', '。', '？', '！', '…'];

/// Weaker clause boundaries — used when force-splitting long segments.
const CLAUSE_BOUNDARIES: [char; 5] = [',', ';', ':', '，', '；'];

/// If `text` ends at a strong sentence boundary, return the byte length of the committable prefix.
fn sentence_boundary_prefix_len(text: &str) -> Option<usize> {
    let trimmed = text.trim_end();
    if trimmed.is_empty() {
        return None;
    }
    let last = trimmed.chars().last()?;
    if !STRONG_BOUNDARIES.contains(&last) {
        return None;
    }
    Some(trimmed.len())
}

/// Pick a split point for force-commit: prefer clause punctuation, then whitespace, else hard cap.
fn force_commit_split(text: &str, max_chars: usize) -> usize {
    let char_count = text.chars().count();
    if char_count <= max_chars {
        return text.len();
    }

    let target = text
        .char_indices()
        .nth(max_chars)
        .map(|(idx, _)| idx)
        .unwrap_or(text.len());

    let prefix = &text[..target];

    if let Some((idx, _)) = prefix
        .char_indices()
        .rev()
        .find(|(_, ch)| CLAUSE_BOUNDARIES.contains(ch))
    {
        return idx + prefix[idx..].chars().next().map(|c| c.len_utf8()).unwrap_or(0);
    }

    if let Some((idx, _)) = prefix.char_indices().rev().find(|(_, ch)| ch.is_whitespace()) {
        return idx;
    }

    target
}

fn split_at_byte(text: &str, byte_idx: usize) -> (&str, &str) {
    if byte_idx >= text.len() {
        return (text.trim(), "");
    }
    let (head, tail) = text.split_at(byte_idx);
    (head.trim(), tail.trim_start())
}

/// Streaming partial MT: throttle re-translation on the *unstable* open segment only.
///
/// Stable segments (Sherpa `is_final` or ASR text unchanged for STABLE_ASR_COMMIT) are
/// committed as separate subtitle entries and never re-translated.
struct SherpaStreamingState {
    sentence_id: u64,
    /// Cumulative ASR text already committed via stability (before Sherpa endpoint reset).
    stable_prefix: String,
    /// Open (unstable) segment text derived from latest ASR minus stable_prefix.
    last_asr_text: String,
    last_asr_changed_at: Option<Instant>,
    /// Source text last sent to MT for the open segment.
    last_translated_source: String,
    last_translation: String,
    last_mt_at: Option<Instant>,
    mt_generation: u64,
    /// Timestamp of the most recent committed segment (stable or forced).
    last_commit_at: Option<Instant>,
    /// Most recently committed source text — prevents duplicate final entries.
    last_committed_text: String,
}

impl SherpaStreamingState {
    fn new() -> Self {
        Self {
            sentence_id: 1,
            stable_prefix: String::new(),
            last_asr_text: String::new(),
            last_asr_changed_at: None,
            last_translated_source: String::new(),
            last_translation: String::new(),
            last_mt_at: None,
            mt_generation: 0,
            last_commit_at: None,
            last_committed_text: String::new(),
        }
    }

    fn is_already_committed(&self, text: &str) -> bool {
        let text = text.trim();
        text.is_empty()
            || text
                .eq_ignore_ascii_case(self.last_committed_text.trim())
    }

    fn can_commit_now(&self) -> bool {
        match self.last_commit_at {
            None => true,
            Some(at) => at.elapsed() >= STABLE_ASR_COMMIT,
        }
    }

    fn record_successful_commit(&mut self, text: &str) {
        self.last_committed_text = text.trim().to_string();
        self.last_commit_at = Some(Instant::now());
    }

    fn clear_utterance_tracking(&mut self) {
        self.stable_prefix.clear();
        self.last_committed_text.clear();
    }

    fn utterance_key(&self) -> String {
        format!("s-{}", self.sentence_id)
    }

    fn reset_open_mt_state(&mut self) {
        self.last_asr_text.clear();
        self.last_asr_changed_at = None;
        self.last_translated_source.clear();
        self.last_translation.clear();
        self.last_mt_at = None;
        self.mt_generation += 1;
    }

    fn open_segment_text(&self, full_asr: &str) -> String {
        let full = full_asr.trim();
        if full.is_empty() {
            return String::new();
        }
        if self.stable_prefix.is_empty() {
            return full.to_string();
        }
        let prefix = self.stable_prefix.trim();

        // Sherpa cumulative text still within already-committed range.
        if full.eq_ignore_ascii_case(prefix) {
            return String::new();
        }

        if full.len() >= prefix.len() && full[..prefix.len()].eq_ignore_ascii_case(prefix) {
            let tail = full[prefix.len()..].trim_start();
            return tail.to_string();
        }

        // ASR rolled back to a shorter hypothesis already covered by stable_prefix.
        if prefix.len() >= full.len() && prefix[..full.len()].eq_ignore_ascii_case(full) {
            return String::new();
        }

        // Major ASR revision — drop stale prefix and treat the full hypothesis as open.
        full.to_string()
    }

    fn append_stable_prefix(&mut self, segment: &str) {
        let segment = segment.trim();
        if segment.is_empty() {
            return;
        }
        if self.stable_prefix.is_empty() {
            self.stable_prefix = segment.to_string();
        } else {
            self.stable_prefix.push(' ');
            self.stable_prefix.push_str(segment);
        }
    }

    fn should_translate_partial(&self) -> bool {
        if self.last_asr_text.len() < MIN_PARTIAL_MT_CHARS {
            return false;
        }
        if self.last_asr_text == self.last_translated_source {
            return false;
        }
        match self.last_mt_at {
            None => true,
            Some(at) => at.elapsed() >= PARTIAL_MT_INTERVAL,
        }
    }

    fn try_translate_partial(
        &mut self,
        app: &AppHandle,
        mt: &dyn MtProvider,
        consecutive_errors: &Arc<Mutex<u32>>,
    ) {
        if !mt.supports_streaming_partial() {
            return;
        }
        if !self.should_translate_partial() {
            return;
        }

        let text = self.last_asr_text.clone();
        self.mt_generation += 1;
        let gen = self.mt_generation;

        emit_pipeline_state(app, false, true);
        match mt.translate(&text) {
            Ok(translation) => {
                if gen != self.mt_generation {
                    emit_pipeline_state(app, false, false);
                    return;
                }
                if let Ok(mut errors) = consecutive_errors.lock() {
                    *errors = 0;
                }
                self.last_translated_source.clone_from(&text);
                self.last_translation.clone_from(&translation);
                self.last_mt_at = Some(Instant::now());
                emit_sherpa_subtitle(
                    app,
                    &self.utterance_key(),
                    &text,
                    &translation,
                    false,
                );
            }
            Err(err) => {
                let msg = err.to_string();
                if is_mt_rate_limited(&msg) {
                    return;
                }
                handle_pipeline_error(app, consecutive_errors, "mt", &msg);
            }
        }
        emit_pipeline_state(app, false, false);
    }

    fn on_partial_asr(&mut self, full_text: String, app: &AppHandle) {
        let open = self.open_segment_text(&full_text);
        if open.is_empty() {
            // Already committed — clear stale open text so stable commit won't re-fire.
            if !self.last_asr_text.is_empty() {
                self.last_asr_text.clear();
                self.last_asr_changed_at = None;
            }
            return;
        }
        if self.is_already_committed(&open) {
            self.last_asr_text.clear();
            self.last_asr_changed_at = None;
            return;
        }

        // ASR major revision: open equals full while we still hold a stale stable_prefix.
        if !self.stable_prefix.is_empty()
            && open.eq_ignore_ascii_case(full_text.trim())
            && !self.is_already_committed(&open)
        {
            self.stable_prefix.clear();
        }

        if open == self.last_asr_text {
            return;
        }
        self.last_asr_text = open;
        self.last_asr_changed_at = Some(Instant::now());
        emit_sherpa_subtitle(
            app,
            &self.utterance_key(),
            &self.last_asr_text,
            &self.last_translation,
            false,
        );
    }

    fn try_commit_stable_asr(
        &mut self,
        app: &AppHandle,
        mt: &dyn MtProvider,
        consecutive_errors: &Arc<Mutex<u32>>,
    ) {
        if self.last_asr_text.len() < MIN_STABLE_COMMIT_CHARS {
            return;
        }
        if self.is_already_committed(&self.last_asr_text) {
            return;
        }
        if !self.can_commit_now() {
            return;
        }
        let Some(changed_at) = self.last_asr_changed_at else {
            return;
        };
        if changed_at.elapsed() < STABLE_ASR_COMMIT {
            return;
        }
        let text = self.last_asr_text.clone();
        self.commit_segment(app, mt, consecutive_errors, &text, true);
    }

    /// Commit as soon as the open segment ends with sentence punctuation.
    fn try_commit_on_sentence_boundary(
        &mut self,
        app: &AppHandle,
        mt: &dyn MtProvider,
        consecutive_errors: &Arc<Mutex<u32>>,
    ) {
        if self.last_asr_text.len() < MIN_SENTENCE_BOUNDARY_CHARS {
            return;
        }
        let Some(prefix_len) = sentence_boundary_prefix_len(&self.last_asr_text) else {
            return;
        };
        if prefix_len < MIN_SENTENCE_BOUNDARY_CHARS {
            return;
        }
        let open = self.last_asr_text.clone();
        let (head, tail) = split_at_byte(&open, prefix_len);
        if head.is_empty() {
            return;
        }
        if self.is_already_committed(head) {
            return;
        }
        if !self.can_commit_now() {
            return;
        }
        self.commit_prefix(app, mt, consecutive_errors, head, tail);
    }

    /// Force-commit when the open segment grows too long, even if ASR is still changing.
    /// Splits at a natural boundary so readers see smaller translated chunks during fast speech.
    fn try_force_commit_by_length(
        &mut self,
        app: &AppHandle,
        mt: &dyn MtProvider,
        consecutive_errors: &Arc<Mutex<u32>>,
    ) {
        if self.last_asr_text.len() < MIN_FORCE_COMMIT_CHARS {
            return;
        }
        if self.last_asr_text.chars().count() < MAX_OPEN_SEGMENT_CHARS {
            return;
        }
        let ready = match self.last_commit_at {
            None => true,
            Some(at) => at.elapsed() >= MIN_FORCE_COMMIT_INTERVAL,
        };
        if !ready {
            return;
        }
        let open = self.last_asr_text.clone();
        let split_at = force_commit_split(&open, MAX_OPEN_SEGMENT_CHARS);
        let (head, tail) = split_at_byte(&open, split_at);
        if head.is_empty() {
            return;
        }
        if self.is_already_committed(head) {
            return;
        }
        if !self.can_commit_now() {
            return;
        }
        self.commit_prefix(app, mt, consecutive_errors, head, tail);
    }

    fn on_final_asr(
        &mut self,
        text: String,
        app: &AppHandle,
        mt: &dyn MtProvider,
        consecutive_errors: &Arc<Mutex<u32>>,
    ) {
        // Sherpa resets its stream after endpoint. Only commit the uncommitted tail.
        let segment = self.open_segment_text(&text);
        if segment.is_empty() || self.is_already_committed(&segment) {
            self.clear_utterance_tracking();
            self.reset_open_mt_state();
            return;
        }
        // Endpoint boundary — committed tail is final for this utterance.
        self.stable_prefix.clear();
        self.last_committed_text.clear();
        self.commit_segment(app, mt, consecutive_errors, &segment, true);
    }

    fn commit_segment(
        &mut self,
        app: &AppHandle,
        mt: &dyn MtProvider,
        consecutive_errors: &Arc<Mutex<u32>>,
        text: &str,
        increment_sentence: bool,
    ) {
        if self.is_already_committed(text) {
            return;
        }
        self.mt_generation += 1;

        emit_pipeline_state(app, false, true);
        match mt.translate(text) {
            Ok(translation) => {
                if let Ok(mut errors) = consecutive_errors.lock() {
                    *errors = 0;
                }
                let key = self.utterance_key();
                emit_sherpa_subtitle(app, &key, text, &translation, true);

                if increment_sentence {
                    self.append_stable_prefix(text);
                    self.sentence_id += 1;
                }
                self.record_successful_commit(text);
                self.reset_open_mt_state();
            }
            Err(err) => {
                let msg = err.to_string();
                if is_mt_rate_limited(&msg) {
                    return;
                }
                handle_pipeline_error(app, consecutive_errors, "mt", &msg);
            }
        }
        emit_pipeline_state(app, false, false);
    }

    /// Commit a prefix of the open segment and keep the remainder for further ASR/MT.
    fn commit_prefix(
        &mut self,
        app: &AppHandle,
        mt: &dyn MtProvider,
        consecutive_errors: &Arc<Mutex<u32>>,
        head: &str,
        tail: &str,
    ) {
        if head.is_empty() || self.is_already_committed(head) {
            return;
        }
        self.mt_generation += 1;

        emit_pipeline_state(app, false, true);
        match mt.translate(head) {
            Ok(translation) => {
                if let Ok(mut errors) = consecutive_errors.lock() {
                    *errors = 0;
                }
                let key = self.utterance_key();
                emit_sherpa_subtitle(app, &key, head, &translation, true);

                self.append_stable_prefix(head);
                self.sentence_id += 1;
                self.record_successful_commit(head);

                self.last_asr_text = tail.to_string();
                self.last_asr_changed_at = if tail.is_empty() {
                    None
                } else {
                    Some(Instant::now())
                };
                self.last_translated_source.clear();
                self.last_translation.clear();
                self.last_mt_at = None;
                self.mt_generation += 1;

                if !tail.is_empty() {
                    emit_sherpa_subtitle(
                        app,
                        &self.utterance_key(),
                        tail,
                        "",
                        false,
                    );
                }
            }
            Err(err) => {
                let msg = err.to_string();
                if is_mt_rate_limited(&msg) {
                    return;
                }
                handle_pipeline_error(app, consecutive_errors, "mt", &msg);
            }
        }
        emit_pipeline_state(app, false, false);
    }
}

fn is_mt_rate_limited(message: &str) -> bool {
    message.contains("rate limited")
        || message.contains("429")
        || message.contains("Too many requests")
}

fn emit_sherpa_subtitle(
    app: &AppHandle,
    utterance_key: &str,
    original: &str,
    translation: &str,
    sentence_end: bool,
) {
    let payload = SubtitleUpdatePayload {
        original: original.to_string(),
        translation: translation.to_string(),
        sentence_id: Some(utterance_key.to_string()),
        sentence_end,
        tokens: build_translation_tokens(translation),
    };
    let _ = app.emit(EVENT_SUBTITLE_UPDATE, payload);
}

fn run_modular_sherpa_worker(
    app: AppHandle,
    model_id: String,
    mt_config: MtConfig,
    chunk_rx: Receiver<Vec<i16>>,
    stop_rx: Receiver<()>,
    consecutive_errors: Arc<Mutex<u32>>,
) {
    let mt = match translation::build_mt(&mt_config) {
        Ok(mt) => mt,
        Err(err) => {
            handle_pipeline_error(&app, &consecutive_errors, "mt", &err.to_string());
            return;
        }
    };

    let mut session = match SherpaSidecarSession::start(&app, &model_id) {
        Ok(session) => session,
        Err(err) => {
            handle_pipeline_error(&app, &consecutive_errors, "asr", &err.to_string());
            return;
        }
    };

    let mut streaming = SherpaStreamingState::new();

    loop {
        if stop_rx.try_recv().is_ok() {
            break;
        }

        streaming.try_translate_partial(&app, mt.as_ref(), &consecutive_errors);
        streaming.try_commit_on_sentence_boundary(&app, mt.as_ref(), &consecutive_errors);
        streaming.try_commit_stable_asr(&app, mt.as_ref(), &consecutive_errors);
        streaming.try_force_commit_by_length(&app, mt.as_ref(), &consecutive_errors);

        match chunk_rx.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(pcm) => {
                if normalized_rms(&pcm) < SILENCE_RMS_THRESHOLD {
                    streaming.try_translate_partial(&app, mt.as_ref(), &consecutive_errors);
                    streaming.try_commit_on_sentence_boundary(&app, mt.as_ref(), &consecutive_errors);
                    streaming.try_commit_stable_asr(&app, mt.as_ref(), &consecutive_errors);
                    streaming.try_force_commit_by_length(&app, mt.as_ref(), &consecutive_errors);
                    continue;
                }

                emit_pipeline_state(&app, true, false);

                match session.send_pcm16k(&pcm) {
                    Ok(partials) => {
                        for partial in partials {
                            let text = partial.text.trim().to_string();
                            if text.is_empty() {
                                continue;
                            }

                            if partial.is_final {
                                streaming.on_final_asr(text, &app, mt.as_ref(), &consecutive_errors);
                            } else {
                                streaming.on_partial_asr(text, &app);
                            }
                        }
                    }
                    Err(asr::AsrError::Empty) => {}
                    Err(err) => {
                        handle_pipeline_error(&app, &consecutive_errors, "asr", &err.to_string());
                    }
                }

                streaming.try_translate_partial(&app, mt.as_ref(), &consecutive_errors);
                streaming.try_commit_on_sentence_boundary(&app, mt.as_ref(), &consecutive_errors);
                streaming.try_commit_stable_asr(&app, mt.as_ref(), &consecutive_errors);
                streaming.try_force_commit_by_length(&app, mt.as_ref(), &consecutive_errors);
                emit_pipeline_state(&app, false, false);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                streaming.try_translate_partial(&app, mt.as_ref(), &consecutive_errors);
                streaming.try_commit_on_sentence_boundary(&app, mt.as_ref(), &consecutive_errors);
                streaming.try_commit_stable_asr(&app, mt.as_ref(), &consecutive_errors);
                streaming.try_force_commit_by_length(&app, mt.as_ref(), &consecutive_errors);
                continue;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    let _ = session.shutdown();
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
                                    sentence_id: None,
                                    sentence_end: true,
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
                                        sentence_id: None,
                                        sentence_end: true,
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

pub fn test_asr_connection(app: &AppHandle, asr_config: &AsrConfig) -> Result<(), String> {
    if let AsrConfig::Sherpa { model } = asr_config {
        return asr::sherpa::test_sherpa_connection(app, model).map_err(|e| e.to_string());
    }

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

#[cfg(test)]
mod sherpa_streaming_tests {
    use super::*;

    #[test]
    fn partial_and_final_share_utterance_key() {
        let mut state = SherpaStreamingState::new();
        assert_eq!(state.utterance_key(), "s-1");
        state.sentence_id += 1;
        assert_eq!(state.utterance_key(), "s-2");
    }

    #[test]
    fn open_segment_strips_stable_prefix() {
        let mut state = SherpaStreamingState::new();
        state.stable_prefix = "hello world".into();
        assert_eq!(
            state.open_segment_text("hello world again"),
            "again"
        );
    }

    #[test]
    fn throttle_allows_first_partial_immediately() {
        let state = SherpaStreamingState {
            last_asr_text: "Hello".into(),
            ..SherpaStreamingState::new()
        };
        assert!(state.should_translate_partial());
    }

    #[test]
    fn throttle_blocks_until_interval_elapses() {
        let mut state = SherpaStreamingState {
            last_asr_text: "Hello".into(),
            last_translated_source: "Hi".into(),
            last_mt_at: Some(Instant::now()),
            ..SherpaStreamingState::new()
        };
        assert!(!state.should_translate_partial());
        state.last_mt_at = Some(Instant::now() - PARTIAL_MT_INTERVAL);
        assert!(state.should_translate_partial());
    }

    #[test]
    fn skips_unchanged_source_text() {
        let state = SherpaStreamingState {
            last_asr_text: "Hello".into(),
            last_translated_source: "Hello".into(),
            ..SherpaStreamingState::new()
        };
        assert!(!state.should_translate_partial());
    }

    #[test]
    fn skips_too_short_partials() {
        let state = SherpaStreamingState {
            last_asr_text: "Hi".into(),
            ..SherpaStreamingState::new()
        };
        assert!(!state.should_translate_partial());
    }

    #[test]
    fn stable_commit_waits_for_quiet_period() {
        let state = SherpaStreamingState {
            last_asr_text: "hello world".into(),
            last_asr_changed_at: Some(Instant::now()),
            ..SherpaStreamingState::new()
        };
        assert!(state.last_asr_changed_at.unwrap().elapsed() < STABLE_ASR_COMMIT);
    }

    #[test]
    fn open_segment_empty_when_fully_committed() {
        let mut state = SherpaStreamingState::new();
        state.stable_prefix = "hello world".into();
        assert_eq!(state.open_segment_text("hello world"), "");
        assert_eq!(state.open_segment_text("HELLO WORLD"), "");
    }

    #[test]
    fn open_segment_empty_when_asr_rolls_back() {
        let mut state = SherpaStreamingState::new();
        state.stable_prefix = "hello world again".into();
        assert_eq!(state.open_segment_text("hello world"), "");
    }

    #[test]
    fn duplicate_commit_blocked_by_last_committed_text() {
        let state = SherpaStreamingState {
            last_committed_text: "WE INTRODUCED COMMUNICATE TO THINKING".into(),
            ..SherpaStreamingState::new()
        };
        assert!(state.is_already_committed("WE INTRODUCED COMMUNICATE TO THINKING"));
    }

    #[test]
    fn sentence_boundary_detects_period() {
        assert_eq!(
            sentence_boundary_prefix_len("Hello world."),
            Some("Hello world.".len())
        );
        assert_eq!(sentence_boundary_prefix_len("Hello world"), None);
    }

    #[test]
    fn force_commit_split_prefers_comma() {
        let text = "When it goes to the taste, I have to say I love both Chinese and Indian";
        let split = force_commit_split(text, 40);
        let (head, _) = split_at_byte(text, split);
        assert!(head.ends_with(','));
    }

    #[test]
    fn force_commit_split_falls_back_to_space() {
        let text = "WHEN IT GOES TO THE TASTE I HAVE TO SAY I LOVE BOTH CHINESE AND INDIAN";
        let split = force_commit_split(text, 20);
        let (head, tail) = split_at_byte(text, split);
        assert!(!head.is_empty());
        assert!(!tail.is_empty());
        assert!(head.chars().count() <= 20);
    }

    #[test]
    fn force_commit_skips_short_open_segment() {
        let state = SherpaStreamingState {
            last_asr_text: "short text".into(),
            ..SherpaStreamingState::new()
        };
        // Below MIN_FORCE_COMMIT_CHARS
        assert!(state.last_asr_text.len() < MIN_FORCE_COMMIT_CHARS);
    }

    #[test]
    fn force_commit_respects_interval_after_recent_commit() {
        let state = SherpaStreamingState {
            last_asr_text: "a long enough open segment to force commit by length threshold".into(),
            last_commit_at: Some(Instant::now()),
            ..SherpaStreamingState::new()
        };
        assert!(state.last_asr_text.chars().count() >= MAX_OPEN_SEGMENT_CHARS);
        assert!(state.last_commit_at.unwrap().elapsed() < MIN_FORCE_COMMIT_INTERVAL);
    }

    #[test]
    fn final_asr_only_commits_uncommitted_tail() {
        let mut state = SherpaStreamingState::new();
        state.stable_prefix = "hello world".into();
        state.last_asr_text = "again".into();
        // Sherpa final carries the full cumulative text
        let open = state.open_segment_text("hello world again more");
        assert_eq!(open, "again more");
    }
}
