const NO_SPACE_BEFORE = new Set(['.', ',', '!', '?', ';', ':', ')', ']', '"'])
const NO_SPACE_AFTER = new Set(['(', '[', '"'])

export function tokensToText(tokens: string[]): string {
  let output = ''
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (i === 0) {
      output += token
      continue
    }

    const prev = tokens[i - 1]
    if (NO_SPACE_BEFORE.has(token)) {
      output += token
      continue
    }

    if (NO_SPACE_AFTER.has(prev)) {
      output += token
      continue
    }

    output += ` ${token}`
  }

  return output
}
