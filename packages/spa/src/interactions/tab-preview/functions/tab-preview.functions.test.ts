import { describe, expect, it } from "vitest";
import {
  fittedLaunchpadHeight,
  LAUNCHPAD_DISMISS_HEIGHT,
  LAUNCHPAD_MIN_HEIGHT,
  launchpadHeightCss,
  launchpadMaxHeight,
  MILL_HEIGHT,
  MILL_WIDTH,
  PREVIEW_ASPECT,
} from "./tab-preview.functions";

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
  it("asks for the height it is being drawn at", () => {
    expect(launchpadHeightCss(420)).toContain("420px");
  });

  it("leaves the page a strip of the window however tall it is asked to be", () => {
    expect(launchpadHeightCss(2000)).toContain("calc(100svh - 192px)");
  });

  it("never collapses past a row of cards", () => {
    expect(launchpadHeightCss(10)).toContain(`${LAUNCHPAD_MIN_HEIGHT}px`);
  });

  it("holds both bounds itself, so the panel and the page cannot disagree", () => {
    expect(launchpadHeightCss(500)).toBe(
      `clamp(${LAUNCHPAD_MIN_HEIGHT}px, 500px, calc(100svh - 192px))`
    );
  });
});

describe("dragging the launchpad shut", () => {
  it("only closes well past the floor, so an ordinary resize cannot", () => {
    expect(LAUNCHPAD_DISMISS_HEIGHT).toBeLessThan(LAUNCHPAD_MIN_HEIGHT);
    expect(LAUNCHPAD_MIN_HEIGHT - LAUNCHPAD_DISMISS_HEIGHT).toBeGreaterThan(50);
  });
});

describe("fittedLaunchpadHeight", () => {
  it("opens on exactly the rows there are", () => {
    expect(fittedLaunchpadHeight(460, 900)).toBe(460);
  });

  it("takes no notice of the height the last drag left behind", () => {
    expect(fittedLaunchpadHeight(460, 900)).toBe(
      fittedLaunchpadHeight(460, 900)
    );
    expect(fittedLaunchpadHeight(LAUNCHPAD_DISMISS_HEIGHT, 900)).toBe(
      LAUNCHPAD_MIN_HEIGHT
    );
  });

  it("never asks for more of the window than it can spare", () => {
    expect(fittedLaunchpadHeight(5000, 900)).toBe(launchpadMaxHeight(900));
  });

  it("still stands a row tall with nothing to show", () => {
    expect(fittedLaunchpadHeight(0, 900)).toBe(LAUNCHPAD_MIN_HEIGHT);
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
