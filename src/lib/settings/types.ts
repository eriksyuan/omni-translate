export type AsrEngine = "whisper" | "cloudAliyun" | "cloudTencent";
export type WhisperModel = "tiny" | "base" | "large";
export type MtTraditionalProvider = "google" | "deepl";

export type AsrProfileId =
  | "asr:whisper:tiny"
  | "asr:whisper:base"
  | "asr:whisper:large"
  | "asr:cloud:aliyun"
  | "asr:cloud:tencent";

export type MtProfileId = `mt:traditional:${MtTraditionalProvider}` | `mt:llm:${string}`;

export type ProviderProfileId = AsrProfileId | MtProfileId;
export type ProviderKind = "asr" | "mt";
export type PreferencesSection = "general" | "ocr" | "asr" | "mt";

export interface AsrWhisperProfileConfig {
  kind: "whisper";
  model: WhisperModel;
  modelPath: string;
}

export interface AsrCloudProfileConfig {
  kind: "cloud";
  engine: "cloudAliyun" | "cloudTencent";
  apiKey: string;
}

export type AsrProfileConfig = AsrWhisperProfileConfig | AsrCloudProfileConfig;

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

export type MtProfileConfig = MtTraditionalProfileConfig | MtLlmProfileConfig;

export interface AudioSessionSelection {
  asrId?: AsrProfileId;
  mtId?: MtProfileId;
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
  audioSession: AudioSessionSelection;
}

export type TestState = "idle" | "testing" | "ok" | "error";
