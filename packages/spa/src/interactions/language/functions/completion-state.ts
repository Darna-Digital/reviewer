/**
 * The rules the completion popup follows, kept out of the component.
 *
 * When to open, when to give up, how the highlighted row moves, and what an
 * accepted item actually replaces — all of it is decidable from the buffer, the
 * caret and the list, so none of it needs a rendered popup to test.
 */
import { prefixAt, type CompletionItem } from "@byconvo/core/language"

/** Shortest prefix worth asking about, unless a trigger character forces it. */
export const MIN_PREFIX = 1

/** Characters that open the list regardless of prefix, as in every IDE. */
const TRIGGERS = new Set([".", '"', "'", "`", "/", "@", "<"])

export interface CaretContext {
  /** The text of the caret's line. */
  readonly lineText: string
  /** Zero-based caret column. */
  readonly character: number
}

/** The identifier being typed at the caret. */
export const prefixOf = (caret: CaretContext): string =>
  prefixAt(caret.lineText, caret.character)

/**
 * Whether a caret should be asking for completions. Typing an identifier does;
 * so does the character after `.`, which is how member lists appear before
 * anything has been typed.
 */
export const shouldRequest = (caret: CaretContext): boolean => {
  const prefix = prefixOf(caret)
  if (prefix.length >= MIN_PREFIX) return true
  const previous = caret.lineText[caret.character - 1]
  return previous !== undefined && TRIGGERS.has(previous)
}

/** Index after moving `delta` rows, wrapping at both ends. */
export const moveSelection = (
  current: number,
  delta: number,
  length: number
): number => {
  if (length === 0) return 0
  return (((current + delta) % length) + length) % length
}

export interface AcceptedEdit {
  /** Zero-based line the replacement happens on. */
  readonly line: number
  readonly startCharacter: number
  readonly endCharacter: number
  readonly newText: string
}

/**
 * What accepting `item` replaces: the identifier already typed, not just an
 * insertion at the caret. Anything else duplicates the prefix.
 */
export const acceptedEdit = (
  item: CompletionItem,
  line: number,
  caret: CaretContext
): AcceptedEdit => {
  const prefix = prefixOf(caret)
  return {
    line,
    startCharacter: Math.max(0, caret.character - prefix.length),
    endCharacter: caret.character,
    newText: item.insertText.length > 0 ? item.insertText : item.label,
  }
}

/**
 * Whether an item needs resolving before it can be accepted — only the ones
 * that would bring a symbol into scope, since resolving is a round trip.
 */
export const needsResolve = (item: CompletionItem): boolean =>
  item.source.length > 0

/** Zero-based caret coordinates in a buffer. */
export interface CaretPosition {
  readonly line: number
  readonly character: number
}

/**
 * Where the caret ends up after `edit` is applied — the end of the text just
 * inserted.
 *
 * Accepting an item changes the buffer, which is the same signal that opens the
 * list, so without this the popup reappears offering the word it just inserted.
 * Remembering the resulting caret lets the next request recognise its own echo
 * and stay closed, while any further typing moves the caret and opens the list
 * again as normal.
 */
export const caretAfter = (edit: AcceptedEdit): CaretPosition => ({
  line: edit.line,
  character: edit.startCharacter + edit.newText.length,
})

/** Whether a caret is the one an accepted item left behind. */
export const isEchoOfAccept = (
  caret: CaretPosition,
  accepted: CaretPosition | null
): boolean =>
  accepted !== null &&
  caret.line === accepted.line &&
  caret.character === accepted.character
