export type AsrEngine = "sherpa" | "whisper" | "cloudAliyun" | "cloudTencent";
export type WhisperModel = "tiny" | "base" | "large";
export type SherpaModel = "zipformer-en-20m" | "zipformer-en-full";
export type MtTraditionalProvider = "google" | "deepl";
export type AudioTranslationMode = "modular" | "integrated";
export type TencentTransModel = "hunyuan-translation-lite" | "hunyuan-translation";
export type TencentSpeechDomain = 1 | 2 | 3;

import type {
  TencentLanguagePair,
  TencentSpeechSource,
  TencentSpeechTarget,
} from "@/lib/settings/tencent-speech-languages";

export type { TencentLanguagePair, TencentSpeechSource, TencentSpeechTarget };

export type AsrProfileId =
  | "asr:sherpa:zipformer-en-20m"
  | "asr:sherpa:zipformer-en-full"
  | "asr:whisper:tiny"
  | "asr:whisper:base"
  | "asr:whisper:large"
  | "asr:cloud:aliyun"
  | "asr:cloud:tencent";

export type MtProfileId =
  | `mt:traditional:${MtTraditionalProvider}`
  | `mt:llm:${string}`
  | "mt:builtin";

export type SpeechTranslateProfileId = "speech:tencent:realtime";

export type ProviderProfileId = AsrProfileId | MtProfileId | SpeechTranslateProfileId;
export type ProviderKind = "asr" | "mt" | "speechTranslate";
export type PreferencesSection = "general" | "ocr" | "asr" | "mt" | "speechTranslate";

export interface AsrSherpaProfileConfig {
  kind: "sherpa";
  model: SherpaModel;
}

export interface AsrWhisperProfileConfig {
  kind: "whisper";
  model: WhisperModel;
  modelPath: string;
}

export interface AsrCloudProfileConfig {
  kind: "cloud";
  engine: "cloudAliyun" | "cloudTencent";
  /** Combined credential string sent to Rust (also derived from structured fields). */
  apiKey?: string;
  /** Aliyun NLS AppKey */
  appKey?: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  /** Tencent Cloud */
  secretId?: string;
  secretKey?: string;
}

export type AsrProfileConfig =
  | AsrSherpaProfileConfig
  | AsrWhisperProfileConfig
  | AsrCloudProfileConfig;

export interface MtTraditionalProfileConfig {
  kind: "traditional";
  provider: MtTraditionalProvider;
  apiKey: string;
}

export interface MtLlmProfileConfig {
  kind: "llm";
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
}

export interface MtBuiltinProfileConfig {
  kind: "builtin";
}

export type MtProfileConfig = MtTraditionalProfileConfig | MtLlmProfileConfig | MtBuiltinProfileConfig;

/** Service profile: credentials + engine tuning (no language pair). */
export interface TencentSpeechTranslateConfig {
  kind: "speechTranslate";
  provider: "tencentRealtime";
  appId: string;
  secretId: string;
  secretKey: string;
  transModel: TencentTransModel;
  hotwordList?: string;
  noiseThreshold?: number;
  domain?: TencentSpeechDomain;
}

export type SpeechTranslateProfileConfig = TencentSpeechTranslateConfig;

export interface AudioSessionSelection {
  mode?: AudioTranslationMode;
  asrId?: AsrProfileId;
  mtId?: MtProfileId;
  speechTranslateId?: SpeechTranslateProfileId;
  speechSource?: TencentSpeechSource;
  speechTarget?: TencentSpeechTarget;
}

export interface SettingsStore {
  asr: {
    profiles: Partial<Record<AsrProfileId, AsrProfileConfig>>;
    verified: AsrProfileId[];
  };
  mt: {
    profiles: Partial<Record<string, MtProfileConfig>>;
    verified: MtProfileId[];
  };
  speechTranslate: {
    profiles: Partial<Record<SpeechTranslateProfileId, SpeechTranslateProfileConfig>>;
    verified: SpeechTranslateProfileId[];
  };
  audioSession: AudioSessionSelection;
}

export type TestState = "idle" | "testing" | "ok" | "error";
