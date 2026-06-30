import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { hideWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";
import { CloseIcon, CursorClickIcon, LockIcon, OpacityIcon } from "@/windows/shared/icons";
import styles from "./subtitle.module.css";

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
  const [opacity, setOpacity] = useState(0.5);
  const [runId, setRunId] = useState(0);

  const tokens = useMemo(() => parseTokens(t("subtitle.tokens")), [t]);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => setRunId((n) => n + 1), 3400);
    return () => clearInterval(id);
  }, []);

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
    if (isTauri()) void hideWindow(WINDOW_LABELS.SUBTITLE);
  };

  const showToolbar = hovered && !locked;

  return (
    <div className={styles.stage}>
      <div
        className={`${styles.sub} ${locked ? styles.subLocked : styles.subHover}`}
        style={locked ? undefined : { background: `rgba(0, 0, 0, ${opacity})` }}
        onPointerEnter={() => !locked && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {showToolbar ? (
          <div className={styles.toolbar}>
            <button type="button" onClick={toggleLock} title={t("subtitle.lock")}>
              <LockIcon size={15} />
            </button>
            <span className={styles.opa} title={t("subtitle.opacity")}>
              <OpacityIcon size={14} />
              <input
                type="range"
                min={20}
                max={80}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                aria-label={t("subtitle.opacity")}
              />
            </span>
            <button type="button" onClick={close} title={t("subtitle.close")}>
              <CloseIcon size={15} />
            </button>
          </div>
        ) : null}

        {!showToolbar && locked ? (
          <span className={styles.clickthrough}>
            <CursorClickIcon size={13} />
            {t("subtitle.clickthrough")}
          </span>
        ) : null}

        <div className={styles.orig}>{t("subtitle.original")}</div>
        <div className={styles.trans} key={runId}>
          {tokens.map((token, i) => (
            <span
              key={`${runId}-${i}`}
              className={`${styles.word} ${token.hl ? styles.hl : ""}`}
              style={{ animationDelay: `${i * 0.22}s` }}
            >
              {token.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
