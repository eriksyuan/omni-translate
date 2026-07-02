import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { testAsrConnection } from "@/lib/audio";
import {
  formatDownloadProgress,
  formatModelSize,
  listSherpaModelStatuses,
  progressPercent,
  SHERPA_MODELS,
  type DownloadPhase,
  type SherpaModelStatus,
} from "@/lib/models/sherpa";
import { useSherpaModelDownloads } from "@/lib/models/useSherpaModelDownloads";
import {
  asrProfileIdForEngine,
  asrProfileIdForSherpa,
  asrProfileIdForWhisper,
  buildAliyunCloudProfile,
  buildTencentCloudProfile,
  getAsrProfile,
  isAliyunCloudComplete,
  isTencentCloudComplete,
  markAsrVerified,
  parseAliyunCredentials,
  parseTencentCredentials,
  revokeAsrVerified,
  saveAsrProfile,
  toRustAsrConfig,
  type AsrEngine,
  type AsrProfileId,
  type SherpaModel,
  type TestState,
  type WhisperModel,
} from "@/lib/settings";

const WHISPER_MODELS = ["tiny", "base", "large"] as const;

const ASR_ENGINE_OPTIONS = [
  { value: "sherpa", key: "asrSettings.engine.sherpa" },
  { value: "cloudAliyun", key: "asrSettings.engine.cloudAliyun" },
  { value: "cloudTencent", key: "asrSettings.engine.cloudTencent" },
  { value: "whisper", key: "asrSettings.engine.whisper" },
] as const;

const EMPTY_ALIYUN = { appKey: "", accessKeyId: "", accessKeySecret: "" };
const EMPTY_TENCENT = { secretId: "", secretKey: "" };

function currentProfileId(
  engine: AsrEngine,
  whisperModel: WhisperModel,
  sherpaModel: SherpaModel,
): AsrProfileId {
  if (engine === "whisper") return asrProfileIdForWhisper(whisperModel);
  if (engine === "sherpa") return asrProfileIdForSherpa(sherpaModel);
  return asrProfileIdForEngine(engine);
}

function sherpaPhaseLabel(t: TFunction, phase: DownloadPhase): string {
  switch (phase) {
    case "downloading":
      return t("asrSettings.sherpa.manage.downloading");
    case "paused":
      return t("asrSettings.sherpa.phase.paused");
    case "verifying":
      return t("asrSettings.sherpa.phase.verifying");
    case "extracting":
      return t("asrSettings.sherpa.phase.extracting");
    case "installed":
      return t("asrSettings.manage.ready");
    case "error":
      return t("asrSettings.sherpa.phase.error");
    default:
      return t("asrSettings.sherpa.manage.notInstalled");
  }
}

