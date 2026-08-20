import { describe, expect, it } from "vitest";
import { INITIAL_VIM_STATE } from "../interfaces/vim.interfaces";
import type { VimPosition, VimState } from "../interfaces/vim.interfaces";
import { onVimKey } from "./vim.functions";

const FILE = [
  "const greeting = 'hello';",
  "  const other = greeting;",
  "",
  "function main() {",
  "  return other;",
  "}",
].join("\n");

interface Editor {
  readonly text: string;
  readonly caret: VimPosition;
  readonly state: VimState;
  readonly handled: boolean;
  readonly history: ReadonlyArray<"undo" | "redo">;
}

/** Apply the edits a keystroke produced, exactly as the adapter would. */
function applyEdits(
  text: string,
  edits: ReadonlyArray<{
    range: { start: VimPosition; end: VimPosition };
    newText: string;
  }>
): string {
  const lines = text.split("\n");
  const offset = (at: VimPosition) => {
    let out = 0;
    for (let n = 0; n < at.line; n++) out += (lines[n] ?? "").length + 1;
    return out + at.character;
  };
  // Bottom-up, so each edit's offsets stay valid.
  const sorted = [...edits].sort(
    (a, b) => offset(b.range.start) - offset(a.range.start)
  );
  let out = text;
  for (const one of sorted) {
    out =
      out.slice(0, offset(one.range.start)) +
      one.newText +
      out.slice(offset(one.range.end));
  }
  return out;
}

const open = (
  text = FILE,
  caret: VimPosition = { line: 0, character: 0 }
): Editor => ({
  text,
  caret,
  state: INITIAL_VIM_STATE,
  handled: true,
  history: [],
});

/** Type a run of keys, one keystroke each, the way a user would. `C-x` is ⌃x. */
function type(editor: Editor, keys: ReadonlyArray<string>): Editor {
  let current = editor;
  for (const key of keys) {
    const ctrlKey = key.startsWith("C-");
    const outcome = onVimKey(
      current.state,
      current.text.split("\n"),
      current.caret,
      {
        key: ctrlKey ? key.slice(2) : key,
        ctrlKey,
        metaKey: false,
        altKey: false,
      }
    );
    current = {
      text: applyEdits(current.text, outcome.edits),
      caret: outcome.caret,
      state: outcome.state,
      handled: outcome.handled,
      history:
        outcome.history === undefined
          ? current.history
          : [...current.history, outcome.history],
    };
  }
  return current;
}

