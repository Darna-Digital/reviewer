import { describe, expect, it } from "vitest";
import { INITIAL_VIM_STATE } from "../interfaces/vim.interfaces";
import type { VimPosition } from "../interfaces/vim.interfaces";
import { onVimKey } from "./vim.functions";

const CODE = [
  "const greeting = 'hello world';", // 0
  "call(a, b);", //                     1
  "", //                                2
  "function main() {", //               3
  "  return greeting;", //              4
  "}", //                               5
].join("\n");

interface Run {
  readonly text: string;
  readonly caret: VimPosition;
  readonly anchor: VimPosition | null;
  readonly mode: string;
}

function type(
  keys: ReadonlyArray<string>,
  from: VimPosition,
  source = CODE
): Run {
  let state = INITIAL_VIM_STATE;
  let caret = from;
  let text = source;
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
  return { text, caret, anchor: state.anchor, mode: state.mode };
}

/** What a visual selection covers, as the text between its two ends. */
const selected = (run: Run, source = CODE): string => {
  const lines = source.split("\n");
  const offset = (at: VimPosition) => {
    let out = 0;
    for (let n = 0; n < at.line; n++) out += (lines[n] ?? "").length + 1;
    return out + at.character;
  };
  if (run.anchor === null) return "";
  const [a, b] = [offset(run.anchor), offset(run.caret) + 1].sort(
    (x, y) => x - y
  );
  return source.slice(a, b);
};

describe("viw — selecting the word you are on", () => {
  it("takes the whole word from anywhere inside it", () => {
    // Caret in the middle of `greeting`.
    const run = type(["v", "i", "w"], { line: 0, character: 9 });
    expect(run.mode).toBe("visual");
    expect(selected(run)).toBe("greeting");
  });

  it("takes it from the first character too", () => {
    expect(selected(type(["v", "i", "w"], { line: 0, character: 6 }))).toBe(
      "greeting"
    );
  });

  it("takes the run of punctuation as its own word", () => {
    // `(` in `call(a, b);`
    expect(selected(type(["v", "i", "w"], { line: 1, character: 4 }))).toBe(
      "("
    );
  });

  it("treats a big word as everything that is not a space", () => {
    expect(selected(type(["v", "i", "W"], { line: 1, character: 4 }))).toBe(
      "call(a,"
    );
  });

  it("takes the trailing space with `aw`", () => {
    expect(selected(type(["v", "a", "w"], { line: 0, character: 9 }))).toBe(
      "greeting "
    );
  });
});

describe("diw and friends — operators over an object", () => {
  it("deletes the word under the caret", () => {
    expect(
      type(["d", "i", "w"], { line: 0, character: 9 }).text.split("\n")[0]
    ).toBe("const  = 'hello world';");
  });

  it("deletes the word and its space with `daw`", () => {
    expect(
      type(["d", "a", "w"], { line: 0, character: 9 }).text.split("\n")[0]
    ).toBe("const = 'hello world';");
  });

  it("changes what is inside the quotes, leaving them standing", () => {
    const run = type(["c", "i", "'"], { line: 0, character: 20 });
    expect(run.text.split("\n")[0]).toBe("const greeting = '';");
    expect(run.mode).toBe("insert");
  });

  it("reaches a string the caret has not got to yet, as Vim does", () => {
    expect(
      type(["c", "i", "'"], { line: 0, character: 0 }).text.split("\n")[0]
    ).toBe("const greeting = '';");
  });

  it("takes the quotes too with `a`", () => {
    expect(
      type(["d", "a", "'"], { line: 0, character: 20 }).text.split("\n")[0]
    ).toBe("const greeting = ;");
  });

  it("deletes inside the parens the caret is within", () => {
    expect(
      type(["d", "i", "("], { line: 1, character: 6 }).text.split("\n")[1]
    ).toBe("call();");
  });

  it("takes the parens as well with `a(`", () => {
    expect(
      type(["d", "a", "b"], { line: 1, character: 6 }).text.split("\n")[1]
    ).toBe("call;");
  });

  it("yanks a braced block without touching it", () => {
    const run = type(["y", "i", "{"], { line: 4, character: 4 });
    expect(run.text).toBe(CODE);
  });

  it("deletes the paragraph the caret is in, linewise", () => {
    const run = type(["d", "i", "p"], { line: 0, character: 0 });
    expect(run.text.split("\n")[0]).toBe("");
    expect(run.text.split("\n")[1]).toBe("function main() {");
  });
});

