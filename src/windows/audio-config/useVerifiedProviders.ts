import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  CONFIGURE_SENTINEL,
  getProviderMeta,
  type AsrProfileId,
  type MtProfileId,
  type ProviderKind,
} from "@/lib/settings";
import { getVerifiedProfileIds, loadAudioSession } from "@/lib/settings/storage";
import { SETTINGS_VERIFIED_CHANGED_EVENT } from "@/lib/preferences-navigation";

export interface VerifiedProviderOption {
  value: string;
  label: string;
}

export function useVerifiedProviders() {
  const { t } = useTranslation();
  const [asrOptions, setAsrOptions] = useState<VerifiedProviderOption[]>([]);
  const [mtOptions, setMtOptions] = useState<VerifiedProviderOption[]>([]);
  const [selectedAsrId, setSelectedAsrId] = useState<AsrProfileId | undefined>();
  const [selectedMtId, setSelectedMtId] = useState<MtProfileId | undefined>();

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
    const session = loadAudioSession();

    setAsrOptions(buildOptions("asr", asrIds));
    setMtOptions(buildOptions("mt", mtIds));

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

  return {
    asrOptions,
    mtOptions,
    selectedAsrId,
    selectedMtId,
    setSelectedAsrId,
    setSelectedMtId,
    refresh,
    hasVerifiedAsr: asrOptions.length > 0,
    hasVerifiedMt: mtOptions.length > 0,
    configureSentinel: CONFIGURE_SENTINEL,
  };
}
