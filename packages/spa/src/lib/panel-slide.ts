/**
 * The slide a panel comes out of an edge with — one definition, wherever the
 * window uses it.
 *
 * The launchpad slides down out of the window bar and pushes the page off the
 * bottom. A panel that arrived a little faster or eased a little differently
 * would read as a second, nearly-identical idea rather than as the one the
 * window has.
 *
 * The ease is a decelerating curve — nearly all of the distance is covered in
 * the first half, and the panel settles rather than stopping. That is what lets
 * the page it is pushing be composited away without the eye following it: by
 * the time you have looked at what moved, it has arrived.
 */

/** How long a panel takes to slide in, and the page under it to be pushed. */
export const PANEL_SLIDE_MS = 260;

/** The curve they travel on, as the Tailwind arbitrary it is used as. */
export const PANEL_EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * The inline style that carries the duration. Inline rather than a class
 * because the panel, the page it pushes and the scrim over that page all have
 * to be given the same one, and a shared object is the only way to be sure they
 * were.
 */
export const PANEL_SLIDE = {
  transitionDuration: `${PANEL_SLIDE_MS}ms`,
} as const;
