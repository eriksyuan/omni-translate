import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { hideWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";
import { CheckIcon, CrosshairIcon, SpinnerIcon } from "@/components/icons";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function OcrOverlayWindow() {
  const { t } = useTranslation();
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTauri()) {
        void hideWindow(WINDOW_LABELS.OCR_OVERLAY);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-ocr-go]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    setRecognizing(false);
    setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !startRef.current) return;
    const s = startRef.current;
    setRect({
      x: Math.min(e.clientX, s.x),
      y: Math.min(e.clientY, s.y),
      w: Math.abs(e.clientX - s.x),
      h: Math.abs(e.clientY - s.y),
    });
  };

  const onPointerUp = () => setDragging(false);

  const startRecognize = () => setRecognizing(true);

  const hasSelection = rect !== null && (rect.w > 4 || rect.h > 4);

  return (
    <div
      className="fixed inset-0 w-full h-full cursor-crosshair bg-transparent select-none touch-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {!hasSelection && !dragging ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-5 pointer-events-none inline-flex items-center gap-2 text-white/90 text-[13px] bg-black/45 px-3.5 py-2 rounded-full backdrop-blur-[8px] shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
          <CrosshairIcon size={15} className="text-white" />
          {t("ocrOverlay.hint")}
        </div>
      ) : null}

      {rect ? (
        <div
          className="ocr-sel"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        >
          <span className="absolute -top-[22px] left-0 font-mono text-[11px] text-white bg-accent px-[7px] py-0.5 rounded-[5px] whitespace-nowrap">
            {Math.round(rect.w * dpr)} × {Math.round(rect.h * dpr)}
          </span>
          <b className="absolute w-[9px] h-[9px] bg-white border border-accent border-solid rounded-[2px] -top-[5px] -left-[5px]" />
          <b className="absolute w-[9px] h-[9px] bg-white border border-accent border-solid rounded-[2px] -top-[5px] -right-[5px]" />
          <b className="absolute w-[9px] h-[9px] bg-white border border-accent border-solid rounded-[2px] -bottom-[5px] -left-[5px]" />
          <b className="absolute w-[9px] h-[9px] bg-white border border-accent border-solid rounded-[2px] -bottom-[5px] -right-[5px]" />
          {!dragging && hasSelection ? (
            <button
              type="button"
              data-ocr-go
              className="absolute -bottom-[42px] right-0 inline-flex items-center gap-[7px] bg-accent text-white border-0 cursor-pointer font-600 text-[13px] px-3.5 py-2 rounded-[9px] shadow-[0_6px_18px_rgba(0,90,255,0.45)] active:translate-y-px"
              onClick={startRecognize}
            >
              {recognizing ? (
                <>
                  <SpinnerIcon size={14} />
                  {t("ocrOverlay.recognizing")}
                </>
              ) : (
                <>
                  <CheckIcon size={14} />
                  {t("ocrOverlay.start")}
                </>
              )}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
