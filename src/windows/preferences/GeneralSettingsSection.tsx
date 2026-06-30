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
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-row";

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
    <section className="animate-fade">
      <h2 className="text-[18px] font-[620]">{t("generalSettings.title")}</h2>
      <p className="text-[13px] text-fg-2 mt-1.5 leading-[1.55]">
        {t("generalSettings.sub")}
      </p>
      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">
          {t("generalSettings.group.appearance")}
        </div>
        <div className="formcard">
          <FormField
            id="theme"
            label={t("generalSettings.theme.label")}
            description={t("generalSettings.theme.help")}
          >
            <Select
              ariaLabel={t("generalSettings.theme.label")}
              value={theme}
              onValueChange={(v) => handleThemeChange(v as ThemePreference)}
              options={SUPPORTED_THEMES.map((value) => ({
                value,
                label: t(THEME_OPTION_KEYS[value]),
              }))}
            />
          </FormField>
          <FormField
            id="language"
            label={t("generalSettings.language.label")}
            description={t("generalSettings.language.help")}
          >
            <Select
              ariaLabel={t("generalSettings.language.label")}
              value={locale}
              onValueChange={(v) => void handleLanguageChange(v as Locale)}
              options={SUPPORTED_LOCALES.map((value) => ({
                value,
                label: t(LOCALE_OPTION_KEYS[value]),
              }))}
            />
          </FormField>
        </div>
      </div>
    </section>
  );
}
