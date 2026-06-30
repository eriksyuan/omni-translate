import type {
  SpeechTranslateProfileConfig,
  SpeechTranslateProfileId,
  TencentSpeechTranslateConfig,
} from "@/lib/settings/types";

export const TENCENT_SPEECH_TRANSLATE_PROFILE_ID: SpeechTranslateProfileId =
  "speech:tencent:realtime";

export function defaultTencentSpeechTranslateConfig(): TencentSpeechTranslateConfig {
  return {
    kind: "speechTranslate",
    provider: "tencentRealtime",
    appId: "",
    secretId: "",
    secretKey: "",
    source: "en",
    target: "zh",
    transModel: "hunyuan-translation-lite",
  };
}

export function isSpeechTranslateConfigComplete(
  config: SpeechTranslateProfileConfig,
): boolean {
  return (
    config.appId.trim().length > 0 &&
    config.secretId.trim().length > 0 &&
    config.secretKey.trim().length > 0
  );
}

export function toRustSpeechTranslateConfig(config: TencentSpeechTranslateConfig) {
  return {
    provider: "tencentRealtime" as const,
    appId: config.appId.trim(),
    secretId: config.secretId.trim(),
    secretKey: config.secretKey.trim(),
    source: config.source,
    target: config.target,
    transModel: config.transModel,
  };
}
