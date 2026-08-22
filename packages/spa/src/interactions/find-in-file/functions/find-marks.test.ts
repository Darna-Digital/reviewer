// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findRanges, topVisibleLine } from "./find-marks";
import type { FindMatch } from "../interfaces/find-in-file.interfaces";

/**
 * A stand-in for what `@pierre/diffs` renders: lines carrying `data-line`, and
 * tokens inside them carrying the column they start at. The real view puts all
 * of it behind a shadow root, which `codeRootOf` steps through; a plain element
 * is the other half of that contract and is what these tests use.
 */
const view = (lines: ReadonlyArray<ReadonlyArray<string>>): HTMLElement => {
  const host = document.createElement("div");
  lines.forEach((tokens, index) => {
    const line = document.createElement("div");
    line.setAttribute("data-line", String(index + 1));
    // Line numbers live in the line element too, and carry no `data-char` —
    // counting their text would shift every column along.
    const gutter = document.createElement("span");
    gutter.textContent = String(index + 1);
    line.append(gutter);
    let column = 0;
    for (const text of tokens) {
      const token = document.createElement("span");
      token.setAttribute("data-char", String(column));
      token.textContent = text;
      line.append(token);
      column += text.length;
    }
    host.append(line);
  });
  return host;
};

const match = (line: number, start: number, end: number): FindMatch => ({
  line,
  start,
  end,
});

describe("findRanges", () => {
  it("covers exactly the matched characters, not the whole token", () => {
    const host = view([["const", " ", "value", " = 1;"]]);
    const { rest, current } = findRanges(host, [match(1, 6, 11)], -1);
    expect(current).toHaveLength(0);
    expect(rest).toHaveLength(1);
    expect(rest[0].toString()).toBe("value");
  });

  it("splits a match that runs across two tokens", () => {
    const host = view([["foo", "bar"]]);
    const { rest } = findRanges(host, [match(1, 2, 5)], -1);
    expect(rest.map((range) => range.toString())).toEqual(["o", "ba"]);
  });

  it("hands the current match to its own list", () => {
    const host = view([["value"], ["value"]]);
    const { rest, current } = findRanges(
      host,
      [match(1, 0, 5), match(2, 0, 5)],
      1
    );
    expect(rest).toHaveLength(1);
    expect(current).toHaveLength(1);
  });

  it("ignores matches on lines that are not rendered", () => {
    const host = view([["value"]]);
    expect(findRanges(host, [match(9, 0, 5)], 0).rest).toEqual([]);
  });

  it("has nothing to do without matches", () => {
    const host = view([["value"]]);
    expect(findRanges(host, [], 0)).toEqual({ rest: [], current: [] });
  });
});

describe("topVisibleLine", () => {
  /** jsdom lays nothing out, so the geometry has to be stated. */
  const place = (element: Element, top: number, height: number) => {
    element.getBoundingClientRect = () =>
      ({ top, bottom: top + height, height }) as DOMRect;
  };

  it("has no answer before anything is rendered", () => {
    expect(topVisibleLine(document.createElement("div"))).toBeNull();
  });

  it("names the first line whose bottom clears the top of the scroller", () => {
    const scroller = view([["a"], ["b"], ["c"]]);
    place(scroller, 100, 300);
    const lines = [...scroller.querySelectorAll("[data-line]")];
    // The first line is scrolled off the top; the second straddles the edge.
    place(lines[0], 60, 20);
    place(lines[1], 90, 20);
    place(lines[2], 110, 20);
    expect(topVisibleLine(scroller)).toEqual({ line: 2, character: 0 });
  });

  it("has no answer when every line is above the viewport", () => {
    const scroller = view([["a"]]);
    place(scroller, 100, 300);
    place(scroller.querySelector("[data-line]")!, 0, 20);
    expect(topVisibleLine(scroller)).toBeNull();
  });
});
