import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { testSpeechTranslateConnection } from "@/lib/audio/session";
import {
  defaultTencentSpeechTranslateConfig,
  getSpeechTranslateProfile,
  isSpeechTranslateConfigComplete,
  markSpeechTranslateVerified,
  revokeSpeechTranslateVerified,
  saveSpeechTranslateProfile,
  SPEECH_TRANSLATE_TEST_LANGUAGE_PAIR,
  TENCENT_SPEECH_TRANSLATE_PROFILE_ID,
  toRustSpeechTranslateConfig,
  type TencentSpeechDomain,
  type TencentTransModel,
  type TestState,
} from "@/lib/settings";

const TRANS_MODEL_OPTIONS = [
  { value: "hunyuan-translation" as const, labelKey: "speechTranslateSettings.transModel.standard" as const },
  { value: "hunyuan-translation-lite" as const, labelKey: "speechTranslateSettings.transModel.lite" as const },
];

const DOMAIN_OPTIONS = [
  { value: "", labelKey: "speechTranslateSettings.domain.none" as const },
  { value: "1", labelKey: "speechTranslateSettings.domain.tech" as const },
  { value: "2", labelKey: "speechTranslateSettings.domain.movie" as const },
  { value: "3", labelKey: "speechTranslateSettings.domain.song" as const },
];

export function SpeechTranslateSettingsSection() {
  const { t } = useTranslation();
  const profileId = TENCENT_SPEECH_TRANSLATE_PROFILE_ID;
  const [config, setConfig] = useState(defaultTencentSpeechTranslateConfig());
  const [test, setTest] = useState<TestState>("idle");
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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

    void testSpeechTranslateConnection(
      toRustSpeechTranslateConfig(config, SPEECH_TRANSLATE_TEST_LANGUAGE_PAIR),
    )
      .then(() => {
        markSpeechTranslateVerified(profileId);
        setTest("ok");
      })
      .catch(() => {
        setTest("error");
      });
  };

  const canTest = isSpeechTranslateConfigComplete(config);
  const domainValue = config.domain ? String(config.domain) : "";

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

          <div className="mt-2">
            <button
              type="button"
              className="text-[13px] text-accent-fg hover:underline"
              onClick={() => setShowAdvanced((open) => !open)}
            >
              {showAdvanced
                ? t("speechTranslateSettings.advanced.hide")
                : t("speechTranslateSettings.advanced.show")}
            </button>
          </div>

          {showAdvanced ? (
            <>
              <FormField
                stacked
                label={t("speechTranslateSettings.hotwordList.label")}
                description={t("speechTranslateSettings.hotwordList.help")}
              >
                <Input
                  value={config.hotwordList ?? ""}
                  onChange={(event) => updateConfig({ hotwordList: event.target.value })}
                  placeholder={t("speechTranslateSettings.hotwordList.placeholder")}
                  autoComplete="off"
                />
              </FormField>

              <FormField
                stacked
                label={t("speechTranslateSettings.noiseThreshold.label")}
                description={t("speechTranslateSettings.noiseThreshold.help")}
              >
                <div className="flex items-center gap-3">
                  <Slider
                    min={-2}
                    max={2}
                    step={0.1}
                    value={[config.noiseThreshold ?? 0]}
                    onValueChange={([value]) => updateConfig({ noiseThreshold: value ?? 0 })}
                    aria-label={t("speechTranslateSettings.noiseThreshold.label")}
                    className="flex-1"
                  />
                  <span className="text-[12px] text-fg-2 w-8 text-right tabular-nums">
                    {(config.noiseThreshold ?? 0).toFixed(1)}
                  </span>
                </div>
              </FormField>

              <FormField stacked label={t("speechTranslateSettings.domain.label")} description={t("speechTranslateSettings.domain.help")}>
                <Select
                  ariaLabel={t("speechTranslateSettings.domain.label")}
                  options={DOMAIN_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  value={domainValue}
                  onValueChange={(value) =>
                    updateConfig({
                      domain: value ? (Number(value) as TencentSpeechDomain) : undefined,
                    })
                  }
                />
              </FormField>
            </>
          ) : null}

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
