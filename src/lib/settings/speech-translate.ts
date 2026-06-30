import {
  DEFAULT_LANGUAGE_PAIR,
  type TencentLanguagePair,
} from "@/lib/settings/tencent-speech-languages";
import type {
  SpeechTranslateProfileConfig,
  SpeechTranslateProfileId,
  TencentSpeechTranslateConfig,
} from "@/lib/settings/types";

export const TENCENT_SPEECH_TRANSLATE_PROFILE_ID: SpeechTranslateProfileId =
  "speech:tencent:realtime";

/** Fixed pair for connectivity test (settings page). */
export const SPEECH_TRANSLATE_TEST_LANGUAGE_PAIR: TencentLanguagePair = {
  source: "en",
  target: "zh",
};

export function defaultTencentSpeechTranslateConfig(): TencentSpeechTranslateConfig {
  return {
    kind: "speechTranslate",
    provider: "tencentRealtime",
    appId: "",
    secretId: "",
    secretKey: "",
    transModel: "hunyuan-translation",
    hotwordList: "",
    noiseThreshold: 0,
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

export function toRustSpeechTranslateConfig(
  config: TencentSpeechTranslateConfig,
  languagePair: TencentLanguagePair = DEFAULT_LANGUAGE_PAIR,
) {
  const payload: Record<string, unknown> = {
    provider: "tencentRealtime" as const,
    appId: config.appId.trim(),
    secretId: config.secretId.trim(),
    secretKey: config.secretKey.trim(),
    source: languagePair.source,
    target: languagePair.target,
    transModel: config.transModel,
  };

  const hotword = config.hotwordList?.trim();
  if (hotword) {
    payload.hotwordList = hotword;
  }

  if (config.noiseThreshold !== undefined && config.noiseThreshold !== 0) {
    payload.noiseThreshold = config.noiseThreshold;
  }

  if (config.domain !== undefined) {
    payload.domain = config.domain;
  }

  return payload as {
    provider: "tencentRealtime";
    appId: string;
    secretId: string;
    secretKey: string;
    source: string;
    target: string;
    transModel: string;
    hotwordList?: string;
    noiseThreshold?: number;
    domain?: number;
  };
}

export type { TencentLanguagePair } from "@/lib/settings/tencent-speech-languages";
export {
  AUTO_DETECT_LANGUAGE_PAIR,
  DEFAULT_LANGUAGE_PAIR,
  getValidTargets,
  isValidLanguagePair,
  normalizeLanguagePair,
  resolveLanguagePair,
  TENCENT_SPEECH_SOURCE_CODES,
  TENCENT_SOURCE_TARGET_MAP,
} from "@/lib/settings/tencent-speech-languages";
