import { describe, expect, it } from "vitest";
import type { TextEdit } from "@pierre/diffs/edit";
import {
  deleteLinesEdits,
  duplicateLinesEdits,
  lineCommentToken,
  toggleLineCommentEdits,
} from "./editor-commands";

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

const toggle = (text: string, lineNums: number[], token: string) =>
  apply(text, toggleLineCommentEdits(text.split("\n"), lineNums, token));
const duplicate = (text: string, lineNums: number[]) =>
  apply(text, duplicateLinesEdits(text.split("\n"), lineNums));
const remove = (text: string, lineNums: number[]) =>
  apply(text, deleteLinesEdits(text.split("\n"), lineNums));

describe("lineCommentToken", () => {
  it("maps by filetype", () => {
    expect(lineCommentToken(".env")).toBe("#");
    expect(lineCommentToken("a.ts")).toBe("//");
    expect(lineCommentToken("q.sql")).toBe("--");
    expect(lineCommentToken("c.yaml")).toBe("#");
  });
  it("falls back to # for env-like files the grammar calls text", () => {
    expect(lineCommentToken(".env.local")).toBe("#");
    expect(lineCommentToken("app/.env.production")).toBe("#");
  });
  it("returns null when unknown", () => {
    expect(lineCommentToken("notes.txt")).toBeNull();
  });
});

describe("toggleLineCommentEdits", () => {
  it("comments a single line", () => {
    expect(toggle("FOO=bar", [0], "#")).toBe("# FOO=bar");
  });
  it("uncomments a commented line", () => {
    expect(toggle("# FOO=bar", [0], "#")).toBe("FOO=bar");
  });
  it("keeps indentation and aligns at the shallowest indent", () => {
    expect(toggle("    const a = 1", [0], "//")).toBe("    // const a = 1");
    const src = "  a\n      b";
    expect(toggle(src, [0, 1], "//")).toBe("  // a\n  //     b");
  });
  it("comments all lines when the range is mixed", () => {
    expect(toggle("#a\nb", [0, 1], "#")).toBe("# #a\n# b");
  });
  it("ignores blank lines", () => {
    expect(toggle("a\n\nb", [0, 1, 2], "#")).toBe("# a\n\n# b");
  });
});

describe("duplicateLinesEdits", () => {
  it("duplicates a line below itself", () => {
    expect(duplicate("a\nb\nc", [1])).toBe("a\nb\nb\nc");
  });
  it("duplicates a contiguous run", () => {
    expect(duplicate("a\nb\nc", [0, 1])).toBe("a\nb\na\nb\nc");
  });
});

describe("deleteLinesEdits", () => {
  it("deletes a middle line", () => {
    expect(remove("a\nb\nc", [1])).toBe("a\nc");
  });
  it("deletes the last line with its preceding break", () => {
    expect(remove("a\nb", [1])).toBe("a");
  });
  it("deletes a contiguous run", () => {
    expect(remove("a\nb\nc\nd", [1, 2])).toBe("a\nd");
  });
});
