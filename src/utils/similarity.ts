import { levenshtein } from './levenshtein'

export function findClosestToken(target: string, vocab: string[]): string | null {
  if (!target || vocab.length === 0) return null
  let bestToken = vocab[0]
  let bestDistance = levenshtein(target, bestToken)

  for (let i = 1; i < vocab.length; i += 1) {
    const token = vocab[i]
    const distance = levenshtein(target, token)
    if (distance < bestDistance) {
      bestDistance = distance
      bestToken = token
      if (bestDistance === 0) break
    }
  }

  return bestToken
}
