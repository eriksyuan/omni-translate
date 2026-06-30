import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { hideWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";
import { CheckIcon, CrosshairIcon, SpinnerIcon } from "@/windows/shared/icons";
import styles from "./ocr-overlay.module.css";

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
    if ((e.target as HTMLElement).closest(`.${styles.go}`)) return;
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
      className={styles.overlay}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {!hasSelection && !dragging ? (
        <div className={styles.hint}>
          <CrosshairIcon size={15} style={{ color: "#fff" }} />
          {t("ocrOverlay.hint")}
        </div>
      ) : null}

      {rect ? (
        <div
          className={styles.sel}
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        >
          <span className={styles.res}>
            {Math.round(rect.w * dpr)} × {Math.round(rect.h * dpr)}
          </span>
          <b className={`${styles.handle} ${styles.tl}`} />
          <b className={`${styles.handle} ${styles.tr}`} />
          <b className={`${styles.handle} ${styles.bl}`} />
          <b className={`${styles.handle} ${styles.br}`} />
          {!dragging && hasSelection ? (
            <button type="button" className={styles.go} onClick={startRecognize}>
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
