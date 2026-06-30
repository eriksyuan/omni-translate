import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
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

interface LiveSubtitle {
  sentenceId: string;
  translation: string;
}

function parseTokens(raw: string): Token[] {
  return raw.split("|").map((piece) => {
    const hl = piece.startsWith("*");
    return { text: hl ? piece.slice(1) : piece, hl };
  });
}

const SUBTITLE_MAX_HEIGHT = 120;

export function SubtitleWindow() {
  const { t } = useTranslation();
  const shellRef = useRef<HTMLDivElement>(null);
  const [locked, setLocked] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [opacity, setOpacity] = useState(50);
  const [runId, setRunId] = useState(0);
  const [live, setLive] = useState<LiveSubtitle | null>(null);
  const isLive = live !== null;

  const tokenSource = live?.translation ?? t("subtitle.tokens");
  const tokens = useMemo(() => parseTokens(tokenSource), [tokenSource, t]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      html: html.style.height,
      body: body.style.height,
      root: root?.style.height ?? "",
    };

    html.style.height = "auto";
    body.style.height = "auto";
    if (root) root.style.height = "auto";

    return () => {
      html.style.height = prev.html;
      body.style.height = prev.body;
      if (root) root.style.height = prev.root;
    };
  }, []);

  const syncWindowHeight = useCallback(() => {
    if (!isTauri()) return;
    const shell = shellRef.current;
    if (!shell) return;

    const height = Math.min(
      SUBTITLE_MAX_HEIGHT,
      Math.ceil(shell.getBoundingClientRect().height),
    );

    void (async () => {
      try {
        const win = getCurrentWindow();
        const [inner, scale] = await Promise.all([win.innerSize(), win.scaleFactor()]);
        await win.setSize(new LogicalSize(inner.width / scale, height));
      } catch {
        /* window API unavailable */
      }
    })();
  }, []);

  useLayoutEffect(() => {
    syncWindowHeight();
  }, [syncWindowHeight, live?.translation, live?.sentenceId, locked, opacity, isLive, runId]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell || !isTauri()) return;

    const observer = new ResizeObserver(() => syncWindowHeight());
    observer.observe(shell);
    return () => observer.disconnect();
  }, [syncWindowHeight]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    void listen<SubtitleUpdatePayload>(SUBTITLE_UPDATE_EVENT, (event) => {
      const { translation, sentenceId } = event.payload;
      if (!translation.trim()) return;

      setLive((prev) => ({
        sentenceId: sentenceId ?? prev?.sentenceId ?? `local-${Date.now()}`,
        translation,
      }));
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
  const displayTokens = isLive ? tokens : parseTokens(t("subtitle.tokens"));

  return (
    <div ref={shellRef} className="w-full p-2">
      <div
        className={cn(
          "relative w-full rounded px-4 py-2.5 border border-solid transition-all duration-250 ease-mac",
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

        <div className="max-h-[2.6em] overflow-hidden flex flex-col justify-end">
          <div
            className={cn(
              "text-[27px] font-700 leading-[1.3] text-white tracking-[-0.01em]",
              locked && "subtitle-locked-text",
            )}
            key={isLive ? live.sentenceId : runId}
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
    </div>
  );
}
