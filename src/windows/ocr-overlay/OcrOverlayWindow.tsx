import styles from "./ocr-overlay.module.css";

export function OcrOverlayWindow() {
  return (
    <main className={styles.overlay}>
      <p className={styles.hint}>按住拖拽，框选一个区域（UI 骨架）</p>
    </main>
  );
}
