import styles from "./subtitle.module.css";

export function SubtitleWindow() {
  return (
    <main className={styles.wrap}>
      <p className={styles.orig}>Welcome to the future of AI translation.</p>
      <p className={styles.trans}>
        欢迎来到 <span className={styles.hl}>AI 翻译</span>的未来。
      </p>
    </main>
  );
}