describe("motions", () => {
  it("moves with hjkl", () => {
    expect(type(open(), ["l", "l", "l"]).caret).toEqual({
      line: 0,
      character: 3,
    });
    expect(type(open(), ["j", "j"]).caret.line).toBe(2);
    expect(type(open(), ["j", "k"]).caret.line).toBe(0);
    // Nothing to the left of column zero, and no wrapping to the line above.
    expect(type(open(), ["h", "h"]).caret.character).toBe(0);
  });

  it("takes a count", () => {
    expect(type(open(), ["5", "l"]).caret.character).toBe(5);
    expect(type(open(), ["1", "2", "l"]).caret.character).toBe(12);
    expect(type(open(), ["3", "j"]).caret.line).toBe(3);
  });

  it("stops at the last character of a line, not past it", () => {
    const at = type(open(), ["$"]).caret;
    expect(at.character).toBe("const greeting = 'hello';".length - 1);
  });

  it("moves by words", () => {
    // const| greeting -> const |greeting
    expect(type(open(), ["w"]).caret.character).toBe(6);
    expect(type(open(), ["w", "w"]).caret.character).toBe(15);
    expect(type(open(), ["w", "b"]).caret.character).toBe(0);
    // `e` lands on the last character of the word, not after it.
    expect(type(open(), ["e"]).caret.character).toBe(4);
  });

  it("treats a big word as everything that is not a space", () => {
    const line = "a.b.c dd";
    expect(type(open(line), ["w"]).caret.character).toBe(1);
    expect(type(open(line), ["W"]).caret.character).toBe(6);
  });

  it("goes to the first non-blank of a line, and to the ends of the file", () => {
    expect(type(open(), ["j", "^"]).caret).toEqual({ line: 1, character: 2 });
    expect(type(open(), ["j", "0"]).caret).toEqual({ line: 1, character: 0 });
    expect(type(open(), ["G"]).caret.line).toBe(5);
    expect(type(open(), ["G", "g", "g"]).caret.line).toBe(0);
    // A count turns both into "go to this line".
    expect(type(open(), ["4", "G"]).caret.line).toBe(3);
    expect(type(open(), ["2", "g", "g"]).caret).toEqual({
      line: 1,
      character: 2,
    });
  });

  it("finds a character on the line, and stops before it with t", () => {
    expect(type(open(), ["f", "g"]).caret.character).toBe(6);
    expect(type(open(), ["t", "g"]).caret.character).toBe(5);
    expect(type(open(), ["f", "g", "f", "g"]).caret.character).toBe(13);
    expect(type(open(), ["$", "F", "="]).caret.character).toBe(15);
    // A character that is not there leaves the caret alone.
    expect(type(open(), ["f", "Z"]).caret.character).toBe(0);
  });

  it("moves half a page with ⌃d and ⌃u", () => {
    const long = Array.from({ length: 40 }, (_, n) => `line ${n}`).join("\n");
    const down = type(open(long), ["C-d"]);
    expect(down.caret.line).toBe(12);
    expect(type(down, ["C-u"]).caret.line).toBe(0);
  });
});

describe("insert mode", () => {
  it("is the editor's, so ordinary keys are left alone", () => {
    const editing = type(open(), ["i"]);
    expect(editing.state.mode).toBe("insert");
    const typed = type(editing, ["x"]);
    // Unhandled: the keystroke goes to the editor, which types it.
    expect(typed.handled).toBe(false);
    expect(typed.text).toBe(FILE);
  });

  it("is entered where each of i I a A asks for", () => {
    expect(type(open(), ["5", "l", "i"]).caret.character).toBe(5);
    expect(type(open(), ["5", "l", "a"]).caret.character).toBe(6);
    expect(type(open(), ["j", "I"]).caret).toEqual({ line: 1, character: 2 });
    expect(type(open(), ["A"]).caret.character).toBe(
      "const greeting = 'hello';".length
    );
  });

  it("opens a line below and above, keeping the indentation", () => {
    const below = type(open(), ["j", "o"]);
    expect(below.state.mode).toBe("insert");
    expect(below.text.split("\n")[2]).toBe("  ");
    expect(below.caret).toEqual({ line: 2, character: 2 });

    const above = type(open(), ["j", "O"]);
    expect(above.text.split("\n")[1]).toBe("  ");
    expect(above.caret).toEqual({ line: 1, character: 2 });
  });

  it("steps back one on the way out, as Vim does", () => {
    const back = type(type(open(), ["5", "l", "i"]), ["Escape"]);
    expect(back.state.mode).toBe("normal");
    expect(back.caret.character).toBe(4);
  });
});

