import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MT_PROVIDER_OPTIONS = [
  { value: "google", label: "Google Translate" },
  { value: "deepl", label: "DeepL" },
];

export function MtSettingsSection() {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-chat");
  const [prompt, setPrompt] = useState(t("mtSettings.llm.promptDefault"));
  const [mtProvider, setMtProvider] = useState("google");

  return (
    <section className="animate-fade">
      <h2 className="text-[18px] font-[620]">{t("mtSettings.title")}</h2>
      <p className="text-[13px] text-fg-2 mt-1.5 leading-[1.55]">{t("mtSettings.sub")}</p>

      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">
          {t("mtSettings.group.mt")}
        </div>
        <div className="formcard">
          <FormField label={t("mtSettings.mt.provider")}>
            <Select
              ariaLabel={t("mtSettings.mt.provider")}
              value={mtProvider}
              onValueChange={setMtProvider}
              options={MT_PROVIDER_OPTIONS}
            />
          </FormField>
          <div className="field-row">
            <label htmlFor="mtApiKey" className="text-[12.5px] font-[510] text-fg">
              {t("mtSettings.mt.apiKey")}
            </label>
            <Input
              id="mtApiKey"
              type="password"
              placeholder={t("mtSettings.mt.apiKeyPlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">
          {t("mtSettings.group.llm")}
        </div>
        <div className="formcard">
          <div className="field-row">
            <label htmlFor="llmBaseUrl" className="text-[12.5px] font-[510] text-fg">
              {t("mtSettings.llm.baseUrl")}
            </label>
            <Input
              id="llmBaseUrl"
              mono
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <span className="text-[11px] text-fg-2">{t("mtSettings.llm.baseUrlHint")}</span>
          </div>
          <div className="field-row">
            <label htmlFor="llmApiKey" className="text-[12.5px] font-[510] text-fg">
              {t("mtSettings.llm.apiKey")}
            </label>
            <Input id="llmApiKey" type="password" placeholder="sk-••••••••••••••••" />
          </div>
          <div className="field-row">
            <label htmlFor="llmModel" className="text-[12.5px] font-[510] text-fg">
              {t("mtSettings.llm.model")}
            </label>
            <Input
              id="llmModel"
              mono
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat / gpt-4o-mini"
            />
          </div>
          <div className="field-row">
            <label htmlFor="llmPrompt" className="text-[12.5px] font-[510] text-fg">
              {t("mtSettings.llm.prompt")}
            </label>
            <Textarea
              id="llmPrompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <span className="text-[11px] text-fg-2">
              {t("mtSettings.llm.promptHint", {
                interpolation: { prefix: "[[", suffix: "]]" },
              })}
            </span>
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
