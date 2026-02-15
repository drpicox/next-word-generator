import { normalizeText } from '../utils/normalize'
import { tokenize } from '../utils/tokenize'
import { findClosestToken } from '../utils/similarity'

export type BigramCandidate = {
  token: string
  count: number
  prob: number
}

export type BigramEntry = {
  prev: string
  next: string
  count: number
  prob: number
}

export class BigramModel {
  private counts: Map<string, Map<string, number>> = new Map()
  private totals: Map<string, number> = new Map()
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

    for (let i = 0; i < tokens.length - 1; i += 1) {
      const prev = tokens[i]
      const next = tokens[i + 1]
      const nextMap = this.counts.get(prev) ?? new Map()
      nextMap.set(next, (nextMap.get(next) ?? 0) + 1)
      this.counts.set(prev, nextMap)
      this.totals.set(prev, (this.totals.get(prev) ?? 0) + 1)
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

  getCandidates(prev: string): BigramCandidate[] {
    const nextMap = this.counts.get(prev)
    if (!nextMap) return []
    const total = this.totals.get(prev) ?? 1
    const candidates: BigramCandidate[] = []
    for (const [token, count] of nextMap.entries()) {
      candidates.push({ token, count, prob: count / total })
    }
    return candidates.sort((a, b) => b.prob - a.prob)
  }

  getAllBigrams(): BigramEntry[] {
    const entries: BigramEntry[] = []
    for (const [prev, nextMap] of this.counts.entries()) {
      const total = this.totals.get(prev) ?? 1
      for (const [next, count] of nextMap.entries()) {
        entries.push({ prev, next, count, prob: count / total })
      }
    }
    return entries.sort((a, b) => b.prob - a.prob)
  }
}
