import { describe, expect, it } from "vitest";
import {
  keepWarm,
  LAUNCHPAD_MIN_HEIGHT,
  LIVE_PREVIEW_LIMIT,
  launchpadHeightCss,
  launchpadMaxHeight,
  OVERVIEW_TRANSITION_MS,
  previewFrameStyle,
  PREVIEW_ZOOM,
  staggeredBootMs,
} from "./tab-preview.functions";

describe("previewFrameStyle", () => {
  it("sizes the frame so the scale lands back on its box", () => {
    expect(previewFrameStyle(0.25)).toEqual({
      width: "400%",
      height: "400%",
      transform: "scale(0.25)",
      transformOrigin: "top left",
    });
  });

  it("scales from the top left, so the page hangs where the box starts", () => {
    expect(previewFrameStyle(PREVIEW_ZOOM).transformOrigin).toBe("top left");
  });
});

describe("keepWarm", () => {
  it("holds the frames most recently shown", () => {
    expect(keepWarm(keepWarm([], "a"), "b")).toEqual(["b", "a"]);
  });

  it("drops the coldest frame once the cache is full", () => {
    const full = ["c", "b", "a"];

    expect(keepWarm(full, "d", 3)).toEqual(["d", "c", "b"]);
  });

  it("moves a frame back to the head instead of holding it twice", () => {
    expect(keepWarm(["c", "b", "a"], "a", 3)).toEqual(["a", "c", "b"]);
  });

  it("leaves the list alone when the same frame is shown again", () => {
    const warm = ["a", "b"];

    expect(keepWarm(warm, "a")).toBe(warm);
  });
});

describe("staggeredBootMs", () => {
  it("starts the first preview with the panel, not after it", () => {
    expect(staggeredBootMs(0)).toBe(0);
  });

  it("has every preview up well inside the slide", () => {
    expect(staggeredBootMs(LIVE_PREVIEW_LIMIT)).toBeLessThan(
      OVERVIEW_TRANSITION_MS
    );
  });

  it("starts each card after the one before it, never together", () => {
    expect(staggeredBootMs(3) - staggeredBootMs(2)).toBe(
      staggeredBootMs(2) - staggeredBootMs(1)
    );
    expect(staggeredBootMs(1)).toBeGreaterThan(staggeredBootMs(0));
  });
});

describe("launchpadHeightCss", () => {
  it("asks for the height it was dragged to", () => {
    expect(launchpadHeightCss(420)).toContain("420px");
  });

  it("leaves the page a strip of the window whatever was stored", () => {
    expect(launchpadHeightCss(2000)).toBe("min(2000px, calc(100svh - 192px))");
  });

  it("never collapses past a row of cards", () => {
    expect(launchpadHeightCss(10)).toContain(`${LAUNCHPAD_MIN_HEIGHT}px`);
  });
});

describe("launchpadMaxHeight", () => {
  it("stops the drag short of the window's own bottom", () => {
    expect(launchpadMaxHeight(900)).toBeLessThan(900);
  });

  it("still allows the shortest panel in a window with no room", () => {
    expect(launchpadMaxHeight(200)).toBe(LAUNCHPAD_MIN_HEIGHT);
  });
});
