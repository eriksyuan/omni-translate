import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getMtProfile,
  markMtVerified,
  mtLlmProfileId,
  mtTraditionalProfileId,
  revokeMtVerified,
  saveMtProfile,
  type MtProfileId,
  type MtTraditionalProvider,
  type TestState,
} from "@/lib/settings";
import { testMtConnection } from "@/lib/audio";

const MT_PROVIDER_OPTIONS = [
  { value: "google", label: "Google Translate" },
  { value: "deepl", label: "DeepL" },
];

export function MtSettingsSection() {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-chat");
  const [prompt, setPrompt] = useState(t("mtSettings.llm.promptDefault"));
  const [mtProvider, setMtProvider] = useState<MtTraditionalProvider>("google");
  const [mtApiKey, setMtApiKey] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [traditionalTest, setTraditionalTest] = useState<TestState>("idle");
  const [llmTest, setLlmTest] = useState<TestState>("idle");
  const traditionalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const llmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const traditionalProfileId = mtTraditionalProfileId(mtProvider);
  const llmProfileId = mtLlmProfileId(model);

  useEffect(() => {
    const saved = getMtProfile(traditionalProfileId);
    if (saved?.kind === "traditional") {
      setMtApiKey(saved.apiKey);
    }
  }, [traditionalProfileId]);

  useEffect(() => {
    const saved = getMtProfile(llmProfileId);
    if (saved?.kind === "llm") {
      setBaseUrl(saved.baseUrl);
      setLlmApiKey(saved.apiKey);
      setModel(saved.model);
      setPrompt(saved.prompt);
    }
  }, [llmProfileId]);

  const invalidateTraditional = (id: MtProfileId = traditionalProfileId) => {
    revokeMtVerified(id);
    setTraditionalTest("idle");
  };

  const invalidateLlm = (id: MtProfileId = llmProfileId) => {
    revokeMtVerified(id);
    setLlmTest("idle");
  };

  const persistTraditional = () => {
    saveMtProfile(traditionalProfileId, {
      kind: "traditional",
      provider: mtProvider,
      apiKey: mtApiKey,
    });
  };

  const persistLlm = () => {
    saveMtProfile(llmProfileId, {
      kind: "llm",
      baseUrl,
      apiKey: llmApiKey,
      model,
      prompt,
    });
  };

  const runTraditionalTest = () => {
    setTraditionalTest("testing");
    if (traditionalTimer.current) clearTimeout(traditionalTimer.current);

    if (mtApiKey.trim().length === 0) {
      setTraditionalTest("error");
      return;
    }

    persistTraditional();

    void testMtConnection({
      kind: "traditional",
      provider: mtProvider,
      apiKey: mtApiKey,
    })
      .then(() => {
        markMtVerified(traditionalProfileId);
        setTraditionalTest("ok");
      })
      .catch(() => {
        setTraditionalTest("error");
      });
  };

  const runLlmTest = () => {
    setLlmTest("testing");
    if (llmTimer.current) clearTimeout(llmTimer.current);

    const valid =
      baseUrl.trim().length > 0 && model.trim().length > 0 && llmApiKey.trim().length > 0;

    if (!valid) {
      setLlmTest("error");
      return;
    }

    persistLlm();

    void testMtConnection({
      kind: "llm",
      baseUrl,
      apiKey: llmApiKey,
      model,
      prompt,
    })
      .then(() => {
        markMtVerified(llmProfileId);
        setLlmTest("ok");
      })
      .catch(() => {
        setLlmTest("error");
      });
  };

  useEffect(() => {
    return () => {
      if (traditionalTimer.current) clearTimeout(traditionalTimer.current);
      if (llmTimer.current) clearTimeout(llmTimer.current);
    };
  }, []);

  return (
    <section className="animate-fade">
      <h2 className="text-[18px] font-[620]">{t("mtSettings.title")}</h2>
      <p className="text-[13px] text-fg-2 mt-1.5 leading-[1.55]">{t("mtSettings.sub")}</p>

      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">{t("mtSettings.group.mt")}</div>
        <div className="formcard">
          <FormField label={t("mtSettings.mt.provider")}>
            <Select
              ariaLabel={t("mtSettings.mt.provider")}
              value={mtProvider}
              onValueChange={(value) => {
                invalidateTraditional();
                setMtProvider(value as MtTraditionalProvider);
              }}
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
              value={mtApiKey}
              onChange={(e) => {
                if (e.target.value !== mtApiKey) invalidateTraditional();
                setMtApiKey(e.target.value);
              }}
              placeholder={t("mtSettings.mt.apiKeyPlaceholder")}
            />
          </div>
          <FormField
            label={t("mtSettings.test.label")}
            description={t("mtSettings.test.help")}
            controlClassName="flex gap-2.5 items-center"
          >
            <Button onClick={runTraditionalTest} disabled={traditionalTest === "testing"}>
              {traditionalTest === "testing" ? t("mtSettings.test.testing") : t("mtSettings.test.run")}
            </Button>
            {traditionalTest === "ok" ? (
              <span className="text-[12px] mt-2 inline-flex items-center gap-1.5 text-success">
                <CheckIcon size={13} />
                {t("mtSettings.test.ok")}
              </span>
            ) : null}
            {traditionalTest === "error" ? (
              <span className="text-[12px] mt-2 text-warn-fg">{t("mtSettings.test.fail")}</span>
            ) : null}
          </FormField>
        </div>
      </div>

      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">{t("mtSettings.group.llm")}</div>
        <div className="formcard">
          <div className="field-row">
            <label htmlFor="llmBaseUrl" className="text-[12.5px] font-[510] text-fg">
              {t("mtSettings.llm.baseUrl")}
            </label>
            <Input
              id="llmBaseUrl"
              mono
              value={baseUrl}
              onChange={(e) => {
                if (e.target.value !== baseUrl) invalidateLlm();
                setBaseUrl(e.target.value);
              }}
            />
            <span className="text-[11px] text-fg-2">{t("mtSettings.llm.baseUrlHint")}</span>
          </div>
          <div className="field-row">
            <label htmlFor="llmApiKey" className="text-[12.5px] font-[510] text-fg">
              {t("mtSettings.llm.apiKey")}
            </label>
            <Input
              id="llmApiKey"
              type="password"
              value={llmApiKey}
              onChange={(e) => {
                if (e.target.value !== llmApiKey) invalidateLlm();
                setLlmApiKey(e.target.value);
              }}
              placeholder="sk-••••••••••••••••"
            />
          </div>
          <div className="field-row">
            <label htmlFor="llmModel" className="text-[12.5px] font-[510] text-fg">
              {t("mtSettings.llm.model")}
            </label>
            <Input
              id="llmModel"
              mono
              value={model}
              onChange={(e) => {
                if (e.target.value !== model) invalidateLlm();
                setModel(e.target.value);
              }}
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
              onChange={(e) => {
                if (e.target.value !== prompt) invalidateLlm();
                setPrompt(e.target.value);
              }}
            />
            <span className="text-[11px] text-fg-2">
              {t("mtSettings.llm.promptHint", {
                interpolation: { prefix: "[[", suffix: "]]" },
              })}
            </span>
          </div>
          <FormField
            label={t("mtSettings.test.label")}
            description={t("mtSettings.test.help")}
            controlClassName="flex gap-2.5 items-center"
          >
            <Button onClick={runLlmTest} disabled={llmTest === "testing"}>
              {llmTest === "testing" ? t("mtSettings.test.testing") : t("mtSettings.test.run")}
            </Button>
            {llmTest === "ok" ? (
              <span className="text-[12px] mt-2 inline-flex items-center gap-1.5 text-success">
                <CheckIcon size={13} />
                {t("mtSettings.test.ok")}
              </span>
            ) : null}
            {llmTest === "error" ? (
              <span className="text-[12px] mt-2 text-warn-fg">{t("mtSettings.test.fail")}</span>
            ) : null}
          </FormField>
        </div>
      </div>

      <div className="footbar">
        <Button>{t("preferences.action.reset")}</Button>
        <Button
          variant="primary"
          onClick={() => {
            persistTraditional();
            persistLlm();
          }}
        >
          {t("preferences.action.save")}
        </Button>
      </div>
    </section>
  );
}
