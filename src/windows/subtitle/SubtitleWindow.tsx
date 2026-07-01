import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AUDIO_STATE_EVENT,
  SUBTITLE_UPDATE_EVENT,
  stopAudioSession,
  type AudioCaptureStatus,
  type SubtitleUpdatePayload,
} from "@/lib/audio";
import { hideWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";
import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  applySubtitleUpdate,
  parseTokens,
  type SubtitleEntry,
} from "@/windows/subtitle/subtitle-entries";

type ResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

const RESIZE_ZONES: { direction: ResizeDirection; className: string }[] = [
  { direction: "North", className: "absolute top-0 left-2 right-2 h-2 cursor-n-resize" },
  { direction: "South", className: "absolute bottom-0 left-2 right-2 h-2 cursor-s-resize" },
  { direction: "West", className: "absolute left-0 top-2 bottom-2 w-2 cursor-w-resize" },
  { direction: "East", className: "absolute right-0 top-2 bottom-2 w-2 cursor-e-resize" },
  {
    direction: "NorthWest",
    className: "absolute top-0 left-0 w-3 h-3 cursor-nw-resize",
  },
  {
    direction: "NorthEast",
    className: "absolute top-0 right-0 w-3 h-3 cursor-ne-resize",
  },
  {
    direction: "SouthWest",
    className: "absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize",
  },
  {
    direction: "SouthEast",
    className: "absolute bottom-0 right-0 w-3 h-3 cursor-se-resize",
  },
];

function startResize(direction: ResizeDirection) {
  if (!isTauri()) return;
  void getCurrentWindow().startResizeDragging(direction).catch(() => undefined);
}

function SubtitleEntryView({ entry }: { entry: SubtitleEntry }) {
  const tokens = parseTokens(entry.tokenSource);

  return (
    <div className="flex flex-col gap-1">
      {entry.original ? (
        <p className="text-[13px] text-white/65 leading-snug">{entry.original}</p>
      ) : null}
      <p className="text-[22px] font-700 leading-[1.3] text-white tracking-[-0.01em]">
        {tokens.map((token, i) => (
          <span key={i} className={cn(token.hl && "text-hi")}>
            {token.text}
          </span>
        ))}
      </p>
    </div>
  );
}

export function SubtitleWindow() {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [entries, scrollToBottom]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlistenSubtitle: (() => void) | undefined;
    let unlistenAudio: (() => void) | undefined;

    void listen<SubtitleUpdatePayload>(SUBTITLE_UPDATE_EVENT, (event) => {
      setEntries((prev) => applySubtitleUpdate(prev, event.payload));
    }).then((fn) => {
      unlistenSubtitle = fn;
    });

    void listen<AudioCaptureStatus>(AUDIO_STATE_EVENT, () => {
      setEntries([]);
    }).then((fn) => {
      unlistenAudio = fn;
    });

    return () => {
      unlistenSubtitle?.();
      unlistenAudio?.();
    };
  }, []);

  const close = () => {
    if (isTauri()) {
      void stopAudioSession().catch(() => undefined);
      void hideWindow(WINDOW_LABELS.SUBTITLE);
    }
  };

  return (
    <div className="relative h-full w-full p-2 box-border">
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden rounded",
          "border border-solid border-white/16 bg-black/55 backdrop-blur-[14px]",
          "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
        )}
      >
        <button
          type="button"
          className="absolute top-2 right-2 z-20 appearance-none border-0 bg-transparent text-white/75 cursor-pointer w-7 h-7 rounded-[6px] grid place-items-center hover:bg-white/14 hover:text-white"
          onClick={close}
          title={t("subtitle.close")}
        >
          <CloseIcon size={15} />
        </button>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pr-10 flex flex-col justify-end gap-3"
        >
          {entries.length === 0 ? (
            <p className="text-[13px] text-white/50 text-center">{t("subtitle.waiting")}</p>
          ) : (
            entries.map((entry) => <SubtitleEntryView key={entry.id} entry={entry} />)
          )}
        </div>

        {RESIZE_ZONES.map(({ direction, className }) => (
          <div
            key={direction}
            className={cn(className, "z-10")}
            onPointerDown={() => startResize(direction)}
          />
        ))}
      </div>
    </div>
  );
}
