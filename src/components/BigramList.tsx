import styles from './BigramList.module.css'

export type BigramRow = {
  prev: string
  next: string
  prob: number
  count: number
}

type BigramListProps = {
  bigrams: BigramRow[]
  currentToken: string | null
  predictedNext: string | null
  filterCurrentOnly: boolean
  onToggleFilter: (value: boolean) => void
  onSelectBigram: (prev: string, next: string) => void
}

export function BigramList({
  bigrams,
  currentToken,
  predictedNext,
  filterCurrentOnly,
  onToggleFilter,
  onSelectBigram,
}: BigramListProps) {
  const visible = filterCurrentOnly && currentToken
    ? bigrams.filter((row) => row.prev === currentToken)
    : bigrams

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <label className={styles.filter}>
          <input
            type="checkbox"
            checked={filterCurrentOnly}
            onChange={(event) => onToggleFilter(event.target.checked)}
          />
          Mostrar nomes alternatives actuals
        </label>
        <span className={styles.prob}>{visible.length} bigrames</span>
      </div>
      <div className={styles.list}>
        {visible.map((row, index) => {
          const isHighlight = currentToken ? row.prev === currentToken : false
          const isWinner =
            currentToken && predictedNext
              ? row.prev === currentToken && row.next === predictedNext
              : false
          const isSelectable = currentToken ? row.prev === currentToken : false
          return (
            <div
              className={`${styles.row} ${isHighlight ? styles.highlight : ''} ${isWinner ? styles.winner : ''} ${isSelectable ? styles.selectable : ''}`}
              key={`${row.prev}-${row.next}-${index}`}
              onClick={() => {
                if (isSelectable) onSelectBigram(row.prev, row.next)
              }}
              role={isSelectable ? 'button' : undefined}
              tabIndex={isSelectable ? 0 : undefined}
            >
              <span className={styles.pair}>
                {row.prev} → {row.next}
              </span>
              <span className={styles.prob}>
                {(row.prob * 100).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
