import type { Card } from "../schema/tasks.schema.ts"

const KEY_IN_TEXT = /[a-z][a-z0-9]*-\d+/i
export const resolveTask = (
  cards: ReadonlyArray<Card>,
  query: string
): Card | null => {
  const q = query.trim()
  if (q.length === 0) return null
  const lower = q.toLowerCase()
  const exactKey = cards.find((c) => c.key.toLowerCase() === lower)
  if (exactKey !== undefined) return exactKey
  const embedded = q.match(KEY_IN_TEXT)?.[0]
  if (embedded !== undefined) {
    const byEmbedded = cards.find(
      (c) => c.key.toLowerCase() === embedded.toLowerCase()
    )
    if (byEmbedded !== undefined) return byEmbedded
  }
  const exactTitle = cards.find((c) => c.title.trim().toLowerCase() === lower)
  if (exactTitle !== undefined) return exactTitle
  const titleInPhrase = cards
    .filter(
      (c) =>
        c.title.trim().length > 0 &&
        lower.includes(c.title.trim().toLowerCase())
    )
    .sort((a, b) => b.title.length - a.title.length)
  if (titleInPhrase.length > 0) return titleInPhrase[0]
  const queryInTitle = cards
    .filter((c) => c.title.toLowerCase().includes(lower))
    .sort((a, b) => a.title.length - b.title.length)
  if (queryInTitle.length > 0) return queryInTitle[0]
  return null
}
export const normalizePrefix = (prefix: string): string => {
  const cleaned = prefix.replace(/[^a-z0-9]/gi, "").toUpperCase()
  return cleaned.length > 0 ? cleaned : "T"
}
