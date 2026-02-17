import { normalizeText } from '../utils/normalize'
import { tokenize } from '../utils/tokenize'
import { findClosestToken } from '../utils/similarity'
import { levenshtein } from '../utils/levenshtein'

export type TetragramCandidate = {
  token: string
  count: number
  prob: number
}

export type TetragramEntry = {
  prev1: string
  prev2: string
  prev3: string
  next: string
  count: number
  prob: number
}

export type TetragramContextDistance = {
  prev1: string
  prev2: string
  prev3: string
  distance: number
}

export class TetragramModel {
  private counts: Map<string, Map<string, Map<string, Map<string, number>>>> = new Map()
  private totals: Map<string, Map<string, Map<string, number>>> = new Map()
  private tokenCounts: Map<string, number> = new Map()
  private vocab: Set<string> = new Set()

  clear() {
    this.counts.clear()
    this.totals.clear()
    this.tokenCounts.clear()
    this.vocab.clear()
  }

  train(text: string) {
    this.clear()
    const normalized = normalizeText(text)
    const tokens = tokenize(normalized)
    for (const token of tokens) {
      this.vocab.add(token)
      this.tokenCounts.set(token, (this.tokenCounts.get(token) ?? 0) + 1)
    }

    for (let i = 0; i < tokens.length - 3; i += 1) {
      const prev1 = tokens[i]
      const prev2 = tokens[i + 1]
      const prev3 = tokens[i + 2]
      const next = tokens[i + 3]

      const secondMap = this.counts.get(prev1) ?? new Map()
      const thirdMap = secondMap.get(prev2) ?? new Map()
      const nextMap = thirdMap.get(prev3) ?? new Map()
      nextMap.set(next, (nextMap.get(next) ?? 0) + 1)
      thirdMap.set(prev3, nextMap)
      secondMap.set(prev2, thirdMap)
      this.counts.set(prev1, secondMap)

      const totalsSecond = this.totals.get(prev1) ?? new Map()
      const totalsThird = totalsSecond.get(prev2) ?? new Map()
      totalsThird.set(prev3, (totalsThird.get(prev3) ?? 0) + 1)
      totalsSecond.set(prev2, totalsThird)
      this.totals.set(prev1, totalsSecond)
    }
  }

  isEmpty(): boolean {
    return this.counts.size === 0
  }

  getVocabulary(): string[] {
    return Array.from(this.vocab)
  }

  resolveToken(token: string): string | null {
    if (!token) return null
    if (this.vocab.has(token)) return token
    return findClosestToken(token, this.getVocabulary())
  }

  getMostCommonToken(): string | null {
    let bestToken: string | null = null
    let bestCount = -1
    for (const [token, count] of this.tokenCounts.entries()) {
      if (count > bestCount) {
        bestToken = token
        bestCount = count
      }
    }
    return bestToken
  }

  getCandidates(prev1: string, prev2: string, prev3: string): TetragramCandidate[] {
    const secondMap = this.counts.get(prev1)
    if (!secondMap) return []
    const thirdMap = secondMap.get(prev2)
    if (!thirdMap) return []
    const nextMap = thirdMap.get(prev3)
    if (!nextMap) return []
    const totalsSecond = this.totals.get(prev1)
    const totalsThird = totalsSecond?.get(prev2)
    const total = totalsThird?.get(prev3) ?? 1
    const candidates: TetragramCandidate[] = []
    for (const [token, count] of nextMap.entries()) {
      candidates.push({ token, count, prob: count / total })
    }
    return candidates.sort((a, b) => b.prob - a.prob)
  }

