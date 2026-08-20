// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import type { Editor } from "@pierre/diffs/edit";
import { useFindInFile } from "./find-in-file.hook.adapter";
import { resetCodeSelection, selectedCodeText } from "./code-selection.store";

const FILE = [
  "const value = 1;",
  "const other = value + value;",
  "// value is not other",
].join("\n");

/** Which keys reached the code element under the view. */
const reachedTheCode = vi.fn<(key: string) => void>();

/**
 * A stand-in editor. The real one is attached to a rendered document; all this
 * hook ever asks it is what it holds, what is selected in it, and to take the
 * caret back.
 */
const fakeEditor = (
  over: Partial<{
    text: string;
    selections: Array<{
      start: { line: number; character: number };
      end: { line: number; character: number };
    }>;
  }> = {}
) => {
  const focus = vi.fn();
  const editor = {
    getText: () => over.text ?? FILE,
    getState: () => ({ selections: over.selections }),
    focus,
  } as unknown as Editor<undefined>;
  return { editor, focus };
};

function Harness({
  contents = FILE,
  editor = null,
}: {
  contents?: string;
  editor?: Editor<undefined> | null;
}) {
  const code = useRef<HTMLDivElement>(null);
  const find = useFindInFile({
    path: "src/lib/queries.ts",
    contents,
    editor,
    getScroller: () => null,
  });
  return (
    <div>
      {/* Stands in for the code element the library binds its own find panel
          to: anything that reaches here is a chord we failed to take. */}
      <div
        ref={code}
        data-testid="code"
        onKeyDown={(event) => reachedTheCode(event.key.toLowerCase())}
      >
        <input aria-label="Code" />
      </div>
      {find.bar}
    </div>
  );
}

const bar = () => screen.queryByRole("search", { name: /^Find in / });
const box = () => screen.getByRole("textbox", { name: "Find in file" });
const status = () =>
  screen.getByRole("search", { name: /^Find in / }).querySelector("[aria-live]")
    ?.textContent;

afterEach(() => {
  cleanup();
  resetCodeSelection();
  vi.clearAllMocks();
});

describe("useFindInFile", () => {
  it("stays out of the way until ⌘F", () => {
    render(<Harness />);

    expect(bar()).toBeNull();
  });

  it("opens on ⌘F while the file is only being read", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{Meta>}f{/Meta}");

    expect(bar()).toBeTruthy();
    expect(box()).toBe(document.activeElement);
  });

  it("opens on ⌘F while the file is being edited, and on Ctrl+F", async () => {
    const user = userEvent.setup();
    render(<Harness editor={fakeEditor().editor} />);

    await user.keyboard("{Control>}f{/Control}");

    expect(bar()).toBeTruthy();
  });

  it("never lets the chord reach the library's own panel", async () => {
    const user = userEvent.setup();
    render(<Harness editor={fakeEditor().editor} />);

    await user.click(screen.getByLabelText("Code"));
    await user.keyboard("{Meta>}f{/Meta}");

    expect(bar()).toBeTruthy();
    expect(reachedTheCode).not.toHaveBeenCalledWith("f");
  });

  it("counts the whole file, whichever mode it is in", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);

    await user.keyboard("{Meta>}f{/Meta}");
    await user.type(box(), "value");
    expect(status()).toBe("1 of 4");

    unmount();
    render(<Harness editor={fakeEditor().editor} />);
    await user.keyboard("{Meta>}f{/Meta}");
    await user.type(box(), "value");
    expect(status()).toBe("1 of 4");
  });

  it("counts the buffer, not what is on disk", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        contents="nothing here"
        editor={fakeEditor({ text: "value value" }).editor}
      />
    );

    await user.keyboard("{Meta>}f{/Meta}");
    await user.type(box(), "value");

    expect(status()).toBe("1 of 2");
  });

  it("steps through the matches, wrapping at the end", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{Meta>}f{/Meta}");
    await user.type(box(), "value");
    await user.keyboard("{Enter}{Enter}{Enter}");
    expect(status()).toBe("4 of 4");

    await user.keyboard("{Enter}");
    expect(status()).toBe("1 of 4");
  });

  it("finds again on ⌘G without the box having focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{Meta>}f{/Meta}");
    await user.type(box(), "value");
    await user.click(screen.getByLabelText("Code"));

    await user.keyboard("{Meta>}g{/Meta}");
    expect(status()).toBe("2 of 4");
    await user.keyboard("{Meta>}{Shift>}g{/Shift}{/Meta}");
    expect(status()).toBe("1 of 4");
  });

  it("leaves ⌘G alone while there is no search to repeat", async () => {
    const user = userEvent.setup();
    render(<Harness editor={fakeEditor().editor} />);

    await user.click(screen.getByLabelText("Code"));
    await user.keyboard("{Meta>}g{/Meta}");

    expect(reachedTheCode).toHaveBeenCalledWith("g");
  });

  it("opens on whatever the editor has selected", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        editor={
          fakeEditor({
            selections: [
              {
                start: { line: 0, character: 6 },
                end: { line: 0, character: 11 },
              },
            ],
          }).editor
        }
      />
    );

    await user.keyboard("{Meta>}f{/Meta}");

    expect((box() as HTMLInputElement).value).toBe("value");
    expect(status()).toBe("1 of 4");
  });

  it("keeps the last query when nothing is selected", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{Meta>}f{/Meta}");
    await user.type(box(), "other");
    await user.keyboard("{Escape}");
    await user.keyboard("{Meta>}f{/Meta}");

    expect((box() as HTMLInputElement).value).toBe("other");
  });

  it("hands the caret back to the editor on the way out", async () => {
    const user = userEvent.setup();
    const { editor, focus } = fakeEditor();
    render(<Harness editor={editor} />);

    await user.keyboard("{Meta>}f{/Meta}");
    await user.keyboard("{Escape}");

    expect(bar()).toBeNull();
    expect(focus).toHaveBeenCalled();
  });

  it("stands aside for a dialog opened over the file", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <div role="dialog">
          <input aria-label="Palette" />
        </div>
      </>
    );

    await user.click(screen.getByLabelText("Palette"));
    await user.keyboard("{Meta>}f{/Meta}");

    expect(bar()).toBeNull();
  });

  it("offers the open file's selection to the content search", async () => {
    render(
      <Harness
        editor={
          fakeEditor({
            selections: [
              {
                start: { line: 1, character: 14 },
                end: { line: 1, character: 19 },
              },
            ],
          }).editor
        }
      />
    );

    expect(selectedCodeText()).toBe("value");
  });

  it("offers nothing once the file is gone", () => {
    const { unmount } = render(
      <Harness
        editor={
          fakeEditor({
            selections: [
              {
                start: { line: 0, character: 6 },
                end: { line: 0, character: 11 },
              },
            ],
          }).editor
        }
      />
    );

    unmount();

    expect(selectedCodeText()).toBe("");
  });
});
