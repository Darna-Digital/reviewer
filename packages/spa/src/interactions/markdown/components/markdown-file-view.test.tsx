// @vitest-environment jsdom
/**
 * How the three views are composed, and — the reason this file exists — what
 * the document falls back to when the code view has no buffer to lend.
 *
 * The code view is stubbed. What is under test is the arrangement around it:
 * that it is mounted in every view, that it is only taken off screen rather
 * than unmounted, and that the document pane does not wait for ever on a
 * bridge that may never arrive.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  FileBufferBridge,
  MarkdownView,
} from "../interfaces/markdown.interfaces";

const FILE = "# On disk\n";

/**
 * A code view that publishes a buffer only when asked to — which is the
 * difference between a file being edited and one being read.
 */
const lendsBuffer = { current: true };
const written: string[] = [];

vi.mock("@/components/editor/code-view", () => ({
  CodeView: ({
    path,
    onBuffer,
  }: {
    path: string;
    onBuffer?: (bridge: FileBufferBridge | null) => void;
  }) => {
    if (onBuffer !== undefined && lendsBuffer.current) {
      queueMicrotask(() =>
        onBuffer({
          subscribe: () => () => {},
          read: () => FILE,
          write: (text) => written.push(text),
        })
      );
    }
    return <div data-testid="code-view">{path}</div>;
  },
}));

vi.mock("@/lib/queries", () => ({
  useFile: () => ({ data: { contents: FILE } }),
}));

const view = { current: "editor" as MarkdownView };
const setUiPrefs = vi.fn();
vi.mock("@/lib/ui-prefs", () => ({
  useUiPrefs: () => ({
    markdownView: view.current,
    markdownSourceWidth: 480,
  }),
  setUiPrefs: (next: unknown) => setUiPrefs(next),
}));

const { MarkdownFileView } = await import("./markdown-file-view");

const show = (as: MarkdownView, lends: boolean) => {
  view.current = as;
  lendsBuffer.current = lends;
  return render(
    <MarkdownFileView path="README.md" theme="light" actionsSlot={null} />
  );
};

afterEach(() => {
  cleanup();
  written.length = 0;
});

describe("MarkdownFileView", () => {
  it("mounts the code view in every view, including the document's own", () => {
    for (const as of ["source", "split", "editor"] as const) {
      const { unmount } = show(as, true);
      // Unmounting it would throw away the buffer, the dirty marker and ⌘S.
      expect(screen.getByTestId("code-view")).toBeDefined();
      unmount();
    }
  });

  it("keeps the code view laid out when the document is alone", () => {
    const { container } = show("editor", true);
    const pane = container.querySelector(
      "[data-testid=code-view]"
    )!.parentElement!;

    // `display: none` would leave it with no box, and the view windows itself
    // with an IntersectionObserver: no box, no lines, no editor, and the
    // document waits for a buffer that is never built.
    expect(pane.classList.contains("hidden")).toBe(false);
    expect(pane.classList.contains("absolute")).toBe(true);
    expect(pane.hasAttribute("inert")).toBe(true);
  });

  it("shows the file from disk when there is no buffer to share", async () => {
    const { container } = show("editor", false);
    await waitFor(() =>
      expect(container.querySelector("h1")?.textContent).toBe("On disk")
    );
    // Read-only rather than a spinner: comment mode lends no editor, and a
    // document nobody can type into is still a document.
    expect(
      container
        .querySelector(".document-content")
        ?.getAttribute("contenteditable")
    ).toBe("false");
  });

  it("edits through the shared buffer once one is lent", async () => {
    const { container } = show("editor", true);
    await waitFor(() =>
      expect(
        container
          .querySelector(".document-content")
          ?.getAttribute("contenteditable")
      ).toBe("true")
    );
  });

  it("leaves the document out of the source view", () => {
    const { container } = show("source", true);
    expect(container.querySelector(".document-content")).toBeNull();
  });
});
