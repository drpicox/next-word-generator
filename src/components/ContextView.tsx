import type { ReactNode } from 'react'
import styles from './ContextView.module.css'

type ContextFragment = {
  tokens: string[]
  contextStart: number
  contextEnd: number
  nextIndex: number | null
}

type ContextViewProps = {
  fragment: ContextFragment | null
}

const NO_SPACE_BEFORE = new Set(['.', ',', '!', '?', ';', ':', ')', ']', '"'])
const NO_SPACE_AFTER = new Set(['(', '[', '"'])

function renderTokens(fragment: ContextFragment) {
  const parts: Array<ReactNode> = []
  fragment.tokens.forEach((token, index) => {
    const prevToken = index > 0 ? fragment.tokens[index - 1] : null
    const needsSpace = index > 0
      ? !NO_SPACE_BEFORE.has(token) && !(prevToken && NO_SPACE_AFTER.has(prevToken))
      : false
    const isContext = index >= fragment.contextStart && index <= fragment.contextEnd
    const isNext = fragment.nextIndex === index
    const className = isNext
      ? `${styles.token} ${styles.next}`
      : isContext
        ? `${styles.token} ${styles.context}`
        : styles.token
    parts.push(
      <span className={className} key={`${token}-${index}`}>
        {needsSpace ? ` ${token}` : token}
      </span>,
    )
  })
  return parts
}

export function ContextView({ fragment }: ContextViewProps) {
  if (!fragment) {
    return <div className={styles.muted}>No s'ha trobat un context probable.</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.fragment}>{renderTokens(fragment)}</div>
    </div>
  )
}
