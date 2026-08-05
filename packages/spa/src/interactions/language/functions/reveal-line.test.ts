import { describe, expect, it } from "vitest";
import { estimateScrollTop, scrollTopForElement } from "./reveal-line";

describe("estimateScrollTop", () => {
  it("centres a line in the middle of a long file", () => {
    // Line 500 of 1000 sits halfway down a 20000px document.
    expect(estimateScrollTop(500, 1000, 20_000, 600)).toBeCloseTo(9680, 0);
  });

  it("does not scroll above the top", () => {
    expect(estimateScrollTop(1, 1000, 20_000, 600)).toBe(0);
    expect(estimateScrollTop(3, 1000, 20_000, 600)).toBe(0);
  });

  it("does not scroll past the bottom", () => {
    expect(estimateScrollTop(1000, 1000, 20_000, 600)).toBe(19_400);
  });

  it("stays at the top when the file already fits", () => {
    expect(estimateScrollTop(40, 100, 500, 600)).toBe(0);
  });

  it("survives a file with no lines", () => {
    expect(estimateScrollTop(1, 0, 20_000, 600)).toBe(0);
  });

  it("clamps a line beyond the end of the file", () => {
    expect(estimateScrollTop(5000, 1000, 20_000, 600)).toBe(19_400);
  });
});

describe("scrollTopForElement", () => {
  it("centres an element already in view", () => {
    // Element 400px down the viewport, container scrolled to 1000, 600 tall.
    expect(scrollTopForElement(400, 20, 0, 1000, 600, 20_000)).toBe(1110);
  });

  it("clamps at the top of the document", () => {
    expect(scrollTopForElement(10, 20, 0, 0, 600, 20_000)).toBe(0);
  });

  it("clamps at the bottom of the document", () => {
    // Centring the last line would need 19610; the document only allows 19400.
    expect(scrollTopForElement(500, 20, 0, 19_400, 600, 20_000)).toBe(19_400);
  });

  it("accounts for a container that is not at the top of the page", () => {
    expect(scrollTopForElement(400, 20, 100, 1000, 600, 20_000)).toBe(1010);
  });
});
