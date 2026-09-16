/**
 * The rule between the line numbers and the code, drawn the full height of the
 * pane rather than the height of the file.
 *
 * `gutter-divider-css` can only reach as far as the rows: pierre draws the seam
 * with a border on each gutter cell, so the line starts below the code block's
 * top padding, stops at the last line, and leaves the empty space a short file
 * (or the scroll-past room under a long one) hangs below it unruled. An editor's
 * gutter runs the height of the editor — the line has to outlive the rows.
 *
 * So it is painted once, by the pane, as a 1px overlay pinned to the pane's own
 * top and bottom. The only thing it needs from the view is where to stand, and
 * that is not knowable in CSS out here: the column is as wide as the widest line
 * number in the mono face inside the shadow root, which a `ch` measured against
 * the app's sans font would not match. A ResizeObserver on the gutter publishes
 * its width to the pane as a custom property instead, so the line follows the
 * column across files of three digits and five, and through a font swap, without
 * this view re-rendering.
 */
import { useCallback, useEffect, useRef, type RefObject } from "react";

import { codeRootOf } from "@/lib/code-root";

const WIDTH_VAR = "--code-gutter-width";

export function useGutterRule(pane: RefObject<HTMLElement | null>) {
  const observer = useRef<ResizeObserver | null>(null);
  const observed = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const resize = new ResizeObserver((entries) => {
      const width = entries.at(-1)?.borderBoxSize[0]?.inlineSize;
      if (width === undefined) return;
      pane.current?.style.setProperty(WIDTH_VAR, `${width}px`);
    });
    observer.current = resize;
    return () => {
      resize.disconnect();
      observer.current = null;
      observed.current = null;
    };
  }, [pane]);

  /**
   * Runs after every render pass the virtualiser makes, so it does no work once
   * it holds the gutter — only a remount (the view is keyed per file) puts a
   * fresh shadow root, and a fresh gutter, in front of it.
   */
  return useCallback((container: HTMLElement) => {
    if (observed.current?.isConnected === true) return;
    const gutter = codeRootOf(container).querySelector("[data-gutter]");
    if (!(gutter instanceof HTMLElement)) return;
    if (observed.current !== null)
      observer.current?.unobserve(observed.current);
    observed.current = gutter;
    observer.current?.observe(gutter);
  }, []);
}

/**
 * Sits at the gutter's trailing edge, over the transparent pixel
 * `gutter-divider-css` leaves there for it. Absolute rather than in flow so it
 * paints above the code block, whose gutter carries an opaque background of its
 * own; `-1px` puts it on that pixel rather than on the code's first.
 */
export const GutterRule = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-y-0 w-px bg-border"
    style={{ left: `calc(var(${WIDTH_VAR}, 0px) - 1px)` }}
  />
);
