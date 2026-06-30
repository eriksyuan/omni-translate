use cpal::traits::{DeviceTrait, HostTrait};
use thiserror::Error;

use super::types::AudioInputDevice;

#[derive(Debug, Error)]
pub enum DeviceError {
    #[error("no default input host")]
    NoHost,
    #[error("failed to enumerate input devices: {0}")]
    Enumerate(String),
    #[error("audio input device not found: {0}")]
    NotFound(String),
    #[error("no suitable audio input device for source: {0}")]
    SourceUnavailable(String),
}

pub fn list_input_devices() -> Result<Vec<AudioInputDevice>, DeviceError> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|device| device.name().ok());

    let devices = host
        .input_devices()
        .map_err(|e| DeviceError::Enumerate(e.to_string()))?;

    let mut result = Vec::new();
    for device in devices {
        let name = device.name().map_err(|e| DeviceError::Enumerate(e.to_string()))?;
        let is_blackhole = is_blackhole_name(&name);
        let is_default = default_name.as_deref() == Some(name.as_str());

        result.push(AudioInputDevice {
            id: name.clone(),
            name,
            is_default,
            is_blackhole,
        });
    }

    result.sort_by(|a, b| {
        b.is_default
            .cmp(&a.is_default)
            .then_with(|| b.is_blackhole.cmp(&a.is_blackhole))
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(result)
}

pub fn blackhole_installed() -> Result<bool, DeviceError> {
    Ok(list_input_devices()?
        .iter()
        .any(|device| device.is_blackhole))
}

pub fn resolve_device(
    devices: &[AudioInputDevice],
    source: super::types::AudioSourceKind,
) -> Result<cpal::Device, DeviceError> {
    let host = cpal::default_host();
    let input_devices: Vec<_> = host
        .input_devices()
        .map_err(|e| DeviceError::Enumerate(e.to_string()))?
        .collect();

    let target_name = match source {
        super::types::AudioSourceKind::Blackhole => devices
            .iter()
            .find(|device| device.is_blackhole)
            .map(|device| device.name.clone())
            .ok_or_else(|| DeviceError::SourceUnavailable("blackhole".into()))?,
        super::types::AudioSourceKind::Mic => devices
            .iter()
            .find(|device| !device.is_blackhole && device.is_default)
            .or_else(|| devices.iter().find(|device| !device.is_blackhole))
            .map(|device| device.name.clone())
            .ok_or_else(|| DeviceError::SourceUnavailable("microphone".into()))?,
    };

    input_devices
        .into_iter()
        .find(|device| device.name().ok().as_deref() == Some(target_name.as_str()))
        .ok_or_else(|| DeviceError::NotFound(target_name))
}

pub fn is_blackhole_name(name: &str) -> bool {
    let normalized = name.to_ascii_lowercase();
    normalized.contains("blackhole")
}
