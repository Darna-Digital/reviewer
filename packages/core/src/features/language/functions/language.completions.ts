/**
 * Narrowing a completion list to what the user is typing.
 *
 * A language service answers a bare identifier position with everything in
 * scope plus every exported symbol it could auto-import — thousands of entries.
 * Capping that blindly would hide the one match the user is reaching for, so
 * the prefix is matched here and only the survivors are capped.
 *
 * Ranking follows what editors have taught people to expect: an exact
 * case-sensitive prefix first, then case-insensitive, then a subsequence match
 * (`gS` finding `greetSomeone`), and inside each tier the provider's own
 * ordering wins.
 */
import type { CompletionItem } from "../schema/language.schema.ts"

/** Most items a single response carries. */
export const MAX_COMPLETIONS = 200

export type MatchTier = "exact-prefix" | "prefix" | "subsequence" | "none"

/** Whether `prefix`'s characters appear in `label` in order. */
const isSubsequence = (label: string, prefix: string): boolean => {
  let index = 0
  for (const character of label) {
    if (character === prefix[index]) index += 1
    if (index === prefix.length) return true
  }
  return prefix.length === 0
}

/** How well `label` matches `prefix`. */
export const matchTier = (label: string, prefix: string): MatchTier => {
  if (prefix.length === 0) return "exact-prefix"
  if (label.startsWith(prefix)) return "exact-prefix"
  const lowerLabel = label.toLowerCase()
  const lowerPrefix = prefix.toLowerCase()
  if (lowerLabel.startsWith(lowerPrefix)) return "prefix"
  return isSubsequence(lowerLabel, lowerPrefix) ? "subsequence" : "none"
}

const TIER_RANK: Record<Exclude<MatchTier, "none">, number> = {
  "exact-prefix": 0,
  prefix: 1,
  subsequence: 2,
}

/**
 * The items worth showing for `prefix`, best first and capped. Items the
 * provider marked as auto-imports sort after ones already in scope at the same
 * tier — reaching for something already imported is the common case.
 */
export const filterCompletions = (
  items: ReadonlyArray<CompletionItem>,
  prefix: string,
  max: number = MAX_COMPLETIONS
): ReadonlyArray<CompletionItem> => {
  const scored: Array<{
    readonly item: CompletionItem
    readonly tier: number
    readonly index: number
  }> = []
  for (const [index, item] of items.entries()) {
    const tier = matchTier(item.label, prefix)
    if (tier === "none") continue
    scored.push({ item, tier: TIER_RANK[tier], index })
  }
  return scored
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        Number(a.item.source.length > 0) - Number(b.item.source.length > 0) ||
        a.item.sortText.localeCompare(b.item.sortText) ||
        a.item.label.localeCompare(b.item.label) ||
        a.index - b.index
    )
    .slice(0, max)
    .map((entry) => entry.item)
}

/**
 * The identifier immediately before `character` on `line`.
 *
 * The caller could compute this, but every provider and the UI need to agree on
 * exactly which characters count as part of the word being typed — otherwise
 * the accepted text replaces the wrong span.
 */
export const prefixAt = (lineText: string, character: number): string => {
  const upto = lineText.slice(0, Math.max(0, character))
  const match = /[\p{L}\p{N}_$]*$/u.exec(upto)
  return match?.[0] ?? ""
}

export interface IdentifierSpan {
  readonly text: string
  readonly start: number
  readonly end: number
}

/**
 * The identifier `offset` sits in or next to, or null when it is not on one.
 *
 * Import resolution needs the whole word, not the part before the caret: a
 * right-click lands in the middle of a name and still has to know which symbol
 * it is looking at.
 */
export const identifierAt = (
  text: string,
  offset: number
): IdentifierSpan | null => {
  const at = Math.min(Math.max(offset, 0), text.length)
  const isWord = (character: string | undefined) =>
    character !== undefined && /[\p{L}\p{N}_$]/u.test(character)

  let start = at
  while (start > 0 && isWord(text[start - 1])) start -= 1
  let end = at
  while (end < text.length && isWord(text[end])) end += 1
  return end === start ? null : { text: text.slice(start, end), start, end }
}
