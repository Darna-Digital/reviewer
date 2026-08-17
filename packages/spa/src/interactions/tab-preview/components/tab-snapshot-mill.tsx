/**
 * The one frame that actually runs anything: a single preview window, off
 * screen, pointed at each section of the app in turn and photographed.
 *
 * One at a time is the whole point. A dozen cards used to mean a dozen apps
 * booting at once, and the window spent the launchpad's first second doing
 * nothing else; now there is never more than one page running, it is never the
 * one you are looking at, and what the cards show is the last picture it took.
 *
 * It works from the moment the window has settled rather than from the moment
 * the launchpad is opened. A picture takes a page load and a moment to draw,
 * and taking it while you are reading something else is free — taking it while
 * you are waiting for the grid is the whole of the wait. So the mill runs in
 * the background and the launchpad opens onto pictures that were already there;
 * with the panel up it comes round again sooner, since you are watching.
 *
 * The frame is booted once and steered after that. Writing its `src` per
 * section threw the document away and booted the app again for every picture —
 * a dozen boots a pass, each one the slowest thing the window does — when the
 * app already in there has a router and could simply be sent somewhere. See
 * `preview-channel`; a pass is now one boot and a round of navigations.
 *
 * And every picture keeps its own clock rather than the pass keeping one for
 * all of them, so the mill takes what has actually gone stale instead of
 * everything, every time round.
 */
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { isPreviewWindow, previewUrl } from "@/lib/preview-window";
import { useUiPrefs } from "@/lib/ui-prefs";
import {
  useOverviewPicking,
  useOverviewResizing,
  useTabOverview,
  whenOverviewStill,
} from "../adapters/tab-overview.store";
import { useLaunchpadSections } from "../adapters/launchpad-sections.hook.adapter";
import {
  forgetSnapshots,
  keepSnapshotsFor,
  putPreviewStyles,
  putSnapshot,
  snapshotAt,
} from "../adapters/tab-snapshots.store";
import {
  capturePreviewPage,
  capturePreviewStyles,
} from "../functions/preview-capture.functions";
import {
  isPreviewShown,
  previewGoto,
} from "../functions/preview-channel.functions";
import {
  captureOrder,
  isSnapshotDue,
  isSnapshotWorthKeeping,
  PREVIEW_REBOOT_MS,
  SNAPSHOT_COLD_SETTLE_MS,
  SNAPSHOT_SETTLE_MS,
  SNAPSHOT_STEER_SETTLE_MS,
  SNAPSHOT_STEER_TIMEOUT_MS,
  SNAPSHOT_TIMEOUT_MS,
  SWEEP_MS,
} from "../functions/tab-snapshot.functions";
import {
  MILL_HEIGHT,
  MILL_WIDTH,
  PREVIEW_ROOT_SELECTOR,
} from "../functions/tab-preview.functions";

const wait = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Resolves once the frame has loaded `href` and had a moment to draw it. */
function boot(
  frame: HTMLIFrameElement,
  href: string,
  settleMs: number,
  stopped: () => boolean
): Promise<Window | null> {
  return new Promise((resolve) => {
    let settle = 0;
    const finish = (value: Window | null) => {
      window.clearTimeout(settle);
      window.clearTimeout(giveUp);
      frame.removeEventListener("load", onLoad);
      resolve(value);
    };
    const onLoad = () => {
      settle = window.setTimeout(() => {
        finish(stopped() ? null : frame.contentWindow);
      }, settleMs);
    };
    const giveUp = window.setTimeout(() => finish(null), SNAPSHOT_TIMEOUT_MS);
    frame.addEventListener("load", onLoad);
    frame.src = previewUrl(href);
  });
}

let askings = 0;

/**
 * How many pages in a row may fail to answer being steered before the mill
 * stops asking and boots for every picture, as it always used to. Two, because
 * one is a document caught mid-reload and more than that is an app without the
 * channel — a packaged build from before it existed, say.
 */
const DEAF_LIMIT = 2;

/**
 * Take the page already up in the frame to `href` without reloading it, and
 * resolve once it says it is there and has had a moment to draw.
 *
 * `null` means the page did not answer, which is not an error so much as a
 * document that cannot be steered — one mid-reload, or one that booted before
 * the channel existed. The caller boots it instead.
 */
function steer(
  frame: HTMLIFrameElement,
  href: string,
  settleMs: number,
  stopped: () => boolean
): Promise<Window | null> {
  return new Promise((resolve) => {
    const view = frame.contentWindow;
    if (view === null) {
      resolve(null);
      return;
    }
    const nonce = ++askings;
    let settle = 0;
    const finish = (value: Window | null) => {
      window.clearTimeout(settle);
      window.clearTimeout(giveUp);
      window.removeEventListener("message", onMessage);
      resolve(value);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== view || !isPreviewShown(event.data, nonce)) return;
      settle = window.setTimeout(() => {
        finish(stopped() ? null : frame.contentWindow);
      }, settleMs);
    };
    const giveUp = window.setTimeout(
      () => finish(null),
      SNAPSHOT_STEER_TIMEOUT_MS
    );
    window.addEventListener("message", onMessage);
    view.postMessage(previewGoto(href, nonce), window.location.origin);
  });
}

/** Wait for the window to have nothing better to do than boot a second app. */
function settled(): Promise<void> {
  return new Promise((resolve) => {
    window.requestIdleCallback(() => resolve(), { timeout: 4_000 });
  });
}

