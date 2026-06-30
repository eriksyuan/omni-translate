import { invoke } from "@tauri-apps/api/core";
import { toRustAsrConfig } from "@/lib/settings/asr-cloud-credentials";
import { toRustSpeechTranslateConfig } from "@/lib/settings/speech-translate";
import type {
  AsrProfileConfig,
  MtProfileConfig,
  TencentSpeechTranslateConfig,
} from "@/lib/settings/types";
import type { AudioCaptureStatus, AudioSourceKind } from "@/lib/audio/types";

export type ModularSessionConfig = {
  mode: "modular";
  asrConfig: AsrProfileConfig;
  mtConfig: MtProfileConfig;
};

export type IntegratedSessionConfig = {
  mode: "integrated";
  speechConfig: TencentSpeechTranslateConfig;
};

export type AudioSessionConfig = ModularSessionConfig | IntegratedSessionConfig;

export interface StartAudioSessionArgs {
  source: AudioSourceKind;
  deviceId?: string | null;
  sessionConfig: AudioSessionConfig;
}

function toRustSessionConfig(sessionConfig: AudioSessionConfig) {
  if (sessionConfig.mode === "modular") {
    return {
      mode: "modular" as const,
      asrConfig: toRustAsrConfig(sessionConfig.asrConfig),
      mtConfig: sessionConfig.mtConfig,
    };
  }

  return {
    mode: "integrated" as const,
    speechConfig: toRustSpeechTranslateConfig(sessionConfig.speechConfig),
  };
}

export function startAudioSession({
  source,
  deviceId,
  sessionConfig,
}: StartAudioSessionArgs) {
  return invoke<AudioCaptureStatus>("start_audio_session", {
    source,
    deviceId: deviceId ?? null,
    sessionConfig: toRustSessionConfig(sessionConfig),
  });
}

export function stopAudioSession() {
  return invoke<AudioCaptureStatus>("stop_audio_session");
}

export function testAsrConnection(asrConfig: AsrProfileConfig) {
  return invoke<void>("test_asr_connection_cmd", { asrConfig: toRustAsrConfig(asrConfig) });
}

export function testMtConnection(mtConfig: MtProfileConfig) {
  return invoke<string>("test_mt_connection_cmd", { mtConfig });
}

export function testSpeechTranslateConnection(
  speechConfig: ReturnType<typeof toRustSpeechTranslateConfig>,
) {
  return invoke<void>("test_speech_translate_connection_cmd", { speechConfig });
}
