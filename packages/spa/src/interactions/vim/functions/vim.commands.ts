/**
 * Carrying a parsed Vim command out against the buffer.
 *
 * Everything here is expressed as `TextEdit`s plus where the caret ends up, so
 * the adapter can hand the whole thing to the editor in one `applyEdits` — one
 * batch, one undo, exactly as `u` expects. Nothing writes to the document
 * itself; the lines that come in are the lines the editor is showing.
 */
import type { TextEdit } from "@pierre/diffs/edit";
import type {
  VimCommand,
  VimInsertAt,
  VimOperator,
  VimOutcome,
  VimPosition,
  VimRegister,
  VimState,
} from "../interfaces/vim.interfaces";
import {
  applyMotion,
  clampCaret,
  firstNonBlank,
  isInclusive,
  isLinewise,
  lastColumn,
} from "./vim.motions";
import { isLinewiseObject, textObjectSpan } from "./vim.objects";

/** One level of indentation, matching what the editor inserts for Tab. */
const INDENT = "  ";

const NOTHING: ReadonlyArray<TextEdit> = [];

const edit = (
  start: VimPosition,
  end: VimPosition,
  newText: string
): TextEdit => ({
  range: {
    start: { line: start.line, character: start.character },
    end: { line: end.line, character: end.character },
  },
  newText,
});

/** Whether `a` comes before `b` in the buffer. */
export const precedes = (a: VimPosition, b: VimPosition): boolean =>
  a.line < b.line || (a.line === b.line && a.character < b.character);

const ordered = (a: VimPosition, b: VimPosition): [VimPosition, VimPosition] =>
  precedes(b, a) ? [b, a] : [a, b];

const sliceLines = (
  lines: ReadonlyArray<string>,
  from: VimPosition,
  to: VimPosition
): string => {
  if (from.line === to.line) {
    return (lines[from.line] ?? "").slice(from.character, to.character);
  }
  const head = (lines[from.line] ?? "").slice(from.character);
  const middle = lines.slice(from.line + 1, to.line);
  const tail = (lines[to.line] ?? "").slice(0, to.character);
  return [head, ...middle, tail].join("\n");
};

/** Whole lines `lo`..`hi`, and the range that takes them out with their break. */
function linewiseRange(
  lines: ReadonlyArray<string>,
  lo: number,
  hi: number
): { readonly from: VimPosition; readonly to: VimPosition } {
  const last = lines.length - 1;
  if (hi < last) {
    return {
      from: { line: lo, character: 0 },
      to: { line: hi + 1, character: 0 },
    };
  }
  // Reaching the final line: swallow the break in front of the run instead, so
  // the file does not end up with a stray empty line.
  return {
    from:
      lo > 0
        ? { line: lo - 1, character: (lines[lo - 1] ?? "").length }
        : { line: 0, character: 0 },
    to: { line: hi, character: (lines[hi] ?? "").length },
  };
}

const yankedLines = (
  lines: ReadonlyArray<string>,
  lo: number,
  hi: number
): VimRegister => ({
  text: `${lines.slice(lo, hi + 1).join("\n")}\n`,
  linewise: true,
});

