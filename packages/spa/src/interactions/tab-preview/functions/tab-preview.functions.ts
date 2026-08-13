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
 * The first preview starts with the panel rather than after it: the launchpad is
 * the previews, and a grid that arrives empty and fills in later reads as the
 * app being slow rather than as care being taken. Frames stay warm once booted,
 * so this is only ever paid the first time a tab is looked at.
 */
export const PREVIEW_INTENT_MS = 0;

/**
 * Each card starts a frame behind the one before it. A dozen whole apps booting
 * in the same tick locks the window up long enough to be felt — including by the
 * slide itself — so they are spread just far enough apart to keep it moving,
 * which still lands them all inside the animation.
 */
const BOOT_STAGGER_MS = 20;

export const staggeredBootMs = (index: number): number =>
  PREVIEW_INTENT_MS + index * BOOT_STAGGER_MS;

/**
 * Cards past this many keep their title and drop the live view. Every frame is
 * an app left running for as long as the overview is open, and a strip long
 * enough to reach this is one you are reading titles off anyway.
 */
export const LIVE_PREVIEW_LIMIT = 12;

/**
 * How many booted frames are held at once. A frame that is kept costs the
 * memory of an idle app and saves the whole of its boot, so the ones you have
 * just been looking at are worth keeping and the rest are not.
 */
export const WARM_PREVIEW_LIMIT = 6;

/**
 * Move `key` to the head of the warm list, dropping whatever falls off the end.
 * Returns the list unchanged when it is already at the head, so a preview being
 * shown again does not make every other frame re-render.
 */
export function keepWarm(
  warm: ReadonlyArray<string>,
  key: string,
  limit = WARM_PREVIEW_LIMIT
): ReadonlyArray<string> {
  if (warm[0] === key) return warm;
  return [key, ...warm.filter((held) => held !== key)].slice(0, limit);
}

/** The shortest the launchpad is worth being: a row of cards and its header. */
export const LAUNCHPAD_MIN_HEIGHT = 220;

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
