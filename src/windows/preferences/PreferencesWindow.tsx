import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { GearIcon, MicIcon, OcrFrameIcon, TranslateIcon } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  clearPendingPreferencesSection,
  PREFERENCES_NAVIGATE_EVENT,
  readPendingPreferencesSection,
} from "@/lib/preferences-navigation";
import type { PreferencesSection } from "@/lib/settings/types";
import { AsrSettingsSection } from "./AsrSettingsSection";
import { GeneralSettingsSection } from "./GeneralSettingsSection";
import { MtSettingsSection } from "./MtSettingsSection";
import { OcrSettingsSection } from "./OcrSettingsSection";

const SECTIONS = ["general", "ocr", "asr", "mt"] as const;

const TAB_ICON = {
  general: GearIcon,
  ocr: OcrFrameIcon,
  asr: MicIcon,
  mt: TranslateIcon,
} as const;

function isPreferencesSection(value: string): value is PreferencesSection {
  return (SECTIONS as readonly string[]).includes(value);
}

export function PreferencesWindow() {
  const { t } = useTranslation();
  const [section, setSection] = useState<PreferencesSection>("general");

  const applySection = useCallback((next: PreferencesSection) => {
    setSection(next);
    clearPendingPreferencesSection();
  }, []);

  useEffect(() => {
    const pending = readPendingPreferencesSection();
    if (pending) {
      applySection(pending);
    }
  }, [applySection]);

  useEffect(() => {
    if (!isTauri()) {
      const handler = (event: Event) => {
        const detail = (event as CustomEvent<{ section?: string }>).detail;
        if (detail?.section && isPreferencesSection(detail.section)) {
          applySection(detail.section);
        }
      };
      window.addEventListener(PREFERENCES_NAVIGATE_EVENT, handler);
      return () => window.removeEventListener(PREFERENCES_NAVIGATE_EVENT, handler);
    }

    let unlistenNavigate: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;

    void listen<{ section: PreferencesSection }>(PREFERENCES_NAVIGATE_EVENT, (event) => {
      if (isPreferencesSection(event.payload.section)) {
        applySection(event.payload.section);
      }
    }).then((unlisten) => {
      unlistenNavigate = unlisten;
    });

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) return;
        const pending = readPendingPreferencesSection();
        if (pending) {
          applySection(pending);
        }
      })
      .then((unlisten) => {
        unlistenFocus = unlisten;
      });

    return () => {
      unlistenNavigate?.();
      unlistenFocus?.();
    };
  }, [applySection]);

  return (
    <Tabs
      value={section}
      onValueChange={(v) => setSection(v as PreferencesSection)}
      className="flex min-h-full win-shell"
    >
      <aside className="w-[210px] flex-none p-[14px_10px] bg-panel border-r-[0.5px] border-hairline">
        <TabsList aria-label={t("preferences.title")} className="flex flex-col gap-[2px]">
          {SECTIONS.map((id) => {
            const TabIcon = TAB_ICON[id];
            return (
              <TabsTrigger key={id} value={id} className="group">
                <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center flex-none bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent group-data-[state=active]:bg-white/22 group-data-[state=active]:text-white">
                  <TabIcon size={15} />
                </span>
                {t(`preferences.nav.${id}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </aside>
      <main className="flex-1 min-w-0 p-[26px_30px] overflow-auto">
        <TabsContent value="general" className="animate-fade">
          <GeneralSettingsSection />
        </TabsContent>
        <TabsContent value="ocr" className="animate-fade">
          <OcrSettingsSection />
        </TabsContent>
        <TabsContent value="asr" className="animate-fade">
          <AsrSettingsSection />
        </TabsContent>
        <TabsContent value="mt" className="animate-fade">
          <MtSettingsSection />
        </TabsContent>
      </main>
    </Tabs>
  );
}
