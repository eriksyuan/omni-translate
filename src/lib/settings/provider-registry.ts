import type {
  AsrEngine,
  AsrProfileId,
  MtProfileId,
  MtTraditionalProvider,
  ProviderKind,
  SherpaModel,
  SpeechTranslateProfileId,
  WhisperModel,
} from "@/lib/settings/types";

export const CONFIGURE_SENTINEL = "__configure__";

interface ProviderMeta {
  labelKey: string;
  settingsSection: "asr" | "mt" | "speechTranslate";
  kind: ProviderKind;
}

const ASR_REGISTRY: Record<AsrProfileId, ProviderMeta> = {
  "asr:sherpa:zipformer-en-20m": {
    labelKey: "provider.asr.sherpaSmall",
    settingsSection: "asr",
    kind: "asr",
  },
  "asr:sherpa:zipformer-en-full": {
    labelKey: "provider.asr.sherpaFull",
    settingsSection: "asr",
    kind: "asr",
  },
  "asr:whisper:tiny": { labelKey: "provider.asr.whisperTiny", settingsSection: "asr", kind: "asr" },
  "asr:whisper:base": { labelKey: "provider.asr.whisperBase", settingsSection: "asr", kind: "asr" },
  "asr:whisper:large": { labelKey: "provider.asr.whisperLarge", settingsSection: "asr", kind: "asr" },
  "asr:cloud:aliyun": { labelKey: "provider.asr.cloudAliyun", settingsSection: "asr", kind: "asr" },
  "asr:cloud:tencent": { labelKey: "provider.asr.cloudTencent", settingsSection: "asr", kind: "asr" },
};

const MT_BUILTIN_PROFILE_ID = "mt:builtin" as const satisfies MtProfileId;

const MT_BUILTIN_REGISTRY: ProviderMeta = {
  labelKey: "provider.mt.builtin",
  settingsSection: "mt",
  kind: "mt",
};

const MT_TRADITIONAL_REGISTRY: Record<MtTraditionalProvider, ProviderMeta> = {
  google: { labelKey: "provider.mt.google", settingsSection: "mt", kind: "mt" },
  deepl: { labelKey: "provider.mt.deepl", settingsSection: "mt", kind: "mt" },
};

const SPEECH_TRANSLATE_REGISTRY: Record<SpeechTranslateProfileId, ProviderMeta> = {
  "speech:tencent:realtime": {
    labelKey: "provider.speechTranslate.tencentRealtime",
    settingsSection: "speechTranslate",
    kind: "speechTranslate",
  },
};

export function asrProfileIdForSherpa(model: SherpaModel): AsrProfileId {
  return `asr:sherpa:${model}`;
}

export function asrProfileIdForWhisper(model: WhisperModel): AsrProfileId {
  return `asr:whisper:${model}`;
}

export function asrProfileIdForEngine(engine: AsrEngine): AsrProfileId {
  if (engine === "whisper") {
    throw new Error("use asrProfileIdForWhisper for whisper engine");
  }
  if (engine === "sherpa") {
    throw new Error("use asrProfileIdForSherpa for sherpa engine");
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

export function mtBuiltinProfileId(): MtProfileId {
  return MT_BUILTIN_PROFILE_ID;
}

export function getAsrProviderMeta(id: AsrProfileId): ProviderMeta {
  return ASR_REGISTRY[id];
}

export function getMtProviderMeta(id: MtProfileId): ProviderMeta {
  if (id === MT_BUILTIN_PROFILE_ID) {
    return MT_BUILTIN_REGISTRY;
  }
  if (id.startsWith("mt:traditional:")) {
    const provider = id.replace("mt:traditional:", "") as MtTraditionalProvider;
    return MT_TRADITIONAL_REGISTRY[provider];
  }
  return { labelKey: "provider.mt.llm", settingsSection: "mt", kind: "mt" };
}

export function getSpeechTranslateProviderMeta(id: SpeechTranslateProfileId): ProviderMeta {
  return SPEECH_TRANSLATE_REGISTRY[id];
}

export function getProviderMeta(id: string, kind: ProviderKind): ProviderMeta | null {
  if (kind === "asr" && id in ASR_REGISTRY) {
    return ASR_REGISTRY[id as AsrProfileId];
  }
  if (kind === "mt" && (id === MT_BUILTIN_PROFILE_ID || id.startsWith("mt:traditional:") || id.startsWith("mt:llm:"))) {
    return getMtProviderMeta(id as MtProfileId);
  }
  if (kind === "speechTranslate" && id in SPEECH_TRANSLATE_REGISTRY) {
    return SPEECH_TRANSLATE_REGISTRY[id as SpeechTranslateProfileId];
  }
  return null;
}

export function mtLlmLabelKey(model: string): string {
  return model.trim() ? `provider.mt.llmNamed` : "provider.mt.llm";
}