export function AsrSettingsSection() {
  const { t } = useTranslation();
  const [engine, setEngine] = useState<AsrEngine>("sherpa");
  const [whisperModel, setWhisperModel] = useState<WhisperModel>("base");
  const [sherpaModel, setSherpaModel] = useState<SherpaModel>("zipformer-en-20m");
  const [modelPath, setModelPath] = useState("");
  const [aliyun, setAliyun] = useState(EMPTY_ALIYUN);
  const [tencent, setTencent] = useState(EMPTY_TENCENT);
  const [test, setTest] = useState<TestState>("idle");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileId = currentProfileId(engine, whisperModel, sherpaModel);
  const isSherpa = engine === "sherpa";
  const isWhisper = engine === "whisper";
  const isAliyun = engine === "cloudAliyun";
  const isTencent = engine === "cloudTencent";

  const { statusByModel, refresh, download, pause, resume, openFolder } = useSherpaModelDownloads(isSherpa);
  const modelStatus: SherpaModelStatus | undefined = statusByModel[sherpaModel];

  useEffect(() => {
    const savedProfile = getAsrProfile(profileId);
    setTest("idle");
    setSaved(false);

    if (!savedProfile) {
      setModelPath("");
      setAliyun(EMPTY_ALIYUN);
      setTencent(EMPTY_TENCENT);
      return;
    }

    if (savedProfile.kind === "sherpa") {
      setSherpaModel(savedProfile.model);
      setAliyun(EMPTY_ALIYUN);
      setTencent(EMPTY_TENCENT);
      return;
    }

    if (savedProfile.kind === "whisper") {
      setWhisperModel(savedProfile.model);
      setModelPath(savedProfile.modelPath);
      setAliyun(EMPTY_ALIYUN);
      setTencent(EMPTY_TENCENT);
      return;
    }

    setAliyun(parseAliyunCredentials(savedProfile));
    setTencent(parseTencentCredentials(savedProfile));
  }, [profileId]);

  const invalidateVerification = (id: AsrProfileId) => {
    revokeAsrVerified(id);
    setTest("idle");
    setSaved(false);
  };

  const handleEngineChange = (next: string) => {
    invalidateVerification(profileId);
    setEngine(next as AsrEngine);
  };

  const handleWhisperModelChange = (next: WhisperModel) => {
    invalidateVerification(profileId);
    setWhisperModel(next);
  };

  const handleSherpaModelChange = (next: SherpaModel) => {
    invalidateVerification(profileId);
    setSherpaModel(next);
  };

  const handleModelPathChange = (value: string) => {
    if (value !== modelPath) {
      invalidateVerification(profileId);
    }
    setModelPath(value);
    setSaved(false);
  };

  const updateAliyun = (patch: Partial<typeof EMPTY_ALIYUN>) => {
    invalidateVerification(profileId);
    setAliyun((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const updateTencent = (patch: Partial<typeof EMPTY_TENCENT>) => {
    invalidateVerification(profileId);
    setTencent((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const buildCurrentProfile = () => {
    if (isSherpa) {
      return { kind: "sherpa" as const, model: sherpaModel };
    }
    if (isWhisper) {
      return { kind: "whisper" as const, model: whisperModel, modelPath };
    }
    if (isAliyun) {
      return buildAliyunCloudProfile(aliyun);
    }
    return buildTencentCloudProfile(tencent);
  };

  const isCloudConfigComplete = () => {
    if (isAliyun) return isAliyunCloudComplete(aliyun);
    if (isTencent) return isTencentCloudComplete(tencent);
    return false;
  };

  const persistCurrent = () => {
    saveAsrProfile(profileId, buildCurrentProfile());
  };

  const flashSaved = () => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
  };

  const handleDownloadModel = () => {
    void download(sherpaModel).catch(() => undefined);
  };

  const handlePauseModel = () => {
    void pause(sherpaModel).catch(() => undefined);
  };

  const handleResumeModel = () => {
    void resume(sherpaModel).catch(() => undefined);
  };

  const handleOpenModelFolder = () => {
    void openFolder(sherpaModel).catch(() => undefined);
  };

  const runTest = () => {
    setTest("testing");

    void (async () => {
      if (isSherpa) {
        await refresh();
        const statuses = await listSherpaModelStatuses();
        const current = statuses.find((s) => s.modelId === sherpaModel);
        if (current?.installed !== true) {
          setTest("error");
          return;
        }
      } else if (isWhisper) {
        if (modelPath.trim().length === 0) {
          setTest("error");
          return;
        }
      } else if (!isCloudConfigComplete()) {
        setTest("error");
        return;
      }

      persistCurrent();
      flashSaved();

      try {
        await testAsrConnection(toRustAsrConfig(buildCurrentProfile()));
        markAsrVerified(profileId);
        setTest("ok");
      } catch {
        setTest("error");
      }
    })();
  };

  const handleSave = () => {
    if (isSherpa && modelStatus?.installed !== true) {
      return;
    }
    if (isWhisper && modelPath.trim().length === 0) {
      return;
    }
    if (!isSherpa && !isWhisper && !isCloudConfigComplete()) {
      return;
    }
    persistCurrent();
    flashSaved();
  };

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const sherpaProgress = modelStatus ? progressPercent(modelStatus) : 0;
  const sherpaProgressText = modelStatus
    ? formatDownloadProgress(modelStatus.downloadedBytes, modelStatus.sizeBytes)
    : "";
  const isSherpaDownloading = modelStatus?.phase === "downloading";
  const isSherpaPaused = modelStatus?.phase === "paused" || (modelStatus?.resumable && !modelStatus.installed);
  const isSherpaInstalled = modelStatus?.installed === true;

  return (
    <section className="animate-fade">
      <h2 className="text-[18px] font-[620]">{t("asrSettings.title")}</h2>
      <p className="text-[13px] text-fg-2 mt-1.5 leading-[1.55]">{t("asrSettings.sub")}</p>

      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">{t("asrSettings.group.engine")}</div>
        <div className="formcard">
          <FormField label={t("asrSettings.engine.label")} description={t("asrSettings.engine.help")}>
            <Select
              ariaLabel={t("asrSettings.engine.label")}
              value={engine}
              onValueChange={handleEngineChange}
              options={ASR_ENGINE_OPTIONS.map((o) => ({ value: o.value, label: t(o.key) }))}
            />
          </FormField>

          {isSherpa ? (
            <>
              <FormField
                label={t("asrSettings.model.label")}
                description={t("asrSettings.sherpa.model.help")}
                controlClassName="flex justify-end"
              >
                <SegmentedControl
                  type="single"
                  aria-label={t("asrSettings.model.label")}
                  value={sherpaModel}
                  onValueChange={(v: string) => {
                    if (v) handleSherpaModelChange(v as SherpaModel);
                  }}
                >
                  {SHERPA_MODELS.map((m) => (
                    <SegmentedItem key={m} value={m}>
                      {t(`asrSettings.sherpa.model.${m === "zipformer-en-20m" ? "small" : "full"}`)}
                    </SegmentedItem>
                  ))}
                </SegmentedControl>
              </FormField>

              <FormField
                stacked
                label={t("asrSettings.manage.label")}
                description={
                  modelStatus
                    ? t("asrSettings.sherpa.manage.size", {
                        size: formatModelSize(modelStatus.sizeBytes),
                      })
                    : t("asrSettings.sherpa.manage.pending")
                }
                controlClassName="w-full max-w-none mt-2"
              >
                <div className="flex items-center gap-2.5 mt-2.5">
                  <ProgressBar value={sherpaProgress} className="flex-1" />
                  <span className="font-mono text-[11px] text-fg-2 shrink-0">
                    {modelStatus
                      ? sherpaPhaseLabel(t, modelStatus.phase)
                      : t("asrSettings.sherpa.manage.notInstalled")}
                  </span>
                </div>
                {modelStatus && !isSherpaInstalled ? (
                  <p className="font-mono text-[11px] text-fg-3 mt-1.5">{sherpaProgressText}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {isSherpaInstalled ? (
                    <Button onClick={handleOpenModelFolder}>
                      {t("asrSettings.sherpa.manage.openFolder")}
                    </Button>
                  ) : isSherpaDownloading ? (
                    <Button onClick={handlePauseModel}>{t("asrSettings.sherpa.manage.pause")}</Button>
                  ) : isSherpaPaused ? (
                    <Button onClick={handleResumeModel}>{t("asrSettings.sherpa.manage.resume")}</Button>
                  ) : (
                    <Button onClick={handleDownloadModel}>
                      {t("asrSettings.sherpa.manage.download")}
                    </Button>
                  )}
                </div>
              </FormField>
            </>
          ) : null}

          {isWhisper ? (
            <>
              <FormField
                label={t("asrSettings.model.label")}
                description={t("asrSettings.model.help")}
                controlClassName="flex justify-end"
              >
                <SegmentedControl
                  type="single"
                  aria-label={t("asrSettings.model.label")}
                  value={whisperModel}
                  onValueChange={(v: string) => {
                    if (v) handleWhisperModelChange(v as WhisperModel);
                  }}
                >
                  {WHISPER_MODELS.map((m) => (
                    <SegmentedItem key={m} value={m}>
                      {t(`asrSettings.model.${m}`)}
                    </SegmentedItem>
                  ))}
                </SegmentedControl>
              </FormField>

              <FormField
                stacked
                label={t("asrSettings.manage.label")}
                description={t("asrSettings.manage.file")}
                controlClassName="w-full max-w-none mt-2"
              >
                <div className="flex items-center gap-2.5 mt-2.5">
                  <ProgressBar value={modelPath ? 100 : 0} className="flex-1" />
                  <span className="font-mono text-[11px] text-fg-2">
                    {modelPath ? t("asrSettings.manage.ready") : t("asrSettings.manage.progress")}
                  </span>
                </div>
                <Input
                  className="mt-2.5"
                  mono
                  value={modelPath}
                  onChange={(e) => handleModelPathChange(e.target.value)}
                  placeholder={t("asrSettings.manage.pathPlaceholder")}
                />
              </FormField>
            </>
          ) : null}

          {isAliyun ? (
            <>
              <div className="field-row">
                <label htmlFor="asrAppKey" className="text-[12.5px] font-[510] text-fg">
                  {t("asrSettings.cloud.aliyun.appKey")}
                </label>
                <Input
                  id="asrAppKey"
                  value={aliyun.appKey}
                  onChange={(e) => updateAliyun({ appKey: e.target.value })}
                  placeholder={t("asrSettings.cloud.aliyun.appKeyPlaceholder")}
                />
              </div>
              <div className="field-row">
                <label htmlFor="asrAccessKeyId" className="text-[12.5px] font-[510] text-fg">
                  {t("asrSettings.cloud.aliyun.accessKeyId")}
                </label>
                <Input
                  id="asrAccessKeyId"
                  mono
                  value={aliyun.accessKeyId}
                  onChange={(e) => updateAliyun({ accessKeyId: e.target.value })}
                  placeholder="LTAI..."
                />
              </div>
              <div className="field-row">
                <label htmlFor="asrAccessKeySecret" className="text-[12.5px] font-[510] text-fg">
                  {t("asrSettings.cloud.aliyun.accessKeySecret")}
                </label>
                <Input
                  id="asrAccessKeySecret"
                  type="password"
                  value={aliyun.accessKeySecret}
                  onChange={(e) => updateAliyun({ accessKeySecret: e.target.value })}
                  placeholder="••••••••••••••••"
                />
              </div>
              <p className="text-[11.5px] text-fg-3 leading-[1.5]">{t("asrSettings.cloud.aliyun.help")}</p>
            </>
          ) : null}

          {isTencent ? (
            <>
              <div className="field-row">
                <label htmlFor="asrSecretId" className="text-[12.5px] font-[510] text-fg">
                  {t("asrSettings.cloud.tencent.secretId")}
                </label>
                <Input
                  id="asrSecretId"
                  mono
                  value={tencent.secretId}
                  onChange={(e) => updateTencent({ secretId: e.target.value })}
                  placeholder="AKID..."
                />
              </div>
              <div className="field-row">
                <label htmlFor="asrSecretKey" className="text-[12.5px] font-[510] text-fg">
                  {t("asrSettings.cloud.tencent.secretKey")}
                </label>
                <Input
                  id="asrSecretKey"
                  type="password"
                  value={tencent.secretKey}
                  onChange={(e) => updateTencent({ secretKey: e.target.value })}
                  placeholder="••••••••••••••••"
                />
              </div>
              <p className="text-[11.5px] text-fg-3 leading-[1.5]">{t("asrSettings.cloud.tencent.help")}</p>
            </>
          ) : null}

          <FormField
            label={t("asrSettings.test.label")}
            description={t("asrSettings.test.help")}
            controlClassName="flex gap-2.5 items-center"
          >
            <Button onClick={runTest} disabled={test === "testing"}>
              {test === "testing" ? t("asrSettings.test.testing") : t("asrSettings.test.run")}
            </Button>
            {test === "ok" ? (
              <span className="text-[12px] mt-2 inline-flex items-center gap-1.5 text-success">
                <CheckIcon size={13} />
                {t("asrSettings.test.ok")}
              </span>
            ) : null}
            {test === "error" ? (
              <span className="text-[12px] mt-2 text-warn-fg">{t("asrSettings.test.fail")}</span>
            ) : null}
          </FormField>
        </div>
      </div>

      <div className="footbar">
        <Button>{t("preferences.action.reset")}</Button>
        <div className="inline-flex items-center gap-2.5">
          {saved ? (
            <span className="text-[12px] text-success inline-flex items-center gap-1.5">
              <CheckIcon size={13} />
              {t("preferences.action.saved")}
            </span>
          ) : null}
          <Button variant="primary" onClick={handleSave}>
            {t("preferences.action.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
