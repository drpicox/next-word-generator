import styles from './TetragramList.module.css'

export type TetragramRow = {
  prev1: string
  prev2: string
  prev3: string
  next: string
  prob: number
  count: number
}

type TetragramListProps = {
  tetragrams: TetragramRow[]
  currentPrev1: string | null
  currentPrev2: string | null
  currentPrev3: string | null
  predictedNext: string | null
  filterCurrentOnly: boolean
  onToggleFilter: (value: boolean) => void
  onSelectTetragram: (prev1: string, prev2: string, prev3: string, next: string) => void
  closestContexts?: Array<{ prev1: string; prev2: string; prev3: string; distance: number }>
}

export function TetragramList({
  tetragrams,
  currentPrev1,
  currentPrev2,
  currentPrev3,
  predictedNext,
  filterCurrentOnly,
  onToggleFilter,
  onSelectTetragram,
  closestContexts = [],
}: TetragramListProps) {
  const hasContext = Boolean(currentPrev1 && currentPrev2 && currentPrev3)
  const contextMatches = (
    row: TetragramRow,
    ctx: { prev1: string; prev2: string; prev3: string },
  ) =>
    row.prev1 === ctx.prev1 && row.prev2 === ctx.prev2 && row.prev3 === ctx.prev3
  const hasClosest = closestContexts.length > 0
  const baseFiltered = filterCurrentOnly && hasContext
    ? tetragrams.filter((row) =>
        row.prev1 === currentPrev1 && row.prev2 === currentPrev2 && row.prev3 === currentPrev3,
      )
    : tetragrams
  const needed = filterCurrentOnly ? Math.max(0, 7 - baseFiltered.length) : 0
  const extra = needed > 0 && hasClosest
    ? tetragrams.filter((row) =>
        closestContexts.some((ctx) => contextMatches(row, ctx)) &&
        !baseFiltered.includes(row),
      )
        .slice(0, needed)
    : []
  const visible = filterCurrentOnly && hasContext
    ? [...baseFiltered, ...extra]
    : baseFiltered

  const weightMap = new Map<string, number>()
  for (const ctx of closestContexts) {
    const key = `${ctx.prev1}||${ctx.prev2}||${ctx.prev3}`
    weightMap.set(key, 1 / (1 + ctx.distance))
  }
  const weightedScores = visible.map((row) => {
    const key = `${row.prev1}||${row.prev2}||${row.prev3}`
    const weight = weightMap.get(key) ?? (row.prev1 === currentPrev1 && row.prev2 === currentPrev2 && row.prev3 === currentPrev3 ? 1 : 0.5)
    return row.prob * weight
  })
  const weightedTotal = weightedScores.reduce((sum, value) => sum + value, 0)

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
        <span className={styles.prob}>{visible.length} tetragrames</span>
      </div>
      <div className={styles.list}>
        {visible.map((row, index) => {
          const isHighlight = hasContext
            ? row.prev1 === currentPrev1 && row.prev2 === currentPrev2 && row.prev3 === currentPrev3
            : false
          const isNear = !isHighlight && hasClosest
            ? closestContexts.some((ctx) => contextMatches(row, ctx))
            : false
          const isWinner = isHighlight && predictedNext ? row.next === predictedNext : false
          const isSelectable = isHighlight || isNear
          const displayProb = weightedTotal > 0 ? weightedScores[index] / weightedTotal : row.prob
          return (
            <div
              className={`${styles.row} ${isHighlight ? styles.highlight : ''} ${isNear ? styles.near : ''} ${isWinner ? styles.winner : ''} ${isSelectable ? styles.selectable : ''}`}
              key={`${row.prev1}-${row.prev2}-${row.prev3}-${row.next}-${index}`}
              onClick={() => {
                if (isSelectable) onSelectTetragram(row.prev1, row.prev2, row.prev3, row.next)
              }}
              role={isSelectable ? 'button' : undefined}
              tabIndex={isSelectable ? 0 : undefined}
            >
              <span className={styles.pair}>
                {row.prev1} {row.prev2} {row.prev3} → {row.next}
              </span>
              <span className={styles.prob}>{(displayProb * 100).toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
