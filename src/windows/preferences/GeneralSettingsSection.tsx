import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLocale,
  setLocale,
  SUPPORTED_LOCALES,
  syncLocaleFromBackend,
  type Locale,
} from "@/i18n";
import styles from "./preferences.module.css";

const LOCALE_OPTION_KEYS = {
  "zh-CN": "generalSettings.language.option.zh-CN",
  "en": "generalSettings.language.option.en",
} as const satisfies Record<Locale, "generalSettings.language.option.zh-CN" | "generalSettings.language.option.en">;

export function GeneralSettingsSection() {
  const { t } = useTranslation();
  const [locale, setCurrentLocale] = useState<Locale>(getLocale());

  useEffect(() => {
    void syncLocaleFromBackend().then(() => {
      setCurrentLocale(getLocale());
    });
  }, []);

  const handleLanguageChange = async (nextLocale: Locale) => {
    await setLocale(nextLocale);
    setCurrentLocale(nextLocale);
  };

  return (
    <section className={styles.pane}>
      <h2 className={styles.paneTitle}>{t("generalSettings.title")}</h2>
      <p className={styles.paneSub}>{t("generalSettings.sub")}</p>
      <div className={styles.group}>
        <div className={styles.groupTitle}>{t("generalSettings.group.appearance")}</div>
        <div className={styles.formcard}>
          <div className={styles.frow}>
            <div className={styles.left}>
              <div className="t">
                <label htmlFor="language">{t("generalSettings.language.label")}</label>
              </div>
              <div className="d">{t("generalSettings.language.help")}</div>
            </div>
            <div className={styles.ctl}>
              <div className="select">
                <select
                  id="language"
                  value={locale}
                  onChange={(event) => void handleLanguageChange(event.target.value as Locale)}
                >
                  {SUPPORTED_LOCALES.map((value) => (
                    <option key={value} value={value}>
                      {t(LOCALE_OPTION_KEYS[value])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
