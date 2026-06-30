import { notifyVerifiedProvidersChanged } from "@/lib/preferences-navigation";
import type {
  AsrProfileConfig,
  AsrProfileId,
  AudioSessionSelection,
  MtProfileConfig,
  MtProfileId,
  ProviderKind,
  SettingsStore,
  SpeechTranslateProfileConfig,
  SpeechTranslateProfileId,
} from "@/lib/settings/types";

const STORAGE_KEY = "omnitranslate:settings:v1";

const EMPTY_STORE: SettingsStore = {
  asr: { profiles: {}, verified: [] },
  mt: { profiles: {}, verified: [] },
  speechTranslate: { profiles: {}, verified: [] },
  audioSession: {},
};

function readStore(): SettingsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_STORE);
    const parsed = JSON.parse(raw) as SettingsStore;
    return {
      asr: {
        profiles: parsed.asr?.profiles ?? {},
        verified: parsed.asr?.verified ?? [],
      },
      mt: {
        profiles: parsed.mt?.profiles ?? {},
        verified: parsed.mt?.verified ?? [],
      },
      speechTranslate: {
        profiles: parsed.speechTranslate?.profiles ?? {},
        verified: parsed.speechTranslate?.verified ?? [],
      },
      audioSession: parsed.audioSession ?? {},
    };
  } catch {
    return structuredClone(EMPTY_STORE);
  }
}

function writeStore(store: SettingsStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function notifyVerifiedChanged() {
  void notifyVerifiedProvidersChanged();
}

export function loadSettingsStore(): SettingsStore {
  return readStore();
}

export function saveAsrProfile(id: AsrProfileId, config: AsrProfileConfig) {
  const store = readStore();
  store.asr.profiles[id] = config;
  writeStore(store);
}

export function saveMtProfile(id: MtProfileId, config: MtProfileConfig) {
  const store = readStore();
  store.mt.profiles[id] = config;
  writeStore(store);
}

export function markAsrVerified(id: AsrProfileId) {
  const store = readStore();
  if (!store.asr.verified.includes(id)) {
    store.asr.verified.push(id);
  }
  writeStore(store);
  notifyVerifiedChanged();
}

export function markMtVerified(id: MtProfileId) {
  const store = readStore();
  if (!store.mt.verified.includes(id)) {
    store.mt.verified.push(id);
  }
  writeStore(store);
  notifyVerifiedChanged();
}

export function revokeAsrVerified(id: AsrProfileId) {
  const store = readStore();
  store.asr.verified = store.asr.verified.filter((item) => item !== id);
  if (store.audioSession.asrId === id) {
    delete store.audioSession.asrId;
  }
  writeStore(store);
  notifyVerifiedChanged();
}

export function revokeMtVerified(id: MtProfileId) {
  const store = readStore();
  store.mt.verified = store.mt.verified.filter((item) => item !== id);
  if (store.audioSession.mtId === id) {
    delete store.audioSession.mtId;
  }
  writeStore(store);
  notifyVerifiedChanged();
}

export function saveSpeechTranslateProfile(
  id: SpeechTranslateProfileId,
  config: SpeechTranslateProfileConfig,
) {
  const store = readStore();
  store.speechTranslate.profiles[id] = config;
  writeStore(store);
}

export function markSpeechTranslateVerified(id: SpeechTranslateProfileId) {
  const store = readStore();
  if (!store.speechTranslate.verified.includes(id)) {
    store.speechTranslate.verified.push(id);
  }
  writeStore(store);
  notifyVerifiedChanged();
}

export function revokeSpeechTranslateVerified(id: SpeechTranslateProfileId) {
  const store = readStore();
  store.speechTranslate.verified = store.speechTranslate.verified.filter((item) => item !== id);
  if (store.audioSession.speechTranslateId === id) {
    delete store.audioSession.speechTranslateId;
  }
  writeStore(store);
  notifyVerifiedChanged();
}

export function getVerifiedProfileIds(kind: ProviderKind): string[] {
  const store = readStore();
  if (kind === "asr") return [...store.asr.verified];
  if (kind === "mt") return [...store.mt.verified];
  return [...store.speechTranslate.verified];
}

export function getAsrProfile(id: AsrProfileId): AsrProfileConfig | undefined {
  return readStore().asr.profiles[id];
}

export function getMtProfile(id: MtProfileId): MtProfileConfig | undefined {
  return readStore().mt.profiles[id];
}

export function getSpeechTranslateProfile(
  id: SpeechTranslateProfileId,
): SpeechTranslateProfileConfig | undefined {
  return readStore().speechTranslate.profiles[id];
}

export function saveAudioSession(selection: AudioSessionSelection) {
  const store = readStore();
  store.audioSession = { ...store.audioSession, ...selection };
  writeStore(store);
}

export function loadAudioSession(): AudioSessionSelection {
  const session = readStore().audioSession;
  return {
    mode: session.mode ?? "modular",
    ...session,
  };
}
