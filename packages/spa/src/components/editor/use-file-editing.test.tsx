// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorOptions } from "@pierre/diffs/edit";
import { useFileEditing, type FileEditing } from "./use-file-editing";

const put = vi.fn();
vi.mock("@/lib/api/client", () => ({
  fetchClient: {
    PUT: (...args: ReadonlyArray<unknown>) => put(...args),
  },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/**
 * The editor the view would build. Only the options matter here: the hook folds
 * its own `onChange` into them, and calling it is how this test types.
 */
const built: Array<{ options: EditorOptions<"file", undefined, undefined> }> =
  [];
vi.mock("@pierre/diffs/edit", () => ({
  Editor: class {
    readonly options: EditorOptions<"file", undefined, undefined>;
    constructor(
      _type: string,
      options: EditorOptions<"file", undefined, undefined>
    ) {
      this.options = options;
      built.push(this);
    }
    getText() {
      return "";
    }
    getViewState() {
      return { selections: [] };
    }
    setSelections() {}
    applyEdits() {}
    cleanUp() {}
  },
}));

/** Mount the hook over a file that has already been read. */
function mount(loaded: string) {
  let api!: FileEditing;
  function Host() {
    api = useFileEditing({
      path: "src/a.ts",
      editing: true,
      loadedContents: loaded,
      onSaved: () => {},
    });
    return null;
  }
  render(<Host />);
  act(() => {
    api.createEditor("file", {});
  });
  return () => api;
}

/** One keystroke, as the editor reports it. */
const type = (contents: string) =>
  act(() => {
    built[built.length - 1]?.options.onChange?.({
      file: { contents },
    } as Parameters<
      NonNullable<EditorOptions<"file", undefined, undefined>["onChange"]>
    >[0]);
  });

beforeEach(() => {
  built.length = 0;
  put.mockReset();
});
afterEach(cleanup);

describe("saving", () => {
  it("writes the buffer and marks the file clean", async () => {
    put.mockResolvedValue({ data: {}, error: undefined });
    const editing = mount("one\n");
    type("two\n");
    expect(editing().dirty).toBe(true);

    await act(async () => {
      editing().save();
    });
    expect(put).toHaveBeenCalledWith("/api/file", {
      body: { path: "src/a.ts", contents: "two\n" },
    });
    expect(editing().dirty).toBe(false);
  });

  it("stays dirty when a keystroke lands while the write is in flight", async () => {
    // What went to disk is what the buffer held when the write started; the
    // marker has to go back on for anything typed since, or the tab claims a
    // document nobody has saved.
    let settle: (value: unknown) => void = () => {};
    put.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );
    const editing = mount("one\n");
    type("two\n");

    act(() => {
      editing().save();
    });
    type("three\n");
    await act(async () => {
      settle({ data: {}, error: undefined });
    });

    expect(put).toHaveBeenCalledWith("/api/file", {
      body: { path: "src/a.ts", contents: "two\n" },
    });
    expect(editing().dirty).toBe(true);
  });

  it("leaves the file dirty when the write is refused", async () => {
    put.mockResolvedValue({ error: { reason: "read-only" } });
    const editing = mount("one\n");
    type("two\n");
    await act(async () => {
      editing().save();
    });
    expect(editing().dirty).toBe(true);
  });

  it("does not write a file nobody has changed", async () => {
    const editing = mount("one\n");
    await act(async () => {
      editing().save();
    });
    expect(put).not.toHaveBeenCalled();
  });
});

describe("reading the buffer", () => {
  it("has nothing to say before an editor is attached", () => {
    let api!: FileEditing;
    function Host() {
      api = useFileEditing({
        path: "src/a.ts",
        editing: true,
        loadedContents: "one\n",
        onSaved: () => {},
      });
      return null;
    }
    render(<Host />);
    expect(api.readBuffer()).toBeNull();
  });

  it("answers with what the editor is holding", () => {
    // The view compares this against what the file API last returned, to tell
    // a document that changed underneath it from the read that follows a save.
    const editing = mount("one\n");
    expect(editing().readBuffer()).toBe("one\n");
    type("two\n");
    expect(editing().readBuffer()).toBe("two\n");
  });
});
