/** An identifier on a line, as the SPA's symbol layer reads one. */
export interface Identifier {
  name: string;
  /** UTF-16 index where it starts — the `character` the server takes. */
  start: number;
  end: number;
}

const IDENTIFIER = /[\p{L}_$][\p{L}\p{N}_$]*/gu;

/** Words of the supported languages that never name a symbol worth looking up. */
const KEYWORDS = new Set(
  (
    'abstract as async await break case catch class const continue declare def default ' +
    'defer delete do else elif elsif end enum export extends extension false final finally ' +
    'fn for from func function guard if implements import in instanceof interface is let ' +
    'module namespace new nil null of override private protected public readonly require ' +
    'return self static struct super switch then this throw true try type typeof undefined ' +
    'unless until use var void when where while with yield'
  ).split(' '),
);

/** Every identifier on `text`, left to right, keywords left out; words inside strings count too. */
export function identifiers(text: string): Identifier[] {
  return [...text.matchAll(IDENTIFIER)]
    .filter(
      (match) => !isNumberTail(text, match.index) && !KEYWORDS.has(match[0]),
    )
    .map((match) => ({
      name: match[0],
      start: match.index,
      end: match.index + match[0].length,
    }));
}

/** The identifier under `index`. */
export function identifierAt(text: string, index: number): Identifier | null {
  return (
    identifiers(text).find((word) => index >= word.start && index < word.end) ??
    null
  );
}

/** `1e5`, `0x1f`: a word glued to a digit is part of a number. */
function isNumberTail(text: string, at: number): boolean {
  return at > 0 && /\p{N}/u.test(text[at - 1]!);
}
