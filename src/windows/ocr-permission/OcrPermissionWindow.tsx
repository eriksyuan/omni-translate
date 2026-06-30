import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { hideWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  ClockIcon,
  KeyAuthorizeIcon,
  OcrFrameIcon,
  ShieldCheckIcon,
} from "@/windows/shared/icons";
import styles from "./ocr-permission.module.css";

const SCREEN_RECORDING_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

export function OcrPermissionWindow() {
  const { t } = useTranslation();
  const [granted, setGranted] = useState(false);

  const openSettings = () => {
    setGranted(true);
    if (isTauri()) {
      void openUrl(SCREEN_RECORDING_SETTINGS_URL);
    }
  };

  const cancel = () => {
    setGranted(false);
    if (isTauri()) {
      void hideWindow(WINDOW_LABELS.OCR_PERMISSION);
    }
  };

  return (
    <main className={styles.dialog}>
      <div className={styles.glyph}>
        <CameraIcon size={28} />
      </div>
      <h1 className={styles.title}>{t("ocrPermission.heading")}</h1>
      <p className={styles.lead}>{t("ocrPermission.lead")}</p>
      <p className={styles.priv}>
        <ShieldCheckIcon size={13} />
        {t("ocrPermission.privacy")}
      </p>

      <div className={styles.guide}>
        <div className={styles.guideCap}>
          <ClockIcon size={12} />
          {t("ocrPermission.guide.caption")}
        </div>
        <div className={styles.guideMock}>
          <div className={styles.guideSb}>
            <div className="it">{t("ocrPermission.guide.general")}</div>
            <div className={`it ${styles.itOn}`}>{t("ocrPermission.guide.privacy")}</div>
            <div className="it">{t("ocrPermission.guide.sound")}</div>
          </div>
          <div className={styles.guidePn}>
            <h5>{t("ocrPermission.guide.screenRecording")}</h5>
            <div className={styles.guideApp}>
              <span className="ai">
                <OcrFrameIcon size={13} />
              </span>
              <span className="an">OmniTranslate</span>
              <span className={styles.arrowAnim}>
                <ArrowRightIcon size={20} />
              </span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={granted}
                  onChange={(e) => setGranted(e.target.checked)}
                  aria-label={t("ocrPermission.guide.toggle")}
                />
                <span />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className="btn" onClick={cancel}>
          {t("ocrPermission.cancel")}
        </button>
        <button type="button" className="btn btn--primary" onClick={openSettings}>
          <KeyAuthorizeIcon size={15} />
          {t("ocrPermission.grant")}
        </button>
      </div>

      {granted ? (
        <div className={styles.granted}>
          <CheckIcon size={14} />
          {t("ocrPermission.grantedNote")}
        </div>
      ) : null}
    </main>
  );
}
