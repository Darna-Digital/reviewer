// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearFolds, foldTargetOf, paintFolds } from "./fold-paint";

/**
 * The rendered file as `@pierre/diffs` builds it: a gutter cell and a code row
 * per line, both carrying the same zero-based `data-line-index`.
 */
function rendered(lines: number): HTMLElement {
  const root = document.createElement("div");
  const gutter = document.createElement("div");
  gutter.setAttribute("data-gutter", "");
  const code = document.createElement("div");
  code.setAttribute("data-code", "");
  for (let n = 0; n < lines; n++) {
    const cell = document.createElement("div");
    cell.setAttribute("data-column-number", String(n + 1));
    cell.setAttribute("data-line-index", String(n));
    const number = document.createElement("span");
    number.setAttribute("data-line-number-content", "");
    number.textContent = String(n + 1);
    cell.append(number);
    gutter.append(cell);

    const row = document.createElement("div");
    row.setAttribute("data-line", String(n + 1));
    row.setAttribute("data-line-index", String(n));
    code.append(row);
  }
  root.append(gutter, code);
  document.body.replaceChildren(root);
  return root;
}

const hiddenIndexes = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-line][data-fold-hidden]")].map((el) =>
    Number(el.getAttribute("data-line-index"))
  );

const painting = (
  hidden: Array<number>,
  foldable: Array<number>,
  closed: Array<number>
) => ({
  hidden: new Set(hidden),
  foldable: new Set(foldable),
  closed: new Set(closed),
});

beforeEach(() => document.body.replaceChildren());

describe("paintFolds", () => {
  it("hides both halves of a row, so the numbers stay with the code", () => {
    const root = rendered(6);
    paintFolds(root, painting([2, 3], [1], [1]));
    expect(hiddenIndexes(root)).toEqual([2, 3]);
    expect(
      [...root.querySelectorAll("[data-column-number][data-fold-hidden]")].map(
        (el) => Number(el.getAttribute("data-line-index"))
      )
    ).toEqual([2, 3]);
  });

  it("reports how many rows it hid", () => {
    // Two lines, each with a gutter cell and a code row.
    expect(paintFolds(rendered(6), painting([2, 3], [1], [1]))).toBe(4);
  });

  it("leaves the header of a closed fold on screen, marked", () => {
    const root = rendered(6);
    paintFolds(root, painting([2, 3], [1], [1]));
    const header = root.querySelector("[data-line][data-line-index='1']");
    expect(header?.hasAttribute("data-fold-hidden")).toBe(false);
    expect(header?.hasAttribute("data-fold-closed")).toBe(true);
  });

  it("puts a chevron on a foldable line and takes it off the others", () => {
    const root = rendered(4);
    paintFolds(root, painting([], [1], []));
    expect(root.querySelectorAll("[data-fold-toggle]")).toHaveLength(1);
    expect(
      root.querySelector("[data-column-number][data-line-index='1']")
        ?.textContent
    ).toContain("▾");
  });

  it("turns the chevron round when the fold closes, without adding another", () => {
    const root = rendered(4);
    paintFolds(root, painting([], [1], []));
    paintFolds(root, painting([2], [1], [1]));
    const chevrons = root.querySelectorAll("[data-fold-toggle]");
    expect(chevrons).toHaveLength(1);
    expect(chevrons[0].textContent).toBe("▸");
  });

  it("undoes itself when a fold is opened again", () => {
    const root = rendered(6);
    paintFolds(root, painting([2, 3], [1], [1]));
    paintFolds(root, painting([], [1], []));
    expect(hiddenIndexes(root)).toEqual([]);
    expect(root.querySelectorAll("[data-fold-closed]")).toHaveLength(0);
  });

  it("repaints rows the virtualiser swapped in under it", () => {
    const root = rendered(6);
    paintFolds(root, painting([2, 3], [1], [1]));
    // A re-render replaces the rows; the next pass has to mark them again.
    const fresh = rendered(6);
    paintFolds(fresh, painting([2, 3], [1], [1]));
    expect(hiddenIndexes(fresh)).toEqual([2, 3]);
  });
});

describe("clearFolds", () => {
  it("puts every row back and takes the chevrons away", () => {
    const root = rendered(6);
    paintFolds(root, painting([2, 3], [1], [1]));
    clearFolds(root);
    expect(hiddenIndexes(root)).toEqual([]);
    expect(root.querySelectorAll("[data-fold-toggle]")).toHaveLength(0);
    expect(root.querySelectorAll("[data-foldable]")).toHaveLength(0);
  });
});

/** A press on `element`, seen the way a listener on `window` sees it. */
const pressOn = (element: Element | null): Event => {
  const event = new MouseEvent("pointerdown", {
    bubbles: true,
    composed: true,
  });
  element?.dispatchEvent(event);
  return event;
};

describe("foldTargetOf", () => {
  it("answers to the chevron", () => {
    const root = rendered(4);
    paintFolds(root, painting([], [1], []));
    expect(
      foldTargetOf(pressOn(root.querySelector("[data-fold-toggle]")))
    ).toBe(1);
  });

  it("answers to a click on a closed line, whose body cannot be clicked", () => {
    const root = rendered(4);
    paintFolds(root, painting([2], [1], [1]));
    expect(
      foldTargetOf(
        pressOn(root.querySelector("[data-line][data-line-index='1']"))
      )
    ).toBe(1);
  });

  it("leaves an open line's gutter to the editor, which selects lines with it", () => {
    const root = rendered(4);
    paintFolds(root, painting([], [1], []));
    expect(
      foldTargetOf(
        pressOn(
          root.querySelector(
            "[data-column-number][data-line-index='1'] [data-line-number-content]"
          )
        )
      )
    ).toBeNull();
  });

  it("ignores a click on a line that folds nothing", () => {
    const root = rendered(4);
    paintFolds(root, painting([], [1], []));
    expect(
      foldTargetOf(
        pressOn(root.querySelector("[data-line][data-line-index='3']"))
      )
    ).toBeNull();
  });
});
