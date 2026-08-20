// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Editor, TextEdit } from "@pierre/diffs/edit";
import type { CompletionItem } from "@byconvo/core/language";
import { useCompletions } from "./use-completions";

const requestCompletions = vi.fn();
const resolveCompletion = vi.fn();

vi.mock("../adapters/language.hook.adapter", () => ({
  requestCompletions: (...args: Array<unknown>) => requestCompletions(...args),
  resolveCompletion: (...args: Array<unknown>) => resolveCompletion(...args),
}));

// The popup measures the caret out of the rendered code, which jsdom has no
// geometry for; the list itself is what these tests are about.
vi.mock("@/lib/code-root", () => ({
  caretRect: () => new DOMRect(0, 0, 1, 16),
}));

const item = (label: string, over: Partial<CompletionItem> = {}) =>
  ({
    label,
    kind: "function",
    detail: "",
    insertText: label,
    sortText: "11",
    source: "",
    data: null,
    ...over,
  }) satisfies CompletionItem;

/**
 * A stand-in editor holding one line and a caret in it. `applyEdits` really
 * edits, so a test can assert the text an accept left behind rather than the
 * call it was made with.
 */
function fakeEditor(text: string) {
  const state = { text, caret: text.length };
  const listeners = new Set<() => void>();
  const applyEdits = vi.fn((edits: TextEdit[]) => {
    // One line, so a character is an offset. Bottom-up keeps them valid.
    for (const edit of [...edits].sort(
      (a, b) => b.range.start.character - a.range.start.character
    )) {
      const { start, end } = edit.range;
      state.text =
        state.text.slice(0, start.character) +
        edit.newText +
        state.text.slice(end.character);
      state.caret = start.character + edit.newText.length;
    }
    for (const listener of listeners) listener();
  });
  const editor = {
    getText: () => state.text,
    getState: () => ({
      selections: [
        {
          start: { line: 0, character: state.caret },
          end: { line: 0, character: state.caret },
        },
      ],
    }),
    applyEdits,
  } as unknown as Editor<undefined>;

  return {
    editor,
    applyEdits,
    state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** What the user typing another few characters does to the buffer. */
    type: (more: string) => {
      state.text =
        state.text.slice(0, state.caret) + more + state.text.slice(state.caret);
      state.caret += more.length;
      for (const listener of listeners) listener();
    },
  };
}

function Harness({
  editor,
  subscribe,
  isFocused,
}: {
  editor: Editor<undefined>;
  subscribe: (listener: () => void) => () => void;
  isFocused?: () => boolean;
}) {
  const completions = useCompletions({
    editor,
    subscribe,
    isFocused,
    path: "src/app.ts",
    getContainer: () => document.body,
  });
  return <>{completions.popup}</>;
}

/** Rows on screen, top to bottom. */
const rows = () => screen.queryAllByRole("option").map((el) => el.textContent);

const press = (key: string, over: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...over })
    );
  });

