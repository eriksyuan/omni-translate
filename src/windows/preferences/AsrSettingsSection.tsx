import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { testAsrConnection } from "@/lib/audio";
import {
  asrProfileIdForEngine,
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
  type TestState,
  type WhisperModel,
} from "@/lib/settings";

const MODELS = ["tiny", "base", "large"] as const;

const ASR_ENGINE_OPTIONS = [
  { value: "whisper", key: "asrSettings.engine.whisper" },
  { value: "cloudAliyun", key: "asrSettings.engine.cloudAliyun" },
  { value: "cloudTencent", key: "asrSettings.engine.cloudTencent" },
] as const;

const EMPTY_ALIYUN = { appKey: "", accessKeyId: "", accessKeySecret: "" };
const EMPTY_TENCENT = { secretId: "", secretKey: "" };

function currentProfileId(engine: AsrEngine, model: WhisperModel): AsrProfileId {
  return engine === "whisper" ? asrProfileIdForWhisper(model) : asrProfileIdForEngine(engine);
}

export function AsrSettingsSection() {
  const { t } = useTranslation();
  const [engine, setEngine] = useState<AsrEngine>("whisper");
  const [model, setModel] = useState<WhisperModel>("base");
  const [modelPath, setModelPath] = useState("");
  const [aliyun, setAliyun] = useState(EMPTY_ALIYUN);
  const [tencent, setTencent] = useState(EMPTY_TENCENT);
  const [test, setTest] = useState<TestState>("idle");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileId = currentProfileId(engine, model);
  const isWhisper = engine === "whisper";
  const isAliyun = engine === "cloudAliyun";
  const isTencent = engine === "cloudTencent";

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

    if (savedProfile.kind === "whisper") {
      setModel(savedProfile.model);
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

  const handleModelChange = (next: WhisperModel) => {
    invalidateVerification(profileId);
    setModel(next);
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
    if (isWhisper) {
      return { kind: "whisper" as const, model, modelPath };
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

  const runTest = () => {
    setTest("testing");
    if (timer.current) clearTimeout(timer.current);

    const valid = isWhisper ? modelPath.trim().length > 0 : isCloudConfigComplete();
    if (!valid) {
      setTest("error");
      return;
    }

    persistCurrent();
    flashSaved();

    void testAsrConnection(toRustAsrConfig(buildCurrentProfile()))
      .then(() => {
        markAsrVerified(profileId);
        setTest("ok");
      })
      .catch(() => {
        setTest("error");
      });
  };

  const handleSave = () => {
    if (isWhisper && modelPath.trim().length === 0) {
      return;
    }
    if (!isWhisper && !isCloudConfigComplete()) {
      return;
    }
    persistCurrent();
    flashSaved();
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

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
                  value={model}
                  onValueChange={(v: string) => {
                    if (v) handleModelChange(v as WhisperModel);
                  }}
                >
                  {MODELS.map((m) => (
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