/** An operator over whole lines: `dd`, `cc`, `yy`, `>>`, `<<`, and their visual twins. */
function operateOnLines(
  state: VimState,
  lines: ReadonlyArray<string>,
  operator: VimOperator,
  lo: number,
  hi: number
): VimOutcome {
  const top = Math.max(0, lo);
  const bottom = Math.min(hi, lines.length - 1);
  const register = yankedLines(lines, top, bottom);

  if (operator === "yank") {
    return {
      state: { ...state, mode: "normal", anchor: null, register, pending: "" },
      edits: NOTHING,
      caret: { line: top, character: firstNonBlank(lines[top] ?? "") },
      handled: true,
    };
  }

  if (operator === "indent" || operator === "outdent") {
    const edits: TextEdit[] = [];
    for (let line = bottom; line >= top; line--) {
      const text = lines[line] ?? "";
      if (text.trim().length === 0) continue;
      if (operator === "indent") {
        edits.push(
          edit({ line, character: 0 }, { line, character: 0 }, INDENT)
        );
        continue;
      }
      const indent = text.length - text.trimStart().length;
      const drop = Math.min(indent, INDENT.length);
      if (drop > 0) {
        edits.push(edit({ line, character: 0 }, { line, character: drop }, ""));
      }
    }
    const text = lines[top] ?? "";
    const shift =
      operator === "indent"
        ? INDENT.length
        : -Math.min(text.length - text.trimStart().length, INDENT.length);
    return {
      state: { ...state, mode: "normal", anchor: null, pending: "" },
      edits,
      caret: {
        line: top,
        character: Math.max(0, firstNonBlank(text) + shift),
      },
      handled: true,
    };
  }

  if (operator === "change") {
    // `cc` empties the lines and leaves one to type on, keeping the indent.
    const indent = (lines[top] ?? "").slice(
      0,
      (lines[top] ?? "").length - (lines[top] ?? "").trimStart().length
    );
    return {
      state: { ...state, mode: "insert", anchor: null, register, pending: "" },
      edits: [
        edit(
          { line: top, character: 0 },
          { line: bottom, character: (lines[bottom] ?? "").length },
          indent
        ),
      ],
      caret: { line: top, character: indent.length },
      handled: true,
    };
  }

  const { from, to } = linewiseRange(lines, top, bottom);
  const survivor = lines[Math.min(top, lines.length - (bottom - top + 1) - 1)];
  const landing = Math.max(
    0,
    Math.min(top, lines.length - (bottom - top + 1) - 1)
  );
  return {
    state: { ...state, mode: "normal", anchor: null, register, pending: "" },
    edits: [edit(from, to, "")],
    caret: {
      line: landing,
      character: firstNonBlank(
        (landing < top ? survivor : lines[bottom + 1]) ?? ""
      ),
    },
    handled: true,
  };
}

/** An operator over a character range: `dw`, `d$`, `y2w`, and the visual twins. */
function operateOnRange(
  state: VimState,
  lines: ReadonlyArray<string>,
  operator: VimOperator,
  a: VimPosition,
  b: VimPosition
): VimOutcome {
  const [from, to] = ordered(a, b);
  const text = sliceLines(lines, from, to);

  if (operator === "yank") {
    return {
      state: {
        ...state,
        mode: "normal",
        anchor: null,
        register: { text, linewise: false },
        pending: "",
      },
      edits: NOTHING,
      caret: from,
      handled: true,
    };
  }

  if (operator === "indent" || operator === "outdent") {
    return operateOnLines(state, lines, operator, from.line, to.line);
  }

  const mode = operator === "change" ? "insert" : "normal";
  return {
    state: {
      ...state,
      mode,
      anchor: null,
      register: { text, linewise: false },
      pending: "",
    },
    edits: [edit(from, to, "")],
    caret: mode === "insert" ? from : clampCaret(lines, from, false),
    handled: true,
  };
}

/** The two ends of the visual selection, in document order. */
export const visualRange = (
  state: VimState,
  caret: VimPosition
): [VimPosition, VimPosition] => ordered(state.anchor ?? caret, caret);

const stay = (state: VimState, caret: VimPosition): VimOutcome => ({
  state: { ...state, pending: "" },
  edits: NOTHING,
  caret,
  handled: true,
});

/** Where `i`, `a`, `I`, `A`, `o` and `O` each leave the caret typing. */
function enterInsert(
  state: VimState,
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  at: VimInsertAt
): VimOutcome {
  const text = lines[caret.line] ?? "";
  const typing = { ...state, mode: "insert" as const, anchor: null };
  const landing = (caretAt: VimPosition): VimOutcome => ({
    state: typing,
    edits: NOTHING,
    caret: caretAt,
    handled: true,
  });

  switch (at) {
    case "before":
      return landing(caret);
    case "after":
      return landing({
        line: caret.line,
        character: Math.min(caret.character + 1, text.length),
      });
    case "lineStart":
      return landing({ line: caret.line, character: firstNonBlank(text) });
    case "lineEnd":
      return landing({ line: caret.line, character: text.length });
    case "openBelow":
    case "openAbove": {
      // The new line starts where the old one's code does, which is what makes
      // `o` usable inside a block.
      const indent = text.slice(0, text.length - text.trimStart().length);
      const below = at === "openBelow";
      const put = below
        ? { line: caret.line, character: text.length }
        : { line: caret.line, character: 0 };
      return {
        state: typing,
        edits: [edit(put, put, below ? `\n${indent}` : `${indent}\n`)],
        caret: {
          line: below ? caret.line + 1 : caret.line,
          character: indent.length,
        },
        handled: true,
      };
    }
  }
}

