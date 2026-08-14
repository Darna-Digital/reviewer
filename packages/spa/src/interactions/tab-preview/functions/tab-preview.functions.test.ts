import { describe, expect, it } from "vitest";
import {
  LAUNCHPAD_DISMISS_HEIGHT,
  LAUNCHPAD_MIN_HEIGHT,
  launchpadHeightCss,
  launchpadMaxHeight,
  MILL_HEIGHT,
  MILL_WIDTH,
  PREVIEW_ASPECT,
  previewFrameStyle,
  PREVIEW_ZOOM,
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

describe("the window pictures are taken in", () => {
  it("is the shape a card shows them in, so nothing is cropped to fit", () => {
    const [wide, tall] = PREVIEW_ASPECT.split("/").map(Number);

    expect(MILL_WIDTH / MILL_HEIGHT).toBeCloseTo(wide / tall);
  });

  it("is a desktop, so a page lays itself out as the tab holds it", () => {
    expect(MILL_WIDTH).toBeGreaterThanOrEqual(1024);
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

describe("dragging the launchpad shut", () => {
  it("only closes well past the floor, so an ordinary resize cannot", () => {
    expect(LAUNCHPAD_DISMISS_HEIGHT).toBeLessThan(LAUNCHPAD_MIN_HEIGHT);
    expect(LAUNCHPAD_MIN_HEIGHT - LAUNCHPAD_DISMISS_HEIGHT).toBeGreaterThan(50);
  });

  it("leaves the panel at its floor for the stretch before that", () => {
    expect(launchpadHeightCss(LAUNCHPAD_DISMISS_HEIGHT + 1)).toContain(
      `${LAUNCHPAD_MIN_HEIGHT}px`
    );
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
