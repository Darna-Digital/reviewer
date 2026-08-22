// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearRelativeLines, paintRelativeLines } from "./relative-lines";

/**
 * The gutter as `@pierre/diffs` renders it: each row carries its one-based line
 * number as an attribute the library reads, and again as the text only the
 * reader sees.
 */
function gutter(lines: number): HTMLElement {
  const container = document.createElement("div");
  for (let n = 1; n <= lines; n++) {
    const row = document.createElement("div");
    row.setAttribute("data-column-number", String(n));
    row.setAttribute("data-line-index", String(n - 1));
    const content = document.createElement("span");
    content.setAttribute("data-line-number-content", "");
    content.textContent = String(n);
    row.append(content);
    container.append(row);
  }
  document.body.replaceChildren(container);
  return container;
}

const labels = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-line-number-content]")].map(
    (el) => el.textContent
  );

beforeEach(() => document.body.replaceChildren());

describe("paintRelativeLines", () => {
  it("counts out from the caret's line in both directions", () => {
    const container = gutter(5);
    paintRelativeLines(container, 2);
    // The caret's own row keeps its absolute number, so it is still a place you
    // can jump to; the others say how far away they are.
    expect(labels(container)).toEqual(["2", "1", "3", "1", "2"]);
  });

  it("numbers from the top when the caret is on the first line", () => {
    const container = gutter(4);
    paintRelativeLines(container, 0);
    expect(labels(container)).toEqual(["1", "1", "2", "3"]);
  });

  it("leaves the attribute the library reads untouched", () => {
    const container = gutter(3);
    paintRelativeLines(container, 2);
    expect(
      [...container.querySelectorAll("[data-column-number]")].map((el) =>
        el.getAttribute("data-column-number")
      )
    ).toEqual(["1", "2", "3"]);
  });

  it("repaints in place as the caret moves", () => {
    const container = gutter(4);
    paintRelativeLines(container, 0);
    paintRelativeLines(container, 3);
    expect(labels(container)).toEqual(["3", "2", "1", "4"]);
  });

  it("reports how many rows it numbered", () => {
    expect(paintRelativeLines(gutter(6), 0)).toBe(6);
  });
});

describe("clearRelativeLines", () => {
  it("puts the absolute numbers back", () => {
    const container = gutter(5);
    paintRelativeLines(container, 2);
    clearRelativeLines(container);
    expect(labels(container)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("has nothing to undo on a gutter it never touched", () => {
    const container = gutter(3);
    clearRelativeLines(container);
    expect(labels(container)).toEqual(["1", "2", "3"]);
  });
});
