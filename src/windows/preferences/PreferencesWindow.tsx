import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GearIcon, MicIcon, OcrFrameIcon, TranslateIcon } from "@/windows/shared/icons";
import { AsrSettingsSection } from "./AsrSettingsSection";
import { GeneralSettingsSection } from "./GeneralSettingsSection";
import { MtSettingsSection } from "./MtSettingsSection";
import { OcrSettingsSection } from "./OcrSettingsSection";
import styles from "./preferences.module.css";

const SECTIONS = ["general", "ocr", "asr", "mt"] as const;
type PreferencesSection = (typeof SECTIONS)[number];

const TAB_ICON = {
  general: GearIcon,
  ocr: OcrFrameIcon,
  asr: MicIcon,
  mt: TranslateIcon,
} as const;

export function PreferencesWindow() {
  const { t } = useTranslation();
  const [section, setSection] = useState<PreferencesSection>("general");

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <nav className={styles.nav} aria-label={t("preferences.title")} role="tablist">
          {SECTIONS.map((id) => {
            const TabIcon = TAB_ICON[id];
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                className={active ? styles.tabActive : styles.tab}
                aria-selected={active}
                onClick={() => setSection(id)}
              >
                <span className={styles.tico}>
                  <TabIcon size={15} />
                </span>
                {t(`preferences.nav.${id}`)}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className={styles.content}>
        {section === "general" ? <GeneralSettingsSection /> : null}
        {section === "ocr" ? <OcrSettingsSection /> : null}
        {section === "asr" ? <AsrSettingsSection /> : null}
        {section === "mt" ? <MtSettingsSection /> : null}
      </main>
    </div>
  );
}
