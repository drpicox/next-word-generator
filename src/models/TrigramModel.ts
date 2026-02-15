import { normalizeText } from '../utils/normalize'
import { tokenize } from '../utils/tokenize'
import { findClosestToken } from '../utils/similarity'

export type TrigramCandidate = {
  token: string
  count: number
  prob: number
}

export type TrigramEntry = {
  prev1: string
  prev2: string
  next: string
  count: number
  prob: number
}

export class TrigramModel {
  private counts: Map<string, Map<string, Map<string, number>>> = new Map()
  private totals: Map<string, Map<string, number>> = new Map()
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

    for (let i = 0; i < tokens.length - 2; i += 1) {
      const prev1 = tokens[i]
      const prev2 = tokens[i + 1]
      const next = tokens[i + 2]

      const secondMap = this.counts.get(prev1) ?? new Map()
      const nextMap = secondMap.get(prev2) ?? new Map()
      nextMap.set(next, (nextMap.get(next) ?? 0) + 1)
      secondMap.set(prev2, nextMap)
      this.counts.set(prev1, secondMap)

      const totalsMap = this.totals.get(prev1) ?? new Map()
      totalsMap.set(prev2, (totalsMap.get(prev2) ?? 0) + 1)
      this.totals.set(prev1, totalsMap)
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

  getCandidates(prev1: string, prev2: string): TrigramCandidate[] {
    const secondMap = this.counts.get(prev1)
    if (!secondMap) return []
    const nextMap = secondMap.get(prev2)
    if (!nextMap) return []
    const totalsMap = this.totals.get(prev1)
    const total = totalsMap?.get(prev2) ?? 1
    const candidates: TrigramCandidate[] = []
    for (const [token, count] of nextMap.entries()) {
      candidates.push({ token, count, prob: count / total })
    }
    return candidates.sort((a, b) => b.prob - a.prob)
  }

  getAllTrigrams(): TrigramEntry[] {
    const entries: TrigramEntry[] = []
    for (const [prev1, secondMap] of this.counts.entries()) {
      const totalsMap = this.totals.get(prev1) ?? new Map()
      for (const [prev2, nextMap] of secondMap.entries()) {
        const total = totalsMap.get(prev2) ?? 1
        for (const [next, count] of nextMap.entries()) {
          entries.push({ prev1, prev2, next, count, prob: count / total })
        }
      }
    }
    return entries.sort((a, b) => b.prob - a.prob)
  }
}
