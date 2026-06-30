import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GeneralSettingsSection } from "./GeneralSettingsSection";
import styles from "./preferences.module.css";

const SECTIONS = ["general"] as const;
type PreferencesSection = (typeof SECTIONS)[number];

export function PreferencesWindow() {
  const { t } = useTranslation();
  const [section, setSection] = useState<PreferencesSection>("general");

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <nav className={styles.nav} aria-label={t("preferences.title")}>
          <button
            type="button"
            className={section === "general" ? styles.navItemActive : styles.navItem}
            aria-current={section === "general" ? "page" : undefined}
            onClick={() => setSection("general")}
          >
            {t("preferences.nav.general")}
          </button>
        </nav>
      </aside>
      <main className={styles.content}>
        {section === "general" ? <GeneralSettingsSection /> : null}
      </main>
    </div>
  );
}
