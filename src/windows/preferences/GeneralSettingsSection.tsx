import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLocale,
  setLocale,
  SUPPORTED_LOCALES,
  syncLocaleFromBackend,
  type Locale,
} from "@/i18n";
import {
  getThemePreference,
  setThemePreference,
  SUPPORTED_THEMES,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/theme";
import styles from "./preferences.module.css";

const LOCALE_OPTION_KEYS = {
  "zh-CN": "generalSettings.language.option.zh-CN",
  "en": "generalSettings.language.option.en",
} as const satisfies Record<Locale, "generalSettings.language.option.zh-CN" | "generalSettings.language.option.en">;

const THEME_OPTION_KEYS = {
  light: "generalSettings.theme.option.light",
  dark: "generalSettings.theme.option.dark",
  system: "generalSettings.theme.option.system",
} as const satisfies Record<
  ThemePreference,
  | "generalSettings.theme.option.light"
  | "generalSettings.theme.option.dark"
  | "generalSettings.theme.option.system"
>;

export function GeneralSettingsSection() {
  const { t } = useTranslation();
  const [locale, setCurrentLocale] = useState<Locale>(getLocale());
  const [theme, setCurrentTheme] = useState<ThemePreference>(getThemePreference());

  useEffect(() => {
    void syncLocaleFromBackend().then(() => {
      setCurrentLocale(getLocale());
    });
  }, []);

  useEffect(() => {
    const syncTheme = () => setCurrentTheme(getThemePreference());

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        syncTheme();
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleLanguageChange = async (nextLocale: Locale) => {
    await setLocale(nextLocale);
    setCurrentLocale(nextLocale);
  };

  const handleThemeChange = (nextTheme: ThemePreference) => {
    setThemePreference(nextTheme);
    setCurrentTheme(nextTheme);
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
                <label htmlFor="theme">{t("generalSettings.theme.label")}</label>
              </div>
              <div className="d">{t("generalSettings.theme.help")}</div>
            </div>
            <div className={styles.ctl}>
              <div className="select">
                <select
                  id="theme"
                  value={theme}
                  onChange={(event) =>
                    handleThemeChange(event.target.value as ThemePreference)
                  }
                >
                  {SUPPORTED_THEMES.map((value) => (
                    <option key={value} value={value}>
                      {t(THEME_OPTION_KEYS[value])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
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
