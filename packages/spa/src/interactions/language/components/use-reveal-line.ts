/**
 * Scroll a file view to a line and flash it, for go-to-definition and for
 * picking a usage out of the list.
 *
 * Mechanics follow the diff pane's file-scrolling effect, for the same reasons
 * documented there: native smooth scrolling is a no-op inside these nested
 * overflow containers, so the animation is rolled by hand, the target is
 * recomputed every frame while the content settles, and real user input takes
 * over immediately.
 *
 * Two things are asked for here that the diff pane never has to face, because
 * the jump lands in a file that is not on screen yet:
 *
 *  - the target line is usually not rendered, so an estimate gets the
 *    virtualiser to build that region first;
 *  - the *view* is usually not mounted either. Reading, highlighting and
 *    priming the file takes a moment, and the loading placeholder owns the pane
 *    until it is done — there is no scroller to write to. So the request waits
 *    for one to appear rather than being spent against a pane that has nothing
 *    to scroll: without that wait the first jump into a file silently did
 *    nothing and only a second one, against the now-cached file, worked.
 */
import { useEffect } from "react";
import { queryInCode } from "@/lib/code-root";
import {
  estimateScrollTop,
  scrollTopForElement,
} from "../functions/reveal-line";

/** How long to keep chasing the line while the view lays out. */
const SETTLE_MS = 1200;
/** How long to wait for the file view to mount before dropping the request. */
const MOUNT_MS = 15000;
/** How long the revealed line stays highlighted. */
const FLASH_MS = 1600;
/** How often the background-tab fallback checks in on a throttled animation. */
const FALLBACK_MS = 250;

export interface RevealTarget {
  /** File the line belongs to; a target for any other file is left alone. */
  readonly path: string;
  /** One-based line to bring into view. */
  readonly line: number;
  /** Bumped on every request, so revealing the same line twice works. */
  readonly key: number;
}

export function useRevealLine(
  /** Resolves the element that owns the scroll; views nest it differently. */
  getScroller: () => HTMLElement | null,
  target: RevealTarget | null,
  totalLines: number,
  /** The file on screen. A request for another one belongs to another view. */
  path: string,
  /**
   * Flash the line once it is on screen. On for a jump the user has to find on
   * arrival — a definition, a usage, a note — and off for stepping through find
   * matches, where the match is already highlighted and a flash on every press
   * of Enter is noise.
   */
  flash = true
) {
  const line = target !== null && target.path === path ? target.line : null;
  const key = target?.key ?? 0;

  useEffect(() => {
    if (line === null) return;

    let active = true;
    let raf = 0;
    /** When a frame last ran, so the fallback can tell rAF is throttled. */
    let lastFrame = 0;
    let flashed: HTMLElement | null = null;
    /** Cleared once the flash has had its time; only armed once the line shows. */
    let unflash: ReturnType<typeof setTimeout> | undefined;
    /** The scroller, once the view has mounted one. */
    let container: HTMLElement | null = null;
    /** Set once the line is on screen, so the flash is only wired up once. */
    let sighted = false;
    /** When to give up: extended as the view, then the line, materialise. */
    let deadline = 0;
    const requestedAt = performance.now();
    const cleanups: Array<() => void> = [];

    const stop = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
      for (const cleanup of cleanups) cleanup();
    };

    /**
     * The scroller once the file view replaces the loading placeholder. Latched
     * on first sight: it is only then that the chase has anything to act on, so
     * that is when the settle window starts and when the user's own input
     * becomes something that can take over.
     */
    const resolve = (now: number): HTMLElement | null => {
      if (container !== null) return container;
      const found = getScroller();
      if (found === null) return null;
      container = found;
      deadline = now + SETTLE_MS;
      for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        found.addEventListener(type, stop, { passive: true });
        cleanups.push(() => found.removeEventListener(type, stop));
      }
      return found;
    };

    // The scroller holds the view hosts; the lines live in their shadow roots.
    const lineElement = (scroller: HTMLElement) =>
      queryInCode(scroller, `[data-line="${CSS.escape(String(line))}"]`);

    /**
     * One move towards the line. `instant` lands on it outright, for the
     * fallback below; the animation eases a quarter of the way each frame.
     */
    const step = (scroller: HTMLElement, now: number, instant: boolean) => {
      const element = lineElement(scroller);
      if (element === null) {
        // Not rendered yet: jump to where the line should be so the virtualiser
        // materialises that region, then look again next frame.
        scroller.scrollTop = estimateScrollTop(
          line,
          totalLines,
          scroller.scrollHeight,
          scroller.clientHeight
        );
        return;
      }
      const rect = element.getBoundingClientRect();
      const top = scrollTopForElement(
        rect.top,
        rect.height,
        scroller.getBoundingClientRect().top,
        scroller.scrollTop,
        scroller.clientHeight,
        scroller.scrollHeight
      );
      const delta = top - scroller.scrollTop;
      scroller.scrollTop =
        instant || Math.abs(delta) <= 1
          ? top
          : scroller.scrollTop + delta * 0.25;

      if (!sighted) {
        // The line only just rendered — the estimate may have spent most of the
        // window getting the virtualiser here, so give the correction its own,
        // and start the flash from the moment there is something to flash.
        sighted = true;
        deadline = now + SETTLE_MS;
        if (flash) {
          unflash = setTimeout(
            () => flashed?.removeAttribute("data-revealed"),
            FLASH_MS
          );
        }
      }
      if (flash && flashed !== element) {
        flashed?.removeAttribute("data-revealed");
        element.setAttribute("data-revealed", "");
        flashed = element;
      }
    };

    const frame = (now: number) => {
      if (!active) return;
      lastFrame = now;
      const scroller = resolve(now);
      if (scroller === null) {
        // Still loading. Keep the request alive for the view to arrive.
        if (now - requestedAt < MOUNT_MS) raf = requestAnimationFrame(frame);
        else stop();
        return;
      }
      step(scroller, now, false);
      if (now < deadline) raf = requestAnimationFrame(frame);
      else stop();
    };

    // Background-tab fallback: rAF is throttled there, so a timer lands on the
    // line outright whenever frames have stopped running.
    const fallback = setInterval(() => {
      if (!active) return;
      const now = performance.now();
      if (now - lastFrame < 100) return;
      const scroller = resolve(now);
      if (scroller === null) {
        if (now - requestedAt >= MOUNT_MS) stop();
        return;
      }
      step(scroller, now, true);
      if (now >= deadline) stop();
    }, FALLBACK_MS);
    cleanups.push(() => clearInterval(fallback));

    cleanups.push(() => {
      clearTimeout(unflash);
      flashed?.removeAttribute("data-revealed");
    });

    raf = requestAnimationFrame(frame);
    return stop;
    // `key` re-runs the effect when the same line is requested again.
  }, [line, key, totalLines, getScroller, path, flash]);
}
