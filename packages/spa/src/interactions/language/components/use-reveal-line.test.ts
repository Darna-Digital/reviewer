// @vitest-environment jsdom
/**
 * The jump into a file, with the file view arriving late.
 *
 * jsdom has no layout, so the scroller is a plain div with its metrics stood up
 * by hand: `scrollTop` is backed by a variable (jsdom's own setter is a no-op
 * without a layout box) and the rects move with it, the way a real scroll moves
 * the content under the viewport.
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRevealLine } from "./use-reveal-line";

const CLIENT_HEIGHT = 500;
const SCROLL_HEIGHT = 10000;
/** Where line 100 sits in the content, measured from the top of the file. */
const LINE_OFFSET = 900;
const LINE_HEIGHT = 20;
/** Centring line 100 in the viewport: 900 - 500/2 + 20/2. */
const CENTRED = LINE_OFFSET - CLIENT_HEIGHT / 2 + LINE_HEIGHT / 2;

/** A scroller carrying one rendered line, with layout stood up by hand. */
const makeScroller = (line: number | null) => {
  const container = document.createElement("div");
  let scrollTop = 0;
  Object.defineProperty(container, "scrollTop", {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.min(Math.max(value, 0), SCROLL_HEIGHT - CLIENT_HEIGHT);
    },
  });
  Object.defineProperty(container, "clientHeight", {
    get: () => CLIENT_HEIGHT,
  });
  Object.defineProperty(container, "scrollHeight", {
    get: () => SCROLL_HEIGHT,
  });
  container.getBoundingClientRect = () => new DOMRect(0, 0, 800, CLIENT_HEIGHT);

  if (line !== null) {
    const element = document.createElement("div");
    element.setAttribute("data-line", String(line));
    // The line rides up the viewport as the container scrolls.
    element.getBoundingClientRect = () =>
      new DOMRect(0, LINE_OFFSET - scrollTop, 800, LINE_HEIGHT);
    container.append(element);
  }
  document.body.append(container);
  return container;
};

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("useRevealLine", () => {
  it("scrolls a rendered line to the middle of the view", async () => {
    const container = makeScroller(100);
    renderHook(() =>
      useRevealLine(
        () => container,
        { path: "a.ts", line: 100, key: 1 },
        400,
        "a.ts"
      )
    );

    // The flash goes on the frame the line is first sighted and comes off
    // 1.6s later, while the scroll converges a quarter of the way per frame —
    // so it is waited for first. Asserting it after the scroll had settled read
    // the attribute after its own timer had taken it away again on a slow run.
    await waitFor(() => {
      const flashed = container.querySelector("[data-line='100']");
      expect(flashed?.hasAttribute("data-revealed")).toBe(true);
    });
    await waitFor(() => expect(container.scrollTop).toBeCloseTo(CENTRED, 0));
  });

  it("waits for a view that is still loading, rather than spending the request on nothing", async () => {
    // The file is being read, highlighted and primed: the pane holds a loading
    // placeholder and there is no scroller to write to yet.
    let container: HTMLElement | null = null;
    const getScroller = () => container;
    renderHook(() =>
      useRevealLine(
        getScroller,
        { path: "a.ts", line: 100, key: 1 },
        400,
        "a.ts"
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    container = makeScroller(100);

    await waitFor(() => expect(container?.scrollTop).toBeCloseTo(CENTRED, 0));
  });

  it("leaves the view alone when the request names another file", async () => {
    const container = makeScroller(100);
    renderHook(() =>
      useRevealLine(
        () => container,
        { path: "b.ts", line: 100, key: 1 },
        400,
        "a.ts"
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(container.scrollTop).toBe(0);
  });

  it("estimates a line the virtualiser has not rendered yet", async () => {
    // Nothing to measure against, so the scroll goes where the line should be —
    // which is what makes the virtualiser build that region and the line appear.
    const container = makeScroller(null);
    renderHook(() =>
      useRevealLine(
        () => container,
        { path: "a.ts", line: 200, key: 1 },
        400,
        "a.ts"
      )
    );

    await waitFor(() => expect(container.scrollTop).toBeGreaterThan(0));
    // (200 - 1) / 400 of the content, less half a viewport.
    expect(container.scrollTop).toBeCloseTo(
      (199 / 400) * SCROLL_HEIGHT - CLIENT_HEIGHT / 2,
      0
    );
  });
});
