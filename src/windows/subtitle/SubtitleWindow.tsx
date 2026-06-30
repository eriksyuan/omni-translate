import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SUBTITLE_UPDATE_EVENT, stopAudioSession, type SubtitleUpdatePayload } from "@/lib/audio";
import { hideWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";
import { CloseIcon, CursorClickIcon, LockIcon, OpacityIcon } from "@/components/icons";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/cn";

interface Token {
  text: string;
  hl: boolean;
}

function parseTokens(raw: string): Token[] {
  return raw.split("|").map((piece) => {
    const hl = piece.startsWith("*");
    return { text: hl ? piece.slice(1) : piece, hl };
  });
}

export function SubtitleWindow() {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [opacity, setOpacity] = useState(50);
  const [runId, setRunId] = useState(0);
  const [subtitle, setSubtitle] = useState<SubtitleUpdatePayload | null>(null);
  const isLive = subtitle !== null;

  const originalText = subtitle?.original ?? t("subtitle.original");
  const tokenSource = subtitle?.tokens ?? subtitle?.translation ?? t("subtitle.tokens");
  const tokens = useMemo(() => parseTokens(tokenSource), [tokenSource, t]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    void listen<SubtitleUpdatePayload>(SUBTITLE_UPDATE_EVENT, (event) => {
      setSubtitle(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || isLive) return;
    const id = setInterval(() => setRunId((n) => n + 1), 3400);
    return () => clearInterval(id);
  }, [isLive]);

  const setPassthrough = (on: boolean) => {
    if (!isTauri()) return;
    try {
      void getCurrentWindow().setIgnoreCursorEvents(on);
    } catch {
      /* window API unavailable (e.g. preview) */
    }
  };

  const toggleLock = () => {
    setLocked((prev) => {
      const next = !prev;
      setPassthrough(next);
      if (next) setHovered(false);
      return next;
    });
  };

  const close = () => {
    if (isTauri()) {
      void stopAudioSession().catch(() => undefined);
      void hideWindow(WINDOW_LABELS.SUBTITLE);
    }
  };

  const showToolbar = hovered && !locked;
  const displayTokens = subtitle ? tokens : parseTokens(t("subtitle.tokens"));

  return (
    <div className="w-full h-full flex items-center p-3.5">
      <div
        className={cn(
          "relative w-full rounded p-[18px_22px] border border-solid transition-all duration-250 ease-mac",
          locked
            ? "bg-transparent border-transparent shadow-none"
            : "backdrop-blur-[14px] border-white/16 shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
        )}
        style={locked ? undefined : { background: `rgba(0, 0, 0, ${opacity / 100})` }}
        onPointerEnter={() => !locked && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {showToolbar ? (
          <>
            <b className="absolute w-[11px] h-[11px] border-[1.5px] border-solid border-white/70 bg-black/40 -top-[6px] -left-[6px] cursor-nwse-resize rounded-[2px]" />
            <b className="absolute w-[11px] h-[11px] border-[1.5px] border-solid border-white/70 bg-black/40 -top-[6px] -right-[6px] cursor-nesw-resize rounded-[2px]" />
            <b className="absolute w-[11px] h-[11px] border-[1.5px] border-solid border-white/70 bg-black/40 -bottom-[6px] -left-[6px] cursor-nesw-resize rounded-[2px]" />
            <b className="absolute w-[11px] h-[11px] border-[1.5px] border-solid border-white/70 bg-black/40 -bottom-[6px] -right-[6px] cursor-nwse-resize rounded-[2px]" />
            <div className="absolute top-2.5 right-3 inline-flex items-center gap-1 bg-[rgba(20,20,24,0.82)] border border-white/14 border-solid rounded-[9px] p-1 backdrop-blur-[12px]">
              <button
                type="button"
                className="appearance-none border-0 bg-transparent text-white/82 cursor-pointer w-7 h-7 rounded-[6px] grid place-items-center hover:bg-white/14 hover:text-white"
                onClick={toggleLock}
                title={t("subtitle.lock")}
              >
                <LockIcon size={15} />
              </button>
              <span className="flex items-center gap-1.5 px-1.5 text-white/70" title={t("subtitle.opacity")}>
                <OpacityIcon size={14} />
                <Slider
                  min={20}
                  max={80}
                  step={1}
                  value={[opacity]}
                  onValueChange={([v]) => setOpacity(v ?? opacity)}
                  aria-label={t("subtitle.opacity")}
                />
              </span>
              <button
                type="button"
                className="appearance-none border-0 bg-transparent text-white/82 cursor-pointer w-7 h-7 rounded-[6px] grid place-items-center hover:bg-white/14 hover:text-white"
                onClick={close}
                title={t("subtitle.close")}
              >
                <CloseIcon size={15} />
              </button>
            </div>
          </>
        ) : null}

        {!showToolbar && locked ? (
          <span className="absolute -top-[30px] left-1/2 -translate-x-1/2 font-600 text-[11px] text-hi inline-flex items-center gap-1.5 whitespace-nowrap bg-black/50 px-2.5 py-[5px] rounded-full backdrop-blur-[8px]">
            <CursorClickIcon size={13} />
            {t("subtitle.clickthrough")}
          </span>
        ) : null}

        <div
          className={cn(
            "text-[15px] text-white/82 mb-2 leading-[1.4]",
            locked && "text-white/90 shadow-[0_1px_3px_#000,0_0_1px_#000]",
          )}
        >
          {originalText}
        </div>
        <div
          className={cn(
            "text-[27px] font-700 leading-[1.3] text-white tracking-[-0.01em]",
            locked && "subtitle-locked-text",
          )}
          key={isLive ? "live" : runId}
        >
          {displayTokens.map((token, i) => (
            <span
              key={i}
              className={cn(
                !isLive && "animate-fadein opacity-0",
                token.hl && "text-hi",
                locked && token.hl && "subtitle-locked-hl",
              )}
              style={!isLive ? { animationDelay: `${i * 0.22}s` } : undefined}
            >
              {token.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