export function TabSnapshotMill() {
  const sections = useLaunchpadSections();
  const hrefs = useMemo(
    () => sections.map((section) => section.href),
    [sections]
  );
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const expanded = useTabOverview();
  const picking = useOverviewPicking();
  const resizing = useOverviewResizing();
  // The theme is baked into a picture — the rules were read out of a window
  // wearing it — so switching it is the one thing that makes every card stale.
  const { resolvedTheme } = useUiPrefs();

  const frameRef = useRef<HTMLIFrameElement>(null);
  // Read at the top of each capture rather than closed over, so where the
  // window is and how closely it is being watched change what the rest of a
  // pass does instead of restarting it.
  const plan = useRef({ hrefs, from: 0, expanded });
  plan.current = {
    hrefs,
    from: hrefs.findIndex((href) => pathname.startsWith(href)),
    expanded,
  };

  useEffect(() => keepSnapshotsFor(hrefs), [hrefs]);

  // Not on every run of the loop below — that also restarts when a section is
  // picked — but only when the pictures themselves have gone stale.
  const drawnIn = useRef(resolvedTheme);
  useEffect(() => {
    if (drawnIn.current === resolvedTheme) return;
    drawnIn.current = resolvedTheme;
    forgetSnapshots();
  }, [resolvedTheme]);

  // When the page currently in the frame booted, so it can be replaced before
  // it has been steered around the app for long enough to have drifted.
  const bootedAt = useRef(0);
  // How many times in a row a page has not answered being steered. Steering is
  // the cheap way and booting is the way that always works, so the mill asks
  // first and falls back — but an app that cannot answer at all would be asked
  // once per section forever, and pay the wait for it every time.
  const unanswered = useRef(0);

  useEffect(() => {
    const frame = frameRef.current;
    // A picked section is on its way to the window: the page being loaded in
    // front of you is the only thing worth the main thread now. A drag is the
    // same case for the same reason — booting an app in a frame is the one
    // thing heavy enough to be felt through a gesture that has to keep up with
    // the pointer.
    //
    // The slide is watched just as closely but is not a reason to stop: it is
    // over in a quarter of a second, and giving up the page in the frame for it
    // would mean booting the app again on the far side. The loop waits it out
    // instead — see `whenOverviewStill`.
    if (picking || resizing || frame === null) return;

    let stopped = false;
    let styled = false;

    /**
     * Put `href` up in the frame, by the cheapest way that works: a word to the
     * page already there, or a boot if it will not answer to one.
     */
    const show = async (href: string): Promise<Window | null> => {
      const aged = performance.now() - bootedAt.current > PREVIEW_REBOOT_MS;
      if (bootedAt.current > 0 && !aged && unanswered.current < DEAF_LIMIT) {
        const steered = await steer(
          frame,
          href,
          SNAPSHOT_STEER_SETTLE_MS,
          () => stopped
        );
        if (steered !== null) {
          unanswered.current = 0;
          return steered;
        }
        if (stopped) return null;
        unanswered.current += 1;
      }
      const booted = await boot(
        frame,
        href,
        // Only ever paid once: it is not a page loading but the app coming up
        // in a window of its own, with none of its code in hand.
        bootedAt.current === 0 ? SNAPSHOT_COLD_SETTLE_MS : SNAPSHOT_SETTLE_MS,
        () => stopped
      );
      bootedAt.current = booted === null ? 0 : performance.now();
      return booted;
    };

    const run = async () => {
      await settled();
      while (!stopped) {
        const { hrefs: listed, from, expanded: watched } = plan.current;
        const due = captureOrder(listed, from).filter((href) =>
          isSnapshotDue(snapshotAt(href), performance.now(), watched)
        );
        for (const href of due) {
          if (stopped) return;
          // Read afresh: a section can leave the grid while the pass that
          // planned to photograph it is still working its way round.
          if (!plan.current.hrefs.includes(href)) continue;
          await whenOverviewStill();
          if (stopped) return;
          const view = await show(href);
          // A page coming up in here may focus something on its way — a
          // composer, a search field — and take the keyboard out of the window
          // with it. The preview refuses focus from the inside; this is the
          // same refusal from the outside, for whatever asked before its own
          // scripts were up.
          frame.blur();
          if (stopped || view === null) continue;
          // The rules are the same page after page, so they are read once a
          // run — off the first page that comes up wearing them.
          if (!styled) {
            putPreviewStyles(capturePreviewStyles(view));
            styled = true;
          }
          // The one genuinely heavy thing on this thread: a walk of every node
          // the page rendered, and the whole of it serialised. Worth checking
          // again that nothing is being animated over it.
          await whenOverviewStill();
          if (stopped) return;
          const capture = capturePreviewPage(view, PREVIEW_ROOT_SELECTOR);
          if (capture !== null && isSnapshotWorthKeeping(capture)) {
            putSnapshot(href, capture, performance.now());
          }
        }
        // A sweep that finds nothing due is a walk of a dozen numbers, so it
        // can afford to come round often: what each picture is worth waiting
        // for is the picture's own business now, not the sweep's.
        await wait(SWEEP_MS);
      }
    };

    void run();
    return () => {
      stopped = true;
      // Let go of the page as well as the loop: a preview left pointed at a
      // session keeps its socket open for as long as the frame lives.
      frame.src = "about:blank";
      bootedAt.current = 0;
    };
  }, [picking, resizing, resolvedTheme]);

  // A preview window photographing its own previews is a hall of mirrors, and
  // an app booting one more copy of itself for every copy already booted.
  if (isPreviewWindow) return null;

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
