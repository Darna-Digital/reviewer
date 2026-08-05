import { describe, expect, it } from "vitest";
import type { CompletionItem } from "@byconvo/core/language";
import {
  acceptedEdit,
  caretAfter,
  isEchoOfAccept,
  moveSelection,
  needsResolve,
  prefixOf,
  shouldRequest,
} from "./completion-state";

const item = (over: Partial<CompletionItem> = {}): CompletionItem => ({
  label: "greetSomeone",
  kind: "function",
  detail: "",
  insertText: "greetSomeone",
  sortText: "11",
  source: "",
  data: null,
  ...over,
});

describe("prefixOf", () => {
  it("takes the identifier before the caret", () => {
    expect(prefixOf({ lineText: "  const gre", character: 11 })).toBe("gre");
  });
});

describe("shouldRequest", () => {
  it("asks once an identifier has started", () => {
    expect(shouldRequest({ lineText: "  const g", character: 9 })).toBe(true);
  });
  it("asks right after a dot, before anything is typed", () => {
    expect(shouldRequest({ lineText: "who.", character: 4 })).toBe(true);
  });
  it("asks after other trigger characters", () => {
    expect(shouldRequest({ lineText: 'import "', character: 8 })).toBe(true);
    expect(shouldRequest({ lineText: "<", character: 1 })).toBe(true);
  });
  it("stays quiet on whitespace", () => {
    expect(shouldRequest({ lineText: "const ", character: 6 })).toBe(false);
    expect(shouldRequest({ lineText: "", character: 0 })).toBe(false);
  });
  it("stays quiet after a character that triggers nothing", () => {
    expect(shouldRequest({ lineText: "a + ", character: 4 })).toBe(false);
  });
});

describe("moveSelection", () => {
  it("moves down and up", () => {
    expect(moveSelection(0, 1, 3)).toBe(1);
    expect(moveSelection(2, -1, 3)).toBe(1);
  });
  it("wraps at both ends", () => {
    expect(moveSelection(2, 1, 3)).toBe(0);
    expect(moveSelection(0, -1, 3)).toBe(2);
  });
  it("stays at zero for an empty list", () => {
    expect(moveSelection(0, 1, 0)).toBe(0);
  });
});

describe("acceptedEdit", () => {
  it("replaces the typed prefix, not just inserting at the caret", () => {
    expect(
      acceptedEdit(item(), 4, { lineText: "  const gre", character: 11 })
    ).toEqual({
      line: 4,
      startCharacter: 8,
      endCharacter: 11,
      newText: "greetSomeone",
    });
  });

  it("inserts at the caret when nothing has been typed", () => {
    expect(
      acceptedEdit(item({ label: "at", insertText: "at" }), 0, {
        lineText: "who.",
        character: 4,
      })
    ).toEqual({
      line: 0,
      startCharacter: 4,
      endCharacter: 4,
      newText: "at",
    });
  });

  it("prefers the provider's insert text over the label", () => {
    const edit = acceptedEdit(
      item({ label: "greet", insertText: "greet()" }),
      1,
      { lineText: "gre", character: 3 }
    );
    expect(edit.newText).toBe("greet()");
  });

  it("falls back to the label when there is no insert text", () => {
    const edit = acceptedEdit(item({ insertText: "" }), 1, {
      lineText: "gre",
      character: 3,
    });
    expect(edit.newText).toBe("greetSomeone");
  });
});

describe("needsResolve", () => {
  it("resolves only what would need an import", () => {
    expect(needsResolve(item({ source: "./lib" }))).toBe(true);
    expect(needsResolve(item())).toBe(false);
  });
});

describe("caretAfter", () => {
  it("lands at the end of the inserted text", () => {
    const edit = acceptedEdit(item(), 3, { lineText: "gre", character: 3 });
    expect(caretAfter(edit)).toEqual({ line: 3, character: 12 });
  });

  it("accounts for the prefix the insertion replaced", () => {
    const edit = acceptedEdit(item(), 0, {
      lineText: "const q = gre",
      character: 13,
    });
    expect(caretAfter(edit)).toEqual({ line: 0, character: 22 });
  });
});

describe("isEchoOfAccept", () => {
  const caret = { line: 4, character: 12 };

  it("recognises the caret an accept left behind", () => {
    expect(isEchoOfAccept(caret, { line: 4, character: 12 })).toBe(true);
  });

  it("lets the list open again once the caret has moved", () => {
    expect(isEchoOfAccept(caret, { line: 4, character: 13 })).toBe(false);
    expect(isEchoOfAccept(caret, { line: 5, character: 12 })).toBe(false);
  });

  it("is never an echo when nothing was accepted", () => {
    expect(isEchoOfAccept(caret, null)).toBe(false);
  });
});
