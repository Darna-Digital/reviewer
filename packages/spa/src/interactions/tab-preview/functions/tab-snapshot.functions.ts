/**
 * When the pictures are taken, and in what order.
 *
 * A preview used to be the tab's app, live, one instance per card — a dozen
 * React roots booting into a dozen sockets and their own round of every request
 * the page makes, all so you could glance at a thumbnail. What a glance
 * actually needs is the markup, so that is what is kept: the page is rendered
 * once somewhere off screen, its DOM is lifted out of it (see
 * `preview-capture`), and the card hangs that copy up beside the app.
 *
 * The cost moves from "every card, all the time" to "one page at a time, in the
 * gaps", and opening the launchpad costs nothing at all — by the time it is
 * asked for, the pictures have been waiting.
 */
import type { PreviewCapture } from "./preview-capture.functions";

/**
 * How long a full pass over the sections waits before starting the next one.
 * The launchpad being open is what makes a picture worth refreshing promptly;
 * with it shut the mill is only keeping the next opening warm, and can take its
 * time about it.
 */
export const SNAPSHOT_REFRESH_MS = 10_000;
export const BACKGROUND_REFRESH_MS = 60_000;

/**
 * How often the mill looks for something worth photographing. Each picture
 * keeps its own clock now, so a sweep that finds nothing due costs a walk of a
 * dozen numbers — which is why it can afford to come round this often, and why
 * a section falling due no longer waits out a whole pass over the others.
 */
export const SWEEP_MS = 1_000;

/**
 * How long the page in the preview frame is kept before it is booted afresh.
 *
 * Steering one document from section to section is what makes a pass cheap, and
 * a document steered for long enough is one carrying every page it has been:
 * caches held, listeners attached, whatever an hour of navigating leaves
 * behind. The reboot is the reset — rare enough to cost nothing, often enough
 * that no preview is a picture of a document that has drifted.
 */
export const PREVIEW_REBOOT_MS = 5 * 60_000;

/**
 * How long the page in the frame is given to arrive at a section it was steered
 * to, before the mill gives up and boots the frame instead.
 *
 * Short, because there is nothing to load: the code is in hand and the router
 * is already up. A steer that has not landed by now is not a slow navigation,
 * it is a page that is not listening — a document mid-reload, or one from
 * before the channel existed.
 */
export const SNAPSHOT_STEER_TIMEOUT_MS = 4_000;

/**
 * What a steered page is given to draw before its picture is taken. A fraction
 * of a boot's settle: the app is up, its code is parsed and most of what the
 * next page asks for it has already been told.
 */
export const SNAPSHOT_STEER_SETTLE_MS = 500;

/**
 * How long a page is given to render before its picture is taken. Generous,
 * because nobody is waiting: the mill works in the background, and the half
 * second is the difference between a page and the shell it arrives as.
 */
export const SNAPSHOT_SETTLE_MS = 1_200;

/**
 * What the first page of a run is given instead. It is not only a page loading
 * — it is the app booting into a window of its own, with none of its code in
 * hand and none of its queries answered, and a picture taken at the usual
 * moment is a picture of the shell it starts as.
 */
export const SNAPSHOT_COLD_SETTLE_MS = 2_500;

/**
 * How long to wait before coming round again when something in the grid has no
 * picture at all. A section that has never been drawn is worth going back for
 * now; one whose picture is merely a minute old is not.
 */
export const SNAPSHOT_RETRY_MS = 1_000;

/** When to give up on a page that never finished loading and move on. */
export const SNAPSHOT_TIMEOUT_MS = 15_000;

/**
 * The most markup a picture is worth holding. A page that serialises past this
 * is one whose thumbnail would cost more memory than the section it stands for
 * — a diff of a few thousand lines — so it keeps its title card instead.
 */
export const SNAPSHOT_MAX_CHARS = 2_000_000;

/** A page as it looked when it was last rendered. */
export interface TabSnapshot extends PreviewCapture {
  /** `performance.now()` at capture, so the loop can tell one pass from the next. */
  readonly at: number;
}

/** Whether a capture is worth keeping, or the card is better off with a title. */
export const isSnapshotWorthKeeping = (capture: PreviewCapture): boolean =>
  capture.html.length <= SNAPSHOT_MAX_CHARS &&
  capture.width > 0 &&
  capture.height > 0;

/**
 * The order the pictures are taken in: whatever you are looking at first, then
 * round the rest. A pass that starts at the section you are already on is the
 * one whose first result you are most likely to be waiting for.
 */
export function captureOrder<T>(
  items: ReadonlyArray<T>,
  from: number
): Array<T> {
  if (items.length === 0) return [];
  const start = from < 0 || from >= items.length ? 0 : from;
  return [...items.slice(start), ...items.slice(0, start)];
}

/**
 * Whether a section is worth photographing again yet.
 *
 * Each picture ages on its own rather than the pass ageing all of them
 * together: a grid where one card was drawn a moment ago and the rest an age
 * back used to be redrawn whole, so the section you had just looked at was
 * taken again before the ones that actually needed it.
 *
 * A section with no picture at all is always due — a card showing its own name
 * is what the mill exists to replace — and the clock the rest are held to is
 * the launchpad's: a panel that is up is being read, and its pictures are worth
 * keeping close to the truth.
 */
export const isSnapshotDue = (
  snapshot: TabSnapshot | undefined,
  now: number,
  watched: boolean
): boolean =>
  snapshot === undefined ||
  now - snapshot.at >= (watched ? SNAPSHOT_REFRESH_MS : BACKGROUND_REFRESH_MS);