  getCandidatesForContext(prev1: string, prev2: string, prev3: string): {
    prev1: string
    prev2: string
    prev3: string
    candidates: TetragramCandidate[]
  } | null {
    if (this.counts.size === 0) return null
    const exactCandidates = this.getCandidates(prev1, prev2, prev3)
    if (exactCandidates.length > 0) {
      return { prev1, prev2, prev3, candidates: exactCandidates }
    }

    const closest = this.findClosestContext(prev1, prev2, prev3)
    if (!closest) return null
    const candidates = this.getCandidates(closest.prev1, closest.prev2, closest.prev3)
    if (candidates.length === 0) return null
    return { prev1: closest.prev1, prev2: closest.prev2, prev3: closest.prev3, candidates }
  }

  getClosestContexts(
    prev1: string,
    prev2: string,
    prev3: string,
    limit = 3,
  ): TetragramContextDistance[] {
    const contexts: TetragramContextDistance[] = []
    for (const [key1, secondMap] of this.counts.entries()) {
      for (const [key2, thirdMap] of secondMap.entries()) {
        for (const key3 of thirdMap.keys()) {
          const distance =
            levenshtein(prev1, key1) + levenshtein(prev2, key2) + levenshtein(prev3, key3)
          contexts.push({ prev1: key1, prev2: key2, prev3: key3, distance })
        }
      }
    }
    contexts.sort((a, b) => a.distance - b.distance)
    return contexts.slice(0, limit)
  }

  getWeightedCandidatesForContext(
    prev1: string,
    prev2: string,
    prev3: string,
    limit = 3,
  ): {
    contexts: TetragramContextDistance[]
    candidates: TetragramCandidate[]
  } | null {
    if (this.counts.size === 0) return null
    const exact = this.getCandidates(prev1, prev2, prev3)
    if (exact.length > 0) {
      return {
        contexts: [{ prev1, prev2, prev3, distance: 0 }],
        candidates: exact,
      }
    }

    const closest = this.getClosestContexts(prev1, prev2, prev3, limit)
    if (closest.length === 0) return null
    const scoreMap = new Map<string, number>()
    for (const context of closest) {
      const weight = 1 / (1 + context.distance)
      const candidates = this.getCandidates(context.prev1, context.prev2, context.prev3)
      for (const candidate of candidates) {
        const value = scoreMap.get(candidate.token) ?? 0
        scoreMap.set(candidate.token, value + candidate.prob * weight)
      }
    }
    const total = Array.from(scoreMap.values()).reduce((sum, value) => sum + value, 0)
    if (total === 0) return null
    const candidates = Array.from(scoreMap.entries())
      .map(([token, score]) => ({ token, count: 0, prob: score / total }))
      .sort((a, b) => b.prob - a.prob)
    return { contexts: closest, candidates }
  }

  getAllTetragrams(): TetragramEntry[] {
    const entries: TetragramEntry[] = []
    for (const [prev1, secondMap] of this.counts.entries()) {
      const totalsSecond = this.totals.get(prev1) ?? new Map()
      for (const [prev2, thirdMap] of secondMap.entries()) {
        const totalsThird = totalsSecond.get(prev2) ?? new Map()
        for (const [prev3, nextMap] of thirdMap.entries()) {
          const total = totalsThird.get(prev3) ?? 1
          for (const [next, count] of nextMap.entries()) {
            entries.push({ prev1, prev2, prev3, next, count, prob: count / total })
          }
        }
      }
    }
    return entries.sort((a, b) => b.prob - a.prob)
  }

  private findClosestContext(prev1: string, prev2: string, prev3: string): {
    prev1: string
    prev2: string
    prev3: string
  } | null {
    let best: { prev1: string; prev2: string; prev3: string } | null = null
    let bestScore = Number.POSITIVE_INFINITY
    for (const [key1, secondMap] of this.counts.entries()) {
      for (const [key2, thirdMap] of secondMap.entries()) {
        for (const key3 of thirdMap.keys()) {
          const score =
            levenshtein(prev1, key1) + levenshtein(prev2, key2) + levenshtein(prev3, key3)
          if (score < bestScore) {
            bestScore = score
            best = { prev1: key1, prev2: key2, prev3: key3 }
          }
          if (bestScore === 0) return best
        }
      }
    }
    return best
  }
}
