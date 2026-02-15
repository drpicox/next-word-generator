export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const aLen = a.length
  const bLen = b.length
  if (aLen === 0) return bLen
  if (bLen === 0) return aLen

  const dp: number[] = new Array(bLen + 1)
  for (let j = 0; j <= bLen; j += 1) dp[j] = j

  for (let i = 1; i <= aLen; i += 1) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= bLen; j += 1) {
      const temp = dp[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
      prev = temp
    }
  }

  return dp[bLen]
}
