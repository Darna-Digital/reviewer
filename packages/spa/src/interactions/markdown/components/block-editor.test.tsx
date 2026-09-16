// @vitest-environment jsdom
/**
 * The editor as a controlled component over markdown text.
 *
 * What is worth pinning here is not how a paragraph looks but the contract with
 * whatever owns the buffer: the schema really does accept every block the
 * converters produce, an edit comes back out as markdown, and text arriving
 * from the other pane replaces the document.
 *
 * Note the `{"..."}` around every markdown fixture — a JSX string attribute
 * does not read escape sequences, so `value="a\nb"` would hand the editor a
 * backslash rather than a newline.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockEditor } from "./block-editor";

afterEach(cleanup);

const DOCUMENT = [
  "---",
  "title: Notes",
  "---",
  "",
  "# Title",
  "",
  "Some **bold** and a [link](https://x.test).",
  "",
  "- [x] done",
  "- [ ] todo",
  "",
  "> quoted",
  "",
  "```ts",
  "const a = 1;",
  "```",
  "",
  "| a | b |",
  "| :- | -: |",
  "| 1 | 2 |",
  "",
  '<div class="note">raw</div>',
  "",
].join("\n");

/** The editable surface, once ProseMirror has built it. */
const surface = (container: HTMLElement) =>
  waitFor(() => {
    const found = container.querySelector<HTMLElement>(".document-content");
    expect(found).not.toBeNull();
    return found!;
  });

describe("BlockEditor", () => {
  it("renders every block the converters can produce", async () => {
    const { container } = render(
      <BlockEditor value={DOCUMENT} onChange={vi.fn()} />
    );
    await surface(container);

    // A node the extensions did not declare would have been dropped on the way
    // in rather than reported, so the assertion is that each one arrived.
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("link").getAttribute("href")).toBe(
      "https://x.test"
    );
    expect(container.querySelector("blockquote")?.textContent).toBe("quoted");
    expect(container.querySelector("pre code")?.textContent).toBe(
      "const a = 1;"
    );
    expect(container.querySelectorAll("table th")).toHaveLength(2);
    expect(container.querySelectorAll("input[type=checkbox]")).toHaveLength(2);
    expect(
      [...container.querySelectorAll("[data-markdown-block]")].map((node) =>
        node.getAttribute("data-markdown-block")
      )
    ).toEqual(["frontmatter", "raw"]);
  });

  it("says nothing about a document it has merely been shown", async () => {
    const onChange = vi.fn();
    // Bullet markers the editor does not itself write, so anything that
    // reported the document back would report it changed.
    const { container } = render(
      <BlockEditor value={"# One\n\n* a\n* b\n"} onChange={onChange} />
    );
    await surface(container);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Otherwise switching to the document view would rewrite the file and mark
    // it dirty without the user having touched a key.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports an edit as markdown, not as a document", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <BlockEditor
        value={"---\ntitle: Notes\n---\n\nBody.\n"}
        onChange={onChange}
      />
    );
    await surface(container);

    // Editing the frontmatter is a real transaction on the document, so this
    // exercises the whole way back out: node attributes, serialisation, and
    // the raw block being written byte for byte.
    const box = container.querySelector("textarea")!;
    fireEvent.change(box, { target: { value: "---\ntitle: Renamed\n---" } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall?.[0]).toBe(
      "---\ntitle: Renamed\n---\n\nBody.\n"
    );
  });

  it("replaces the document when text arrives from the other pane", async () => {
    const { container, rerender } = render(
      <BlockEditor value={"# One\n"} onChange={vi.fn()} />
    );
    await surface(container);
    expect(container.querySelector("h1")?.textContent).toBe("One");

    rerender(<BlockEditor value={"# Two\n"} onChange={vi.fn()} />);
    await waitFor(() =>
      expect(container.querySelector("h1")?.textContent).toBe("Two")
    );
  });

  it("does not report a change when it is only being re-seeded", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <BlockEditor value={"# One\n"} onChange={onChange} />
    );
    await surface(container);

    rerender(<BlockEditor value={"# Two\n"} onChange={onChange} />);
    await waitFor(() =>
      expect(container.querySelector("h1")?.textContent).toBe("Two")
    );
    // Otherwise the two panes of a split view would write to each other for
    // ever, each one's re-seed looking to the other like something typed.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("locks the document when it is not editable", async () => {
    const { container } = render(
      <BlockEditor
        value={"---\na: 1\n---\n\nBody.\n"}
        editable={false}
        onChange={vi.fn()}
      />
    );
    const editable = await surface(container);

    expect(editable.getAttribute("contenteditable")).toBe("false");
    expect(container.querySelector("textarea")?.readOnly).toBe(true);
  });
});
