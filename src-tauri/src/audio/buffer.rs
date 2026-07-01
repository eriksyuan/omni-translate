use super::types::{TARGET_CHANNELS, TARGET_SAMPLE_RATE};

/// Fixed analysis window length in seconds (Phase 1 — no VAD).
pub const WINDOW_SECONDS: f64 = 2.5;

pub const WINDOW_SAMPLES: usize =
    (TARGET_SAMPLE_RATE as f64 * WINDOW_SECONDS) as usize;

/// Accumulates interleaved PCM, resamples to 16 kHz mono, emits fixed windows.
pub struct PcmWindowBuffer {
    pending: Vec<i16>,
    sample_rate: u32,
    channels: u16,
}

impl PcmWindowBuffer {
    pub fn new(sample_rate: u32, channels: u16) -> Self {
        Self {
            pending: Vec::new(),
            sample_rate,
            channels,
        }
    }

    pub fn update_format(&mut self, sample_rate: u32, channels: u16) {
        if self.sample_rate != sample_rate || self.channels != channels {
            self.sample_rate = sample_rate;
            self.channels = channels;
            self.pending.clear();
        }
    }

    /// Push an interleaved chunk; returns complete 16 kHz mono windows ready for ASR.
    pub fn push_interleaved(&mut self, samples: &[i16]) -> Vec<Vec<i16>> {
        if samples.is_empty() {
            return Vec::new();
        }

        let mono = downmix_to_mono(samples, self.channels);
        let resampled = resample_to_target(&mono, self.sample_rate, TARGET_SAMPLE_RATE);
        self.pending.extend_from_slice(&resampled);

        let mut windows = Vec::new();
        while self.pending.len() >= WINDOW_SAMPLES {
            let window: Vec<i16> = self.pending.drain(..WINDOW_SAMPLES).collect();
            windows.push(window);
        }
        windows
    }

    pub fn reset(&mut self) {
        self.pending.clear();
    }
}

fn downmix_to_mono(samples: &[i16], channels: u16) -> Vec<i16> {
    let ch = channels.max(1) as usize;
    if ch == 1 {
        return samples.to_vec();
    }

    let frames = samples.len() / ch;
    let mut mono = Vec::with_capacity(frames);
    for frame in 0..frames {
        let base = frame * ch;
        let sum: i32 = samples[base..base + ch].iter().map(|&s| s as i32).sum();
        mono.push((sum / ch as i32) as i16);
    }
    mono
}

fn resample_to_target(samples: &[i16], from_rate: u32, to_rate: u32) -> Vec<i16> {
    if from_rate == 0 || to_rate == 0 || samples.is_empty() {
        return Vec::new();
    }
    if from_rate == to_rate {
        return samples.to_vec();
    }
    if from_rate > to_rate && from_rate.is_multiple_of(to_rate) {
        return decimate_avg(samples, from_rate / to_rate);
    }
    resample_linear(samples, from_rate, to_rate)
}

fn decimate_avg(samples: &[i16], factor: u32) -> Vec<i16> {
    let factor = factor.max(1) as usize;
    let out_len = samples.len() / factor;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let base = i * factor;
        let sum: i32 = samples[base..base + factor].iter().map(|&s| s as i32).sum();
        out.push((sum / factor as i32) as i16);
    }
    out
}

fn resample_linear(samples: &[i16], from_rate: u32, to_rate: u32) -> Vec<i16> {
    let ratio = from_rate as f64 / to_rate as f64;
    let out_len = ((samples.len() as f64) / ratio).floor() as usize;
    let mut out = Vec::with_capacity(out_len);

    for i in 0..out_len {
        let src_pos = i as f64 * ratio;
        let idx = src_pos.floor() as usize;
        let frac = src_pos - idx as f64;
        let a = samples.get(idx).copied().unwrap_or(0) as f64;
        let b = samples.get(idx + 1).copied().unwrap_or(a as i16) as f64;
        let sample = a + (b - a) * frac;
        out.push(sample.clamp(i16::MIN as f64, i16::MAX as f64) as i16);
    }

    out
}

/// Resample interleaved PCM to 16 kHz mono for integrated speech translation.
pub fn interleaved_to_mono_16k(samples: &[i16], sample_rate: u32, channels: u16) -> Vec<i16> {
    let mono = downmix_to_mono(samples, channels);
    resample_to_target(&mono, sample_rate, TARGET_SAMPLE_RATE)
}

/// Simple RMS energy gate for Phase 3 VAD-lite (0.0–1.0 normalized).
pub fn normalized_rms(samples: &[i16]) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f64 = samples
        .iter()
        .map(|&s| {
            let v = s as f64 / i16::MAX as f64;
            v * v
        })
        .sum();
    (sum_sq / samples.len() as f64).sqrt()
}

/// Skip near-silent windows before calling paid ASR APIs.
pub const SILENCE_RMS_THRESHOLD: f64 = 0.008;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emits_window_when_enough_samples() {
        let mut buf = PcmWindowBuffer::new(TARGET_SAMPLE_RATE, TARGET_CHANNELS);
        let chunk = vec![100_i16; WINDOW_SAMPLES];
        let windows = buf.push_interleaved(&chunk);
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].len(), WINDOW_SAMPLES);
    }
}
