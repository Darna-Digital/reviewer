import { describe, expect, it } from "vitest";
import { INITIAL_VIM_STATE } from "../interfaces/vim.interfaces";
import type { VimPosition, VimState } from "../interfaces/vim.interfaces";
import { afterPointerPress, onVimKey } from "./vim.functions";

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
  readonly folds: ReadonlyArray<string>;
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
  folds: [],
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
      folds:
        outcome.fold === undefined
          ? current.folds
          : [...current.folds, `${outcome.fold}@${outcome.caret.line}`],
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
    // `cw` on a word is `ce`, not `dw` and insert: the space after the word
    // stays, so what is typed does not run into the next one.
    expect(changed.text.split("\n")[0]).toBe(" greeting = 'hello';");
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

  it("leaves keys that spell no motion to the editor", () => {
    expect(chord("PageDown", {}).handled).toBe(false);
    expect(chord("Tab", {}).handled).toBe(false);
    expect(chord("F5", {}).handled).toBe(false);
  });
});

describe("the navigation keys", () => {
  it("moves with the arrows as it does with hjkl", () => {
    expect(type(open(), ["ArrowRight", "ArrowRight"]).caret).toEqual({
      line: 0,
      character: 2,
    });
    expect(type(open(), ["ArrowDown", "ArrowDown"]).caret.line).toBe(2);
    expect(type(open(), ["ArrowDown", "ArrowUp"]).caret.line).toBe(0);
    expect(type(open(), ["ArrowLeft"]).caret.character).toBe(0);
    expect(type(open(), ["ArrowDown", "Home"]).caret).toEqual({
      line: 1,
      character: 0,
    });
    expect(type(open(), ["End"]).caret.character).toBe(
      "const greeting = 'hello';".length - 1
    );
  });

  it("takes a count, and an operator takes an arrow as its motion", () => {
    expect(type(open(), ["3", "ArrowRight"]).caret.character).toBe(3);
    // `d→` is `dl`: one character gone, the rest of the line where it was.
    expect(type(open(), ["d", "ArrowRight"]).text.split("\n")[0]).toBe(
      "onst greeting = 'hello';"
    );
    // `d↓` is `dj`: this line and the one below it, taken whole.
    expect(type(open(), ["d", "ArrowDown"]).text.split("\n")[0]).toBe("");
  });

  it("keeps visual mode rather than collapsing it", () => {
    const selecting = type(open(), ["v", "ArrowDown", "ArrowRight"]);
    expect(selecting.state.mode).toBe("visual");
    expect(selecting.state.anchor).toEqual({ line: 0, character: 0 });
    expect(selecting.caret).toEqual({ line: 1, character: 1 });
    expect(selecting.handled).toBe(true);
  });

  it("does not let an arrow become the character `f` is waiting for", () => {
    const after = type(open(), ["f", "ArrowRight"]);
    // The half-typed command is dropped, and the caret has not gone looking
    // for an "l" — but the keystroke is still Vim's, not the editor's.
    expect(after.state.pending).toBe("");
    expect(after.caret).toEqual({ line: 0, character: 0 });
    expect(after.handled).toBe(true);
    expect(type(open(), ["d", "f", "ArrowLeft"]).text).toBe(FILE);
  });

  it("still leaves the arrows to the editor while inserting", () => {
    const inserting = type(open(), ["i", "ArrowRight"]);
    expect(inserting.handled).toBe(false);
    expect(inserting.state.mode).toBe("insert");
  });
});

