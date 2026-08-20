import { describe, expect, it } from "vitest";
import { INITIAL_VIM_STATE } from "../interfaces/vim.interfaces";
import type { VimPosition } from "../interfaces/vim.interfaces";
import { onVimKey } from "./vim.functions";

const CODE = [
  "export function main(a, b) {", // 0
  "  if (a) {", //                    1
  "    return b;", //                 2
  "  }", //                           3
  "", //                              4
  "  return 0;", //                   5
  "}", //                             6
  "", //                              7
  "const other = [1, 2, 3];", //      8
].join("\n");

/** Where a run of keys leaves the caret, starting from `from`. */
function caretAfter(
  keys: ReadonlyArray<string>,
  from: VimPosition,
  text = CODE
): VimPosition {
  let state = INITIAL_VIM_STATE;
  let caret = from;
  for (const key of keys) {
    const outcome = onVimKey(state, text.split("\n"), caret, {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    });
    state = outcome.state;
    caret = outcome.caret;
  }
  return caret;
}

/** The text a run of keys deletes out of the file. */
function textAfter(keys: ReadonlyArray<string>, from: VimPosition): string {
  let state = INITIAL_VIM_STATE;
  let caret = from;
  let text = CODE;
  for (const key of keys) {
    const lines = text.split("\n");
    const outcome = onVimKey(state, lines, caret, {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    });
    const offset = (at: VimPosition) => {
      let out = 0;
      for (let n = 0; n < at.line; n++) out += (lines[n] ?? "").length + 1;
      return out + at.character;
    };
    for (const one of [...outcome.edits].sort(
      (a, b) => offset(b.range.start) - offset(a.range.start)
    )) {
      text =
        text.slice(0, offset(one.range.start)) +
        one.newText +
        text.slice(offset(one.range.end));
    }
    state = outcome.state;
    caret = outcome.caret;
  }
  return text;
}

describe("% — the matching bracket", () => {
  it("jumps from an opening brace to its partner", () => {
    // The `{` closing `main` is on line 0; its partner is line 6.
    expect(caretAfter(["%"], { line: 0, character: 27 })).toEqual({
      line: 6,
      character: 0,
    });
  });

  it("jumps back from a closing brace", () => {
    expect(caretAfter(["%"], { line: 6, character: 0 })).toEqual({
      line: 0,
      character: 27,
    });
  });

  it("looks ahead along the line, so it works from anywhere on it", () => {
    // From column 0 of `  if (a) {` the first bracket ahead is the `(`.
    expect(caretAfter(["%"], { line: 1, character: 0 })).toEqual({
      line: 1,
      character: 7,
    });
  });

  it("counts nesting rather than taking the first partner it sees", () => {
    // The inner `{` on line 1 closes on line 3, not on line 6.
    expect(caretAfter(["%"], { line: 1, character: 9 })).toEqual({
      line: 3,
      character: 2,
    });
  });

  it("handles square brackets too", () => {
    expect(caretAfter(["%"], { line: 8, character: 14 })).toEqual({
      line: 8,
      character: 22,
    });
  });

  it("stays put when the line carries no bracket", () => {
    expect(caretAfter(["%"], { line: 2, character: 4 })).toEqual({
      line: 2,
      character: 4,
    });
  });

  it("takes the bracket it lands on when an operator uses it", () => {
    // `d%` from the `[` removes the whole balanced run, walls included.
    expect(
      textAfter(["d", "%"], { line: 8, character: 14 }).split("\n")[8]
    ).toBe("const other = ;");
  });
});

describe("[{ ]} [( ]) — the walls of the enclosing block", () => {
  it("finds the brace above from inside the block", () => {
    expect(caretAfter(["[", "{"], { line: 2, character: 4 })).toEqual({
      line: 1,
      character: 9,
    });
  });

  it("finds the brace below from inside the block", () => {
    expect(caretAfter(["]", "}"], { line: 2, character: 4 })).toEqual({
      line: 3,
      character: 2,
    });
  });

  it("climbs a level when the motion is repeated", () => {
    // Twice out of `return b;` is the brace of `main`, not of the `if`.
    expect(caretAfter(["2", "[", "{"], { line: 2, character: 4 })).toEqual({
      line: 0,
      character: 27,
    });
    expect(caretAfter(["2", "]", "}"], { line: 2, character: 4 })).toEqual({
      line: 6,
      character: 0,
    });
  });

  it("finds an enclosing paren, not the nearest brace", () => {
    expect(caretAfter(["[", "("], { line: 0, character: 22 })).toEqual({
      line: 0,
      character: 20,
    });
  });

  it("stays put at the top level, where there is no block to leave", () => {
    expect(caretAfter(["[", "{"], { line: 8, character: 0 })).toEqual({
      line: 8,
      character: 0,
    });
  });
});

describe("{ } — paragraph jumps", () => {
  it("travels to the blank line below the run of code", () => {
    expect(caretAfter(["}"], { line: 1, character: 0 }).line).toBe(4);
  });

  it("travels to the blank line above", () => {
    expect(caretAfter(["{"], { line: 5, character: 0 }).line).toBe(4);
  });

  it("steps over a blank it is already sitting on", () => {
    expect(caretAfter(["}"], { line: 4, character: 0 }).line).toBe(7);
  });

  it("takes a count", () => {
    expect(caretAfter(["2", "}"], { line: 1, character: 0 }).line).toBe(7);
  });

  it("stops at the ends of the file rather than running off them", () => {
    expect(caretAfter(["9", "}"], { line: 0, character: 0 }).line).toBe(8);
    expect(caretAfter(["9", "{"], { line: 8, character: 0 }).line).toBe(0);
  });
});

describe("[[ ]] — section jumps", () => {
  it("travels to the next line at the left margin", () => {
    expect(caretAfter(["]", "]"], { line: 2, character: 4 }).line).toBe(6);
  });

  it("travels back to the previous one", () => {
    expect(caretAfter(["[", "["], { line: 5, character: 2 }).line).toBe(0);
  });
});

describe("what the bracket keys do not swallow", () => {
  it("waits for the second key rather than acting on `[` alone", () => {
    const outcome = onVimKey(
      INITIAL_VIM_STATE,
      CODE.split("\n"),
      { line: 2, character: 4 },
      { key: "[", ctrlKey: false, metaKey: false, altKey: false }
    );
    expect(outcome.state.pending).toBe("[");
    expect(outcome.handled).toBe(true);
  });

  it("drops a pair that spells nothing", () => {
    expect(caretAfter(["[", "z"], { line: 2, character: 4 })).toEqual({
      line: 2,
      character: 4,
    });
  });
});
