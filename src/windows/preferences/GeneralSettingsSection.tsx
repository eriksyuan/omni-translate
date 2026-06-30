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
    <section className={styles.section}>
      <h1 className={styles.sectionTitle}>{t("generalSettings.title")}</h1>
      <div className={styles.settingGroup}>
        <div className={styles.settingRow}>
          <label className={styles.settingLabel} htmlFor="language">
            {t("generalSettings.language.label")}
          </label>
          <select
            id="language"
            className={styles.select}
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
    </section>
  );
}
