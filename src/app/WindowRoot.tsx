import type { ReactElement } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TrayMenuWindow } from "@/windows/tray-menu/TrayMenuWindow";
import { AudioConfigWindow } from "@/windows/audio-config/AudioConfigWindow";
import { OcrPermissionWindow } from "@/windows/ocr-permission/OcrPermissionWindow";
import { OcrOverlayWindow } from "@/windows/ocr-overlay/OcrOverlayWindow";
import { SubtitleWindow } from "@/windows/subtitle/SubtitleWindow";
import { PreferencesWindow } from "@/windows/preferences/PreferencesWindow";
import { WINDOW_LABELS, type WindowLabel } from "@/lib/windows";

const VIEWS: Record<WindowLabel, () => ReactElement> = {
  [WINDOW_LABELS.TRAY_MENU]: TrayMenuWindow,
  [WINDOW_LABELS.AUDIO_CONFIG]: AudioConfigWindow,
  [WINDOW_LABELS.OCR_PERMISSION]: OcrPermissionWindow,
  [WINDOW_LABELS.OCR_OVERLAY]: OcrOverlayWindow,
  [WINDOW_LABELS.SUBTITLE]: SubtitleWindow,
  [WINDOW_LABELS.PREFERENCES]: PreferencesWindow,
};

export function WindowRoot() {
  const label = getCurrentWindow().label as WindowLabel;
  const View = VIEWS[label];

  if (!View) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Unknown window</h1>
        <p>{label}</p>
      </main>
    );
  }

  return <View />;
}
