import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TestState = "idle" | "testing" | "ok";

const OCR_ENGINE_OPTIONS = [
  { value: "localNative", key: "ocrSettings.engine.localNative" },
  { value: "localPaddle", key: "ocrSettings.engine.localPaddle" },
  { value: "cloudBaidu", key: "ocrSettings.engine.cloudBaidu" },
  { value: "cloudTencent", key: "ocrSettings.engine.cloudTencent" },
] as const;

export function OcrSettingsSection() {
  const { t } = useTranslation();
  const [engine, setEngine] = useState("localNative");
  const [test, setTest] = useState<TestState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCloud = engine.startsWith("cloud");

  const runTest = () => {
    setTest("testing");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTest("ok"), 800);
  };

  return (
    <section className="animate-fade">
      <h2 className="text-[18px] font-[620]">{t("ocrSettings.title")}</h2>
      <p className="text-[13px] text-fg-2 mt-1.5 leading-[1.55]">{t("ocrSettings.sub")}</p>

      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">
          {t("ocrSettings.group.engine")}
        </div>
        <div className="formcard">
          <FormField
            label={t("ocrSettings.engine.label")}
            description={t("ocrSettings.engine.help")}
          >
            <Select
              ariaLabel={t("ocrSettings.engine.label")}
              value={engine}
              onValueChange={(v) => {
                setEngine(v);
                setTest("idle");
              }}
              options={OCR_ENGINE_OPTIONS.map((o) => ({ value: o.value, label: t(o.key) }))}
            />
          </FormField>

          <div
            className={`max-h-0 overflow-hidden transition-[max-height] duration-300 ease-mac ${
              isCloud ? "max-h-[460px]" : ""
            }`}
          >
            <div className="field-row">
              <label htmlFor="ocrAppId" className="text-[12.5px] font-[510] text-fg">
                {t("ocrSettings.appId")}
              </label>
              <Input id="ocrAppId" placeholder={t("ocrSettings.appIdPlaceholder")} />
            </div>
            <div className="field-row">
              <label htmlFor="ocrSecret" className="text-[12.5px] font-[510] text-fg">
                {t("ocrSettings.secret")}
              </label>
              <Input id="ocrSecret" type="password" placeholder="••••••••••••••••" />
            </div>
            <FormField
              label={t("ocrSettings.test.label")}
              description={t("ocrSettings.test.help")}
              controlClassName="flex gap-2.5 items-center"
            >
              <Button onClick={runTest} disabled={test === "testing"}>
                {test === "testing" ? t("ocrSettings.test.testing") : t("ocrSettings.test.run")}
              </Button>
              {test === "ok" ? (
                <span className="text-[12px] mt-2 inline-flex items-center gap-1.5 text-success">
                  <CheckIcon size={13} />
                  {t("ocrSettings.test.ok")}
                </span>
              ) : null}
            </FormField>
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
