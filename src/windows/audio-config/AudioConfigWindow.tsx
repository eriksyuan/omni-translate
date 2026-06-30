import { useTranslation } from "react-i18next";
import { WindowShell } from "../shared/WindowShell";

export function AudioConfigWindow() {
  const { t } = useTranslation();

  return (
    <WindowShell
      title={t("audioConfig.title")}
      description={t("audioConfig.description")}
      placeholder={t("audioConfig.placeholder")}
    />
  );
}
