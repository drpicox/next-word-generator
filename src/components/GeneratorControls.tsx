import styles from './GeneratorControls.module.css'

type GeneratorControlsProps = {
  modelType: string
  seedText: string
  temperature: number
  isAnimating: boolean
  onModelChange: (value: string) => void
  onSeedChange: (value: string) => void
  onTemperatureChange: (value: number) => void
  onGenerate10: () => void
  onGenerate50: () => void
  onGenerateAnimated: () => void
  onStep: () => void
  onStop: () => void
  onClear: () => void
}

export function GeneratorControls({
  modelType,
  seedText,
  temperature,
  isAnimating,
  onModelChange,
  onSeedChange,
  onTemperatureChange,
  onGenerate10,
  onGenerate50,
  onGenerateAnimated,
  onStep,
  onStop,
  onClear,
}: GeneratorControlsProps) {
  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span>Model</span>
        </div>
        <select
          className={styles.select}
          value={modelType}
          onChange={(event) => onModelChange(event.target.value)}
        >
          <option value="bigrams">Bigrames</option>
          <option value="trigrams">Trigrames</option>
        </select>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span>Seed</span>
        </div>
        <textarea
          className={styles.textarea}
          value={seedText}
          onChange={(event) => onSeedChange(event.target.value)}
          placeholder="Text inicial per començar a generar"
        />
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span>Temperatura</span>
          <span>{temperature.toFixed(1)}</span>
        </div>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={(event) => onTemperatureChange(Number(event.target.value))}
        />
      </div>

      <div className={styles.buttonRow}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} type="button" onClick={onGenerate10}>
          Generar 10 paraules
        </button>
        <button className={styles.button} type="button" onClick={onGenerate50}>
          Generar 50 paraules
        </button>
        <button
          className={`${styles.button} ${styles.buttonWarm} ${styles.iconButton}`}
          type="button"
          onClick={onGenerateAnimated}
          aria-label="Generar animat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M7 5.5v13l11-6.5-11-6.5z" />
          </svg>
          <span className={styles.srOnly}>Generar animat</span>
        </button>
        <button
          className={`${styles.button} ${styles.iconButton}`}
          type="button"
          onClick={onStep}
          aria-label="Pas a pas"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M6 5h3v14H6V5zm6 0l8 7-8 7V5z" />
          </svg>
          <span className={styles.srOnly}>Pas a pas</span>
        </button>
        <button
          className={`${styles.button} ${styles.buttonGhost} ${styles.iconButton}`}
          type="button"
          onClick={onStop}
          disabled={!isAnimating}
          aria-label="Aturar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
          <span className={styles.srOnly}>Aturar</span>
        </button>
        <button
          className={`${styles.button} ${styles.buttonGhost}`}
          type="button"
          onClick={onClear}
        >
          Esborrar
        </button>
      </div>
    </div>
  )
}
