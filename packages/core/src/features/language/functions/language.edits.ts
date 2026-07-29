/**
 * Applying text edits to a document.
 *
 * A quick fix or an auto-import arrives as a set of replacements against the
 * document as the provider saw it, so their offsets all refer to the *original*
 * text. Applying them front-to-back would shift every later one; applying them
 * back-to-front is the standard answer, and doing it here means the editor and
 * the file writer both get it right.
 */
import { offsetAt } from "./language.positions.ts"
import type { TextEdit } from "../schema/language.schema.ts"

const compare = (a: TextEdit, b: TextEdit) =>
  a.range.start.line - b.range.start.line ||
  a.range.start.character - b.range.start.character

/**
 * `text` with `edits` applied. Edits are sorted and applied from the end, so
 * the offsets in each one still refer to the text it was computed against.
 * Overlapping edits are resolved by dropping the later of the pair, which is
 * what an editor does rather than producing mangled output.
 */
export const applyTextEdits = (
  text: string,
  edits: ReadonlyArray<TextEdit>
): string => {
  const resolved = edits
    .map((edit) => ({
      start: offsetAt(text, edit.range.start),
      end: offsetAt(text, edit.range.end),
      newText: edit.newText,
      edit,
    }))
    .sort((a, b) => compare(a.edit, b.edit))

  // Decide what survives in document order, so the *first* of an overlapping
  // pair wins — the same choice an editor makes when a fix collides with one
  // already applied.
  const kept: typeof resolved = []
  let previousEnd = -1
  for (const entry of resolved) {
    if (entry.start < previousEnd) continue
    kept.push(entry)
    previousEnd = entry.end
  }

  // Apply from the end so each remaining offset still refers to `text`.
  let result = text
  for (let index = kept.length - 1; index >= 0; index--) {
    const entry = kept[index]
    result =
      result.slice(0, entry.start) + entry.newText + result.slice(entry.end)
  }
  return result
}
