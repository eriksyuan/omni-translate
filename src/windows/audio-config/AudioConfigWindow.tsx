import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
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
import { WindowShell } from "@/components/ui/window-shell";
import {
  AUDIO_CHUNK_EVENT,
  AUDIO_STATE_EVENT,
  startAudioCapture,
  stopAudioCapture,
  type AudioCaptureStatus,
  type AudioSourceKind,
} from "@/lib/audio";
import { cn } from "@/lib/cn";
import { saveAudioSession, type AsrProfileId, type MtProfileId } from "@/lib/settings";
import { useAudioEnvironment } from "@/windows/audio-config/useAudioEnvironment";
import { useVerifiedProviders } from "@/windows/audio-config/useVerifiedProviders";

export function AudioConfigWindow() {
  const { t } = useTranslation();
  const [source, setSource] = useState<AudioSourceKind>("blackhole");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    env,
    loading,
    ready,
    micGranted,
    micDenied,
    requestingMic,
    checkingBlackhole,
    refresh,
    requestMic,
    openBlackholeGuide,
    syncCaptureStatus,
  } = useAudioEnvironment(source);

  const {
    asrOptions,
    mtOptions,
    selectedAsrId,
    selectedMtId,
    setSelectedAsrId,
    setSelectedMtId,
    hasVerifiedAsr,
    hasVerifiedMt,
  } = useVerifiedProviders();

  const canStart = ready && hasVerifiedAsr && hasVerifiedMt && !!selectedAsrId && !!selectedMtId;

  useEffect(() => {
    saveAudioSession({
      asrId: selectedAsrId,
      mtId: selectedMtId,
    });
  }, [selectedAsrId, selectedMtId]);

  const defaultMicDevice =
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
        const status = await stopAudioCapture();
        setListening(status.active);
        return;
      }

      const status = await startAudioCapture(source);
      setListening(status.active);
    } catch {
      setError(t("audioConfig.error.captureFailed"));
      setListening(false);
    }
  }, [listening, source, t]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlistenState: (() => void) | undefined;
    let unlistenChunk: (() => void) | undefined;

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

    void listen(AUDIO_CHUNK_EVENT, () => {
      // Reserved for ASR pipeline integration.
    }).then((unlisten) => {
      unlistenChunk = unlisten;
    });

    return () => {
      unlistenState?.();
      unlistenChunk?.();
      void stopAudioCapture().catch(() => undefined);
    };
  }, [syncCaptureStatus]);

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
                {source === "mic" ? (
                  <div className={cn("flex items-center gap-2.5 text-[12.5px]", micGranted && "text-fg-2")}>
                    <span
                      className={cn(
                        "w-5 inline-flex justify-center flex-none",
                        micGranted ? "text-success" : "text-warn-fg",
                      )}
                    >
                      {micGranted ? <CircleCheckIcon size={15} /> : <MicIcon size={15} />}
                    </span>
                    <span className="flex-1">{t("audioConfig.dep.mic")}</span>
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

                {micDenied && source === "mic" ? (
                  <p className="text-[11.5px] leading-[1.5] text-warn-fg pl-7">{t("audioConfig.dep.micDenied")}</p>
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

        {error ? (
          <p className="text-[12px] text-warn-fg leading-[1.5]">{error}</p>
        ) : null}

        {!canStart && ready && (!hasVerifiedAsr || !hasVerifiedMt) ? (
          <p className="text-[12px] text-fg-3 leading-[1.5]">{t("audioConfig.error.noAsrOrMt")}</p>
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
              {source === "mic" ? t("audioConfig.start.listeningMic") : t("audioConfig.start.listening")}
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
