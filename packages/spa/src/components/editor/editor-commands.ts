/**
 * How the editor is configured, and the one command it still has to be given.
 *
 * `@pierre/diffs` 1.3.5 ships the commands this module used to hand-roll —
 * `toggleComment`, `toggleBlockComment`, `copyLineUp`/`copyLineDown` — and runs
 * them through its own edit path, so the selection survives the edit and the
 * whole batch is a single undo. Reimplementing them here meant taking ⌘/ off
 * the editor at window level and handing back something that knew four families
 * of language, had no block comment at all, and silently did nothing everywhere
 * else — including CSS, HTML, Markdown, Vue and Svelte.
 *
 * So the commands are the library's now. What is left here is what it cannot
 * know: the comment tokens for the filetypes missing from its own table, the
 * bindings this app wants on top of the defaults, and delete-line, which it has
 * no command for.
 *
 * Edits are computed against the original line array and returned sorted
 * bottom-up so they can be applied sequentially without invalidating positions.
 */
import type { EditorKeymap, EditorOptions, TextEdit } from "@pierre/diffs/edit";

type LanguageComments = NonNullable<
  EditorOptions<"file", undefined, undefined>["languageCommentConfig"]
>;

const HASH: LanguageComments[string] = { lineComment: "#" };
const DASH_BRACE: LanguageComments[string] = {
  lineComment: "--",
  blockComment: ["{-", "-}"],
};
const PERCENT: LanguageComments[string] = { lineComment: "%" };
const SEMI: LanguageComments[string] = { lineComment: ";" };
const MARKUP: LanguageComments[string] = {
  lineComment: null,
  blockComment: ["<!--", "-->"],
};

/**
 * Comment tokens for the filetypes `@pierre/diffs` has no entry for.
 *
 * Only the gaps: anything already in its own table (sql, python, yaml, css,
 * html, markdown, lua, ini, …) is left alone, and anything genuinely served by
 * its `//` + `/* *\/` default (C-likes, Go, Rust, Swift, JSON, SCSS, GraphQL's
 * cousins) is left out rather than restated. Keys are Shiki filetype ids, which
 * is what the editor resolves a file's name to — see `getFiletypeFromFileName`.
 */
export const LANGUAGE_COMMENTS: LanguageComments = {
  // `#` families.
  toml: HASH,
  properties: HASH,
  graphql: HASH,
  elixir: HASH,
  crystal: HASH,
  nim: HASH,
  tcl: HASH,
  awk: HASH,
  cmake: HASH,
  apache: HASH,
  nginx: HASH,
  terraform: { lineComment: "#", blockComment: ["/*", "*/"] },
  tf: { lineComment: "#", blockComment: ["/*", "*/"] },
  hcl: { lineComment: "#", blockComment: ["/*", "*/"] },
  nix: { lineComment: "#", blockComment: ["/*", "*/"] },
  // `--` families.
  haskell: DASH_BRACE,
  elm: DASH_BRACE,
  purescript: DASH_BRACE,
  ada: { lineComment: "--" },
  vhdl: { lineComment: "--" },
  // `%` families.
  erlang: PERCENT,
  latex: PERCENT,
  bibtex: PERCENT,
  matlab: { lineComment: "%", blockComment: ["%{", "%}"] },
  fortran: { lineComment: "!" },
  "fortran-free-form": { lineComment: "!" },
  "fortran-fixed-form": { lineComment: "c " },
  // `;` families.
  lisp: SEMI,
  commonlisp: SEMI,
  "emacs-lisp": SEMI,
  scheme: SEMI,
  racket: SEMI,
  asm: SEMI,
  // Markup, where a line comment would be a syntax error.
  vue: MARKUP,
  svelte: MARKUP,
  astro: MARKUP,
  ocaml: { lineComment: null, blockComment: ["(*", "*)"] },
  vimscript: { lineComment: '"' },
};

/**
 * Bindings layered over the editor's defaults.
 *
 * The defaults already carry the IDE staples — ⌘/ comment, ⇧⌥A block comment,
 * ⌥↑/↓ move line, ⇧⌥↑/↓ copy line, ⌘[ / ⌘] indent, ⌘↑/↓ document ends. These
 * add the two gestures this app's users reach for that they do not cover.
 * ⌘⇧K has no command behind it — see `deleteLinesEdits`.
 */
export const EDITOR_KEYMAP: EditorKeymap = [
  {
    bindings: {
      "cmdOrCtrl+shift+d": "copyLineDown",
      "cmdOrCtrl+shift+Enter": "insertBlankLine",
    },
  },
];

const sortDesc = (edits: TextEdit[]): TextEdit[] =>
  [...edits].sort(
    (a, b) =>
      b.range.start.line - a.range.start.line ||
      b.range.start.character - a.range.start.character
  );

/** Merge sorted, unique line numbers into contiguous [lo, hi] runs. */
function toRuns(sorted: ReadonlyArray<number>): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  for (const n of sorted) {
    const last = runs[runs.length - 1];
    if (last !== undefined && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  return runs;
}

/** Delete each contiguous run of lines, including its line break. */
export function deleteLinesEdits(
  lines: ReadonlyArray<string>,
  lineNums: ReadonlyArray<number>
): TextEdit[] {
  const last = lines.length - 1;
  return sortDesc(
    toRuns([...lineNums]).map(([lo, hi]) => {
      if (hi < last)
        return {
          range: {
            start: { line: lo, character: 0 },
            end: { line: hi + 1, character: 0 },
          },
          newText: "",
        };
      // Run reaches the final line: also swallow the preceding break.
      return {
        range: {
          start:
            lo > 0
              ? { line: lo - 1, character: lines[lo - 1].length }
              : { line: 0, character: 0 },
          end: { line: hi, character: lines[hi].length },
        },
        newText: "",
      };
    })
  );
}

/**
 * Where the caret belongs once those lines are gone: the start of whatever
 * moved up into the first deleted line's place, indented as it is — which is
 * where an IDE leaves it, ready to keep deleting. Deleting through the end of
 * the file leaves it on the last line that survived, there being nothing below
 * to take the place.
 */
export function caretAfterDelete(
  lines: ReadonlyArray<string>,
  lineNums: ReadonlyArray<number>
): { readonly line: number; readonly character: number } {
  const first = lineNums[0];
  if (first === undefined) return { line: 0, character: 0 };
  const gone = new Set(lineNums);
  const survivors = lines.filter((_, n) => !gone.has(n));
  const line = Math.max(0, Math.min(first, survivors.length - 1));
  const text = survivors[line] ?? "";
  return { line, character: text.length - text.trimStart().length };
}
