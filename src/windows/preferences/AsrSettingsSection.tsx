import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import {
  asrProfileIdForEngine,
  asrProfileIdForWhisper,
  getAsrProfile,
  revokeAsrVerified,
  saveAsrProfile,
  markAsrVerified,
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

function currentProfileId(engine: AsrEngine, model: WhisperModel): AsrProfileId {
  return engine === "whisper" ? asrProfileIdForWhisper(model) : asrProfileIdForEngine(engine);
}

export function AsrSettingsSection() {
  const { t } = useTranslation();
  const [engine, setEngine] = useState<AsrEngine>("whisper");
  const [model, setModel] = useState<WhisperModel>("base");
  const [modelPath, setModelPath] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [test, setTest] = useState<TestState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileId = currentProfileId(engine, model);
  const isWhisper = engine === "whisper";

  useEffect(() => {
    const saved = getAsrProfile(profileId);
    if (!saved) return;
    if (saved.kind === "whisper") {
      setModel(saved.model);
      setModelPath(saved.modelPath);
    } else {
      setApiKey(saved.apiKey);
    }
  }, [profileId]);

  const invalidateVerification = (id: AsrProfileId) => {
    revokeAsrVerified(id);
    setTest("idle");
  };

  const handleEngineChange = (next: string) => {
    invalidateVerification(profileId);
    setEngine(next as AsrEngine);
  };

  const handleModelChange = (next: WhisperModel) => {
    invalidateVerification(profileId);
    setModel(next);
  };

  const handleApiKeyChange = (value: string) => {
    if (value !== apiKey) {
      invalidateVerification(profileId);
    }
    setApiKey(value);
  };

  const handleModelPathChange = (value: string) => {
    if (value !== modelPath) {
      invalidateVerification(profileId);
    }
    setModelPath(value);
  };

  const persistCurrent = () => {
    if (isWhisper) {
      saveAsrProfile(profileId, { kind: "whisper", model, modelPath });
      return;
    }
    saveAsrProfile(profileId, {
      kind: "cloud",
      engine: engine as "cloudAliyun" | "cloudTencent",
      apiKey,
    });
  };

  const runTest = () => {
    setTest("testing");
    if (timer.current) clearTimeout(timer.current);

    const valid = isWhisper ? modelPath.trim().length > 0 : apiKey.trim().length > 0;

    timer.current = setTimeout(() => {
      if (!valid) {
        setTest("error");
        return;
      }
      persistCurrent();
      markAsrVerified(profileId);
      setTest("ok");
    }, 800);
  };

  const handleSave = () => {
    persistCurrent();
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
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

          <div
            className={`max-h-0 overflow-hidden transition-[max-height] duration-300 ease-mac ${
              isWhisper ? "max-h-[560px]" : ""
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

          <div
            className={`max-h-0 overflow-hidden transition-[max-height] duration-300 ease-mac ${
              !isWhisper ? "max-h-[560px]" : ""
            }`}
          >
            <div className="field-row">
              <label htmlFor="asrApiKey" className="text-[12.5px] font-[510] text-fg">
                {t("asrSettings.apiKey")}
              </label>
              <Input
                id="asrApiKey"
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="••••••••••••••••"
              />
            </div>
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
      </div>

      <div className="footbar">
        <Button>{t("preferences.action.reset")}</Button>
        <Button variant="primary" onClick={handleSave}>
          {t("preferences.action.save")}
        </Button>
      </div>
    </section>
  );
}
