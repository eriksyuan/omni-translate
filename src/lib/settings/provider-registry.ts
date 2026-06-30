import type {
  AsrEngine,
  AsrProfileId,
  MtProfileId,
  MtTraditionalProvider,
  ProviderKind,
  WhisperModel,
} from "@/lib/settings/types";

export const CONFIGURE_SENTINEL = "__configure__";

interface ProviderMeta {
  labelKey: string;
  settingsSection: "asr" | "mt";
  kind: ProviderKind;
}

const ASR_REGISTRY: Record<AsrProfileId, ProviderMeta> = {
  "asr:whisper:tiny": { labelKey: "provider.asr.whisperTiny", settingsSection: "asr", kind: "asr" },
  "asr:whisper:base": { labelKey: "provider.asr.whisperBase", settingsSection: "asr", kind: "asr" },
  "asr:whisper:large": { labelKey: "provider.asr.whisperLarge", settingsSection: "asr", kind: "asr" },
  "asr:cloud:aliyun": { labelKey: "provider.asr.cloudAliyun", settingsSection: "asr", kind: "asr" },
  "asr:cloud:tencent": { labelKey: "provider.asr.cloudTencent", settingsSection: "asr", kind: "asr" },
};

const MT_TRADITIONAL_REGISTRY: Record<MtTraditionalProvider, ProviderMeta> = {
  google: { labelKey: "provider.mt.google", settingsSection: "mt", kind: "mt" },
  deepl: { labelKey: "provider.mt.deepl", settingsSection: "mt", kind: "mt" },
};

export function asrProfileIdForWhisper(model: WhisperModel): AsrProfileId {
  return `asr:whisper:${model}`;
}

export function asrProfileIdForEngine(engine: AsrEngine): AsrProfileId {
  if (engine === "whisper") {
    throw new Error("use asrProfileIdForWhisper for whisper engine");
  }
  return engine === "cloudAliyun" ? "asr:cloud:aliyun" : "asr:cloud:tencent";
}

export function mtTraditionalProfileId(provider: MtTraditionalProvider): MtProfileId {
  return `mt:traditional:${provider}`;
}

export function mtLlmProfileId(model: string): MtProfileId {
  const normalized = model.trim() || "default";
  return `mt:llm:${normalized}`;
}

export function getAsrProviderMeta(id: AsrProfileId): ProviderMeta {
  return ASR_REGISTRY[id];
}

export function getMtProviderMeta(id: MtProfileId): ProviderMeta {
  if (id.startsWith("mt:traditional:")) {
    const provider = id.replace("mt:traditional:", "") as MtTraditionalProvider;
    return MT_TRADITIONAL_REGISTRY[provider];
  }
  return { labelKey: "provider.mt.llm", settingsSection: "mt", kind: "mt" };
}

export function getProviderMeta(id: string, kind: ProviderKind): ProviderMeta | null {
  if (kind === "asr" && id in ASR_REGISTRY) {
    return ASR_REGISTRY[id as AsrProfileId];
  }
  if (kind === "mt" && (id.startsWith("mt:traditional:") || id.startsWith("mt:llm:"))) {
    return getMtProviderMeta(id as MtProfileId);
  }
  return null;
}

export function mtLlmLabelKey(model: string): string {
  return model.trim() ? `provider.mt.llmNamed` : "provider.mt.llm";
}
