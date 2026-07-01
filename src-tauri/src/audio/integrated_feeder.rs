use super::buffer::interleaved_to_mono_16k;

pub const PCM_CHUNK_BYTES: usize = 6400;

#[derive(Debug, Clone)]
pub struct IntegratedPcmInput {
    pub samples: Vec<i16>,
    pub sample_rate: u32,
    pub channels: u16,
}

pub struct IntegratedPcmFeeder {
    pending: Vec<i16>,
}

impl IntegratedPcmFeeder {
    pub fn new() -> Self {
        Self {
            pending: Vec::new(),
        }
    }

    pub fn push_interleaved(&mut self, samples: &[i16], sample_rate: u32, channels: u16) {
        if samples.is_empty() {
            return;
        }
        let mono = interleaved_to_mono_16k(samples, sample_rate, channels);
        self.pending.extend_from_slice(&mono);
    }

    pub fn pending_samples(&self) -> usize {
        self.pending.len()
    }

    pub fn take_pcm_bytes(&mut self, byte_count: usize) -> Option<Vec<u8>> {
        let sample_count = byte_count / 2;
        if self.pending.len() < sample_count {
            return None;
        }

        let chunk: Vec<i16> = self.pending.drain(..sample_count).collect();
        let mut bytes = Vec::with_capacity(byte_count);
        for sample in chunk {
            bytes.extend_from_slice(&sample.to_le_bytes());
        }
        Some(bytes)
    }
}

pub fn forward_raw_to_integrated(
    tx: &Option<std::sync::mpsc::Sender<IntegratedPcmInput>>,
    samples: &[i16],
    sample_rate: u32,
    channels: u16,
) {
    let Some(sender) = tx else {
        return;
    };
    let _ = sender.send(IntegratedPcmInput {
        samples: samples.to_vec(),
        sample_rate,
        channels,
    });
}
