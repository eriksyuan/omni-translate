import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select } from "@/components/ui/select";
import { testSpeechTranslateConnection } from "@/lib/audio/session";
import {
  defaultTencentSpeechTranslateConfig,
  getSpeechTranslateProfile,
  isSpeechTranslateConfigComplete,
  markSpeechTranslateVerified,
  revokeSpeechTranslateVerified,
  saveSpeechTranslateProfile,
  TENCENT_SPEECH_TRANSLATE_PROFILE_ID,
  toRustSpeechTranslateConfig,
  type SpeechTranslateSource,
  type TencentTransModel,
  type TestState,
} from "@/lib/settings";

const SOURCE_OPTIONS = [
  { value: "en" as const, labelKey: "speechTranslateSettings.source.en" as const },
  { value: "zh" as const, labelKey: "speechTranslateSettings.source.zh" as const },
  { value: "zh_en" as const, labelKey: "speechTranslateSettings.source.zhEn" as const },
];

const TRANS_MODEL_OPTIONS = [
  { value: "hunyuan-translation-lite" as const, labelKey: "speechTranslateSettings.transModel.lite" as const },
  { value: "hunyuan-translation" as const, labelKey: "speechTranslateSettings.transModel.standard" as const },
];

export function SpeechTranslateSettingsSection() {
  const { t } = useTranslation();
  const profileId = TENCENT_SPEECH_TRANSLATE_PROFILE_ID;
  const [config, setConfig] = useState(defaultTencentSpeechTranslateConfig());
  const [test, setTest] = useState<TestState>("idle");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedProfile = getSpeechTranslateProfile(profileId);
    setTest("idle");
    setSaved(false);
    setConfig(savedProfile ?? defaultTencentSpeechTranslateConfig());
  }, [profileId]);

  const invalidateVerification = () => {
    revokeSpeechTranslateVerified(profileId);
    setTest("idle");
    setSaved(false);
  };

  const updateConfig = (patch: Partial<typeof config>) => {
    invalidateVerification();
    setConfig((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const flashSaved = () => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
  };

  const handleSave = () => {
    saveSpeechTranslateProfile(profileId, config);
    flashSaved();
  };

  const handleTest = () => {
    if (!isSpeechTranslateConfigComplete(config)) return;

    setTest("testing");
    if (timer.current) clearTimeout(timer.current);

    saveSpeechTranslateProfile(profileId, config);
    flashSaved();

    void testSpeechTranslateConnection(toRustSpeechTranslateConfig(config))
      .then(() => {
        markSpeechTranslateVerified(profileId);
        setTest("ok");
      })
      .catch(() => {
        setTest("error");
      });
  };

  const canTest = isSpeechTranslateConfigComplete(config);

  return (
    <section>
      <h2 className="text-[18px] font-620">{t("speechTranslateSettings.title")}</h2>
      <p className="text-[13px] text-fg-2 mt-[6px] leading-[1.55]">{t("speechTranslateSettings.sub")}</p>

      <div className="mt-[22px]">
        <div className="formcard">
          <FormField stacked label={t("speechTranslateSettings.appId.label")} description={t("speechTranslateSettings.appId.help")}>
            <Input
              value={config.appId}
              onChange={(event) => updateConfig({ appId: event.target.value })}
              placeholder={t("speechTranslateSettings.appId.placeholder")}
              autoComplete="off"
            />
          </FormField>

          <FormField stacked label={t("speechTranslateSettings.secretId.label")} description={t("speechTranslateSettings.secretId.help")}>
            <Input
              value={config.secretId}
              onChange={(event) => updateConfig({ secretId: event.target.value })}
              placeholder={t("speechTranslateSettings.secretId.placeholder")}
              autoComplete="off"
            />
          </FormField>

          <FormField stacked label={t("speechTranslateSettings.secretKey.label")} description={t("speechTranslateSettings.secretKey.help")}>
            <Input
              type="password"
              value={config.secretKey}
              onChange={(event) => updateConfig({ secretKey: event.target.value })}
              placeholder={t("speechTranslateSettings.secretKey.placeholder")}
              autoComplete="off"
            />
          </FormField>

          <FormField stacked label={t("speechTranslateSettings.source.label")} description={t("speechTranslateSettings.source.help")}>
            <Select
              ariaLabel={t("speechTranslateSettings.source.label")}
              options={SOURCE_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              value={config.source}
              onValueChange={(value) => updateConfig({ source: value as SpeechTranslateSource })}
            />
          </FormField>

          <FormField stacked label={t("speechTranslateSettings.target.label")} description={t("speechTranslateSettings.target.help")}>
            <Input value={t("speechTranslateSettings.target.zh")} readOnly disabled />
          </FormField>

          <FormField stacked label={t("speechTranslateSettings.transModel.label")} description={t("speechTranslateSettings.transModel.help")}>
            <Select
              ariaLabel={t("speechTranslateSettings.transModel.label")}
              options={TRANS_MODEL_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              value={config.transModel}
              onValueChange={(value) => updateConfig({ transModel: value as TencentTransModel })}
            />
          </FormField>

          <FormField
            label={t("speechTranslateSettings.action.test")}
            controlClassName="flex gap-2.5 items-center flex-wrap"
          >
            <Button onClick={handleSave}>{saved ? t("preferences.action.saved") : t("preferences.action.save")}</Button>
            <Button variant="primary" onClick={handleTest} disabled={!canTest || test === "testing"}>
              {test === "testing" ? t("speechTranslateSettings.action.testing") : t("speechTranslateSettings.action.test")}
            </Button>
            {test === "testing" ? <ProgressBar value={50} className="flex-1 max-w-[120px]" /> : null}
            {test === "ok" ? (
              <span className="text-[12px] inline-flex items-center gap-1.5 text-success">
                <CheckIcon size={13} />
                {t("speechTranslateSettings.action.testOk")}
              </span>
            ) : null}
            {test === "error" ? (
              <span className="text-[12px] text-warn-fg">{t("speechTranslateSettings.action.testFailed")}</span>
            ) : null}
          </FormField>
        </div>
      </div>
    </section>
  );
}
