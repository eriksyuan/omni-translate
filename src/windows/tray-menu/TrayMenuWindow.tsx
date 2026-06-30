import { hideWindow, quitApp, showWindow } from "@/lib/tauri";
import { WINDOW_LABELS } from "@/lib/windows";
import styles from "./tray-menu.module.css";

async function openWindow(label: string) {
  await hideWindow(WINDOW_LABELS.TRAY_MENU);
  await showWindow(label);
}

export function TrayMenuWindow() {
  return (
    <nav className={styles.menu} aria-label="OmniTranslate 菜单">
      <button
        type="button"
        className={styles.item}
        onClick={() => openWindow(WINDOW_LABELS.AUDIO_CONFIG)}
      >
        <span className={styles.text}>
          音频实时翻译…
          <div className={styles.sub}>系统声音 / 麦克风同传</div>
        </span>
      </button>
      <button
        type="button"
        className={styles.item}
        onClick={() => openWindow(WINDOW_LABELS.OCR_PERMISSION)}
      >
        <span className={styles.text}>
          屏幕区域 OCR 翻译
          <div className={styles.sub}>框选屏幕任意区域取词</div>
        </span>
      </button>
      <div className={styles.sep} />
      <button
        type="button"
        className={styles.item}
        onClick={() => openWindow(WINDOW_LABELS.PREFERENCES)}
      >
        <span className={styles.text}>服务设置…</span>
        <span className={styles.shortcut}>⌘,</span>
      </button>
      <div className={styles.sep} />
      <button type="button" className={styles.item} onClick={() => void quitApp()}>
        <span className={styles.text}>退出 OmniTranslate</span>
        <span className={styles.shortcut}>⌘Q</span>
      </button>
    </nav>
  );
}
