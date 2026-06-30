import { invoke } from "@tauri-apps/api/core";
import type {
  AudioCaptureStatus,
  AudioEnvironmentStatus,
  AudioSourceKind,
  MicrophonePermission,
} from "@/lib/audio/types";

export {
  AUDIO_CHUNK_EVENT,
  AUDIO_ERROR_EVENT,
  AUDIO_STATE_EVENT,
  BLACKHOLE_INSTALL_GUIDE_URL,
} from "@/lib/audio/constants";
export type {
  AudioCaptureStatus,
  AudioChunkPayload,
  AudioEnvironmentStatus,
  AudioInputDevice,
  AudioSourceKind,
  MicrophonePermission,
} from "@/lib/audio/types";

export function getAudioEnvironment() {
  return invoke<AudioEnvironmentStatus>("get_audio_environment");
}

export function requestMicrophonePermission() {
  return invoke<MicrophonePermission>("request_microphone_permission");
}

export function getAudioCaptureStatus() {
  return invoke<AudioCaptureStatus>("get_audio_capture_status");
}

export function startAudioCapture(source: AudioSourceKind) {
  return invoke<AudioCaptureStatus>("start_audio_capture", { source });
}

export function stopAudioCapture() {
  return invoke<AudioCaptureStatus>("stop_audio_capture");
}
