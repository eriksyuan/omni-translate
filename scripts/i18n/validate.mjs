import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const localesDir = join(rootDir, "locales");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function collectKeys(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    collectKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

function diffKeys(left, right) {
  const missing = left.filter((key) => !right.includes(key));
  const extra = right.filter((key) => !left.includes(key));
  return { missing, extra };
}

function fail(message) {
  console.error(`i18n validate: ${message}`);
  process.exit(1);
}

const meta = readJson(join(localesDir, "meta.json"));
const { defaultLocale, fallbackLocale, supportedLocales } = meta;

if (!Array.isArray(supportedLocales) || supportedLocales.length === 0) {
  fail("meta.supportedLocales must be a non-empty array");
}

if (!supportedLocales.includes(defaultLocale)) {
  fail(`meta.defaultLocale "${defaultLocale}" is not listed in supportedLocales`);
}

if (!supportedLocales.includes(fallbackLocale)) {
  fail(`meta.fallbackLocale "${fallbackLocale}" is not listed in supportedLocales`);
}

const localeFiles = readdirSync(localesDir).filter(
  (name) => name.endsWith(".json") && name !== "meta.json",
);

for (const locale of supportedLocales) {
  const expected = `${locale}.json`;
  if (!localeFiles.includes(expected)) {
    fail(`missing locale file for supported locale "${locale}": ${expected}`);
  }
}

const referenceLocale = supportedLocales[0];
const referencePath = join(localesDir, `${referenceLocale}.json`);
const referenceKeys = collectKeys(readJson(referencePath)).sort();

for (const fileName of localeFiles) {
  const locale = fileName.replace(/\.json$/, "");
  if (!supportedLocales.includes(locale)) {
    fail(`unexpected locale file "${fileName}" (not listed in meta.supportedLocales)`);
  }

  if (locale === referenceLocale) {
    continue;
  }

  const keys = collectKeys(readJson(join(localesDir, fileName))).sort();
  const { missing, extra } = diffKeys(referenceKeys, keys);

  if (missing.length > 0 || extra.length > 0) {
    console.error(`i18n validate: key mismatch between ${referenceLocale}.json and ${fileName}`);
    for (const key of missing) {
      console.error(`  missing in ${fileName}: ${key}`);
    }
    for (const key of extra) {
      console.error(`  extra in ${fileName}: ${key}`);
    }
    process.exit(1);
  }
}

console.log(`i18n validate: ok (${supportedLocales.join(", ")})`);