/** Let the debounce fire and the mocked round trip settle. */
const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  requestCompletions.mockReset();
  resolveCompletion.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("useCompletions", () => {
  it("opens on what was typed", async () => {
    const buffer = fakeEditor("const x = us");
    requestCompletions.mockResolvedValue({
      items: [item("useState"), item("useEffect")],
    });
    render(<Harness editor={buffer.editor} subscribe={buffer.subscribe} />);

    act(() => buffer.type("e"));
    await settle();

    expect(rows()).toHaveLength(2);
  });

  it("narrows the open list as the typing goes on, without waiting for another round trip", async () => {
    const buffer = fakeEditor("const x = us");
    requestCompletions.mockResolvedValue({
      items: [item("useState"), item("useEffect"), item("useMemo")],
    });
    render(<Harness editor={buffer.editor} subscribe={buffer.subscribe} />);

    act(() => buffer.type("e"));
    await settle();
    expect(rows()).toHaveLength(3);

    // No timers run: this is what the user sees between the keystroke and the
    // next request landing.
    await act(async () => {
      buffer.type("St");
      await Promise.resolve();
    });

    expect(rows()).toEqual(["functionuseState"]);
    expect(requestCompletions).toHaveBeenCalledTimes(1);
  });

  it("accepts against the word as it stands, not the one the list was asked about", async () => {
    const buffer = fakeEditor("const x = us");
    requestCompletions.mockResolvedValue({
      items: [item("useState"), item("useEffect")],
    });
    render(<Harness editor={buffer.editor} subscribe={buffer.subscribe} />);

    act(() => buffer.type("e"));
    await settle();

    // Two more characters land while the list is up — the bug this guards is
    // the accept replacing `use` and leaving `useStateSt` behind.
    await act(async () => {
      buffer.type("St");
      await Promise.resolve();
    });
    press("Enter");

    expect(buffer.state.text).toBe("const x = useState");
  });

  it("closes rather than accepting once nothing matches any more", async () => {
    const buffer = fakeEditor("const x = us");
    requestCompletions.mockResolvedValue({ items: [item("useState")] });
    render(<Harness editor={buffer.editor} subscribe={buffer.subscribe} />);

    act(() => buffer.type("e"));
    await settle();

    await act(async () => {
      buffer.type("zzz");
      await Promise.resolve();
    });
    expect(rows()).toHaveLength(0);

    press("Enter");
    expect(buffer.state.text).toBe("const x = usezzz");
  });

  it("retires the list when the caret walks off the word", async () => {
    const buffer = fakeEditor("const x = us");
    requestCompletions.mockResolvedValue({ items: [item("useState")] });
    render(<Harness editor={buffer.editor} subscribe={buffer.subscribe} />);

    act(() => buffer.type("e"));
    await settle();
    expect(rows()).toHaveLength(1);

    press("ArrowLeft");
    expect(rows()).toHaveLength(0);
  });

  it("leaves Enter alone once the caret has left the code", async () => {
    const buffer = fakeEditor("const x = us");
    requestCompletions.mockResolvedValue({ items: [item("useState")] });
    render(
      <Harness
        editor={buffer.editor}
        subscribe={buffer.subscribe}
        isFocused={() => false}
      />
    );

    act(() => buffer.type("e"));
    await settle();

    press("Enter");
    expect(buffer.state.text).toBe("const x = use");
    expect(rows()).toHaveLength(0);
  });

  it("lands an import and the word it belongs to in one edit", async () => {
    const buffer = fakeEditor("const x = us");
    requestCompletions.mockResolvedValue({
      items: [item("useState", { source: "react" })],
    });
    resolveCompletion.mockResolvedValue({
      additionalEdits: [
        {
          path: "src/app.ts",
          edits: [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
              newText: 'import { useState } from "react";\n',
            },
          ],
        },
      ],
    });
    render(<Harness editor={buffer.editor} subscribe={buffer.subscribe} />);

    act(() => buffer.type("e"));
    await settle();

    press("Enter");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // One batch, so one undo takes both back — and so the insertion is not
    // aimed at a line the import has already pushed down.
    expect(buffer.applyEdits).toHaveBeenCalledTimes(1);
    expect(buffer.applyEdits.mock.calls[0][0]).toHaveLength(2);
    expect(buffer.state.text).toBe(
      'import { useState } from "react";\nconst x = useState'
    );
  });

  it("drops the import when the buffer moved under the resolve", async () => {
    const buffer = fakeEditor("const x = us");
    requestCompletions.mockResolvedValue({
      items: [item("useState", { source: "react" })],
    });
    let release: (value: unknown) => void = () => {};
    resolveCompletion.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    render(<Harness editor={buffer.editor} subscribe={buffer.subscribe} />);

    act(() => buffer.type("e"));
    await settle();
    press("Enter");

    // The import edit's offsets were computed against a buffer that has since
    // moved; applying them anyway would put the import inside the code.
    await act(async () => {
      buffer.type("St");
      release({
        additionalEdits: [
          {
            path: "src/app.ts",
            edits: [
              {
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: 0 },
                },
                newText: 'import { useState } from "react";\n',
              },
            ],
          },
        ],
      });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(buffer.state.text).toBe("const x = useState");
  });
});
