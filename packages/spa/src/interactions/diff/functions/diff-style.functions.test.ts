import { describe, expect, it } from "vitest";
import {
  MIN_SPLIT_WIDTH,
  isNarrowedToUnified,
  resolveDiffStyle,
} from "./diff-style.functions";

describe("resolveDiffStyle", () => {
  it("leaves a unified preference alone at any width", () => {
    expect(resolveDiffStyle("unified", 4000)).toBe("unified");
    expect(resolveDiffStyle("unified", 200)).toBe("unified");
  });

  it("keeps split where two columns fit", () => {
    expect(resolveDiffStyle("split", MIN_SPLIT_WIDTH)).toBe("split");
    expect(resolveDiffStyle("split", 1600)).toBe("split");
  });

  it("falls back to unified where they do not", () => {
    expect(resolveDiffStyle("split", MIN_SPLIT_WIDTH - 1)).toBe("unified");
    expect(resolveDiffStyle("split", 320)).toBe("unified");
  });

  it("trusts the preference until the pane has been measured", () => {
    expect(resolveDiffStyle("split", null)).toBe("split");
    expect(resolveDiffStyle("split", 0)).toBe("split");
  });

  it("knows when the width, not the reader, chose unified", () => {
    expect(isNarrowedToUnified("split", 400)).toBe(true);
    expect(isNarrowedToUnified("split", 1600)).toBe(false);
    expect(isNarrowedToUnified("unified", 400)).toBe(false);
  });
});
