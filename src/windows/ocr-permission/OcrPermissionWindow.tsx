import { useTranslation } from "react-i18next";
import { WindowShell } from "../shared/WindowShell";

export function OcrPermissionWindow() {
  const { t } = useTranslation();

  return (
    <WindowShell
      title={t("ocrPermission.title")}
      description={t("ocrPermission.description")}
      placeholder={t("ocrPermission.placeholder")}
    />
  );
}