describe("what an object does when there is none", () => {
  it("leaves the buffer alone outside any pair", () => {
    expect(type(["d", "i", "("], { line: 5, character: 0 }).text).toBe(CODE);
  });

  it("leaves it alone when the line carries no quote", () => {
    expect(type(["c", "i", '"'], { line: 3, character: 2 }).text).toBe(CODE);
  });

  it("waits for the object key rather than acting on `di`", () => {
    const run = type(["d", "i"], { line: 0, character: 9 });
    expect(run.text).toBe(CODE);
  });

  it("drops a pair that names nothing", () => {
    expect(type(["d", "i", "z"], { line: 0, character: 9 }).text).toBe(CODE);
  });
});

describe("visual objects and the ordinary ones together", () => {
  it("keeps extending after the object has been taken", () => {
    // `viw` then `l` reaches one character past the word.
    const run = type(["v", "i", "w", "l"], { line: 0, character: 9 });
    expect(selected(run)).toBe("greeting ");
  });

  it("takes whole lines for a paragraph", () => {
    const run = type(["v", "i", "p"], { line: 0, character: 0 });
    expect(run.mode).toBe("visual-line");
  });
});

describe("a block written across lines", () => {
  const BLOCK = [
    "function main() {",
    "  const a = 1;",
    "  return a;",
    "}",
  ].join("\n");

  it("takes the body as whole lines, leaving the braces where they are", () => {
    // Vim's own rule: nothing after the `{` and nothing but indent before the
    // `}` makes the inner block linewise, so `di{` empties the body rather than
    // closing the braces up into `{}`.
    const run = type(["d", "i", "{"], { line: 1, character: 2 }, BLOCK);
    expect(run.text).toBe("function main() {\n}");
  });

  it("leaves a line to type on when changing it, indented as the body was", () => {
    const run = type(["c", "i", "{"], { line: 1, character: 2 }, BLOCK);
    expect(run.text).toBe("function main() {\n  \n}");
    expect(run.mode).toBe("insert");
    expect(run.caret).toEqual({ line: 1, character: 2 });
  });

  it("selects it linewise", () => {
    expect(type(["v", "i", "{"], { line: 1, character: 2 }, BLOCK).mode).toBe(
      "visual-line"
    );
  });

  it("still takes the braces themselves with `a{`", () => {
    const run = type(["d", "a", "{"], { line: 1, character: 2 }, BLOCK);
    expect(run.text).toBe("function main() ");
  });

  it("holds no block at all when the braces are on consecutive lines", () => {
    const empty = "function main() {\n}";
    expect(type(["d", "i", "{"], { line: 0, character: 16 }, empty).text).toBe(
      empty
    );
  });

  it("stays a character range when the braces share a line with the body", () => {
    const inline = "const o = { a: 1 };";
    expect(type(["d", "i", "{"], { line: 0, character: 13 }, inline).text).toBe(
      "const o = {};"
    );
  });
});

describe("standing on the wall of a pair", () => {
  const CALL = "call(a, b);";

  it("counts the opening bracket as being inside, as Vim does", () => {
    expect(type(["d", "i", "("], { line: 0, character: 4 }, CALL).text).toBe(
      "call();"
    );
  });

  it("counts the closing one too", () => {
    expect(type(["d", "i", "("], { line: 0, character: 9 }, CALL).text).toBe(
      "call();"
    );
  });

  it("takes the walls with it for `a(`", () => {
    expect(type(["d", "a", "("], { line: 0, character: 4 }, CALL).text).toBe(
      "call;"
    );
  });

  it("finds the pair the caret is on rather than the one around it", () => {
    const nested = "f(g(x), y)";
    expect(type(["d", "i", "("], { line: 0, character: 3 }, nested).text).toBe(
      "f(g(), y)"
    );
  });
});

describe("angle brackets", () => {
  const GENERIC = "const m: Map<K, V> = new Map();";

  it("takes what is between them", () => {
    expect(
      type(["d", "i", "<"], { line: 0, character: 14 }, GENERIC).text
    ).toBe("const m: Map<> = new Map();");
  });

  it("takes them too with `a<`", () => {
    expect(
      type(["d", "a", "<"], { line: 0, character: 14 }, GENERIC).text
    ).toBe("const m: Map = new Map();");
  });

  it("is not something `%` goes looking for — a `<` is usually a comparison", () => {
    const compare = "if (a < b) {}";
    // From the `<`, `%` reads on to the `)` at column 9 and jumps to the `(`
    // that opened it, rather than pairing the comparison with anything.
    expect(type(["%"], { line: 0, character: 6 }, compare).caret).toEqual({
      line: 0,
      character: 3,
    });
  });
});
