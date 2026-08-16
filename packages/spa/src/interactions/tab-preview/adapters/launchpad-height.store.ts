/**
 * The height the launchpad is drawn at while a drag is moving it.
 *
 * A drag reports a height sixty times a second, and there are three places to
 * put it. As React state it is sixty renders of the grid, every picture in it
 * and the page underneath — which is what made the gesture stutter, and what
 * `usePanelSize` exists to avoid for the side panes. As a custom property on the
 * document it is sixty full style recalculations instead: custom properties
 * inherit, so touching one on the root dirties every node beneath it, and this
 * document now holds a page's worth of nodes per card.
 *
 * So it is written straight onto the two boxes that answer to it — the panel,
 * and the page it pushes. Height and transform inherit nothing, so a frame of
 * the drag costs two style invalidations and the layout they imply, and nothing
 * else in the window hears about it. React is told once, when the drag ends and
 * the height is worth remembering.
 */
import { useLayoutEffect } from "react";

/** Draws one element at `height`; called for every frame of a drag. */
export type DrawLaunchpad = (height: number) => void;

const drawing = new Set<DrawLaunchpad>();
let live = 0;

/** The height being drawn right now — what a drag starts measuring from. */
export const launchpadHeightNow = (): number => live;

export function drawLaunchpadHeight(height: number): void {
  live = height;
  for (const draw of drawing) draw(height);
}

/**
 * Draw with `draw` from now on, and once immediately. `draw` has to be stable —
 * a `useCallback` with no dependencies — since it is the identity the set holds.
 */
export function useDrawLaunchpad(draw: DrawLaunchpad): void {
  useLayoutEffect(() => {
    drawing.add(draw);
    draw(live);
    return () => {
      drawing.delete(draw);
    };
  }, [draw]);
}
