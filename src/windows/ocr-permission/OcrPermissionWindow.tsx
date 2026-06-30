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
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { WindowShell } from "@/components/ui/window-shell";

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
    <WindowShell className="px-6 pt-[26px] pb-[18px] text-center flex flex-col">
      <div className="icon-box-xl mx-auto mb-4">
        <CameraIcon size={28} />
      </div>
      <h1 className="text-[18px] font-620">{t("ocrPermission.heading")}</h1>
      <p className="text-[13.5px] leading-[1.6] text-fg-2 mt-2.5">{t("ocrPermission.lead")}</p>
      <p className="text-[12px] text-hi mt-2 inline-flex items-center justify-center gap-1.5">
        <ShieldCheckIcon size={13} />
        {t("ocrPermission.privacy")}
      </p>

      <div className="mt-[18px] mb-1.5 rounded-[11px] overflow-hidden border border-hairline border-solid bg-field text-left">
        <div className="text-[11px] text-fg-3 px-3 py-[7px] border-b border-hairline border-solid flex items-center gap-1.5">
          <ClockIcon size={12} />
          {t("ocrPermission.guide.caption")}
        </div>
        <div className="grid grid-cols-[96px_1fr] min-h-[116px]">
          <div className="bg-panel border-r border-hairline border-solid p-2 text-[11px] text-fg-2">
            <div className="px-[7px] py-1 rounded-[6px]">{t("ocrPermission.guide.general")}</div>
            <div className="px-[7px] py-1 rounded-[6px] bg-accent text-white">
              {t("ocrPermission.guide.privacy")}
            </div>
            <div className="px-[7px] py-1 rounded-[6px]">{t("ocrPermission.guide.sound")}</div>
          </div>
          <div className="p-3">
            <h5 className="text-[12px] font-600 mb-2.25">{t("ocrPermission.guide.screenRecording")}</h5>
            <div className="flex items-center gap-2.25 bg-win-solid border border-hairline border-solid rounded-sm px-2.5 py-2">
              <span className="w-[22px] h-[22px] rounded-[6px] grid place-items-center flex-none text-white bg-gradient-to-b from-accent to-[#0066cc]">
                <OcrFrameIcon size={13} />
              </span>
              <span className="flex-1 text-[12px] font-510 text-fg">OmniTranslate</span>
              <span className="inline-flex text-accent animate-nudge">
                <ArrowRightIcon size={20} />
              </span>
              <Switch
                checked={granted}
                onCheckedChange={setGranted}
                aria-label={t("ocrPermission.guide.toggle")}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 mt-4 [&_.btn]:flex-1">
        <Button onClick={cancel}>{t("ocrPermission.cancel")}</Button>
        <Button variant="primary" onClick={openSettings}>
          <KeyAuthorizeIcon size={15} />
          {t("ocrPermission.grant")}
        </Button>
      </div>

      {granted ? (
        <div className="text-[12.5px] text-success mt-3 inline-flex items-center justify-center gap-1.5">
          <CheckIcon size={14} />
          {t("ocrPermission.grantedNote")}
        </div>
      ) : null}
    </WindowShell>
  );
}
