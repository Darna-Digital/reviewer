/**
 * The geometry and timing a preview is drawn with. It is all decidable from the
 * window the pictures are taken in and a card's place in the grid, so none of it
 * needs a rendered preview — or a page to load — to test.
 */
import { PANEL_SLIDE_MS } from "@/lib/panel-slide";

/**
 * The window the pictures are taken in. A desktop shape, in the launchpad's own
 * proportions, so what comes back fills a card rather than being cropped into
 * one — and a desktop one, so a page lays itself out as the app holds it rather
 * than as a phone would.
 *
 * A picture is the page at this size, scaled down by whatever card it lands in:
 * the layout it was captured with is baked into it, so the card is a smaller
 * view of the same window rather than the app run in a narrower one.
 */
export const MILL_WIDTH = 1280;
export const MILL_HEIGHT = 800;

/** Preview boxes are the shape of a window, so a page fills one as it would. */
export const PREVIEW_ASPECT = "16 / 10";

/** What the app's own page is, inside a preview window — see `WindowFrame`. */
export const PREVIEW_ROOT_SELECTOR = ".app-canvas";

/**
 * How long the panel takes to slide in, and the page under it to be pushed.
 *
 * The window's slide rather than the launchpad's own. See `panel-slide`.
 */
export const OVERVIEW_TRANSITION_MS = PANEL_SLIDE_MS;

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
 * Cards past this many keep their title and drop the picture. A grid long
 * enough to reach this is one you are reading titles off anyway, and every
 * extra card is another page the mill has to work its way round to.
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
 * The panel's height, and so exactly how far the page below it is pushed.
 *
 * The bounds are left as CSS rather than resolved here so both follow the window
 * without a resize listener: a window shrunk under a launchpad taller than it
 * takes the floor back, and the height returns when the window grows again.
 *
 * One expression, used by the panel and by the page it pushes, so the two can
 * never disagree about where the seam between them is.
 */
export const launchpadHeightCss = (height: number): string =>
  `clamp(${LAUNCHPAD_MIN_HEIGHT}px, ${height}px, calc(100svh - ${LAUNCHPAD_PAGE_FLOOR}px))`;

/** The tallest a drag can make the panel in the window it is being dragged in. */
export const launchpadMaxHeight = (viewportHeight: number): number =>
  Math.max(LAUNCHPAD_MIN_HEIGHT, viewportHeight - LAUNCHPAD_PAGE_FLOOR);

/**
 * The height the launchpad opens at: whatever its rows actually come to, held
 * between a single row and what the window can spare.
 *
 * Worked out afresh every time it opens rather than kept. A stored height is a
 * height from another moment — one fewer session open, a narrower window, or
 * the drag that shut the panel, which leaves behind the smallest height there
 * is — and opening on any of them is how a panel comes back with its last row
 * sliced in half.
 */
export const fittedLaunchpadHeight = (
  content: number,
  viewportHeight: number
): number =>
  Math.min(
    Math.max(content, LAUNCHPAD_MIN_HEIGHT),
    launchpadMaxHeight(viewportHeight)
  );
