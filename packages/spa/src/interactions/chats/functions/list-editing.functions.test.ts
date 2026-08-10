import { describe, expect, it } from "vitest";
import {
  changedRange,
  continueList,
  shiftListIndent,
  type ComposerSelection,
} from "./list-editing.functions";

/** `|` marks the caret in these fixtures. */
function at(fixture: string): ComposerSelection {
  const caret = fixture.indexOf("|");
  const text = fixture.replace("|", "");
  return { text, selectionStart: caret, selectionEnd: caret };
}

function marked(result: ComposerSelection | null): string {
  if (result === null) return "<null>";
  return (
    result.text.slice(0, result.selectionStart) +
    "|" +
    result.text.slice(result.selectionEnd)
  );
}

describe("continueList", () => {
  it("opens the next numbered item", () => {
    expect(marked(continueList(at("1. task one|")))).toBe("1. task one\n2. |");
  });

  it("opens the next bullet", () => {
    expect(marked(continueList(at("- task one|")))).toBe("- task one\n- |");
  });

  it("carries an unchecked box onto the next item", () => {
    expect(marked(continueList(at("- [x] task one|")))).toBe(
      "- [x] task one\n- [ ] |"
    );
  });

  it("renumbers the items below an insertion", () => {
    expect(marked(continueList(at("1. one|\n2. two\n3. three")))).toBe(
      "1. one\n2. |\n3. two\n4. three"
    );
  });

  it("moves the text after the caret onto the new item", () => {
    expect(marked(continueList(at("1. one |two")))).toBe("1. one \n2. |two");
  });

  it("stays at the same depth as the item it continues", () => {
    expect(marked(continueList(at("1. one\n  1.1 sub|")))).toBe(
      "1. one\n  1.1 sub\n  1.2 |"
    );
  });

  it("outdents an empty sub-item instead of nesting further", () => {
    expect(marked(continueList(at("1. one\n  1.1 |")))).toBe("1. one\n2. |");
  });

  it("closes the list on an empty top-level item", () => {
    expect(marked(continueList(at("1. one\n2. |")))).toBe("1. one\n|");
  });

  it("leaves prose alone", () => {
    expect(continueList(at("just a sentence|"))).toBeNull();
  });

  it("does not mistake a leading year for a marker", () => {
    expect(continueList(at("2024 was a year|"))).toBeNull();
  });

  it("replaces the selection before continuing", () => {
    expect(
      marked(
        continueList({
          text: "1. one two",
          selectionStart: 7,
          selectionEnd: 10,
        })
      )
    ).toBe("1. one \n2. |");
  });
});

describe("changedRange", () => {
  it("narrows to the span that actually changed", () => {
    const before = "1. one\n2. two";
    const after = "1. one\n  1.1 two";
    const [start, end, replacement] = changedRange(before, after);
    expect(before.slice(0, start) + replacement + before.slice(end)).toBe(
      after
    );
    expect(before.slice(start, end)).toBe("2.");
    expect(replacement).toBe("  1.1");
  });

  it("reports an empty span for identical text", () => {
    expect(changedRange("same", "same")).toEqual([4, 4, ""]);
  });

  it("handles an insertion between repeated characters", () => {
    const [start, end, replacement] = changedRange("aaa", "aaaa");
    expect("aaa".slice(0, start) + replacement + "aaa".slice(end)).toBe("aaaa");
  });
});

describe("shiftListIndent", () => {
  it("nests an item under the one above it", () => {
    expect(marked(shiftListIndent(at("1. one\n2. two|"), 1))).toBe(
      "1. one\n  1.1 two|"
    );
  });

  it("numbers a third level under its parent", () => {
    expect(
      marked(shiftListIndent(at("1. one\n2. two\n  2.1 sub\n  2.2 deep|"), 1))
    ).toBe("1. one\n2. two\n  2.1 sub\n    2.1.1 deep|");
  });

  it("keeps the caret where it was in the text", () => {
    expect(marked(shiftListIndent(at("1. one\n2. tw|o"), 1))).toBe(
      "1. one\n  1.1 tw|o"
    );
  });

  it("outdents an item and renumbers the siblings it leaves behind", () => {
    expect(
      marked(shiftListIndent(at("1. one\n  1.1 two|\n  1.2 three"), -1))
    ).toBe("1. one\n2. two|\n  2.1 three");
  });

  it("indents every list line the selection touches", () => {
    const text = "1. one\n2. two\n3. three";
    const result = shiftListIndent(
      { text, selectionStart: 8, selectionEnd: text.length },
      1
    );
    expect(result?.text).toBe("1. one\n  1.1 two\n  1.2 three");
  });

  it("refuses to nest the first item of a list", () => {
    expect(shiftListIndent(at("1. one|"), 1)).toBeNull();
  });

  it("refuses to outdent a top-level item", () => {
    expect(shiftListIndent(at("1. one\n2. two|"), -1)).toBeNull();
  });

  it("keeps a bullet's character when nesting it", () => {
    expect(marked(shiftListIndent(at("- one\n- two|"), 1))).toBe(
      "- one\n  - two|"
    );
  });

  it("leaves prose to the browser's Tab handling", () => {
    expect(shiftListIndent(at("just a sentence|"), 1)).toBeNull();
  });
});
