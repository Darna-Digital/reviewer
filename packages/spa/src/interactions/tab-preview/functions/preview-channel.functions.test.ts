import { describe, expect, it } from "vitest";
import {
  asPreviewGoto,
  isPreviewShown,
  previewGoto,
  previewShown,
  PREVIEW_GOTO,
} from "./preview-channel.functions";

describe("asPreviewGoto", () => {
  it("reads an asking back out", () => {
    expect(asPreviewGoto(previewGoto("/modes/code/commit", 7))).toEqual({
      type: PREVIEW_GOTO,
      href: "/modes/code/commit",
      nonce: 7,
    });
  });

  it("refuses anything that is not one", () => {
    for (const data of [
      null,
      undefined,
      "goto",
      42,
      {},
      { type: PREVIEW_GOTO },
      { type: PREVIEW_GOTO, href: "/x" },
      { type: PREVIEW_GOTO, href: 1, nonce: 1 },
      { type: PREVIEW_GOTO, href: "/x", nonce: "1" },
      { type: "something-else", href: "/x", nonce: 1 },
    ]) {
      expect(asPreviewGoto(data)).toBeNull();
    }
  });
});

describe("isPreviewShown", () => {
  it("answers only to the asking it is waiting on", () => {
    expect(isPreviewShown(previewShown(3), 3)).toBe(true);
    expect(isPreviewShown(previewShown(2), 3)).toBe(false);
  });

  it("refuses anything that is not an answer", () => {
    expect(isPreviewShown(previewGoto("/x", 3), 3)).toBe(false);
    expect(isPreviewShown(null, 3)).toBe(false);
    expect(isPreviewShown({ type: "reviewer:preview:shown" }, 3)).toBe(false);
  });
});