describe("folding", () => {
  it("asks the view to fold rather than touching the buffer", () => {
    const folded = type(open(FILE, { line: 3, character: 0 }), ["z", "a"]);
    expect(folded.folds).toEqual(["toggle@3"]);
    expect(folded.text).toBe(FILE);
  });

  it("spells the rest of the z commands", () => {
    expect(type(open(), ["z", "c"]).folds).toEqual(["close@0"]);
    expect(type(open(), ["z", "o"]).folds).toEqual(["open@0"]);
    expect(type(open(), ["z", "M"]).folds).toEqual(["closeAll@0"]);
    expect(type(open(), ["z", "R"]).folds).toEqual(["openAll@0"]);
  });

  it("waits for the second key, and drops a pair that spells nothing", () => {
    expect(type(open(), ["z"]).state.pending).toBe("z");
    const nonsense = type(open(), ["z", "q"]);
    expect(nonsense.folds).toEqual([]);
    expect(nonsense.text).toBe(FILE);
  });

  it("folds from visual mode too, where the same keys mean the same thing", () => {
    expect(type(open(), ["v", "j", "z", "a"]).folds).toEqual(["toggle@1"]);
  });
});

describe("a press in the code", () => {
  it("ends visual mode, because the press collapsed what it was measuring", () => {
    const visual = type(open(), ["v", "j"]).state;
    expect(visual.mode).toBe("visual");
    const after = afterPointerPress(visual);
    expect(after.mode).toBe("normal");
    expect(after.anchor).toBeNull();
  });

  it("ends visual-line mode too", () => {
    expect(afterPointerPress(type(open(), ["V"]).state).mode).toBe("normal");
  });

  it("drops a half-typed command with it", () => {
    const pending = type(open(), ["v", "2", "d"]).state;
    expect(afterPointerPress(pending).pending).toBe("");
  });

  it("leaves normal and insert mode exactly as they were", () => {
    const normal = INITIAL_VIM_STATE;
    expect(afterPointerPress(normal)).toBe(normal);
    const inserting = type(open(), ["i"]).state;
    expect(afterPointerPress(inserting)).toBe(inserting);
  });
});

describe("where Vim's own special cases are", () => {
  it("changes only the word with cw, leaving the space after it", () => {
    // `cw` is `ce`, not `dw` and insert — otherwise what is typed runs into the
    // next word.
    const changed = type(open("foo bar"), ["c", "w"]);
    expect(changed.text).toBe(" bar");
    expect(changed.state.mode).toBe("insert");
  });

  it("changes only to the end of the word from inside it", () => {
    // `ce` from here would run on to the end of `bar`; `cw` stops at `foo`.
    expect(
      type(open("foo bar", { line: 0, character: 2 }), ["c", "w"]).text
    ).toBe("fo bar");
  });

  it("counts whole words for c2w", () => {
    expect(type(open("foo bar baz"), ["c", "2", "w"]).text).toBe(" baz");
  });

  it("changes the whitespace itself when the caret is standing on it", () => {
    // Nothing special about `cw` on a blank: it is `dw`, as in Vim.
    expect(
      type(open("a   b", { line: 0, character: 1 }), ["c", "w"]).text
    ).toBe("ab");
  });

  it("stops dw at the end of a line rather than joining the next one", () => {
    const one = type(open("foo bar\nbaz qux", { line: 0, character: 4 }), [
      "d",
      "w",
    ]);
    expect(one.text).toBe("foo \nbaz qux");
    // Which is what the register holds too — no line break came with it.
    expect(one.state.register).toEqual({ text: "bar", linewise: false });
    // The rule counts words, not lines: `d2w` still stops at the end of the one
    // the second word is on.
    expect(type(open("foo bar\nbaz"), ["d", "2", "w"]).text).toBe("\nbaz");
  });

  it("still joins when the caret is on a line's trailing space", () => {
    // No word was moved over, so the special case does not apply.
    expect(
      type(open("foo   \nbar", { line: 0, character: 4 }), ["d", "w"]).text
    ).toBe("foo bar");
  });

  it("counts an empty line as a word of its own", () => {
    const file = "a\n\nb";
    expect(type(open(file), ["w"]).caret).toEqual({ line: 1, character: 0 });
    expect(type(open(file), ["w", "w"]).caret).toEqual({
      line: 2,
      character: 0,
    });
    expect(type(open(file, { line: 2, character: 0 }), ["b"]).caret).toEqual({
      line: 1,
      character: 0,
    });
  });
});

