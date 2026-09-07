/**
 * The rules the completion popup follows, kept out of the component.
 *
 * When to open, when to give up, how the highlighted row moves, and what an
 * accepted item actually replaces — all of it is decidable from the buffer, the
 * caret and the list, so none of it needs a rendered popup to test.
 *
 * The rule underneath all of them: a list is only ever as good as the caret it
 * was computed for. Asking costs a debounce plus a round trip, and the user
 * keeps typing through both, so every answer here is expressed against the
 * caret *now* rather than the one that asked the question.
 */
import { filterCompletions, prefixAt } from "@reviewer/core/language";
import type { CompletionItem } from "@reviewer/core/language";

/** Shortest prefix worth asking about, unless a trigger character forces it. */
export const MIN_PREFIX = 1;

/** Characters that open the list regardless of prefix, as in every IDE. */
const TRIGGERS = new Set([".", '"', "'", "`", "/", "@", "<"]);

export interface CaretContext {
  /** The text of the caret's line. */
  readonly lineText: string;
  /** Zero-based caret column. */
  readonly character: number;
}

/** The identifier being typed at the caret. */
export const prefixOf = (caret: CaretContext): string =>
  prefixAt(caret.lineText, caret.character);

/** Zero-based caret coordinates in a buffer. */
export interface CaretPosition {
  readonly line: number;
  readonly character: number;
}

/**
 * Whether a caret should be asking for completions. Typing an identifier does;
 * so does the character after `.`, which is how member lists appear before
 * anything has been typed.
 */
export const shouldRequest = (caret: CaretContext): boolean => {
  const prefix = prefixOf(caret);
  if (prefix.length >= MIN_PREFIX) return true;
  const previous = caret.lineText[caret.character - 1];
  return previous !== undefined && TRIGGERS.has(previous);
};

/** Index after moving `delta` rows, wrapping at both ends. */
export const moveSelection = (
  current: number,
  delta: number,
  length: number
): number => {
  if (length === 0) return 0;
  return (((current + delta) % length) + length) % length;
};

export interface AcceptedEdit {
  /** Zero-based line the replacement happens on. */
  readonly line: number;
  readonly startCharacter: number;
  readonly endCharacter: number;
  readonly newText: string;
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
  const prefix = prefixOf(caret);
  return {
    line,
    startCharacter: Math.max(0, caret.character - prefix.length),
    endCharacter: caret.character,
    newText: item.insertText.length > 0 ? item.insertText : item.label,
  };
};

/**
 * Whether an item needs resolving before it can be accepted — only the ones
 * that would bring a symbol into scope, since resolving is a round trip.
 */
export const needsResolve = (item: CompletionItem): boolean =>
  item.source.length > 0;

/**
 * Whether a caret is the one an accepted item left behind.
 *
 * Accepting an item changes the buffer, which is the same signal that opens the
 * list, so without this the popup reappears offering the word it just inserted.
 * Remembering the caret the edit left lets the next request recognise its own
 * echo and stay closed, while any further typing moves the caret and opens the
 * list again as normal.
 */
export const isEchoOfAccept = (
  caret: CaretPosition,
  accepted: CaretPosition | null
): boolean =>
  accepted !== null &&
  caret.line === accepted.line &&
  caret.character === accepted.character;

/**
 * The word the caret is inside, as a span rather than a string: where the
 * identifier being typed starts, and where the caret sits in it.
 *
 * A list belongs to that span, not to the caret that opened it — which is what
 * lets it survive the next few keystrokes.
 */
export const wordStart = (caret: CaretContext): number =>
  caret.character - prefixOf(caret).length;

/** A list, and the word span it was computed for. */
export interface OpenList {
  /** Everything the provider answered with, before this file's own narrowing. */
  readonly items: ReadonlyArray<CompletionItem>;
  /** Zero-based line the word being completed is on. */
  readonly line: number;
  /** Column the word starts at — the anchor the list belongs to. */
  readonly startCharacter: number;
}

/**
 * Whether an open list still describes where the caret is.
 *
 * It does while the caret is on the same line and still inside — or at the end
 * of — the word the list was asked about. Typing on narrows it; a backspace
 * past the start of the word, a click elsewhere, or a newline retires it, since
 * the provider was answering a question about a different position.
 */
export const stillApplies = (
  list: OpenList,
  caret: CaretPosition & CaretContext
): boolean =>
  caret.line === list.line &&
  caret.character >= list.startCharacter &&
  wordStart(caret) === list.startCharacter;

/**
 * The rows to show for where the caret is now.
 *
 * The provider filtered against the prefix as it stood when it was asked. Every
 * keystroke since then narrows the same answer, so the list tracks the typing
 * instead of lagging a round trip behind it — and an empty result is how the
 * popup knows to close rather than offer words that no longer match.
 */
export const visibleItems = (
  list: OpenList,
  caret: CaretContext
): ReadonlyArray<CompletionItem> =>
  filterCompletions(list.items, prefixOf(caret));
