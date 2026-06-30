import styles from "../shared/window-shell.module.css";

interface Props {
  title: string;
  description: string;
  placeholder: string;
}

export function WindowShell({ title, description, placeholder }: Props) {
  return (
    <main className={styles.panel}>
      <section className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.desc}>{description}</p>
        <div className={styles.placeholder}>{placeholder}</div>
      </section>
    </main>
  );
}
