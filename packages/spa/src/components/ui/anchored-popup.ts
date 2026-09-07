/**
 * What keeps an anchored surface with the thing it belongs to when the view
 * moves under it.
 *
 * A popup is positioned from JavaScript against a rectangle it re-measures as
 * the view scrolls, and two things follow from that. It cannot keep up with a
 * fast scroll — the position it paints is the one from a frame or two ago, so
 * the surface visibly swims after its anchor. And once the anchor has left its
 * scroller the popup is still inside the viewport, so collision handling parks
 * it at the edge of the screen, stranded over unrelated UI.
 */
import * as React from "react";

/**
 * Takes a popup out of sight, and out of the pointer's way, for as long as its
 * anchor is scrolled out of view. Base UI flags that moment on the positioner,
 * which is the element this belongs on.
 */
export const HIDDEN_WITH_ANCHOR =
  "data-[anchor-hidden]:pointer-events-none data-[anchor-hidden]:opacity-0";

/**
 * Dismisses a surface the pointer opened — a tooltip, a hover card — as soon as
 * the user scrolls, instead of dragging it along behind the row it came from.
 *
 * Wheel and touch rather than `scroll`, so that a list scrolling itself, to
 * bring a focused item into view, does not count as the user moving on.
 */
export function useDismissOnUserScroll(open: boolean, dismiss: () => void) {
  const latest = React.useRef(dismiss);
  React.useEffect(() => {
    latest.current = dismiss;
  });

  React.useEffect(() => {
    if (!open) return;
    const onUserScroll = () => latest.current();
    const options = { capture: true, passive: true } as const;
    window.addEventListener("wheel", onUserScroll, options);
    window.addEventListener("touchmove", onUserScroll, options);
    return () => {
      window.removeEventListener("wheel", onUserScroll, true);
      window.removeEventListener("touchmove", onUserScroll, true);
    };
  }, [open]);
}
