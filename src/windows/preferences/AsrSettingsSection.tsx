import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";

const MODELS = ["tiny", "base", "large"] as const;
type WhisperModel = (typeof MODELS)[number];

const ASR_ENGINE_OPTIONS = [
  { value: "whisper", key: "asrSettings.engine.whisper" },
  { value: "cloudAliyun", key: "asrSettings.engine.cloudAliyun" },
  { value: "cloudTencent", key: "asrSettings.engine.cloudTencent" },
] as const;

export function AsrSettingsSection() {
  const { t } = useTranslation();
  const [engine, setEngine] = useState("whisper");
  const [model, setModel] = useState<WhisperModel>("base");

  const isWhisper = engine === "whisper";

  return (
    <section className="animate-fade">
      <h2 className="text-[18px] font-[620]">{t("asrSettings.title")}</h2>
      <p className="text-[13px] text-fg-2 mt-1.5 leading-[1.55]">{t("asrSettings.sub")}</p>

      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">
          {t("asrSettings.group.engine")}
        </div>
        <div className="formcard">
          <FormField
            label={t("asrSettings.engine.label")}
            description={t("asrSettings.engine.help")}
          >
            <Select
              ariaLabel={t("asrSettings.engine.label")}
              value={engine}
              onValueChange={setEngine}
              options={ASR_ENGINE_OPTIONS.map((o) => ({ value: o.value, label: t(o.key) }))}
            />
          </FormField>

          <div
            className={`max-h-0 overflow-hidden transition-[max-height] duration-300 ease-mac ${
              isWhisper ? "max-h-[460px]" : ""
            }`}
          >
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
                  if (v) setModel(v as WhisperModel);
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
                <ProgressBar value={64} className="flex-1" />
                <span className="font-mono text-[11px] text-fg-2">
                  {t("asrSettings.manage.progress")}
                </span>
              </div>
              <Button className="mt-2.5 self-start">{t("asrSettings.manage.choose")}</Button>
            </FormField>
          </div>

          <div
            className={`max-h-0 overflow-hidden transition-[max-height] duration-300 ease-mac ${
              !isWhisper ? "max-h-[460px]" : ""
            }`}
          >
            <div className="field-row">
              <label htmlFor="asrApiKey" className="text-[12.5px] font-[510] text-fg">
                {t("asrSettings.apiKey")}
              </label>
              <Input id="asrApiKey" type="password" placeholder="••••••••••••••••" />
            </div>
          </div>
        </div>
      </div>

      <div className="footbar">
        <Button>{t("preferences.action.reset")}</Button>
        <Button variant="primary">{t("preferences.action.save")}</Button>
      </div>
    </section>
  );
}
