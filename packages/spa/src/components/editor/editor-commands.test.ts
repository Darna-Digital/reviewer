import { describe, expect, it } from "vitest";
import { getFiletypeFromFileName } from "@pierre/diffs";
import type { TextEdit } from "@pierre/diffs/edit";
import {
  EDITOR_KEYMAP,
  LANGUAGE_COMMENTS,
  caretAfterDelete,
  deleteLinesEdits,
} from "./editor-commands";
import { filetypeOf } from "./highlighter";

// Apply line/character TextEdits (sorted bottom-up, non-overlapping) to text.
function apply(text: string, edits: TextEdit[]): string {
  const lines = text.split("\n");
  const offset = (line: number, ch: number) => {
    let o = 0;
    for (let i = 0; i < line; i++) o += lines[i].length + 1;
    return o + ch;
  };
  let out = text;
  for (const e of edits) {
    const s = offset(e.range.start.line, e.range.start.character);
    const en = offset(e.range.end.line, e.range.end.character);
    out = out.slice(0, s) + e.newText + out.slice(en);
  }
  return out;
}

const remove = (text: string, lineNums: number[]) =>
  apply(text, deleteLinesEdits(text.split("\n"), lineNums));

describe("LANGUAGE_COMMENTS", () => {
  // The editor keys this map by the filetype a *path* resolves to, so a right
  // token under the wrong key is silently no configuration at all.
  const tokenFor = (path: string) =>
    LANGUAGE_COMMENTS[getFiletypeFromFileName(path)]?.lineComment;

  it("reaches the filetypes real paths resolve to", () => {
    expect(tokenFor("Cargo.toml")).toBe("#");
    expect(tokenFor("schema.graphql")).toBe("#");
    expect(tokenFor("main.tf")).toBe("#");
    expect(tokenFor("flake.nix")).toBe("#");
    expect(tokenFor("Lib.hs")).toBe("--");
    expect(tokenFor("Main.elm")).toBe("--");
    expect(tokenFor("server.erl")).toBe("%");
    expect(tokenFor("core.scm")).toBe(";");
    expect(tokenFor("app.ex")).toBe("#");
  });

  it("leaves markup without a line comment, and gives it a block one", () => {
    for (const path of ["App.vue", "App.svelte", "index.astro"]) {
      const config = LANGUAGE_COMMENTS[getFiletypeFromFileName(path)];
      expect(config?.lineComment).toBeNull();
      expect(config?.blockComment).toEqual(["<!--", "-->"]);
    }
  });

  it("stays out of the way where the library already knows the answer", () => {
    // Its own table covers these, and its `//` default covers the C-likes.
    for (const path of ["a.py", "a.yaml", "a.sql", "a.css", "a.html", "a.md"]) {
      expect(LANGUAGE_COMMENTS[getFiletypeFromFileName(path)]).toBeUndefined();
    }
    for (const path of ["a.ts", "a.go", "a.rs", "a.java"]) {
      expect(LANGUAGE_COMMENTS[getFiletypeFromFileName(path)]).toBeUndefined();
    }
  });
});

describe("filetypeOf", () => {
  it("reads a dotted env file as an env file, not as plain text", () => {
    expect(getFiletypeFromFileName(".env.local")).toBe("text");
    expect(filetypeOf(".env.local")).toBe("dotenv");
    expect(filetypeOf("apps/web/.env.production")).toBe("dotenv");
  });

  it("leaves every filetype that resolves on its own alone", () => {
    expect(filetypeOf("src/a.ts")).toBe("typescript");
    expect(filetypeOf(".env")).toBe("dotenv");
    expect(filetypeOf("notes.txt")).toBe("text");
    // Not an env file, whatever the name looks like.
    expect(filetypeOf("environment.txt")).toBe("text");
  });
});

describe("EDITOR_KEYMAP", () => {
  it("adds gestures the editor has no default binding for", () => {
    const bindings = EDITOR_KEYMAP.flatMap((group) =>
      Object.entries(group.bindings)
    );
    expect(Object.fromEntries(bindings)).toEqual({
      "cmdOrCtrl+shift+d": "copyLineDown",
      "cmdOrCtrl+shift+Enter": "insertBlankLine",
    });
  });

  it("leaves the defaults the editor already binds to the editor", () => {
    const bound = EDITOR_KEYMAP.flatMap((group) => Object.keys(group.bindings));
    // ⌘/ comment, ⇧⌥A block comment, ⌥↑/↓ move line — all the editor's own.
    expect(bound).not.toContain("cmdOrCtrl+/");
    expect(bound).not.toContain("shift+alt+a");
    expect(bound).not.toContain("alt+ArrowUp");
  });
});

describe("deleteLinesEdits", () => {
  it("removes a single line with its break", () => {
    expect(remove("a\nb\nc", [1])).toBe("a\nc");
  });

  it("removes a contiguous run in one edit", () => {
    expect(deleteLinesEdits("a\nb\nc\nd".split("\n"), [1, 2])).toHaveLength(1);
    expect(remove("a\nb\nc\nd", [1, 2])).toBe("a\nd");
  });

  it("removes separate runs without disturbing what is between them", () => {
    expect(remove("a\nb\nc\nd\ne", [0, 3])).toBe("b\nc\ne");
  });

  it("swallows the preceding break when the run reaches the last line", () => {
    expect(remove("a\nb\nc", [2])).toBe("a\nb");
    expect(remove("a\nb\nc", [1, 2])).toBe("a");
  });

  it("empties a file it is asked to delete entirely", () => {
    expect(remove("a\nb", [0, 1])).toBe("");
  });

  it("has nothing to do for an empty selection", () => {
    expect(deleteLinesEdits("a\nb".split("\n"), [])).toEqual([]);
  });
});

describe("caretAfterDelete", () => {
  const lines = ["const a = 1;", "  const b = 2;", "    const c = 3;", "}"];

  it("lands on the line that moved up, at its indentation", () => {
    expect(caretAfterDelete(lines, [1])).toEqual({ line: 1, character: 4 });
  });

  it("lands past a whole run, not inside it", () => {
    expect(caretAfterDelete(lines, [0, 1])).toEqual({ line: 0, character: 4 });
  });

  it("falls back to the last surviving line at the end of the file", () => {
    expect(caretAfterDelete(lines, [3])).toEqual({ line: 2, character: 4 });
  });

  it("counts only the lines actually deleted between the runs", () => {
    // Lines 0 and 2 go; line 1 moves up into line 0's place.
    expect(caretAfterDelete(lines, [0, 2])).toEqual({ line: 0, character: 2 });
  });

  it("sits at the top of a file it emptied", () => {
    expect(caretAfterDelete(lines, [0, 1, 2, 3])).toEqual({
      line: 0,
      character: 0,
    });
  });
});
