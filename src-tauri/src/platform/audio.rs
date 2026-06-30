use crate::audio::MicrophonePermission;

pub fn microphone_permission_status() -> MicrophonePermission {
    #[cfg(target_os = "macos")]
    {
        return macos::microphone_permission_status();
    }

    #[cfg(not(target_os = "macos"))]
    {
        MicrophonePermission::Granted
    }
}

pub fn request_microphone_permission_sync() -> Result<MicrophonePermission, String> {
    #[cfg(target_os = "macos")]
    {
        return macos::request_microphone_permission_sync();
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(MicrophonePermission::Granted)
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use crate::audio::MicrophonePermission;
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_av_foundation::{AVAuthorizationStatus, AVCaptureDevice, AVMediaTypeAudio};
    use std::sync::mpsc;
    use std::time::Duration;

    fn audio_media_type() -> Result<&'static objc2_av_foundation::AVMediaType, String> {
        unsafe { AVMediaTypeAudio }
            .ok_or_else(|| "AVMediaTypeAudio is unavailable".to_string())
    }

    pub fn microphone_permission_status() -> MicrophonePermission {
        let Ok(media_type) = audio_media_type() else {
            return MicrophonePermission::Unknown;
        };

        let status = unsafe { AVCaptureDevice::authorizationStatusForMediaType(media_type) };
        map_status(status)
    }

    pub fn request_microphone_permission_sync() -> Result<MicrophonePermission, String> {
        let current = microphone_permission_status();
        if current != MicrophonePermission::NotDetermined {
            return Ok(current);
        }

        let media_type = audio_media_type()?;
        let (tx, rx) = mpsc::channel();
        let handler = RcBlock::new(move |granted: Bool| {
            let _ = tx.send(granted.as_bool());
        });

        unsafe {
            AVCaptureDevice::requestAccessForMediaType_completionHandler(media_type, &handler);
        }

        let granted = rx
            .recv_timeout(Duration::from_secs(30))
            .map_err(|_| "microphone permission request timed out".to_string())?;

        Ok(if granted {
            MicrophonePermission::Granted
        } else {
            MicrophonePermission::Denied
        })
    }

    fn map_status(status: AVAuthorizationStatus) -> MicrophonePermission {
        match status {
            AVAuthorizationStatus::Authorized => MicrophonePermission::Granted,
            AVAuthorizationStatus::Denied => MicrophonePermission::Denied,
            AVAuthorizationStatus::Restricted => MicrophonePermission::Restricted,
            AVAuthorizationStatus::NotDetermined => MicrophonePermission::NotDetermined,
            _ => MicrophonePermission::Unknown,
        }
    }
}
