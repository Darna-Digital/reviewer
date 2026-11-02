import { afterEach, describe, expect, it, vi } from "vitest";

const post = vi.fn(() => Promise.resolve());

vi.mock("@/lib/shell", () => ({ shell: { post } }));

const { notify } = await import("./notify");

afterEach(() => {
  vi.clearAllMocks();
});

describe("notify", () => {
  /** The case this exists for: a discard's toast is the window's own notice,
   * and the web view draws nothing. */
  it("posts each toast to the shell as a notice", () => {
    notify.success("Discarded changes in src/app.tsx");
    notify.error("Couldn't load the rest of app.tsx", {
      description: "The server couldn't provide this file's full contents.",
    });
    expect(post).toHaveBeenNthCalledWith(1, {
      type: "notice",
      kind: "success",
      title: "Discarded changes in src/app.tsx",
      detail: null,
    });
    expect(post).toHaveBeenNthCalledWith(2, {
      type: "notice",
      kind: "error",
      title: "Couldn't load the rest of app.tsx",
      detail: "The server couldn't provide this file's full contents.",
    });
  });
});
