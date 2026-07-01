import { useTranslation } from "react-i18next";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "@/components/ui/select";
import { openPreferencesSection } from "@/lib/preferences-navigation";
import { CONFIGURE_SENTINEL } from "@/lib/settings";
import type { ProviderKind } from "@/lib/settings/types";
import type { VerifiedProviderOption } from "@/windows/audio-config/useAudioSessionProviders";

interface ProviderSelectProps {
  kind: ProviderKind;
  ariaLabel: string;
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  options: VerifiedProviderOption[];
  emptyPlaceholder: string;
}

export function ProviderSelect({
  kind,
  ariaLabel,
  value,
  onValueChange,
  disabled,
  options,
  emptyPlaceholder,
}: ProviderSelectProps) {
  const { t } = useTranslation();
  const preferencesSection =
    kind === "asr" ? "asr" : kind === "mt" ? "mt" : "speechTranslate";

  const handleChange = (next: string) => {
    if (next === CONFIGURE_SENTINEL) {
      void openPreferencesSection(preferencesSection);
      return;
    }
    onValueChange(next);
  };

  const selectValue = value ?? (options[0]?.value ?? CONFIGURE_SENTINEL);

  return (
    <SelectRoot value={selectValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder={emptyPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
        {options.length > 0 ? (
          <div className="my-1 border-t border-hairline border-solid" role="separator" />
        ) : null}
        <SelectItem value={CONFIGURE_SENTINEL} className="text-accent">
          {t("audioConfig.action.goConfigure")}
        </SelectItem>
      </SelectContent>
    </SelectRoot>
  );
}