describe("a motion that cannot be made", () => {
  it("takes the whole operator with it rather than half of one", () => {
    // `dfZ` with no Z on the line used to fall back on a zero-width range that
    // the inclusive bump still turned into one deleted character.
    expect(type(open("abc"), ["d", "f", "Z"]).text).toBe("abc");
    expect(type(open("a ( b"), ["f", "(", "d", "%"]).text).toBe("a ( b");
    expect(type(open("abc"), ["d", "[", "{"]).text).toBe("abc");
  });

  it("refuses dj on the last line and dk on the first", () => {
    expect(type(open("a\nb", { line: 1, character: 0 }), ["d", "j"]).text).toBe(
      "a\nb"
    );
    expect(type(open("a\nb"), ["d", "k"]).text).toBe("a\nb");
    // And a count that reaches past the end takes nothing at all.
    expect(type(open("a\nb\nc"), ["d", "3", "j"]).text).toBe("a\nb\nc");
  });

  it("still lets a plain motion stop where the file does", () => {
    expect(
      type(open("a\nb", { line: 1, character: 0 }), ["j"]).caret.line
    ).toBe(1);
    expect(type(open("abc"), ["f", "Z"]).caret.character).toBe(0);
  });

  it("keeps dd counting to the end of the file, which is not a failure", () => {
    expect(
      type(open("a\nb", { line: 1, character: 0 }), ["2", "d", "d"]).text
    ).toBe("a");
  });
});

describe("f, F, t and T", () => {
  const LINE = "a,b,c";

  it("counts occurrences rather than starting the search short of them", () => {
    expect(type(open(LINE), ["2", "f", ","]).caret.character).toBe(3);
    expect(type(open(LINE), ["2", "t", ","]).caret.character).toBe(2);
    expect(
      type(open(LINE, { line: 0, character: 4 }), ["2", "T", ","]).caret
        .character
    ).toBe(2);
  });

  it("stops before the very next character, and dt takes only what is behind it", () => {
    expect(type(open("a,,b"), ["d", "t", ","]).text).toBe(",,b");
    // The motion stands still, and the operator still takes the character the
    // caret is on — exactly as Vim does.
    expect(type(open("a,b"), ["t", ","]).caret.character).toBe(0);
  });
});

describe("the caret after an edit", () => {
  it("never sits past the end of the line the delete leaves behind", () => {
    // Deleting to the end of the buffer used to leave the caret measured
    // against the longer line that had just gone.
    const run = type(open("ab\ncd", { line: 1, character: 1 }), [
      "v",
      "k",
      "d",
    ]);
    expect(run.text).toBe("a");
    expect(run.caret).toEqual({ line: 0, character: 0 });
  });

  it("lands on the last character replaced by a counted r", () => {
    const run = type(open("abcd"), ["3", "r", "z"]);
    expect(run.text).toBe("zzzd");
    expect(run.caret).toEqual({ line: 0, character: 2 });
  });

  it("leaves a counted r alone when the line is too short for it", () => {
    expect(type(open("ab"), ["3", "r", "z"]).text).toBe("ab");
  });
});

describe("J, as Vim spells it", () => {
  it("keeps the white space a line already ends with rather than adding more", () => {
    const run = type(open("foo   \n  bar"), ["J"]);
    expect(run.text).toBe("foo   bar");
    expect(run.caret).toEqual({ line: 0, character: 6 });
  });

  it("closes a continuation up against the line it continues", () => {
    expect(type(open("call(a,\n  )"), ["J"]).text).toBe("call(a,)");
  });

  it("leaves the caret on the seam it last closed", () => {
    const run = type(open("a\nb\nc\nd"), ["3", "J"]);
    expect(run.text).toBe("a b c\nd");
    expect(run.caret).toEqual({ line: 0, character: 3 });
  });
});
