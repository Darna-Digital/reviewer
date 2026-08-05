// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { codeRootOf, codeRootsWithin, queryInCode } from "./code-root";

/**
 * `@pierre/diffs` renders into a `<diffs-container>` shadow root. Missing that
 * boundary is not a visible failure — queries just return nothing — so these
 * tests pin it down.
 *
 * Importing the package registers the custom element, whose constructor already
 * attaches the shadow root, so these helpers reuse it rather than attaching
 * another (which throws).
 */
const shadowOf = (host: HTMLElement) =>
  host.shadowRoot ?? host.attachShadow({ mode: "open" });

const makeHost = () => {
  const host = document.createElement("diffs-container");
  return { host, shadow: shadowOf(host) };
};

const withShadowedLines = (lines: ReadonlyArray<number>) => {
  const scroller = document.createElement("div");
  const { host, shadow } = makeHost();
  for (const line of lines) {
    const element = document.createElement("div");
    element.setAttribute("data-line", String(line));
    shadow.append(element);
  }
  scroller.append(host);
  return { scroller, host, shadow };
};

describe("codeRootOf", () => {
  it("returns the shadow root of a view", () => {
    const { host, shadow } = withShadowedLines([1]);
    expect(codeRootOf(host)).toBe(shadow);
  });

  it("falls back to the element when it has no shadow root", () => {
    const plain = document.createElement("div");
    expect(codeRootOf(plain)).toBe(plain);
  });
});

describe("codeRootsWithin", () => {
  it("finds the shadow root of each view in a scroller", () => {
    const scroller = document.createElement("div");
    const shadows = [0, 1].map(() => {
      const { host, shadow } = makeHost();
      scroller.append(host);
      return shadow;
    });
    expect(codeRootsWithin(scroller)).toEqual(shadows);
  });

  it("falls back to the container when it holds no views", () => {
    const scroller = document.createElement("div");
    expect(codeRootsWithin(scroller)).toEqual([scroller]);
  });

  it("ignores an element that is not a view", () => {
    const scroller = document.createElement("div");
    scroller.append(document.createElement("section"));
    expect(codeRootsWithin(scroller)).toEqual([scroller]);
  });
});

describe("queryInCode", () => {
  it("finds a line inside a view's shadow root", () => {
    const { scroller } = withShadowedLines([1, 2, 3]);
    // The whole point: this selector finds nothing from the scroller itself.
    expect(scroller.querySelector('[data-line="2"]')).toBeNull();
    expect(queryInCode(scroller, '[data-line="2"]')).not.toBeNull();
  });

  it("returns null when no view holds the line", () => {
    const { scroller } = withShadowedLines([1]);
    expect(queryInCode(scroller, '[data-line="9"]')).toBeNull();
  });

  it("still works when the lines are in the light DOM", () => {
    const scroller = document.createElement("div");
    const line = document.createElement("div");
    line.setAttribute("data-line", "4");
    scroller.append(line);
    expect(queryInCode(scroller, '[data-line="4"]')).toBe(line);
  });
});
