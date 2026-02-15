export type Candidate = {
  token: string
  prob: number
}

export function applyTemperature(
  candidates: Candidate[],
  temperature: number,
): Candidate[] {
  if (candidates.length === 0) return []
  if (temperature <= 0) return candidates

  const adjusted = candidates.map((candidate) => ({
    token: candidate.token,
    prob: Math.pow(candidate.prob, 1 / temperature),
  }))

  const total = adjusted.reduce((sum, item) => sum + item.prob, 0)
  if (total === 0) return candidates

  return adjusted.map((item) => ({
    token: item.token,
    prob: item.prob / total,
  }))
}

export function sampleCandidate(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null
  let threshold = Math.random()
  for (const candidate of candidates) {
    threshold -= candidate.prob
    if (threshold <= 0) return candidate
  }
  return candidates[candidates.length - 1]
}
