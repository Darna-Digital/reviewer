/**
 * The geometry and timing a preview is drawn with. It is all decidable from a
 * zoom and a card's place in the grid, so none of it needs a rendered preview —
 * or a frame to load — to test.
 */
import type { CSSProperties } from "react";
import type { PreviewZoom } from "../interfaces/tab-preview.interfaces";

/**
 * A preview keeps a desktop-shaped window and shrinks it, rather than loading
 * the app into a narrow one: what you see is the page as the tab holds it, not
 * a phone layout of it. The zoom is what the box's own width is divided by, so
 * a card that grows previews a wider window rather than a larger one.
 */
export const PREVIEW_ZOOM: PreviewZoom = 0.3;

/**
 * The window the pictures are taken in. A desktop shape, in the launchpad's own
 * proportions, so what comes back fills a card rather than being cropped into
 * one.
 */
export const MILL_WIDTH = 1280;
export const MILL_HEIGHT = 800;

/** Preview boxes are the shape of a window, so a page fills one as it would. */
export const PREVIEW_ASPECT = "16 / 10";

/** Size a frame so that, once scaled down, it exactly fills its box. */
export function previewFrameStyle(zoom: PreviewZoom): CSSProperties {
  const extent = `${100 / zoom}%`;
  return {
    width: extent,
    height: extent,
    transform: `scale(${zoom})`,
    transformOrigin: "top left",
  };
}

/** How long the panel takes to slide in, and the page under it to be pushed. */
export const OVERVIEW_TRANSITION_MS = 260;

/**
 * The longest the launchpad will stay up waiting for a page it was asked for.
 * Covering the window while the page it is about to show loads is what keeps
 * the last one from flashing past; covering it indefinitely is a hang.
 */
export const PICK_COVER_CEILING_MS = 1_200;

/** A promise that settles after `ms`, for racing something slower against. */
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * Cards past this many keep their title and drop the picture. A strip long
 * enough to reach this is one you are reading titles off anyway, and every
 * extra card is another page the renderer has to work its way round to.
 */
export const LIVE_PREVIEW_LIMIT = 12;

/** The shortest the launchpad is worth being: a row of cards and its header. */
export const LAUNCHPAD_MIN_HEIGHT = 220;

/**
 * Dragged shorter than this, the launchpad closes instead of sitting at its
 * floor. Pulling the seam up to nothing is how you say you are done with it,
 * and a panel that refuses to go any smaller has nowhere to put that.
 *
 * Well clear of the floor, so the last stretch of an ordinary resize is not
 * spent worrying about dismissing it by accident.
 */
export const LAUNCHPAD_DISMISS_HEIGHT = 140;

/** How much of the pushed page stays on screen however far the panel is dragged. */
export const LAUNCHPAD_PAGE_FLOOR = 192;

/**
 * The panel's height, and so exactly how far the page below it is pushed. It is
 * left as CSS rather than resolved here so both follow the window without a
 * resize listener: a window shrunk under a launchpad taller than it takes the
 * floor back, and the stored height returns when the window grows again.
 */
export const launchpadHeightCss = (stored: number): string =>
  `min(${Math.max(stored, LAUNCHPAD_MIN_HEIGHT)}px, calc(100svh - ${LAUNCHPAD_PAGE_FLOOR}px))`;

/** The tallest a drag can make the panel in the window it is being dragged in. */
export const launchpadMaxHeight = (viewportHeight: number): number =>
  Math.max(LAUNCHPAD_MIN_HEIGHT, viewportHeight - LAUNCHPAD_PAGE_FLOOR);