describe("operators", () => {
  it("deletes a word", () => {
    expect(type(open(), ["d", "w"]).text.split("\n")[0]).toBe(
      "greeting = 'hello';"
    );
  });

  it("deletes to the end of a word, taking the character it lands on", () => {
    expect(type(open(), ["d", "e"]).text.split("\n")[0]).toBe(
      " greeting = 'hello';"
    );
  });

  it("deletes to the end of the line with D", () => {
    expect(type(open(), ["6", "l", "D"]).text.split("\n")[0]).toBe("const ");
  });

  it("deletes whole lines with dd, and counts them", () => {
    expect(type(open(), ["d", "d"]).text.split("\n")[0]).toBe(
      "  const other = greeting;"
    );
    const two = type(open(), ["2", "d", "d"]);
    expect(two.text.split("\n")[0]).toBe("");
    expect(two.text.split("\n")[1]).toBe("function main() {");
  });

  it("changes a word and leaves the caret typing", () => {
    const changed = type(open(), ["c", "w"]);
    expect(changed.state.mode).toBe("insert");
    expect(changed.text.split("\n")[0]).toBe("greeting = 'hello';");
    expect(changed.caret).toEqual({ line: 0, character: 0 });
  });

  it("changes a whole line but keeps its indentation", () => {
    const changed = type(open(), ["j", "c", "c"]);
    expect(changed.state.mode).toBe("insert");
    expect(changed.text.split("\n")[1]).toBe("  ");
    expect(changed.caret).toEqual({ line: 1, character: 2 });
  });

  it("scales the count on both sides of the operator", () => {
    expect(type(open(), ["2", "d", "w"]).text.split("\n")[0]).toBe(
      "= 'hello';"
    );
    expect(type(open(), ["d", "2", "w"]).text.split("\n")[0]).toBe(
      "= 'hello';"
    );
  });

  it("indents and outdents whole lines", () => {
    const indented = type(open(), [">", ">"]);
    expect(indented.text.split("\n")[0]).toBe("  const greeting = 'hello';");
    const back = type(open(), ["j", "<", "<"]);
    expect(back.text.split("\n")[1]).toBe("const other = greeting;");
  });

  it("leaves a blank line alone when indenting a run", () => {
    const indented = type(open(), ["3", ">", ">"]);
    expect(indented.text.split("\n")[2]).toBe("");
  });
});

describe("yank and put", () => {
  it("puts a yanked line below with p and above with P", () => {
    const put = type(open(), ["y", "y", "p"]);
    expect(put.text.split("\n").slice(0, 2)).toEqual([
      "const greeting = 'hello';",
      "const greeting = 'hello';",
    ]);
    expect(put.caret.line).toBe(1);

    const above = type(open(), ["j", "y", "y", "P"]);
    expect(above.text.split("\n")[1]).toBe("  const other = greeting;");
    expect(above.text.split("\n")[2]).toBe("  const other = greeting;");
  });

  it("puts a yanked word after the caret", () => {
    const put = type(open(), ["y", "w", "$", "p"]);
    expect(put.text.split("\n")[0]).toBe("const greeting = 'hello';const ");
  });

  it("puts what a delete took", () => {
    const moved = type(open(), ["d", "d", "p"]);
    expect(moved.text.split("\n").slice(0, 2)).toEqual([
      "  const other = greeting;",
      "const greeting = 'hello';",
    ]);
  });

  it("does nothing when there is nothing in the register", () => {
    expect(type(open(), ["p"]).text).toBe(FILE);
  });
});

describe("small edits", () => {
  it("deletes characters with x and X", () => {
    expect(type(open(), ["x"]).text.split("\n")[0]).toBe(
      "onst greeting = 'hello';"
    );
    expect(type(open(), ["3", "x"]).text.split("\n")[0]).toBe(
      "st greeting = 'hello';"
    );
    expect(type(open(), ["5", "l", "X"]).text.split("\n")[0]).toBe(
      "cons greeting = 'hello';"
    );
  });

  it("replaces the character under the caret with r", () => {
    expect(type(open(), ["r", "K"]).text.split("\n")[0]).toBe(
      "Konst greeting = 'hello';"
    );
    // The caret stays put, so `rx` can be repeated along a line.
    expect(type(open(), ["r", "K"]).caret).toEqual({ line: 0, character: 0 });
  });

  it("joins lines with J, collapsing the indentation to one space", () => {
    expect(type(open(), ["J"]).text.split("\n")[0]).toBe(
      "const greeting = 'hello'; const other = greeting;"
    );
  });

  it("asks the editor for undo and redo rather than reimplementing them", () => {
    expect(type(open(), ["u"]).history).toEqual(["undo"]);
    expect(type(open(), ["C-r"]).history).toEqual(["redo"]);
  });
});

