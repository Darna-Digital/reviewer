// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { clippedText } from "@/components/ui/truncated-text";

/** jsdom does no layout, so widths are declared rather than measured. */
const sized = (
  html: string,
  widths: ReadonlyArray<[string, number, number]>
) => {
  const row = document.createElement("div");
  row.innerHTML = html;
  for (const [selector, scrollWidth, clientWidth] of widths) {
    const node = selector === ":scope" ? row : row.querySelector(selector);
    if (node === null) throw new Error(`no element matches ${selector}`);
    Object.defineProperty(node, "scrollWidth", { value: scrollWidth });
    Object.defineProperty(node, "clientWidth", { value: clientWidth });
  }
  return row;
};

describe("clippedText", () => {
  it("reads back the ellipsized label, not the whole row", () => {
    const row = sized(
      `<svg></svg><span class="label">task/BMB-207-a-very-long-branch</span><span class="badge">↑2</span>`,
      [
        [":scope", 200, 200],
        [".label", 400, 160],
        [".badge", 20, 20],
      ]
    );

    expect(clippedText(row)).toBe("task/BMB-207-a-very-long-branch");
  });

  it("stays quiet when everything fits", () => {
    const row = sized(`<span class="label">main</span>`, [
      [":scope", 200, 200],
      [".label", 40, 160],
    ]);

    expect(clippedText(row)).toBeNull();
  });

  it("ignores the pixel of slack a snug fit reports", () => {
    const row = sized(`<span class="label">main</span>`, [
      [":scope", 200, 200],
      [".label", 161, 160],
    ]);

    expect(clippedText(row)).toBeNull();
  });

  it("falls back to the row when the row itself clips", () => {
    const row = sized(`Checkout and Update`, [[":scope", 400, 160]]);

    expect(clippedText(row)).toBe("Checkout and Update");
  });

  it("has nothing to say about a clipped row holding only icons", () => {
    const row = sized(`<svg class="icon"></svg>`, [
      [":scope", 200, 200],
      [".icon", 40, 20],
    ]);

    expect(clippedText(row)).toBeNull();
  });
});
