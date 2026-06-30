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
  PIPELINE_ERROR_EVENT,
  PIPELINE_STATE_EVENT,
  SUBTITLE_UPDATE_EVENT,
} from "@/lib/audio/constants";
export type {
  PipelineErrorPayload,
  PipelineStatePayload,
  SubtitleUpdatePayload,
} from "@/lib/audio/pipeline-types";
export type {
  AudioCaptureStatus,
  AudioChunkPayload,
  AudioEnvironmentStatus,
  AudioInputDevice,
  AudioSourceKind,
  MicrophonePermission,
} from "@/lib/audio/types";
export {
  startAudioSession,
  stopAudioSession,
  testAsrConnection,
  testMtConnection,
  testSpeechTranslateConnection,
} from "@/lib/audio/session";
export type { AudioSessionConfig, StartAudioSessionArgs } from "@/lib/audio/session";

export function getAudioEnvironment() {
  return invoke<AudioEnvironmentStatus>("get_audio_environment");
}

export function requestMicrophonePermission() {
  return invoke<MicrophonePermission>("request_microphone_permission");
}

export function getAudioCaptureStatus() {
  return invoke<AudioCaptureStatus>("get_audio_capture_status");
}

export function startAudioCapture(source: AudioSourceKind, deviceId?: string | null) {
  return invoke<AudioCaptureStatus>("start_audio_capture", { source, deviceId: deviceId ?? null });
}

export function stopAudioCapture() {
  return invoke<AudioCaptureStatus>("stop_audio_capture");
}
