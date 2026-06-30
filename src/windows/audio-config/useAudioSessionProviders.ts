import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  CONFIGURE_SENTINEL,
  getProviderMeta,
  type AsrProfileId,
  type AudioTranslationMode,
  type MtProfileId,
  type ProviderKind,
  type SpeechTranslateProfileId,
} from "@/lib/settings";
import { getVerifiedProfileIds, loadAudioSession } from "@/lib/settings/storage";
import { SETTINGS_VERIFIED_CHANGED_EVENT } from "@/lib/preferences-navigation";

export interface VerifiedProviderOption {
  value: string;
  label: string;
}

export function useAudioSessionProviders() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AudioTranslationMode>("modular");
  const [asrOptions, setAsrOptions] = useState<VerifiedProviderOption[]>([]);
  const [mtOptions, setMtOptions] = useState<VerifiedProviderOption[]>([]);
  const [speechOptions, setSpeechOptions] = useState<VerifiedProviderOption[]>([]);
  const [selectedAsrId, setSelectedAsrId] = useState<AsrProfileId | undefined>();
  const [selectedMtId, setSelectedMtId] = useState<MtProfileId | undefined>();
  const [selectedSpeechId, setSelectedSpeechId] = useState<SpeechTranslateProfileId | undefined>();

  const buildOptions = useCallback(
    (kind: ProviderKind, ids: string[]): VerifiedProviderOption[] => {
      return ids.flatMap((id) => {
        const meta = getProviderMeta(id, kind);
        if (!meta) return [];
        if (kind === "mt" && id.startsWith("mt:llm:")) {
          const model = id.replace("mt:llm:", "");
          return [{ value: id, label: t("provider.mt.llmNamed", { model }) }];
        }
        return [{ value: id, label: t(meta.labelKey as "provider.asr.whisperBase") }];
      });
    },
    [t],
  );

  const refresh = useCallback(() => {
    const asrIds = getVerifiedProfileIds("asr") as AsrProfileId[];
    const mtIds = getVerifiedProfileIds("mt") as MtProfileId[];
    const speechIds = getVerifiedProfileIds("speechTranslate") as SpeechTranslateProfileId[];
    const session = loadAudioSession();

    setMode(session.mode ?? "modular");
    setAsrOptions(buildOptions("asr", asrIds));
    setMtOptions(buildOptions("mt", mtIds));
    setSpeechOptions(buildOptions("speechTranslate", speechIds));

    setSelectedAsrId((current) => {
      if (current && asrIds.includes(current)) return current;
      if (session.asrId && asrIds.includes(session.asrId)) return session.asrId;
      return asrIds[0];
    });

    setSelectedMtId((current) => {
      if (current && mtIds.includes(current)) return current;
      if (session.mtId && mtIds.includes(session.mtId)) return session.mtId;
      return mtIds[0];
    });

    setSelectedSpeechId((current) => {
      if (current && speechIds.includes(current)) return current;
      if (session.speechTranslateId && speechIds.includes(session.speechTranslateId)) {
        return session.speechTranslateId;
      }
      return speechIds[0];
    });
  }, [buildOptions]);

  useEffect(() => {
    refresh();

    if (!isTauri()) {
      const handler = () => refresh();
      window.addEventListener(SETTINGS_VERIFIED_CHANGED_EVENT, handler);
      return () => window.removeEventListener(SETTINGS_VERIFIED_CHANGED_EVENT, handler);
    }

    let unlistenVerified: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;

    void listen(SETTINGS_VERIFIED_CHANGED_EVENT, () => {
      refresh();
    }).then((unlisten) => {
      unlistenVerified = unlisten;
    });

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) refresh();
      })
      .then((unlisten) => {
        unlistenFocus = unlisten;
      });

    return () => {
      unlistenVerified?.();
      unlistenFocus?.();
    };
  }, [refresh]);

  const hasVerifiedAsr = asrOptions.length > 0;
  const hasVerifiedMt = mtOptions.length > 0;
  const hasVerifiedSpeech = speechOptions.length > 0;

  const canStartModular = hasVerifiedAsr && hasVerifiedMt && !!selectedAsrId && !!selectedMtId;
  const canStartIntegrated = hasVerifiedSpeech && !!selectedSpeechId;
  const canStart = mode === "modular" ? canStartModular : canStartIntegrated;

  return {
    mode,
    setMode,
    asrOptions,
    mtOptions,
    speechOptions,
    selectedAsrId,
    selectedMtId,
    selectedSpeechId,
    setSelectedAsrId,
    setSelectedMtId,
    setSelectedSpeechId,
    refresh,
    hasVerifiedAsr,
    hasVerifiedMt,
    hasVerifiedSpeech,
    canStart,
    canStartModular,
    canStartIntegrated,
    configureSentinel: CONFIGURE_SENTINEL,
  };
}

/** @deprecated Use useAudioSessionProviders */
export const useVerifiedProviders = useAudioSessionProviders;
