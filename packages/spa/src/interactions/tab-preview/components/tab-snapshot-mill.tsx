/**
 * The one frame that actually runs anything: a single preview window, off
 * screen, pointed at each open tab in turn and photographed.
 *
 * One at a time is the whole point. Twelve cards used to mean twelve apps
 * booting at once, and the window spent the launchpad's first second doing
 * nothing else; now there is never more than one page running, it is never the
 * one you are looking at, and what the cards show is the last picture it took.
 *
 * It works only while the launchpad is open. A picture nobody is going to look
 * at is not worth the page it takes to make, and the ones already taken keep.
 */
import { useEffect, useRef } from "react";
import { previewRootUrl, previewUrl } from "@/lib/preview-window";
import { keepSnapshotsFor, putSnapshot } from "../adapters/tab-snapshots.store";
import {
  captureOrder,
  snapshotOf,
  SNAPSHOT_REFRESH_MS,
  SNAPSHOT_SETTLE_MS,
  SNAPSHOT_TIMEOUT_MS,
} from "../functions/tab-snapshot.functions";
import {
  MILL_HEIGHT,
  MILL_WIDTH,
  OVERVIEW_TRANSITION_MS,
} from "../functions/tab-preview.functions";

/** Resolves once the frame has loaded `href` and had a moment to draw it. */
function render(
  frame: HTMLIFrameElement,
  href: string,
  stopped: () => boolean
): Promise<Document | null> {
  return new Promise((resolve) => {
    let settle = 0;
    const finish = (value: Document | null) => {
      window.clearTimeout(settle);
      window.clearTimeout(giveUp);
      frame.removeEventListener("load", onLoad);
      resolve(value);
    };
    const onLoad = () => {
      settle = window.setTimeout(() => {
        finish(stopped() ? null : frame.contentDocument);
      }, SNAPSHOT_SETTLE_MS);
    };
    const giveUp = window.setTimeout(() => finish(null), SNAPSHOT_TIMEOUT_MS);
    frame.addEventListener("load", onLoad);
    frame.src = previewUrl(href);
  });
}

export function TabSnapshotMill({
  hrefs,
  from,
  running,
}: {
  /** Every open tab's location, in the order the grid shows them. */
  readonly hrefs: ReadonlyArray<string>;
  /** Which card to photograph first — the one you are most likely looking at. */
  readonly from: number;
  /** Whether the launchpad is open; nothing runs while it is not. */
  readonly running: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Read at the top of each capture rather than closed over, so opening or
  // closing a tab mid-pass changes what the rest of that pass photographs
  // instead of restarting it.
  const plan = useRef({ hrefs, from });
  plan.current = { hrefs, from };

  useEffect(() => keepSnapshotsFor(hrefs), [hrefs]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!running || frame === null) return;

    let stopped = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));

    const run = async () => {
      // Let the panel finish arriving first. The cards already have their last
      // pictures to show, and booting a page in the middle of the slide is the
      // one thing that would be felt.
      await wait(OVERVIEW_TRANSITION_MS);
      while (!stopped) {
        const pass = captureOrder(plan.current.hrefs, plan.current.from);
        for (const href of pass) {
          if (stopped) return;
          if (!plan.current.hrefs.includes(href)) continue;
          const rendered = await render(frame, href, () => stopped);
          // A page coming up in here may focus something on its way — a
          // composer, a search field — and take the keyboard out of the window
          // with it. The preview refuses focus from the inside; this is the
          // same refusal from the outside, for whatever asked before its own
          // scripts were up.
          frame.blur();
          if (stopped) return;
          const html =
            rendered === null
              ? null
              : snapshotOf(rendered, previewRootUrl(window.location.href));
          if (html !== null) putSnapshot(href, html, performance.now());
        }
        await wait(SNAPSHOT_REFRESH_MS);
      }
    };

    void run();
    return () => {
      stopped = true;
      // Let go of the page as well as the loop: a preview left pointed at a
      // session keeps its socket open for as long as the frame lives.
      frame.src = "about:blank";
    };
  }, [running]);

  return (
    <iframe
      ref={frameRef}
      aria-hidden
      tabIndex={-1}
      title="Tab preview renderer"
      onFocus={() => frameRef.current?.blur()}
      // Parked off the side of the window rather than hidden: a frame with no
      // box to lay out into draws nothing, and nothing is what we would then
      // have a picture of.
      style={{
        width: MILL_WIDTH,
        height: MILL_HEIGHT,
        position: "fixed",
        top: 0,
        left: `-${MILL_WIDTH + 100}px`,
      }}
      className="pointer-events-none border-0"
    />
  );
}
