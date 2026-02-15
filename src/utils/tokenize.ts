const TOKEN_REGEX = /[\p{L}\p{M}\p{N}']+|[.,!?;:"()\[\]-]/gu

export function tokenize(text: string): string[] {
  if (!text) return []
  const matches = text.match(TOKEN_REGEX)
  return matches ? matches.filter(Boolean) : []
}
