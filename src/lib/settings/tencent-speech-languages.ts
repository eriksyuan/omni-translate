export const TENCENT_SPEECH_SOURCE_CODES = [
  "zh",
  "en",
  "zh_en",
  "ja",
  "ko",
  "yue",
  "id",
  "th",
] as const;

export const TENCENT_SPEECH_TARGET_CODES = [
  "zh",
  "en",
  "zh_en",
  "ja",
  "ko",
  "yue",
  "id",
  "th",
] as const;

export type TencentSpeechSource = (typeof TENCENT_SPEECH_SOURCE_CODES)[number];
export type TencentSpeechTarget = (typeof TENCENT_SPEECH_TARGET_CODES)[number];

export interface TencentLanguagePair {
  source: TencentSpeechSource;
  target: TencentSpeechTarget;
}

/** Tencent Cloud speech_translate official source → allowed targets */
export const TENCENT_SOURCE_TARGET_MAP: Record<
  TencentSpeechSource,
  readonly TencentSpeechTarget[]
> = {
  zh: ["zh", "en", "ja", "ko", "yue", "id", "th"],
  en: ["zh", "en", "ja", "ko", "yue", "id", "th"],
  zh_en: ["zh_en", "zh", "en", "ja", "ko", "yue", "id", "th"],
  ja: ["zh", "en", "ja", "ko", "yue"],
  ko: ["zh", "en", "ja", "ko", "yue"],
  yue: ["zh", "en", "ja", "ko", "yue"],
  id: ["zh", "en", "id"],
  th: ["zh", "en", "th"],
};

export const DEFAULT_LANGUAGE_PAIR: TencentLanguagePair = {
  source: "en",
  target: "zh",
};

export const AUTO_DETECT_LANGUAGE_PAIR: TencentLanguagePair = {
  source: "zh_en",
  target: "zh_en",
};

export function getValidTargets(source: TencentSpeechSource): TencentSpeechTarget[] {
  return [...TENCENT_SOURCE_TARGET_MAP[source]];
}

export function isValidLanguagePair(source: string, target: string): boolean {
  if (!(source in TENCENT_SOURCE_TARGET_MAP)) return false;
  const allowed = TENCENT_SOURCE_TARGET_MAP[source as TencentSpeechSource];
  return allowed.includes(target as TencentSpeechTarget);
}

export function normalizeLanguagePair(
  source: TencentSpeechSource,
  target: TencentSpeechTarget,
): TencentLanguagePair {
  const allowed = getValidTargets(source);
  if (allowed.includes(target)) {
    return { source, target };
  }
  const fallbackTarget = allowed.includes(DEFAULT_LANGUAGE_PAIR.target)
    ? DEFAULT_LANGUAGE_PAIR.target
    : allowed[0];
  return { source, target: fallbackTarget };
}

export function resolveLanguagePair(
  source?: string,
  target?: string,
): TencentLanguagePair {
  const src = (source ?? DEFAULT_LANGUAGE_PAIR.source) as TencentSpeechSource;
  const tgt = (target ?? DEFAULT_LANGUAGE_PAIR.target) as TencentSpeechTarget;
  if (src in TENCENT_SOURCE_TARGET_MAP) {
    return normalizeLanguagePair(src, tgt);
  }
  return DEFAULT_LANGUAGE_PAIR;
}