describe("visual mode", () => {
  it("deletes what the motion covered, including the character under the caret", () => {
    const deleted = type(open(), ["v", "e", "d"]);
    expect(deleted.text.split("\n")[0]).toBe(" greeting = 'hello';");
    expect(deleted.state.mode).toBe("normal");
  });

  it("takes whole lines in V, however far along them the caret is", () => {
    const deleted = type(open(), ["5", "l", "V", "j", "d"]);
    expect(deleted.text.split("\n")[0]).toBe("");
    expect(deleted.text.split("\n")[1]).toBe("function main() {");
  });

  it("yanks a selection and leaves the buffer alone", () => {
    const yanked = type(open(), ["v", "e", "y"]);
    expect(yanked.text).toBe(FILE);
    expect(yanked.state.register).toEqual({ text: "const", linewise: false });
    expect(yanked.state.mode).toBe("normal");
  });

  it("changes a selection and leaves the caret typing", () => {
    const changed = type(open(), ["v", "e", "c"]);
    expect(changed.state.mode).toBe("insert");
    expect(changed.text.split("\n")[0]).toBe(" greeting = 'hello';");
  });

  it("leaves on a second v, and on Escape", () => {
    expect(type(open(), ["v", "v"]).state.mode).toBe("normal");
    expect(type(open(), ["v", "Escape"]).state.mode).toBe("normal");
    expect(type(open(), ["V", "Escape"]).state.anchor).toBe(null);
  });

  it("indents the selected lines", () => {
    const indented = type(open(), ["V", "j", ">"]);
    expect(indented.text.split("\n").slice(0, 2)).toEqual([
      "  const greeting = 'hello';",
      "    const other = greeting;",
    ]);
  });
});

describe("pending keys", () => {
  it("waits for the rest of a command rather than acting on a prefix", () => {
    const half = type(open(), ["2", "d"]);
    expect(half.state.pending).toBe("2d");
    expect(half.text).toBe(FILE);
    expect(half.handled).toBe(true);
  });

  it("drops a run that spells nothing, without touching the buffer", () => {
    const nonsense = type(open(), ["d", "z"]);
    expect(nonsense.state.pending).toBe("");
    expect(nonsense.text).toBe(FILE);
    // Still swallowed: a stray letter must never land in the buffer.
    expect(nonsense.handled).toBe(true);
  });

  it("abandons a half-typed command on Escape", () => {
    const abandoned = type(open(), ["2", "d", "Escape"]);
    expect(abandoned.state.pending).toBe("");
    expect(abandoned.text).toBe(FILE);
  });
});

describe("what Vim mode never takes", () => {
  const chord = (
    key: string,
    over: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }>
  ) =>
    onVimKey(
      INITIAL_VIM_STATE,
      FILE.split("\n"),
      { line: 0, character: 0 },
      {
        key,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        ...over,
      }
    );

  it("leaves the app's and the editor's chords alone", () => {
    // ⌘S save, ⌘F find, ⌘/ comment, ⌥↓ move line.
    expect(chord("s", { metaKey: true }).handled).toBe(false);
    expect(chord("f", { metaKey: true }).handled).toBe(false);
    expect(chord("/", { metaKey: true }).handled).toBe(false);
    expect(chord("ArrowDown", { altKey: true }).handled).toBe(false);
    // A ctrl chord Vim does not define is the app's too.
    expect(chord("k", { ctrlKey: true }).handled).toBe(false);
  });

  it("leaves the arrow keys to the editor", () => {
    expect(chord("ArrowLeft", {}).handled).toBe(false);
    expect(chord("Home", {}).handled).toBe(false);
  });
});
