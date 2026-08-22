// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Editor } from "@pierre/diffs/edit";
import { useVim } from "./vim.hook.adapter";

interface Position {
  readonly line: number;
  readonly character: number;
}
interface Selection {
  readonly start: Position;
  readonly end: Position;
  readonly direction: "forward" | "backward" | "none";
}

/**
 * A stand-in editor that answers about its selection the way the real one does:
 * as a span with the earlier end first, whichever end the caret is at. Reading
 * a caret back out of it is exactly what Vim mode cannot do, which is what
 * these tests are about.
 */
function fakeEditor(text: string) {
  let selection: Selection = {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
    direction: "none",
  };
  const setSelections = vi.fn((next: Array<Selection>) => {
    const [only] = next;
    if (only === undefined) return;
    const flipped =
      only.start.line > only.end.line ||
      (only.start.line === only.end.line &&
        only.start.character > only.end.character);
    selection = flipped
      ? { start: only.end, end: only.start, direction: only.direction }
      : only;
  });
  const editor = {
    getText: () => text,
    getState: () => ({ selections: [selection] }),
    setSelections,
    applyEdits: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  } as unknown as Editor<undefined>;
  return { editor, setSelections, at: () => selection };
}

const LINES = ["const alpha = 1;", "const beta = 22;", "const gamma = 333;"];

function mount(text: string) {
  const fake = fakeEditor(text);
  function Host() {
    useVim({ editor: fake.editor, enabled: true, isFocused: () => true });
    return null;
  }
  render(<Host />);
  return fake;
}

const press = (key: string) =>
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  });

/** The characters the editor is currently showing as selected, on one line. */
const width = (selection: Selection) =>
  selection.end.character - selection.start.character;

afterEach(cleanup);

describe("useVim", () => {
  it("grows a visual selection a character at a time", () => {
    const fake = mount(LINES.join("\n"));
    press("v");
    expect(width(fake.at())).toBe(1);
    press("l");
    expect(width(fake.at())).toBe(2);
    press("l");
    press("l");
    expect(width(fake.at())).toBe(4);
  });

  it("carries a visual selection down through the file", () => {
    const fake = mount(LINES.join("\n"));
    press("v");
    press("j");
    expect(fake.at().end.line).toBe(1);
    press("j");
    expect(fake.at().end.line).toBe(2);
  });

  it("shrinks back to the character it started on", () => {
    const fake = mount(LINES.join("\n"));
    press("v");
    press("l");
    press("l");
    press("h");
    expect(width(fake.at())).toBe(2);
    press("h");
    expect(width(fake.at())).toBe(1);
  });

  it("marks a selection reaching back up the file as backward", () => {
    const fake = mount(LINES.join("\n"));
    press("j");
    press("j");
    press("v");
    expect(fake.at().direction).toBe("forward");
    press("k");
    expect(fake.at().direction).toBe("backward");
    expect(fake.at().start.line).toBe(1);
    press("j");
    press("j");
    expect(fake.at().direction).toBe("forward");
  });
});
