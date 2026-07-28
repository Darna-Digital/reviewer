/**
 * Conversions between LSP positions (zero-based line + UTF-16 character) and
 * flat string offsets. Every provider needs them — the TypeScript service
 * speaks offsets, LSP servers speak positions, and the UI speaks both — so they
 * live here, pure and shared, rather than once per adapter.
 *
 * Line terminators follow LSP/TypeScript: `\r\n`, `\n` and a lone `\r` all end
 * a line. JavaScript strings are already UTF-16, so `character` is a plain
 * index into the line and needs no re-encoding.
 */
import type { Position, Range } from "../schema/language.schema.ts"

/** Offsets at which each line starts. Always has at least one entry. */
export const lineStarts = (text: string): ReadonlyArray<number> => {
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 10) {
      starts.push(i + 1)
    } else if (code === 13) {
      // A lone CR ends a line; CRLF counts once, at the LF.
      if (text.charCodeAt(i + 1) !== 10) starts.push(i + 1)
    }
  }
  return starts
}

/** Number of lines in `text`; a trailing newline opens an empty last line. */
export const lineCount = (text: string): number => lineStarts(text).length

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value

/** End offset of `line`, excluding its terminator. */
const lineEnd = (
  text: string,
  starts: ReadonlyArray<number>,
  line: number
): number => {
  const next = starts[line + 1]
  if (next === undefined) return text.length
  // Step back over the terminator: \n, or the \r of a \r\n / lone \r.
  const beforeNewline = next - 1
  if (text.charCodeAt(beforeNewline) === 10 && text.charCodeAt(next - 2) === 13)
    return next - 2
  return beforeNewline
}

/**
 * Flat offset of `position`, clamped into `text`. Out-of-range positions clamp
 * rather than throw: they routinely arrive from a stale editor buffer, and a
 * clamped lookup degrades better than a failed request.
 */
export const offsetAt = (text: string, position: Position): number => {
  const starts = lineStarts(text)
  const line = clamp(Math.trunc(position.line), 0, starts.length - 1)
  const start = starts[line]
  const end = lineEnd(text, starts, line)
  return clamp(start + Math.trunc(position.character), start, end)
}

/** Position of a flat offset, clamped into `text`. */
export const positionAt = (text: string, offset: number): Position => {
  const starts = lineStarts(text)
  const target = clamp(Math.trunc(offset), 0, text.length)
  // Binary search for the last line starting at or before `target`.
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (starts[mid] <= target) low = mid
    else high = mid - 1
  }
  return { line: low, character: target - starts[low] }
}

/** The half-open range covering `[start, start + length)`. */
export const rangeFromSpan = (
  text: string,
  start: number,
  length: number
): Range => ({
  start: positionAt(text, start),
  end: positionAt(text, start + Math.max(0, length)),
})

const PREVIEW_MAX = 200

/**
 * The trimmed source line at `line`, for reference and definition lists. Long
 * lines (minified bundles, generated code) are cut so a payload stays small.
 */
export const previewAt = (text: string, line: number): string => {
  const starts = lineStarts(text)
  if (line < 0 || line >= starts.length) return ""
  const raw = text.slice(starts[line], lineEnd(text, starts, line))
  const trimmed = raw.trim()
  return trimmed.length > PREVIEW_MAX
    ? `${trimmed.slice(0, PREVIEW_MAX)}…`
    : trimmed
}

/**
 * Whether `position` falls inside the half-open `range`. An empty range is the
 * exception: it contains its own start, so zero-length diagnostics (a missing
 * token, an unexpected end of file) still have something to hover over.
 */
export const rangeContains = (range: Range, position: Position): boolean => {
  const { start, end } = range
  if (position.line < start.line || position.line > end.line) return false
  if (position.line === start.line && position.character < start.character)
    return false
  if (start.line === end.line && start.character === end.character)
    return (
      position.line === start.line && position.character === start.character
    )
  if (position.line === end.line && position.character >= end.character)
    return false
  return true
}
