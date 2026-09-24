/**
 * Code coloured in a theme, for a shell that draws its own.
 *
 * The web app highlights in the browser: Shiki's grammars and the chosen
 * theme are already on the page, and every diff and file is painted from
 * them. A native conversation has neither, and a fenced snippet in a reply
 * sat there flat. Rather than teach the shell a second, poorer grammar —
 * and a second reading of a theme's token colours, which would drift from
 * the one the web app paints with — the snippet is read here, by the same
 * Shiki and the same theme, and handed over as tokens with colours on them.
 *
 * `codeToTokens` keeps a highlighter of its own between calls, so a grammar
 * is fetched the first time a language is asked for and free after: a reply
 * full of TypeScript costs one load, and the snippet after it nothing.
 */
import {
  bundledLanguages,
  codeToTokens,
  type BundledLanguage,
  type SpecialLanguage,
} from "shiki";
import type { ThemeLike } from "@pierre/theming";
import type { CodeToken, HighlightedCode } from "../schema/themes.schema.ts";

/** Shiki's own name for "do not read this as anything". */
const PLAIN: SpecialLanguage = "text";

/** The bits Shiki packs a token's face into. */
const ITALIC = 1;
const BOLD = 2;

/**
 * Past this a snippet is left plain. A reply carries snippets, not files,
 * and a grammar walking something file-sized would hold the request open
 * for a paint nobody is waiting on any more.
 */
const MAX_CHARS = 100_000;

/**
 * The grammar a fence's info string names. Shiki's bundle is keyed by every
 * alias it knows — `ts` as well as `typescript` — so the lookup is the
 * whole of it; anything else, the empty fence included, reads as plain text.
 */
export function grammarFor(lang: string): BundledLanguage | SpecialLanguage {
  const wanted = lang.trim().toLowerCase();
  return wanted in bundledLanguages ? (wanted as BundledLanguage) : PLAIN;
}

export async function highlightCode(
  code: string,
  lang: string,
  theme: ThemeLike
): Promise<HighlightedCode> {
  const grammar = code.length > MAX_CHARS ? PLAIN : grammarFor(lang);
  const { tokens, fg } = await codeToTokens(code, { lang: grammar, theme });
  return {
    lang: grammar,
    ...(fg === undefined ? {} : { foreground: fg }),
    lines: tokens.map((line) => line.map((token) => read(token, fg))),
  };
}

/**
 * One of Shiki's tokens as the wire carries it. A token already set in the
 * code's own foreground is sent without a colour — which is most of a
 * snippet, every space and every plain word — and a theme is free to write
 * the same colour in either case, so the two are compared as colours rather
 * than as strings.
 */
function read(
  token: { content: string; color?: string; fontStyle?: number },
  foreground: string | undefined
): CodeToken {
  const style = token.fontStyle ?? 0;
  const own =
    token.color !== undefined &&
    token.color.toLowerCase() !== foreground?.toLowerCase();
  return {
    text: token.content,
    ...(own ? { color: token.color } : {}),
    ...((style & ITALIC) === 0 ? {} : { italic: true }),
    ...((style & BOLD) === 0 ? {} : { bold: true }),
  };
}
