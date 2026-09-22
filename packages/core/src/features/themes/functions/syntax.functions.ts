/**
 * From a theme to the code inside a card: the colours a fenced code block in
 * markdown is set in — an LSP hover's signature above all, which floats over
 * a diff highlighted with the very same theme.
 *
 * A diff is coloured by Shiki, which asks the theme what a token's TextMate
 * scope is worth. Markdown is coloured by highlight.js, which has no scopes
 * at all: it tags a token with one of a handful of classes and leaves the
 * colour to a stylesheet — which is why a hover card used to be lit by
 * GitHub's palette whatever theme was chosen. The bridge is built here. Each
 * of those classes is named as the scope it stands for, the theme is asked
 * for that scope, and the seven answers are what the stylesheet paints with.
 *
 * The colours are the theme's as written, never inked for legibility the way
 * the chrome's are: a card stands on a surface derived from the editor's own
 * background (see `deriveChromeTokens`), so a token that reads in the diff
 * reads on the card, and moving it would only make the two disagree.
 */
import type { ThemeLike } from "@pierre/theming";
import { parseHex, toHex } from "./hex-color.functions.ts";

/** The colours markdown's code is set in, by the role each class plays. */
export interface SyntaxTokens {
  /** Keywords, storage, types — highlight.js's `keyword` family. */
  keyword: string;
  /** The name a thing is declared under: `title`, `title.function_`. */
  entity: string;
  /** Numbers, literals, attributes, operators. */
  constant: string;
  string: string;
  /** `built_in` and `symbol`. */
  variable: string;
  comment: string;
  /** Tag names and selectors. */
  tag: string;
}

/** The TextMate scope each role is read from. */
const SCOPES: Record<keyof SyntaxTokens, string> = {
  keyword: "keyword",
  entity: "entity.name.function",
  constant: "constant",
  string: "string",
  variable: "variable",
  comment: "comment",
  tag: "entity.name.tag",
};

/**
 * What stands in for a role the theme never names: the colour plain code is
 * already set in, so an unnamed role reads as unhighlighted rather than as
 * some other theme's idea of a keyword.
 */
const PLAIN = "inherit";

/** A theme's TextMate rules, which `ThemeLike` does not declare. */
interface TokenRule {
  readonly scope?: string | ReadonlyArray<string>;
  readonly settings?: { readonly foreground?: string };
}

export function deriveSyntaxTokens(theme: ThemeLike): SyntaxTokens {
  const rules = tokenRulesOf(theme);
  const plain =
    hex(theme.fg) ?? hex(theme.colors?.["editor.foreground"]) ?? PLAIN;
  const read = (role: keyof SyntaxTokens): string =>
    hex(colorFor(rules, SCOPES[role])) ?? plain;
  return {
    keyword: read("keyword"),
    entity: read("entity"),
    constant: read("constant"),
    string: read("string"),
    variable: read("variable"),
    comment: read("comment"),
    tag: read("tag"),
  };
}

/**
 * A theme writes its rules under `tokenColors`; the older TextMate spelling
 * is `settings`, and a few of the bundled themes still use it.
 */
function tokenRulesOf(theme: ThemeLike): ReadonlyArray<TokenRule> {
  const { tokenColors, settings } = theme as {
    tokenColors?: ReadonlyArray<TokenRule>;
    settings?: ReadonlyArray<TokenRule>;
  };
  return tokenColors ?? settings ?? [];
}

/**
 * What the theme paints `scope` in: the rule whose selector is the longest
 * prefix of it, as TextMate resolves a scope — a theme that names both
 * `entity` and `entity.name.function` means the narrower one for a function
 * — and the last of equals, since a rule written later refines the one above
 * it. Contextual selectors (`source.js keyword`) are left alone: they say
 * what a scope is worth somewhere in particular, and nothing about what it is
 * worth on its own.
 */
function colorFor(
  rules: ReadonlyArray<TokenRule>,
  scope: string
): string | undefined {
  let color: string | undefined;
  let longest = -1;
  for (const rule of rules) {
    const foreground = rule.settings?.foreground;
    if (foreground === undefined) continue;
    for (const selector of selectorsOf(rule.scope)) {
      if (scope !== selector && !scope.startsWith(`${selector}.`)) continue;
      if (selector.length < longest) continue;
      longest = selector.length;
      color = foreground;
    }
  }
  return color;
}

/** A rule's scopes, however it lists them: an array, or one comma-separated. */
function selectorsOf(
  scope: string | ReadonlyArray<string> | undefined
): ReadonlyArray<string> {
  const listed = typeof scope === "string" ? scope.split(",") : (scope ?? []);
  return listed
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0 && !/\s/.test(selector));
}

/** A theme's colour as CSS reads it, or nothing where it is unreadable. */
function hex(color: string | undefined): string | undefined {
  const parsed = parseHex(color);
  return parsed === undefined ? undefined : toHex(parsed);
}
