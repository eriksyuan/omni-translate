import i18n from "i18next";
import { isTauri } from "@tauri-apps/api/core";
import { initReactI18next } from "react-i18next";
import { getLocale as getBackendLocale, setLocale as setBackendLocale } from "@/lib/tauri";
import en from "@locales/en.json";
import metaJson from "@locales/meta.json";
import zhCN from "@locales/zh-CN.json";
import "./types";

export type Locale = "zh-CN" | "en";

const meta = metaJson as {
  defaultLocale: Locale;
  fallbackLocale: Locale;
  supportedLocales: Locale[];
  persist: {
    rustFilename: string;
    webStorageKey: string;
  };
};

export const SUPPORTED_LOCALES: readonly Locale[] = meta.supportedLocales;
export const DEFAULT_LOCALE = meta.defaultLocale;
export const LOCALE_STORAGE_KEY = meta.persist.webStorageKey;

const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: en },
} as const;

function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function detectLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && isLocale(stored)) {
    return stored;
  }

  const browserLocale = navigator.language;
  if (browserLocale.startsWith("zh")) {
    return "zh-CN";
  }

  return meta.fallbackLocale;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLocale(),
  fallbackLng: meta.fallbackLocale,
  interpolation: {
    escapeValue: false,
  },
});

export async function setLocale(locale: Locale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  await i18n.changeLanguage(locale);

  if (isTauri()) {
    await setBackendLocale(locale);
  }
}

export async function syncLocaleFromBackend() {
  if (!isTauri()) {
    return;
  }

  const locale = await getBackendLocale();
  if (!isLocale(locale)) {
    return;
  }

  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  await i18n.changeLanguage(locale);
}

export function getLocale(): Locale {
  const current = i18n.language;
  return isLocale(current) ? current : DEFAULT_LOCALE;
}

export default i18n;
