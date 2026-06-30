import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./preferences.module.css";

export function MtSettingsSection() {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-chat");
  const [prompt, setPrompt] = useState(t("mtSettings.llm.promptDefault"));

  return (
    <section className={styles.pane}>
      <h2 className={styles.paneTitle}>{t("mtSettings.title")}</h2>
      <p className={styles.paneSub}>{t("mtSettings.sub")}</p>

      <div className={styles.group}>
        <div className={styles.groupTitle}>{t("mtSettings.group.mt")}</div>
        <div className={styles.formcard}>
          <div className={styles.frow}>
            <div className={styles.left}>
              <div className="t">{t("mtSettings.mt.provider")}</div>
            </div>
            <div className={styles.ctl}>
              <div className="select">
                <select aria-label={t("mtSettings.mt.provider")}>
                  <option>Google Translate</option>
                  <option>DeepL</option>
                </select>
              </div>
            </div>
          </div>
          <div className={styles.fieldRow}>
            <label htmlFor="mtApiKey">{t("mtSettings.mt.apiKey")}</label>
            <input className="field" id="mtApiKey" type="password" placeholder={t("mtSettings.mt.apiKeyPlaceholder")} />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>{t("mtSettings.group.llm")}</div>
        <div className={styles.formcard}>
          <div className={styles.fieldRow}>
            <label htmlFor="llmBaseUrl">{t("mtSettings.llm.baseUrl")}</label>
            <input
              className="field mono"
              id="llmBaseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <span className={styles.hint}>{t("mtSettings.llm.baseUrlHint")}</span>
          </div>
          <div className={styles.fieldRow}>
            <label htmlFor="llmApiKey">{t("mtSettings.llm.apiKey")}</label>
            <input className="field" id="llmApiKey" type="password" placeholder="sk-••••••••••••••••" />
          </div>
          <div className={styles.fieldRow}>
            <label htmlFor="llmModel">{t("mtSettings.llm.model")}</label>
            <input
              className="field mono"
              id="llmModel"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat / gpt-4o-mini"
            />
          </div>
          <div className={styles.fieldRow}>
            <label htmlFor="llmPrompt">{t("mtSettings.llm.prompt")}</label>
            <textarea
              className="field"
              id="llmPrompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <span className={styles.hint}>
              {t("mtSettings.llm.promptHint", {
                interpolation: { prefix: "[[", suffix: "]]" },
              })}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.footbar}>
        <button type="button" className="btn">
          {t("preferences.action.reset")}
        </button>
        <button type="button" className="btn btn--primary">
          {t("preferences.action.save")}
        </button>
      </div>
    </section>
  );
}
