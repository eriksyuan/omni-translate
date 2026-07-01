import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  MicIcon,
  PlayIcon,
  SpeakerIcon,
  SpinnerIcon,
  WarningIcon,
} from "@/components/icons";
import { ProviderSelect } from "@/components/ProviderSelect";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { WindowShell } from "@/components/ui/window-shell";
import {
  AUDIO_ERROR_EVENT,
  AUDIO_STATE_EVENT,
  buildIntegratedSpeechRustConfig,
  PIPELINE_ERROR_EVENT,
  startAudioSession,
  stopAudioSession,
  type AudioCaptureStatus,
  type AudioSourceKind,
  type PipelineErrorPayload,
} from "@/lib/audio";
import { cn } from "@/lib/cn";
import { formatInvokeError } from "@/lib/invoke-error";
import {
  AUTO_DETECT_LANGUAGE_PAIR,
  getAsrProfile,
  getMtProfile,
  getSpeechTranslateProfile,
  getValidTargets,
  normalizeLanguagePair,
  saveAudioSession,
  TENCENT_SPEECH_SOURCE_CODES,
  type AsrProfileId,
  type AudioTranslationMode,
  type MtProfileId,
  type SpeechTranslateProfileId,
  type TencentSpeechSource,
  type TencentSpeechTarget,
} from "@/lib/settings";
import { hideWindow, showWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";
import { useAudioEnvironment } from "@/windows/audio-config/useAudioEnvironment";
import { useAudioSessionProviders } from "@/windows/audio-config/useAudioSessionProviders";

export function AudioConfigWindow() {
  const { t } = useTranslation();
  const [source, setSource] = useState<AudioSourceKind>("blackhole");
  const [micDeviceId, setMicDeviceId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    env,
    loading,
    ready,
    micGranted,
    micDenied,
    micNeedsGrant,
    requestingMic,
    checkingBlackhole,
    micDeviceOptions,
    refresh,
    requestMic,
    openBlackholeGuide,
    syncCaptureStatus,
  } = useAudioEnvironment(source);

  const {
    mode,
    setMode,
    asrOptions,
    mtOptions,
    speechOptions,
    selectedAsrId,
    selectedMtId,
    selectedSpeechId,
    speechSource,
    speechTarget,
    setSelectedAsrId,
    setSelectedMtId,
    setSelectedSpeechId,
    setSpeechSource,
    setSpeechTarget,
    hasVerifiedAsr,
    hasVerifiedMt,
    hasVerifiedSpeech,
    canStart,
  } = useAudioSessionProviders();

  useEffect(() => {
    saveAudioSession({
      mode,
      asrId: selectedAsrId,
      mtId: selectedMtId,
      speechTranslateId: selectedSpeechId,
      speechSource,
      speechTarget,
    });
  }, [mode, selectedAsrId, selectedMtId, selectedSpeechId, speechSource, speechTarget]);

  useEffect(() => {
    if (source !== "mic" || micDeviceId) return;
    const defaultDevice =
      env.inputDevices.find((device) => !device.isBlackhole && device.isDefault) ??
      env.inputDevices.find((device) => !device.isBlackhole);
    if (defaultDevice) {
      setMicDeviceId(defaultDevice.id);
    }
  }, [env.inputDevices, micDeviceId, source]);

  const defaultMicDevice =
    env.inputDevices.find((device) => device.id === micDeviceId) ??
    env.inputDevices.find((device) => !device.isBlackhole && device.isDefault) ??
    env.inputDevices.find((device) => !device.isBlackhole);

  const micSourceLabel = defaultMicDevice?.name ?? t("audioConfig.source.mic");

  const sourceOptions = [
    { value: "blackhole", label: t("audioConfig.source.blackhole") },
    { value: "mic", label: micSourceLabel },
  ];

  const toggleCapture = useCallback(async () => {
    if (!isTauri()) return;

    setError(null);

    try {
      if (listening) {
        const status = await stopAudioSession();
        setListening(status.active);
        await hideWindow(WINDOW_LABELS.SUBTITLE).catch(() => undefined);
        return;
      }

      if (mode === "modular") {
        if (!selectedAsrId || !selectedMtId) {
          setError(t("audioConfig.error.noAsrOrMt"));
          return;
        }

        const asrConfig = getAsrProfile(selectedAsrId);
        const mtConfig = getMtProfile(selectedMtId);

        if (!asrConfig || !mtConfig) {
          setError(t("audioConfig.error.noAsrOrMt"));
          return;
        }

        const status = await startAudioSession({
          source,
          deviceId: source === "mic" ? micDeviceId : null,
          sessionConfig: { mode: "modular", asrConfig, mtConfig },
        });
        setListening(status.active);
        if (status.active) {
          try {
            await showWindow(WINDOW_LABELS.SUBTITLE);
          } catch (windowError) {
            await stopAudioSession().catch(() => undefined);
            setListening(false);
            setError(formatInvokeError(windowError));
            return;
          }
        }
        return;
      }

      if (!selectedSpeechId) {
        setError(t("audioConfig.error.noSpeechTranslate"));
        return;
      }

      const speechProfile = getSpeechTranslateProfile(selectedSpeechId);
      if (!speechProfile) {
        setError(t("audioConfig.error.noSpeechTranslate"));
        return;
      }

      const status = await startAudioSession({
        source,
        deviceId: source === "mic" ? micDeviceId : null,
        sessionConfig: {
          mode: "integrated",
          speechConfig: buildIntegratedSpeechRustConfig(speechProfile, {
            source: speechSource,
            target: speechTarget,
          }),
        },
      });
      setListening(status.active);
      if (status.active) {
        try {
          await showWindow(WINDOW_LABELS.SUBTITLE);
        } catch (windowError) {
          await stopAudioSession().catch(() => undefined);
          setListening(false);
          setError(formatInvokeError(windowError));
          return;
        }
      }
    } catch (startError) {
      setError(formatInvokeError(startError));
      setListening(false);
    }
  }, [
    listening,
    micDeviceId,
    mode,
    selectedAsrId,
    selectedMtId,
    selectedSpeechId,
    speechSource,
    speechTarget,
    source,
    t,
  ]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlistenState: (() => void) | undefined;
    let unlistenPipelineError: (() => void) | undefined;
    let unlistenAudioError: (() => void) | undefined;

    void syncCaptureStatus().then((status) => {
      setListening(status.active);
      if (status.source) {
        setSource(status.source);
      }
    });

    void listen<AudioCaptureStatus>(AUDIO_STATE_EVENT, (event) => {
      setListening(event.payload.active);
      if (event.payload.source) {
        setSource(event.payload.source);
      }
    }).then((unlisten) => {
      unlistenState = unlisten;
    });

    void listen<PipelineErrorPayload>(PIPELINE_ERROR_EVENT, (event) => {
      setError(event.payload.message);
      if (event.payload.code === "pipeline_stopped") {
        void stopAudioSession()
          .then((status) => setListening(status.active))
          .catch(() => setListening(false));
      }
    }).then((unlisten) => {
      unlistenPipelineError = unlisten;
    });

    void listen<string>(AUDIO_ERROR_EVENT, (event) => {
      setError(event.payload);
      void stopAudioSession()
        .then((status) => setListening(status.active))
        .catch(() => setListening(false));
    }).then((unlisten) => {
      unlistenAudioError = unlisten;
    });

    return () => {
      unlistenState?.();
      unlistenPipelineError?.();
      unlistenAudioError?.();
      void stopAudioSession().catch(() => undefined);
    };
  }, [syncCaptureStatus]);

  const handleModeChange = (next: string) => {
    setMode(next as AudioTranslationMode);
    setError(null);
  };

  const speechSourceOptions = [
    {
      value: "auto",
      label: t("audioConfig.language.autoDetect"),
    },
    ...TENCENT_SPEECH_SOURCE_CODES.map((code) => ({
      value: code,
      label: t(`audioConfig.language.source.${code}` as "audioConfig.language.source.en"),
    })),
  ];

  const speechTargetOptions = getValidTargets(speechSource).map((code) => ({
    value: code,
    label: t(`audioConfig.language.target.${code}` as "audioConfig.language.target.zh"),
  }));

  const handleSpeechSourceChange = (value: string) => {
    if (value === "auto") {
      setSpeechSource(AUTO_DETECT_LANGUAGE_PAIR.source);
      setSpeechTarget(AUTO_DETECT_LANGUAGE_PAIR.target);
      return;
    }
    const nextSource = value as TencentSpeechSource;
    const normalized = normalizeLanguagePair(nextSource, speechTarget);
    setSpeechSource(normalized.source);
    setSpeechTarget(normalized.target);
  };

  const handleSpeechTargetChange = (value: string) => {
    const normalized = normalizeLanguagePair(speechSource, value as TencentSpeechTarget);
    setSpeechSource(normalized.source);
    setSpeechTarget(normalized.target);
  };

  const speechSourceSelectValue =
    speechSource === AUTO_DETECT_LANGUAGE_PAIR.source &&
    speechTarget === AUTO_DETECT_LANGUAGE_PAIR.target
      ? "auto"
      : speechSource;
  const isAutoDetectPair = speechSourceSelectValue === "auto";

  return (
    <WindowShell>
      <div className="p-[18px] flex flex-col gap-4">
        <div className="flex items-center gap-2.5 text-[15px] font-600">
          <span className="icon-box-lg">
            <MicIcon size={17} />
          </span>
          {t("audioConfig.panelTitle")}
        </div>

        <Banner
          className={cn(
            "transition-[max-height,opacity,padding,margin,border-width] duration-300 ease-mac overflow-hidden",
            ready ? "max-h-0 opacity-0 py-0 border-0 m-0" : "max-h-96",
          )}
        >
          <div className="flex gap-[11px] items-start">
            <WarningIcon size={18} />
            <div className="flex-1">
              <b className="font-600">{t("audioConfig.banner.title")}</b>
              <div className="flex flex-col gap-[9px] mt-2.5">
                {!micGranted ? (
                  <div className={cn("flex items-center gap-2.5 text-[12.5px]", micGranted && "text-fg-2")}>
                    <span
                      className={cn(
                        "w-5 inline-flex justify-center flex-none",
                        micGranted ? "text-success" : "text-warn-fg",
                      )}
                    >
                      {micGranted ? <CircleCheckIcon size={15} /> : <MicIcon size={15} />}
                    </span>
                    <span className="flex-1">
                      {source === "blackhole"
                        ? t("audioConfig.dep.micForBlackhole")
                        : t("audioConfig.dep.mic")}
                    </span>
                    {micGranted ? (
                      <Badge variant="ok">
                        <CheckIcon size={11} />
                        {t("audioConfig.dep.granted")}
                      </Badge>
                    ) : (
                      <Button
                        className="px-[11px] py-[5px] text-[12px]"
                        onClick={() => void requestMic()}
                        disabled={requestingMic}
                      >
                        {requestingMic ? <SpinnerIcon size={13} /> : null}
                        {t("audioConfig.dep.grant")}
                      </Button>
                    )}
                  </div>
                ) : null}

                {micDenied ? (
                  <p className="text-[11.5px] leading-[1.5] text-warn-fg pl-7">{t("audioConfig.dep.micDenied")}</p>
                ) : null}

                {source === "blackhole" && micNeedsGrant && !micDenied ? (
                  <p className="text-[11.5px] leading-[1.5] text-fg-3 pl-7">{t("audioConfig.dep.micForBlackholeHint")}</p>
                ) : null}

                {source === "blackhole" ? (
                  <div
                    className={cn(
                      "flex items-center gap-2.5 text-[12.5px]",
                      env.blackholeInstalled && "text-fg-2",
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 inline-flex justify-center flex-none",
                        env.blackholeInstalled ? "text-success" : "text-warn-fg",
                      )}
                    >
                      {env.blackholeInstalled ? <CircleCheckIcon size={15} /> : <SpeakerIcon size={15} />}
                    </span>
                    <span className="flex-1">{t("audioConfig.dep.blackhole")}</span>
                    {env.blackholeInstalled ? (
                      <Badge variant="ok">
                        <CheckIcon size={11} />
                        {t("audioConfig.dep.installed")}
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button className="px-[11px] py-[5px] text-[12px]" onClick={() => void openBlackholeGuide()}>
                          {checkingBlackhole ? <SpinnerIcon size={13} /> : null}
                          {t("audioConfig.dep.install")}
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-[7px] py-[5px] text-[11px] text-accent"
                          onClick={() => void refresh()}
                          disabled={loading}
                        >
                          {t("audioConfig.dep.recheck")}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}

                {!env.blackholeInstalled && source === "blackhole" ? (
                  <p className="text-[11.5px] leading-[1.5] text-fg-3 pl-7">
                    {t("audioConfig.dep.installGuideHint")}{" "}
                    <button
                      type="button"
                      className="text-accent underline-offset-2 hover:underline"
                      onClick={() => void openBlackholeGuide()}
                    >
                      {t("audioConfig.dep.blackholeGuideLink")}
                    </button>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </Banner>

        {ready ? (
          <div className="flex gap-2.5">
            {source === "mic" ? (
              <Badge variant="ok">
                <CheckIcon size={12} />
                {t("audioConfig.ready.mic")}
              </Badge>
            ) : (
              <Badge variant="ok">
                <CheckIcon size={12} />
                {t("audioConfig.ready.blackhole")}
              </Badge>
            )}
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-[7px]", !ready && "opacity-90")}>
          <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.source")}</span>
          <Select
            ariaLabel={t("audioConfig.field.source")}
            options={sourceOptions}
            value={source}
            onValueChange={(value) => setSource(value as AudioSourceKind)}
            disabled={listening}
          />
          {!ready ? (
            <p className="text-[11.5px] text-fg-3">{t("audioConfig.field.locked")}</p>
          ) : null}
        </div>

        {source === "mic" && micDeviceOptions.length > 1 ? (
          <div className="flex flex-col gap-[7px]">
            <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.micDevice")}</span>
            <Select
              ariaLabel={t("audioConfig.field.micDevice")}
              options={micDeviceOptions}
              value={micDeviceId ?? micDeviceOptions[0]?.value ?? ""}
              onValueChange={setMicDeviceId}
              disabled={listening}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-[7px]">
          <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.mode")}</span>
          <SegmentedControl type="single" value={mode} onValueChange={handleModeChange} disabled={listening}>
            <SegmentedItem value="modular">{t("audioConfig.mode.modular")}</SegmentedItem>
            <SegmentedItem value="integrated">{t("audioConfig.mode.integrated")}</SegmentedItem>
          </SegmentedControl>
          <p className="text-[11.5px] text-fg-3">
            {mode === "modular" ? t("audioConfig.mode.modularHint") : t("audioConfig.mode.integratedHint")}
          </p>
        </div>

        {mode === "modular" ? (
          <>
            <div className="flex flex-col gap-[7px]">
              <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.asr")}</span>
              <ProviderSelect
                kind="asr"
                ariaLabel={t("audioConfig.field.asr")}
                value={selectedAsrId}
                onValueChange={(value) => setSelectedAsrId(value as AsrProfileId)}
                disabled={listening}
                options={asrOptions}
                emptyPlaceholder={t("audioConfig.field.noVerifiedAsr")}
              />
              {!hasVerifiedAsr ? (
                <p className="text-[11.5px] text-fg-3">{t("audioConfig.field.noVerifiedAsr")}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-[7px]">
              <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.mt")}</span>
              <ProviderSelect
                kind="mt"
                ariaLabel={t("audioConfig.field.mt")}
                value={selectedMtId}
                onValueChange={(value) => setSelectedMtId(value as MtProfileId)}
                disabled={listening}
                options={mtOptions}
                emptyPlaceholder={t("audioConfig.field.noVerifiedMt")}
              />
              {!hasVerifiedMt ? (
                <p className="text-[11.5px] text-fg-3">{t("audioConfig.field.noVerifiedMt")}</p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-[7px]">
            <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.speechTranslate")}</span>
            <ProviderSelect
              kind="speechTranslate"
              ariaLabel={t("audioConfig.field.speechTranslate")}
              value={selectedSpeechId}
              onValueChange={(value) => setSelectedSpeechId(value as SpeechTranslateProfileId)}
              disabled={listening}
              options={speechOptions}
              emptyPlaceholder={t("audioConfig.field.noVerifiedSpeechTranslate")}
            />
            {!hasVerifiedSpeech ? (
              <p className="text-[11.5px] text-fg-3">{t("audioConfig.field.noVerifiedSpeechTranslate")}</p>
            ) : null}
          </div>
        )}

        {mode === "integrated" && hasVerifiedSpeech ? (
          <div className="flex flex-col gap-[7px]">
            <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.speechLanguagePair")}</span>
            <div className="flex items-center gap-2">
              <Select
                className="min-w-0 flex-1"
                ariaLabel={t("audioConfig.field.speechSource")}
                options={speechSourceOptions}
                value={speechSourceSelectValue}
                onValueChange={handleSpeechSourceChange}
                disabled={listening}
              />
              <ArrowRightIcon size={14} className="flex-none text-fg-3" aria-hidden />
              <Select
                className="min-w-0 flex-1"
                ariaLabel={t("audioConfig.field.speechTarget")}
                options={speechTargetOptions}
                value={speechTarget}
                onValueChange={handleSpeechTargetChange}
                disabled={listening || isAutoDetectPair}
              />
            </div>
            <p className="text-[11.5px] text-fg-3">{t("audioConfig.field.speechSourceHelp")}</p>
          </div>
        ) : null}

        {error ? (
          <p className="text-[12px] text-warn-fg leading-[1.5]">{error}</p>
        ) : null}

        {!canStart && ready && mode === "modular" && (!hasVerifiedAsr || !hasVerifiedMt) ? (
          <p className="text-[12px] text-fg-3 leading-[1.5]">{t("audioConfig.error.noAsrOrMt")}</p>
        ) : null}

        {!canStart && ready && mode === "integrated" && !hasVerifiedSpeech ? (
          <p className="text-[12px] text-fg-3 leading-[1.5]">{t("audioConfig.error.noSpeechTranslate")}</p>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          block
          className="mt-1"
          disabled={!canStart || loading}
          aria-disabled={!canStart || loading}
          onClick={() => void toggleCapture()}
        >
          {listening ? (
            <>
              <SpinnerIcon size={15} />
              {t("audioConfig.start.stop")}
            </>
          ) : (
            <>
              <PlayIcon size={16} />
              {t("audioConfig.start.idle")}
            </>
          )}
        </Button>

        {ready && !listening && canStart ? (
          <div className="flex items-center gap-2 text-[12.5px] text-success font-510 animate-pop">
            <CheckIcon size={16} />
            {t("audioConfig.okNote")}
          </div>
        ) : null}
      </div>
    </WindowShell>
  );
}