/**
 * Run `command` against the buffer.
 *
 * `caret` is where the caret is now; the returned caret is where it belongs
 * once the edits have landed. Positions are always expressed against the lines
 * that came in, which is why the edits are safe to apply as one batch.
 */
export function runCommand(
  state: VimState,
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  command: VimCommand
): VimOutcome {
  const visual = state.mode === "visual" || state.mode === "visual-line";
  const cleared: VimState = { ...state, pending: "" };

  switch (command.kind) {
    case "move": {
      const to = applyMotion(
        lines,
        caret,
        command.motion,
        command.count,
        false
      );
      return stay(cleared, to);
    }

    case "escape":
      return {
        state: { ...cleared, mode: "normal", anchor: null },
        edits: NOTHING,
        caret: clampCaret(lines, caret, false),
        handled: true,
      };

    case "enterVisual": {
      const line = command.line;
      const already =
        (line && state.mode === "visual-line") ||
        (!line && state.mode === "visual");
      // Pressing `v` again in the same visual mode leaves it, as in Vim.
      return {
        state: {
          ...cleared,
          mode: already ? "normal" : line ? "visual-line" : "visual",
          anchor: already ? null : (state.anchor ?? caret),
        },
        edits: NOTHING,
        caret,
        handled: true,
      };
    }

    case "operateSelection": {
      const [from, to] = visualRange(state, caret);
      if (state.mode === "visual-line") {
        return operateOnLines(
          cleared,
          lines,
          command.operator,
          from.line,
          to.line
        );
      }
      // Visual mode's selection includes the character under the caret.
      const end = {
        line: to.line,
        character: Math.min(to.character + 1, (lines[to.line] ?? "").length),
      };
      return operateOnRange(cleared, lines, command.operator, from, end);
    }

    case "operateLines": {
      const lo = visual ? visualRange(state, caret)[0].line : caret.line;
      const hi = visual
        ? visualRange(state, caret)[1].line
        : Math.min(caret.line + command.count - 1, lines.length - 1);
      return operateOnLines(cleared, lines, command.operator, lo, hi);
    }

    case "operate": {
      if (isLinewise(command.motion)) {
        const to = applyMotion(
          lines,
          caret,
          command.motion,
          command.count,
          false
        );
        const [lo, hi] = [
          Math.min(caret.line, to.line),
          Math.max(caret.line, to.line),
        ];
        return operateOnLines(cleared, lines, command.operator, lo, hi);
      }
      const landed = applyMotion(
        lines,
        caret,
        command.motion,
        command.count,
        true
      );
      const [from, to] = ordered(caret, landed);
      // `de` and `df,` take the character they land on; `dw` stops before it.
      const end =
        isInclusive(command.motion) && command.motion.kind !== "lineEnd"
          ? {
              line: to.line,
              character: Math.min(
                to.character + 1,
                (lines[to.line] ?? "").length
              ),
            }
          : to;
      return operateOnRange(cleared, lines, command.operator, from, end);
    }

    case "deleteChar": {
      const text = lines[caret.line] ?? "";
      const from = command.before
        ? {
            line: caret.line,
            character: Math.max(0, caret.character - command.count),
          }
        : caret;
      const to = command.before
        ? caret
        : {
            line: caret.line,
            character: Math.min(caret.character + command.count, text.length),
          };
      if (from.character === to.character) return stay(cleared, caret);
      return {
        state: {
          ...cleared,
          register: {
            text: text.slice(from.character, to.character),
            linewise: false,
          },
        },
        edits: [edit(from, to, "")],
        caret: {
          line: caret.line,
          character: Math.max(
            0,
            Math.min(
              from.character,
              text.length - (to.character - from.character) - 1
            )
          ),
        },
        handled: true,
      };
    }

    case "replaceChar": {
      const text = lines[caret.line] ?? "";
      if (caret.character >= text.length) return stay(cleared, caret);
      return {
        state: cleared,
        edits: [
          edit(
            caret,
            { line: caret.line, character: caret.character + 1 },
            command.char
          ),
        ],
        caret,
        handled: true,
      };
    }

    case "insert":
      return enterInsert(cleared, lines, caret, command.at);

    case "put": {
      const register = state.register;
      if (register === null) return stay(cleared, caret);
      const body = register.text.repeat(command.count);
      if (register.linewise) {
        const at = command.after
          ? { line: caret.line, character: (lines[caret.line] ?? "").length }
          : { line: caret.line, character: 0 };
        const text = command.after ? `\n${body.replace(/\n$/, "")}` : body;
        return {
          state: cleared,
          edits: [edit(at, at, text)],
          caret: {
            line: caret.line + (command.after ? 1 : 0),
            character: firstNonBlank(body.split("\n")[0] ?? ""),
          },
          handled: true,
        };
      }
      const text = lines[caret.line] ?? "";
      const at = {
        line: caret.line,
        character: command.after
          ? Math.min(caret.character + 1, text.length)
          : caret.character,
      };
      const lastLine = body.split("\n").at(-1) ?? "";
      const spans = body.includes("\n");
      return {
        state: cleared,
        edits: [edit(at, at, body)],
        caret: spans
          ? {
              line: at.line + body.split("\n").length - 1,
              character: Math.max(0, lastLine.length - 1),
            }
          : {
              line: at.line,
              character: Math.max(0, at.character + body.length - 1),
            },
        handled: true,
      };
    }

    case "join": {
      const top = caret.line;
      const bottom = Math.min(
        top + Math.max(1, command.count - 1),
        lines.length - 1
      );
      if (bottom === top) return stay(cleared, caret);
      const head = lines[top] ?? "";
      const joined = lines
        .slice(top + 1, bottom + 1)
        .map((line) => line.trimStart());
      const text = [head.trimEnd(), ...joined]
        .filter((s) => s.length > 0)
        .join(" ");
      return {
        state: cleared,
        edits: [
          edit(
            { line: top, character: 0 },
            { line: bottom, character: (lines[bottom] ?? "").length },
            text
          ),
        ],
        caret: { line: top, character: Math.max(0, head.trimEnd().length) },
        handled: true,
      };
    }

    case "operateObject": {
      const span = textObjectSpan(lines, caret, command.object, command.around);
      if (span === null) return stay(cleared, caret);
      // `dip` takes whole lines, the way `dd` does, rather than emptying them.
      if (isLinewiseObject(command.object)) {
        return operateOnLines(
          cleared,
          lines,
          command.operator,
          span.start.line,
          span.end.line
        );
      }
      return operateOnRange(
        cleared,
        lines,
        command.operator,
        span.start,
        span.end
      );
    }

    case "selectObject": {
      const span = textObjectSpan(lines, caret, command.object, command.around);
      if (span === null) return stay(cleared, caret);
      const linewise = isLinewiseObject(command.object);
      // The anchor is the far end and the caret the near one, so a motion after
      // the object carries on extending from where it left the caret.
      return {
        state: {
          ...cleared,
          mode: linewise ? "visual-line" : "visual",
          anchor: span.start,
        },
        edits: NOTHING,
        caret: linewise
          ? { line: span.end.line, character: 0 }
          : {
              line: span.end.line,
              character: Math.max(span.start.character, span.end.character - 1),
            },
        handled: true,
      };
    }

    case "fold":
      return {
        state: cleared,
        edits: NOTHING,
        caret,
        handled: true,
        fold: command.action,
      };

    case "undo":
      return {
        state: cleared,
        edits: NOTHING,
        caret,
        handled: true,
        history: "undo",
      };
    case "redo":
      return {
        state: cleared,
        edits: NOTHING,
        caret,
        handled: true,
        history: "redo",
      };
  }
}

/** Where the caret goes when Escape leaves insert mode: one to the left, as in Vim. */
export const caretLeavingInsert = (
  lines: ReadonlyArray<string>,
  caret: VimPosition
): VimPosition =>
  clampCaret(
    lines,
    { line: caret.line, character: Math.max(0, caret.character - 1) },
    false
  );

export { lastColumn };
