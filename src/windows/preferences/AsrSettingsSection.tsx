import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./preferences.module.css";

const MODELS = ["tiny", "base", "large"] as const;
type WhisperModel = (typeof MODELS)[number];

export function AsrSettingsSection() {
  const { t } = useTranslation();
  const [engine, setEngine] = useState("whisper");
  const [model, setModel] = useState<WhisperModel>("base");

  const isWhisper = engine === "whisper";

  return (
    <section className={styles.pane}>
      <h2 className={styles.paneTitle}>{t("asrSettings.title")}</h2>
      <p className={styles.paneSub}>{t("asrSettings.sub")}</p>

      <div className={styles.group}>
        <div className={styles.groupTitle}>{t("asrSettings.group.engine")}</div>
        <div className={styles.formcard}>
          <div className={styles.frow}>
            <div className={styles.left}>
              <div className="t">{t("asrSettings.engine.label")}</div>
              <div className="d">{t("asrSettings.engine.help")}</div>
            </div>
            <div className={styles.ctl}>
              <div className="select">
                <select
                  aria-label={t("asrSettings.engine.label")}
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                >
                  <option value="whisper">{t("asrSettings.engine.whisper")}</option>
                  <option value="cloudAliyun">{t("asrSettings.engine.cloudAliyun")}</option>
                  <option value="cloudTencent">{t("asrSettings.engine.cloudTencent")}</option>
                </select>
              </div>
            </div>
          </div>

          <div className={`${styles.reveal} ${isWhisper ? styles.revealOpen : ""}`}>
            <div className={styles.frow}>
              <div className={styles.left}>
                <div className="t">{t("asrSettings.model.label")}</div>
                <div className="d">{t("asrSettings.model.help")}</div>
              </div>
              <div className={styles.ctl} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div className={styles.segModels} role="group" aria-label={t("asrSettings.model.label")}>
                  {MODELS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={model === m}
                      onClick={() => setModel(m)}
                    >
                      {t(`asrSettings.model.${m}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={`${styles.frow} ${styles.frowCol}`}>
              <div className={styles.left} style={{ width: "100%" }}>
                <div className="t">{t("asrSettings.manage.label")}</div>
                <div className="d">{t("asrSettings.manage.file")}</div>
                <div className={styles.dl}>
                  <div className={styles.dlbar}>
                    <i />
                  </div>
                  <span className={styles.pct}>{t("asrSettings.manage.progress")}</span>
                </div>
              </div>
              <div className={styles.ctl} style={{ justifyContent: "flex-start" }}>
                <button type="button" className="btn">
                  {t("asrSettings.manage.choose")}
                </button>
              </div>
            </div>
          </div>

          <div className={`${styles.reveal} ${!isWhisper ? styles.revealOpen : ""}`}>
            <div className={styles.fieldRow}>
              <label htmlFor="asrApiKey">{t("asrSettings.apiKey")}</label>
              <input className="field" id="asrApiKey" type="password" placeholder="••••••••••••••••" />
            </div>
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
