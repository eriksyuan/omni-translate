import { useTranslation } from "react-i18next";
import styles from "./ocr-overlay.module.css";

export function OcrOverlayWindow() {
  const { t } = useTranslation();

  return (
    <main className={styles.overlay}>
      <p className={styles.hint}>{t("ocrOverlay.hint")}</p>
    </main>
  );
}
