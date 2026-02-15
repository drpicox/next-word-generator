import styles from './TrigramList.module.css'

export type TrigramRow = {
  prev1: string
  prev2: string
  next: string
  prob: number
  count: number
}

type TrigramListProps = {
  trigrams: TrigramRow[]
  currentPrev1: string | null
  currentPrev2: string | null
  predictedNext: string | null
  filterCurrentOnly: boolean
  onToggleFilter: (value: boolean) => void
  onSelectTrigram: (prev1: string, prev2: string, next: string) => void
}

export function TrigramList({
  trigrams,
  currentPrev1,
  currentPrev2,
  predictedNext,
  filterCurrentOnly,
  onToggleFilter,
  onSelectTrigram,
}: TrigramListProps) {
  const hasContext = Boolean(currentPrev1 && currentPrev2)
  const visible = filterCurrentOnly && hasContext
    ? trigrams.filter((row) => row.prev1 === currentPrev1 && row.prev2 === currentPrev2)
    : trigrams

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
        <span className={styles.prob}>{visible.length} trigrames</span>
      </div>
      <div className={styles.list}>
        {visible.map((row, index) => {
          const isHighlight = hasContext
            ? row.prev1 === currentPrev1 && row.prev2 === currentPrev2
            : false
          const isWinner =
            isHighlight && predictedNext
              ? row.next === predictedNext
              : false
          const isSelectable = isHighlight
          return (
            <div
              className={`${styles.row} ${isHighlight ? styles.highlight : ''} ${isWinner ? styles.winner : ''} ${isSelectable ? styles.selectable : ''}`}
              key={`${row.prev1}-${row.prev2}-${row.next}-${index}`}
              onClick={() => {
                if (isSelectable) onSelectTrigram(row.prev1, row.prev2, row.next)
              }}
              role={isSelectable ? 'button' : undefined}
              tabIndex={isSelectable ? 0 : undefined}
            >
              <span className={styles.pair}>
                {row.prev1} {row.prev2} → {row.next}
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
