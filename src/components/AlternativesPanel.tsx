import styles from './AlternativesPanel.module.css'

export type Alternative = {
  token: string
  prob: number
}

type AlternativesPanelProps = {
  alternatives: Alternative[]
}

export function AlternativesPanel({ alternatives }: AlternativesPanelProps) {
  if (alternatives.length === 0) {
    return <div className={styles.empty}>No hi ha alternatives disponibles.</div>
  }

  return (
    <div className={styles.container}>
      {alternatives.map((alt) => (
        <div className={styles.row} key={alt.token}>
          <div className={styles.label}>
            <span>{alt.token}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${alt.prob * 100}%` }} />
            </div>
          </div>
          <span className={styles.prob}>{(alt.prob * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}
