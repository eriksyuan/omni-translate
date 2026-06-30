import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceDir = join(rootDir, "locales");
const targetDir = join(rootDir, "src-tauri/resources/locales");

mkdirSync(targetDir, { recursive: true });

for (const fileName of readdirSync(sourceDir)) {
  if (!fileName.endsWith(".json")) {
    continue;
  }

  cpSync(join(sourceDir, fileName), join(targetDir, fileName), { force: true });
}

console.log(`i18n sync: copied locale files to ${targetDir}`);
