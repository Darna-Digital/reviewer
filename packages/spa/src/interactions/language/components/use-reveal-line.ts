/**
 * Scroll a file view to a line and flash it, for go-to-definition and for
 * picking a usage out of the list.
 *
 * Mechanics follow the diff pane's file-scrolling effect, for the same reasons
 * documented there: native smooth scrolling is a no-op inside these nested
 * overflow containers, so the animation is rolled by hand, the target is
 * recomputed every frame while the content settles, and real user input takes
 * over immediately. The addition here is the first move — the target line is
 * usually not rendered yet, so an estimate gets the virtualiser to build it.
 */
import { useEffect } from "react";
import { queryInCode } from "@/lib/code-root";
import {
  estimateScrollTop,
  scrollTopForElement,
} from "../functions/reveal-line";

/** How long to keep chasing the line while the view lays out. */
const SETTLE_MS = 1200;
/** How long the revealed line stays highlighted. */
const FLASH_MS = 1600;

export interface RevealTarget {
  /** One-based line to bring into view. */
  readonly line: number;
  /** Bumped on every request, so revealing the same line twice works. */
  readonly key: number;
}

export function useRevealLine(
  /** Resolves the element that owns the scroll; views nest it differently. */
  getScroller: () => HTMLElement | null,
  target: RevealTarget | null,
  totalLines: number
) {
  const line = target?.line ?? null;
  const key = target?.key ?? 0;

  useEffect(() => {
    if (line === null) return;
    const container = getScroller();
    if (container === null) return;

    let active = true;
    let raf = 0;
    let flashed: HTMLElement | null = null;
    const startedAt = performance.now();
    const cleanups: Array<() => void> = [];

    // The scroller holds the view hosts; the lines live in their shadow roots.
    const lineElement = () =>
      queryInCode(container, `[data-line="${CSS.escape(String(line))}"]`);

    const stop = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
      for (const cleanup of cleanups) cleanup();
    };

    const frame = (now: number) => {
      if (!active) return;
      const element = lineElement();
      if (element === null) {
        // Not rendered yet: jump to where the line should be so the virtualiser
        // materialises that region, then look again next frame.
        container.scrollTop = estimateScrollTop(
          line,
          totalLines,
          container.scrollHeight,
          container.clientHeight
        );
      } else {
        const rect = element.getBoundingClientRect();
        const top = scrollTopForElement(
          rect.top,
          rect.height,
          container.getBoundingClientRect().top,
          container.scrollTop,
          container.clientHeight,
          container.scrollHeight
        );
        const delta = top - container.scrollTop;
        container.scrollTop =
          Math.abs(delta) <= 1 ? top : container.scrollTop + delta * 0.25;

        if (flashed !== element) {
          flashed?.removeAttribute("data-revealed");
          element.setAttribute("data-revealed", "");
          flashed = element;
        }
      }
      if (now - startedAt < SETTLE_MS) raf = requestAnimationFrame(frame);
      else stop();
    };

    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      container.addEventListener(type, stop, { passive: true });
      cleanups.push(() => container.removeEventListener(type, stop));
    }
    const unflash = setTimeout(
      () => flashed?.removeAttribute("data-revealed"),
      FLASH_MS
    );
    cleanups.push(() => {
      clearTimeout(unflash);
      flashed?.removeAttribute("data-revealed");
    });

    raf = requestAnimationFrame(frame);
    return stop;
    // `key` re-runs the effect when the same line is requested again.
  }, [line, key, totalLines, getScroller]);
}
