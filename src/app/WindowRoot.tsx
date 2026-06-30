import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AudioConfigWindow } from "@/windows/audio-config/AudioConfigWindow";
import { OcrPermissionWindow } from "@/windows/ocr-permission/OcrPermissionWindow";
import { OcrOverlayWindow } from "@/windows/ocr-overlay/OcrOverlayWindow";
import { SubtitleWindow } from "@/windows/subtitle/SubtitleWindow";
import { PreferencesWindow } from "@/windows/preferences/PreferencesWindow";
import { WINDOW_LABELS, type WindowLabel } from "@/lib/windows";

const VIEWS: Record<WindowLabel, () => ReactElement> = {
  [WINDOW_LABELS.AUDIO_CONFIG]: AudioConfigWindow,
  [WINDOW_LABELS.OCR_PERMISSION]: OcrPermissionWindow,
  [WINDOW_LABELS.OCR_OVERLAY]: OcrOverlayWindow,
  [WINDOW_LABELS.SUBTITLE]: SubtitleWindow,
  [WINDOW_LABELS.PREFERENCES]: PreferencesWindow,
};

function resolveLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    const param = new URLSearchParams(window.location.search).get("window");
    return param ?? "";
  }
}

export function WindowRoot() {
  const { t } = useTranslation();
  const label = resolveLabel() as WindowLabel;
  const View = VIEWS[label];

  if (!View) {
    return (
      <main style={{ padding: 24 }}>
        <h1>{t("windowRoot.unknownWindow")}</h1>
        <p>{label}</p>
      </main>
    );
  }

  return <View />;
}
