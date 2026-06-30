import { Trans, useTranslation } from "react-i18next";
import styles from "./subtitle.module.css";

export function SubtitleWindow() {
  const { t } = useTranslation();

  return (
    <main className={styles.wrap}>
      <p className={styles.orig}>{t("subtitle.original")}</p>
      <p className={styles.trans}>
        <Trans i18nKey="subtitle.translation" components={{ hl: <span className={styles.hl} /> }} />
      </p>
    </main>
  );
}
