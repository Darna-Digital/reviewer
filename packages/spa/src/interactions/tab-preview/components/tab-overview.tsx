/**
 * The launchpad: every open tab as a card, laid out in a grid.
 *
 * It slides out of the window bar and pushes the page down rather than covering
 * it, so the app reads as having made room for the tabs instead of having been
 * replaced by them — and the page it pushed stays visible under a scrim, dimmed
 * back so the cards are the only thing to read.
 *
 * Pushing is a transform on the page, not a size given to it: the canvas keeps
 * the height it had and slides off the bottom of the window, so a page holding a
 * few thousand lines of diff is composited down rather than laid out again on
 * every frame. The cards follow the same rule — each is a picture of its tab
 * (see `tab-snapshot-mill`) rather than the tab itself, so a grid of them costs
 * a paint instead of a dozen running apps.
 *
 * Picking a tab starts its navigation at once and keeps the panel over the
 * window until the page has arrived, so the two happen in the time one of them
 * takes and the page being left never flashes past on the way.
 */
import { IconChevronUp, IconPlus, IconX } from "@tabler/icons-react";
import { useEffect, useMemo } from "react";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { useEntered, usePresence } from "@/hooks/use-presence";
import { useWindowTabActions } from "@/interactions/window-tabs/adapters/window-tab-actions";
import { useWindowTabs } from "@/interactions/window-tabs/adapters/window-tabs.store";
import { WindowTabIcon } from "@/interactions/window-tabs/components/window-tab-icon";
import { isPinnedTab } from "@/interactions/window-tabs/functions/window-tabs.functions";
import type { WindowTab } from "@/interactions/window-tabs/interfaces/window-tabs.interfaces";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import {
  beginPick,
  closeTabOverview,
  isTabOverviewOpen,
  setOverviewResizing,
  useOverviewIdle,
  useOverviewResizing,
  useTabOverview,
} from "../adapters/tab-overview.store";
import {
  LAUNCHPAD_DISMISS_HEIGHT,
  LAUNCHPAD_MIN_HEIGHT,
  launchpadHeightCss,
  launchpadMaxHeight,
  LIVE_PREVIEW_LIMIT,
  OVERVIEW_TRANSITION_MS,
  PICK_COVER_CEILING_MS,
  PREVIEW_ASPECT,
  PREVIEW_ZOOM,
  wait,
} from "../functions/tab-preview.functions";
import { TabPreviewFrame } from "./tab-preview-frame";
import { TabSnapshotMill } from "./tab-snapshot-mill";

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/** One source of truth for the slide, so the page and the panel move together. */
const SLIDE = { transitionDuration: `${OVERVIEW_TRANSITION_MS}ms` };

