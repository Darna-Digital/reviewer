/**
 * The launchpad: every open tab as a live card, laid out in a grid.
 *
 * It slides out of the window bar and pushes the page down rather than covering
 * it, so the app reads as having made room for the tabs instead of having been
 * replaced by them — and the page it pushed stays visible under a scrim, dimmed
 * back so the cards are the only thing to read.
 *
 * Pushing is a transform on the page, not a size given to it: the canvas keeps
 * the height it had and slides off the bottom of the window, so a page holding a
 * few thousand lines of diff is composited down rather than laid out again on
 * every frame. Everything else the panel does is bent around the same rule —
 * nothing that costs a layout runs while it is moving, and the navigation a card
 * asks for waits for the slide to finish rather than landing in the middle of it.
 */
import { IconChevronUp, IconPlus, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
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
  closeTabOverview,
  setOverviewResizing,
  useOverviewResizing,
  useTabOverview,
} from "../adapters/tab-overview.store";
import {
  LAUNCHPAD_MIN_HEIGHT,
  launchpadHeightCss,
  launchpadMaxHeight,
  LIVE_PREVIEW_LIMIT,
  OVERVIEW_TRANSITION_MS,
  staggeredBootMs,
  PREVIEW_ASPECT,
  PREVIEW_ZOOM,
} from "../functions/tab-preview.functions";
import { TabPreviewFrame } from "./tab-preview-frame";

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/** One source of truth for the slide, so the page and the panel move together. */
const SLIDE = { transitionDuration: `${OVERVIEW_TRANSITION_MS}ms` };

/**
 * Run once the panel has finished collapsing. Picking a tab is a route change
 * and often a mode change with it — a re-render of the whole canvas — and doing
 * that while the slide is running is what makes the slide stutter. The page is
 * behind the panel until the panel has gone, so there is nothing to see in the
 * wait.
 */
function afterCollapse(run: () => void): void {
  const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (instant) {
    run();
    return;
  }
  window.setTimeout(run, OVERVIEW_TRANSITION_MS);
}

export function TabOverview() {
  const expanded = useTabOverview();
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

  const pick = (act: () => void) => {
    closeTabOverview();
    afterCollapse(act);
  };

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
              shown={expanded}
              bootDelayMs={
                index < LIVE_PREVIEW_LIMIT ? staggeredBootMs(index) : null
              }
              onSelect={() => pick(() => actions.select(tab))}
              onClose={() => actions.close(tab.id)}
            />
          ))}
          <NewSessionCard onClick={() => pick(actions.openSession)} />
        </div>
      </div>
      <CollapseHandle />
      <LaunchpadResize height={height} />
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
 * for the other. */
function LaunchpadResize({ height }: { readonly height: number }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex">
      <ResizeHandle
        orientation="row"
        label="Resize launchpad"
        value={height}
        min={LAUNCHPAD_MIN_HEIGHT}
        max={() => launchpadMaxHeight(window.innerHeight)}
        onResize={(launchpadHeight) => {
          setOverviewResizing(true);
          setUiPrefs({ launchpadHeight });
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
  shown,
  bootDelayMs,
  onSelect,
  onClose,
}: {
  readonly tab: WindowTab;
  readonly active: boolean;
  /** Whether the panel is open — a card in a collapsed panel is not on screen. */
  readonly shown: boolean;
  /** When this card's frame starts, or null for a card that stays a title. */
  readonly bootDelayMs: number | null;
  readonly onSelect: () => void;
  readonly onClose: () => void;
}) {
  return (
    <div
      className={cn(
        // The card is the frame's container, and the frame is embedded
        // content: the control that picks the tab is laid over it rather
        // than wrapped around it.
        "group/card relative overflow-hidden rounded-lg border transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none",
        active
          ? "border-brand-500 ring-1 ring-brand-500"
          : "border-border hover:border-muted-foreground/40",
        EASE
      )}
    >
      {bootDelayMs === null ? (
        <div
          style={{ aspectRatio: PREVIEW_ASPECT }}
          className="w-full bg-background"
        />
      ) : (
        <TabPreviewFrame
          target={tab}
          zoom={PREVIEW_ZOOM}
          bootDelayMs={bootDelayMs}
          cacheKey={`grid:${tab.id}`}
          active={shown}
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
        "flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-[transform,color,border-color] duration-200 hover:-translate-y-0.5 hover:border-muted-foreground/40 hover:text-foreground motion-reduce:transition-none",
        EASE
      )}
    >
      <IconPlus className="size-5" />
      New session
    </button>
  );
}
