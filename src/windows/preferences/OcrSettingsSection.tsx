import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@/windows/shared/icons";
import styles from "./preferences.module.css";

type TestState = "idle" | "testing" | "ok";

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
    <section className={styles.pane}>
      <h2 className={styles.paneTitle}>{t("ocrSettings.title")}</h2>
      <p className={styles.paneSub}>{t("ocrSettings.sub")}</p>

      <div className={styles.group}>
        <div className={styles.groupTitle}>{t("ocrSettings.group.engine")}</div>
        <div className={styles.formcard}>
          <div className={styles.frow}>
            <div className={styles.left}>
              <div className="t">{t("ocrSettings.engine.label")}</div>
              <div className="d">{t("ocrSettings.engine.help")}</div>
            </div>
            <div className={styles.ctl}>
              <div className="select">
                <select
                  aria-label={t("ocrSettings.engine.label")}
                  value={engine}
                  onChange={(e) => {
                    setEngine(e.target.value);
                    setTest("idle");
                  }}
                >
                  <option value="localNative">{t("ocrSettings.engine.localNative")}</option>
                  <option value="localPaddle">{t("ocrSettings.engine.localPaddle")}</option>
                  <option value="cloudBaidu">{t("ocrSettings.engine.cloudBaidu")}</option>
                  <option value="cloudTencent">{t("ocrSettings.engine.cloudTencent")}</option>
                </select>
              </div>
            </div>
          </div>

          <div className={`${styles.reveal} ${isCloud ? styles.revealOpen : ""}`}>
            <div className={styles.fieldRow}>
              <label htmlFor="ocrAppId">{t("ocrSettings.appId")}</label>
              <input className="field" id="ocrAppId" placeholder={t("ocrSettings.appIdPlaceholder")} />
            </div>
            <div className={styles.fieldRow}>
              <label htmlFor="ocrSecret">{t("ocrSettings.secret")}</label>
              <input className="field" id="ocrSecret" type="password" placeholder="••••••••••••••••" />
            </div>
            <div className={styles.frow}>
              <div className={styles.left}>
                <div className="t">{t("ocrSettings.test.label")}</div>
                <div className="d">{t("ocrSettings.test.help")}</div>
              </div>
              <div className={`${styles.ctl} ${styles.inline}`}>
                <button type="button" className="btn" onClick={runTest} disabled={test === "testing"}>
                  {test === "testing" ? t("ocrSettings.test.testing") : t("ocrSettings.test.run")}
                </button>
                {test === "ok" ? (
                  <span className={styles.testResult}>
                    <CheckIcon size={13} />
                    {t("ocrSettings.test.ok")}
                  </span>
                ) : null}
              </div>
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