export function TabOverview() {
  const expanded = useTabOverview();
  const idle = useOverviewIdle();
  const present = usePresence(expanded, OVERVIEW_TRANSITION_MS);
  const entered = useEntered(expanded);
  const { tabs, activeId } = useWindowTabs();
  const actions = useWindowTabActions();
  const height = useUiPrefs().launchpadHeight;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTabOverview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  /**
   * Picking a tab navigates at once and collapses when the page has arrived,
   * rather than waiting out the slide and only then starting to load. The two
   * run in the time the slower of them takes: a page already in hand is behind
   * the panel by the time it has moved, and a page that needs a moment is
   * waited for behind the panel rather than in front of the last one — which is
   * what made picking a session flash the page you were leaving.
   *
   * The wait is capped: a navigation that stalls is not a reason to leave the
   * launchpad covering the window.
   */
  const pick = (act: () => Promise<void>) => {
    beginPick();
    void Promise.race([act(), wait(PICK_COVER_CEILING_MS)])
      .catch(() => {})
      .finally(closeTabOverview);
  };

  // Only the cards that show a picture are worth taking one of, and the one
  // you are already on is the one to start with.
  const shown = useMemo(() => tabs.slice(0, LIVE_PREVIEW_LIMIT), [tabs]);
  const hrefs = useMemo(() => shown.map((tab) => tab.href), [shown]);
  const from = shown.findIndex((tab) => tab.id === activeId);

  return (
    <div
      data-open={entered || undefined}
      style={{ ...SLIDE, height: launchpadHeightCss(height) }}
      // The panel is the frame's own material and nothing else: no sheet, no
      // inset, no backdrop of its own — on the native shell the desktop shows
      // through it exactly as it does through the bar it slides out of.
      className={cn(
        // Above the scrim, which starts on the panel's own bottom edge: the
        // drag handle straddles that edge, and the half of it hanging over the
        // page has to stay a handle rather than a way out.
        "absolute inset-x-0 top-0 z-50 -translate-y-full flex-col transition-transform motion-reduce:transition-none data-open:translate-y-0",
        // Collapsed, the panel is hidden rather than emptied: its cards are
        // booted apps, and `display: none` keeps them alive at no cost, so
        // opening the launchpad a second time has nothing left to build.
        present ? "flex" : "hidden",
        EASE
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 px-3">
        <span className="text-[0.8125rem] font-medium">Tabs</span>
        <span className="text-xs text-muted-foreground">{tabs.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-0 pb-11">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
          {tabs.map((tab, index) => (
            <TabCard
              key={tab.id}
              tab={tab}
              active={tab.id === activeId}
              previewed={index < LIVE_PREVIEW_LIMIT}
              onPrime={() => actions.prime(tab.href)}
              onSelect={() => pick(() => actions.select(tab))}
              onClose={() => actions.close(tab.id)}
            />
          ))}
          <NewSessionCard onClick={() => pick(actions.openSession)} />
        </div>
      </div>
      <CollapseHandle />
      <LaunchpadResize height={height} />
      <TabSnapshotMill hrefs={hrefs} from={from} running={idle} />
    </div>
  );
}

/**
 * The page giving way to the launchpad. It is moved, not resized: the transform
 * is the whole of the animation, and the canvas underneath never learns that
 * anything happened.
 */
export function TabOverviewPush({ children }: { children: React.ReactNode }) {
  const expanded = useTabOverview();
  const present = usePresence(expanded, OVERVIEW_TRANSITION_MS);
  const resizing = useOverviewResizing();
  const height = useUiPrefs().launchpadHeight;

  return (
    <div
      style={{
        ...SLIDE,
        ...(expanded && {
          transform: `translateY(${launchpadHeightCss(height)})`,
        }),
      }}
      className={cn(
        "absolute inset-0 mx-1.5 mb-1.5 flex min-h-0 min-w-0 gap-1.5",
        // A drag has to track the pointer, so the page follows the handle
        // frame for frame instead of easing towards where it used to be.
        resizing
          ? "transition-none"
          : "transition-transform motion-reduce:transition-none",
        // Held only while the panel is on screen: the layer is the whole page,
        // and it is not worth its memory for the rest of the session.
        present && "will-change-transform",
        EASE
      )}
    >
      {children}
    </div>
  );
}

/** The way out, on the edge the panel grew from: a chevron pointing back up at
 * the strip, where clicking it takes the window. */
function CollapseHandle() {
  return (
    <button
      type="button"
      aria-label="Collapse tabs"
      onClick={closeTabOverview}
      className={cn(
        "absolute bottom-3 left-1/2 z-10 flex h-7 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-frame-border bg-background/70 text-muted-foreground transition-all duration-200 supports-backdrop-filter:backdrop-blur-md",
        "hover:-translate-y-0.5 hover:bg-elevate-strong hover:text-foreground active:translate-y-0 motion-reduce:transition-none",
        // The lift and the chevron both point the same way as the collapse.
        "hover:[&>svg]:-translate-y-px",
        EASE
      )}
    >
      <IconChevronUp className="size-4 transition-transform duration-200" />
    </button>
  );
}

/** The seam between the launchpad and the page it pushed, dragged to trade one
 * for the other — or dragged shut. */
function LaunchpadResize({ height }: { readonly height: number }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex">
      <ResizeHandle
        orientation="row"
        label="Resize launchpad"
        value={height}
        // The drag is allowed below the panel's own floor so the gesture has
        // somewhere to go: that last stretch is what closes it.
        min={LAUNCHPAD_DISMISS_HEIGHT}
        max={() => launchpadMaxHeight(window.innerHeight)}
        onResize={(dragged) => {
          // The pointer is still down after the panel has gone, and the rest of
          // the gesture is no longer about a panel that is on its way out.
          if (!isTabOverviewOpen()) return;
          if (dragged <= LAUNCHPAD_DISMISS_HEIGHT) {
            // Let go of the drag before the close, so the page slides back up
            // with the panel rather than snapping there without it.
            setOverviewResizing(false);
            closeTabOverview();
            return;
          }
          setOverviewResizing(true);
          // Stored at the floor rather than under it, so the next drag starts
          // from the height the panel is actually showing.
          setUiPrefs({
            launchpadHeight: Math.max(dragged, LAUNCHPAD_MIN_HEIGHT),
          });
        }}
        onResizeEnd={() => setOverviewResizing(false)}
      />
    </div>
  );
}

/** The page giving way to the overview: still there, and plainly not the thing
 * being looked at. Clicking it is the way back, as with any scrim. */
export function TabOverviewScrim() {
  const expanded = useTabOverview();
  const present = usePresence(expanded, OVERVIEW_TRANSITION_MS);
  const entered = useEntered(expanded);
  if (!present) return null;

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Collapse tabs"
      data-open={entered || undefined}
      onClick={closeTabOverview}
      style={SLIDE}
      // Dimmed, not blurred: the page under the overview is still the page you
      // were reading, and blurring it costs a full-surface filter on every
      // frame of the push-down.
      className="absolute inset-0 z-40 cursor-default rounded-xl bg-background/40 opacity-0 transition-opacity motion-reduce:transition-none data-open:opacity-100"
    />
  );
}

function TabCard({
  tab,
  active,
  previewed,
  onPrime,
  onSelect,
  onClose,
}: {
  readonly tab: WindowTab;
  readonly active: boolean;
  /** Whether this card shows a picture, or stays a title in a plain box. */
  readonly previewed: boolean;
  readonly onPrime: () => void;
  readonly onSelect: () => void;
  readonly onClose: () => void;
}) {
  return (
    <div
      onPointerEnter={onPrime}
      onFocus={onPrime}
      className={cn(
        // The card is the frame's container, and the frame is embedded
        // content: the control that picks the tab is laid over it rather
        // than wrapped around it.
        //
        // Hover is the border and nothing else. A grid of cards that each lift
        // under the pointer reads as a page of things being nudged, and the
        // border already says which one you are on.
        "group/card relative overflow-hidden rounded-lg border transition-colors duration-200 motion-reduce:transition-none",
        active
          ? "border-brand-500 ring-1 ring-brand-500"
          : "border-border hover:border-muted-foreground/40",
        EASE
      )}
    >
      {previewed ? (
        <TabPreviewFrame target={tab} zoom={PREVIEW_ZOOM} />
      ) : (
        <div
          style={{ aspectRatio: PREVIEW_ASPECT }}
          className="w-full bg-background"
        />
      )}
      <div className="flex h-9 items-center gap-2 border-t border-border bg-elevate px-2.5 text-xs">
        <WindowTabIcon
          kind={tab.kind}
          className="size-3.5 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate">{tab.title}</span>
      </div>
      <button
        type="button"
        aria-label={`Show ${tab.title}`}
        aria-current={active}
        onClick={onSelect}
        className="absolute inset-0 cursor-default rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {!isPinnedTab(tab) && (
        <button
          type="button"
          aria-label={`Close ${tab.title}`}
          onClick={onClose}
          className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-all duration-150 group-hover/card:opacity-100 hover:scale-105 hover:text-foreground focus-visible:opacity-100 active:scale-95 motion-reduce:transition-none"
        >
          <IconX className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function NewSessionCard({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors duration-200 hover:border-muted-foreground/40 hover:text-foreground motion-reduce:transition-none",
        EASE
      )}
    >
      <IconPlus className="size-5" />
      New session
    </button>
  );
}
