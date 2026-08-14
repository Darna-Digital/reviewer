/**
 * Editor commands pierre/diffs doesn't ship. Its `EditorCommand` set covers
 * indent/undo/find/move-line but has no toggle-comment, duplicate-line, or
 * delete-line — and no per-language comment tokens — so we implement them here
 * as pure `TextEdit[]` builders and drive the editor via `editor.applyEdits`.
 *
 * Edits are computed against the original line array and returned sorted
 * bottom-up so they can be applied sequentially without invalidating positions.
 */
import { getFiletypeFromFileName } from "@pierre/diffs";
import type { TextEdit } from "@pierre/diffs/edit";

// Line-comment token by Shiki filetype id (see getFiletypeFromFileName).
const HASH = new Set([
  "dotenv",
  "shellscript",
  "shell",
  "bash",
  "sh",
  "zsh",
  "fish",
  "yaml",
  "yml",
  "toml",
  "ini",
  "python",
  "ruby",
  "perl",
  "r",
  "makefile",
  "dockerfile",
  "properties",
  "gitignore",
  "nix",
  "elixir",
  "cmake",
  "coffee",
]);
const SLASH = new Set([
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "jsonc",
  "json5",
  "c",
  "cpp",
  "csharp",
  "java",
  "go",
  "rust",
  "swift",
  "kotlin",
  "scala",
  "php",
  "dart",
  "zig",
  "proto",
  "glsl",
  "scss",
  "less",
]);
const DASH = new Set(["sql", "lua", "haskell", "elm", "ada"]);
const SEMI = new Set(["clojure", "commonlisp", "lisp", "scheme"]);

/** The line-comment prefix for a path, or null when we don't know one. */
export function lineCommentToken(path: string): string | null {
  const t = getFiletypeFromFileName(path);
  if (HASH.has(t)) return "#";
  if (SLASH.has(t)) return "//";
  if (DASH.has(t)) return "--";
  if (SEMI.has(t)) return ";";
  // env files (e.g. `.env.local`) fall back to the "text" grammar.
  if (/(^|\/|\.)env(\.|$)/i.test(path)) return "#";
  return null;
}

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

/**
 * Toggle the line comment on the given lines: uncomment when every non-blank
 * target line is already commented, otherwise comment. Comments are inserted at
 * the shallowest indentation among the targets so they stay aligned; blank lines
 * are ignored.
 */
export function toggleLineCommentEdits(
  lines: ReadonlyArray<string>,
  lineNums: ReadonlyArray<number>,
  token: string
): TextEdit[] {
  const targets = lineNums.filter((n) => (lines[n] ?? "").trim().length > 0);
  if (targets.length === 0) return [];
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const commented = (l: string) => l.trimStart().startsWith(token);

  if (targets.every((n) => commented(lines[n]))) {
    return sortDesc(
      targets.map((n) => {
        const l = lines[n];
        const indent = indentOf(l);
        // Drop the token plus one following space, when present.
        const len =
          l[indent + token.length] === " " ? token.length + 1 : token.length;
        return {
          range: {
            start: { line: n, character: indent },
            end: { line: n, character: indent + len },
          },
          newText: "",
        };
      })
    );
  }

  const col = Math.min(...targets.map((n) => indentOf(lines[n])));
  return sortDesc(
    targets.map((n) => ({
      range: {
        start: { line: n, character: col },
        end: { line: n, character: col },
      },
      newText: `${token} `,
    }))
  );
}

/** Duplicate each contiguous run of lines directly below itself. */
export function duplicateLinesEdits(
  lines: ReadonlyArray<string>,
  lineNums: ReadonlyArray<number>
): TextEdit[] {
  return sortDesc(
    toRuns([...lineNums]).map(([lo, hi]) => ({
      range: {
        start: { line: hi, character: lines[hi].length },
        end: { line: hi, character: lines[hi].length },
      },
      newText: `\n${lines.slice(lo, hi + 1).join("\n")}`,
    }))
  );
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
