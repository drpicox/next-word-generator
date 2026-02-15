import styles from './CorpusTab.module.css'

type CorpusTabProps = {
  corpusText: string
  corpusOptions: Array<{ id: string; label: string; file: string }>
  selectedCorpusId: string
  onCorpusSelect: (id: string) => void
  onCorpusChange: (value: string) => void
  onTrain: () => void
  isTrained: boolean
  isLoading: boolean
}

export function CorpusTab({
  corpusText,
  corpusOptions,
  selectedCorpusId,
  onCorpusSelect,
  onCorpusChange,
  onTrain,
  isTrained,
  isLoading,
}: CorpusTabProps) {
  return (
    <div className={styles.container}>
      <div className={styles.selectRow}>
        <label className={styles.selectLabel} htmlFor="corpus-select">
          Corpus predefinit
        </label>
        <select
          id="corpus-select"
          className={styles.select}
          value={selectedCorpusId}
          onChange={(event) => onCorpusSelect(event.target.value)}
        >
          {corpusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className={styles.textarea}
        value={corpusText}
        onChange={(event) => onCorpusChange(event.target.value)}
        placeholder="Enganxa aqui el corpus d'entrenament"
      />
      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={onTrain}
          disabled={isTrained || isLoading}
        >
          {isLoading ? 'Carregant...' : isTrained ? 'Entrenat' : 'Entrenar model'}
        </button>
      </div>
    </div>
  )
}
