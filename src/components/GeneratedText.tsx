import styles from './GeneratedText.module.css'

type GeneratedTextProps = {
  text: string
}

export function GeneratedText({ text }: GeneratedTextProps) {
  if (!text.trim()) {
    return <div className={`${styles.container} ${styles.placeholder}`}>Encara no hi ha text generat.</div>
  }

  return <div className={styles.container}>{text}</div>
}
