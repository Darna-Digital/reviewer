/**
 * The launchpad: every section of the app as a card, laid out in a grid.
 *
 * It slides out of the window bar and pushes the page down rather than covering
 * it, so the app reads as having made room for itself instead of having been
 * replaced — and the page it pushed stays visible under a scrim, dimmed back so
 * the cards are the only thing to read.
 *
 * Pushing is a transform on the page, not a size given to it: the canvas keeps
 * the height it had and slides off the bottom of the window, so a page holding a
 * few thousand lines of diff is composited down rather than laid out again on
 * every frame. The cards follow the same rule — each is a picture of its
 * section (see `tab-snapshot-mill`) rather than the section itself, so a grid of
 * them costs a paint instead of a dozen running apps.
 *
 * Picking a card starts its navigation at once and keeps the panel over the
 * window until the page has arrived, so the two happen in the time one of them
 * takes and the page being left never flashes past on the way.
 */
import {
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { useRouterState } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEntered, usePresence, useSettled } from "@/hooks/use-presence";
import { useWindowTabActions } from "@/interactions/window-tabs/adapters/window-tab-actions";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import {
  beginPick,
  closeTabOverview,
  isOverviewResizing,
  isTabOverviewOpen,
  setOverviewResizing,
  toggleTabOverview,
  useOverviewResizing,
  useTabOverview,
} from "../adapters/tab-overview.store";
import {
  drawLaunchpadHeight,
  launchpadHeightNow,
  useDrawLaunchpad,
} from "../adapters/launchpad-height.store";
import { useLaunchpadGroups } from "../adapters/launchpad-sections.hook.adapter";
import type { LaunchpadSection } from "../functions/launchpad-sections.functions";
import {
  LAUNCHPAD_DISMISS_HEIGHT,
  LAUNCHPAD_MIN_HEIGHT,
  launchpadHeightCss,
  fittedLaunchpadHeight,
  LIVE_PREVIEW_LIMIT,
  OVERVIEW_TRANSITION_MS,
  PICK_COVER_CEILING_MS,
  PREVIEW_ASPECT,
  wait,
} from "../functions/tab-preview.functions";
import { TabPreviewFrame } from "./tab-preview-frame";

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/** The chord that does what the handle does — see `window-bar.shortcuts`. */
const LAUNCHPAD_KEYS = "⌘L";

/** One source of truth for the slide, so the page and the panel move together. */
const SLIDE = { transitionDuration: `${OVERVIEW_TRANSITION_MS}ms` };

/**
 * The pause between the panel coming to rest and its collapse tab appearing on
 * the edge. Without it the tab lands on the same frame the panel does, which
 * reads as part of the arrival rather than as something the arrival left behind.
 */
const HANDLE_BEAT = 140;

/**
 * How long the grid stays faded after the panel has been asked to go, before it
 * is brought back to full strength behind the window's own clip.
 *
 * The fade is only for the way out, and a grid left at nothing is a grid the
 * window has to paint from scratch on the frame the next opening starts — which
 * is the one frame it cannot spare. So it is restored the moment the panel is
 * out of sight, with a margin: brought back on the same tick the slide ends, a
 * slide that ran a frame long would show it coming back.
 */
const REGRID_MS = OVERVIEW_TRANSITION_MS + 80;

/**
 * Where the panel is parked when it is shut: its own height, and then a pixel
 * more. Parked flush, anything sitting on its bottom edge lands exactly on the
 * clip, and a fraction of it survives rounding — which is how the collapse tab
 * came to draw a second, shorter line across the middle of the frame's own.
 */
const PARKED = "-translate-y-[calc(100%+1px)]";

/**
 * Both ways in and out of the launchpad wear the same tab: it is the frame's
 * material rather than a surface of its own — thin, blurred, and dark enough
 * over a page to be read against it.
 *
 * A tab rather than a pill, because it is attached to something. Closed, it
 * hangs off the bottom of the bar; open, it stands on the bottom of the panel.
 * Either way the edge it is fixed to is square and the free side takes the
 * frame's own radius.
 *
 * The attached edge keeps its border, laid over the line where the page's own
 * sheet begins. Dropping it and letting that line run through was the tidier
 * idea and the worse tab: the sides then meet nothing at the top, and what
 * should read as one closed shape reads as two strokes and a hole. A border all
 * the way round is what makes it a tab.
 *
 * It does not move under the pointer, and it does not fade in or out. A thing
 * fixed to an edge that shifts when you approach it is a thing coming loose,
 * and a chevron easing away while the panel it belongs to is already sliding
 * reads as the panel dragging something behind it. It is simply there or not;
 * only its colour under the pointer is worth animating.
 */
const HANDLE =
  "flex w-9 items-center justify-center border border-frame-border/70 bg-background/60 text-muted-foreground shadow-xs transition-[background-color,color] duration-200 supports-backdrop-filter:backdrop-blur-md hover:bg-background/80 hover:text-foreground motion-reduce:transition-none";

/** Hung off the line under the bar: square along the top, rounded below. */
const HANDLE_UNDER = "top-0 h-5 rounded-b-md";

/** Stood on the line the panel ends at: the same the other way up. */
const HANDLE_OVER = "bottom-0 h-5 rounded-t-md";

/** Which card the window is already on, by the longest location it answers to. */
const sectionAt = (
  sections: ReadonlyArray<LaunchpadSection>,
  pathname: string
): string | null =>
  sections
    .filter((section) => pathname.startsWith(section.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.id ?? null;

export function TabOverview() {
  const expanded = useTabOverview();
  const shown = usePresence(expanded, REGRID_MS);
  const settled = useSettled(expanded, OVERVIEW_TRANSITION_MS + HANDLE_BEAT);
  const resizing = useOverviewResizing();
  const groups = useLaunchpadGroups();
  const { visit, prime, openSession, close } = useWindowTabActions();
  const height = useUiPrefs().launchpadHeight;
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // The panel draws itself at whatever height the drag is reporting, without
  // going through React to do it — see `launchpad-height.store`.
  const panelRef = useRef<HTMLDivElement>(null);
  useDrawLaunchpad(
    useCallback((drawn: number) => {
      const panel = panelRef.current;
      if (panel !== null) panel.style.height = launchpadHeightCss(drawn);
    }, [])
  );
  // Anything that moves the height other than a drag — opening onto the fitted
  // rows, a window resize, the height a session remembered — arrives as a
  // preference, and is handed to the same drawing.
  useLayoutEffect(() => {
    drawLaunchpadHeight(height);
  }, [height]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTabOverview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  /**
   * Size the panel to its rows on the way open, and keep it that size for as
   * long as it is up. The grid is measured rather than guessed at — how many
   * rows it comes to depends on the window's width, how many sessions are on
   * the go, and whether the project has pull requests — and it is measurable at
   * any moment because the panel is parked above the window rather than emptied
   * while it is shut.
   *
   * A window narrowed while the launchpad is open re-wraps the grid into another
   * row, and a window shortened takes the room for one away: the height is
   * followed rather than taken once, or the panel goes on standing at whatever
   * fitted the window it was opened in.
   *
   * Before paint, so the panel starts its slide already the right height rather
   * than growing into it on the way down.
   */
  const gridRef = useRef<HTMLDivElement>(null);
  const fitted = useRef(height);
  fitted.current = height;
  useLayoutEffect(() => {
    if (!expanded) return;
    let frame = 0;
    const fit = () => {
      const grid = gridRef.current;
      // A panel being pulled open by the pointer has a height already: the
      // pointer's. Sizing it to its rows mid-gesture would take the drag off
      // the pointer and leave it somewhere of our choosing.
      if (grid === null || isOverviewResizing()) return;
      const next = fittedLaunchpadHeight(
        grid.getBoundingClientRect().height,
        window.innerHeight
      );
      // A window resize arrives per frame of its own drag, and each one of
      // these is a write to storage: only a height that has moved is worth one.
      if (next === fitted.current) return;
      fitted.current = next;
      setUiPrefs({ launchpadHeight: next });
    };
    const onResize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(fit);
    };
    fit();
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [expanded, groups]);

  /**
   * Picking a section navigates at once and collapses when the page has
   * arrived, rather than waiting out the slide and only then starting to load.
   * The two run in the time the slower of them takes: a page already in hand is
   * behind the panel by the time it has moved, and a page that needs a moment
   * is waited for behind the panel rather than in front of the last one — which
   * is what made picking a session flash the page you were leaving.
   *
   * The wait is capped: a navigation that stalls is not a reason to leave the
   * launchpad covering the window.
   */
  const cover = (going: Promise<void>) => {
    beginPick();
    void Promise.race([going, wait(PICK_COVER_CEILING_MS)])
      .catch(() => {})
      .finally(closeTabOverview);
  };
  const pick = (section: LaunchpadSection) =>
    cover(visit(section.href, section.mode));

  /**
   * Done with a conversation, from the grid rather than from the strip. The
   * panel stays up: shutting one of a dozen cards is tidying the grid, not
   * picking something out of it, and a launchpad that left on every ✕ would be
   * a launchpad you had to reopen to close the next one.
   */
  const closer = (section: LaunchpadSection) => {
    const { tabId } = section;
    return tabId === undefined ? undefined : () => close(tabId);
  };

  const sections = useMemo(
    () => groups.flatMap((group) => [...group.sections]),
    [groups]
  );
  const here = sectionAt(sections, pathname);

  return (
    <div
      ref={panelRef}
      // Off the store rather than a frame behind it. A panel mounted already
      // parked has its transform resolved from the moment the window opened, so
      // there is nothing to wait a frame for — and waiting one made the whole
      // opening hostage to a main thread that might be busy for two.
      data-open={expanded || undefined}
      style={SLIDE}
      // Collapsed, the panel is not emptied and not hidden either: it is parked
      // above the window and clipped by it. Its cards keep their boxes, so they
      // are drawn at the size they will be shown at rather than measured on the
      // way in — which is what used to make a picture arrive a moment after the
      // card it belongs in.
      aria-hidden={!expanded}
      inert={!expanded}
      // The panel is the frame's own material and nothing else: no sheet, no
      // inset, no backdrop of its own — on the native shell the desktop shows
      // through it exactly as it does through the bar it slides out of.
      className={cn(
        // Above the scrim, which starts on the panel's own bottom edge: the
        // drag handle straddles that edge, and the half of it hanging over the
        // page has to stay a handle rather than a way out.
        "absolute inset-x-0 top-0 z-50 flex flex-col data-open:translate-y-0",
        // Kept on a layer of its own for the life of the window, not only while
        // it is up. Parked, the panel is a grid of pictures of pages, and a
        // layer it is only promoted to on the way in is one the window has to
        // draw during the slide — which is a dozen pages' worth of raster
        // landing on the frames that can least afford it. Held, the slide is
        // the compositor moving something it drew while nobody was waiting.
        "will-change-transform",
        // Pulled open by the pointer, it arrives frame for frame with the page
        // it is pushing — the same reason the page drops its own transition.
        resizing
          ? "transition-none"
          : "transition-transform motion-reduce:transition-none",
        PARKED,
        EASE
      )}
    >
      {/* The grid is a box of its own inside the scroller rather than the
          scroller itself, because it is the thing being measured: a scroller
          never reports less than the height it has been given, so a panel that
          was once tall could never learn that its rows had since got shorter.
          The padding rides the grid for the same reason — and the foot of it is
          the collapse tab's room, so the last row ends above it rather than
          behind it. */}
      <div
        // The cards go out with the panel rather than riding it all the way up.
        // Sliding away at full strength, the last sliver of them is still fully
        // drawn as it reaches the bar, which reads as the panel catching on
        // something at the end. Coming in they need no such help: the panel is
        // arriving, and there is nothing to excuse — hence the fade one way and
        // not the other. The ease is the slide's own, which front-loads it, so
        // the grid is all but gone by the time the panel is halfway home.
        //
        // Once the panel is parked the fade is undone behind the window's clip,
        // so the grid is only ever at nothing while it is on its way out. Left
        // there, every opening began by painting a dozen pages back into
        // existence on the frame the slide started — see `REGRID_MS`.
        style={{
          transitionDuration:
            shown && !expanded ? SLIDE.transitionDuration : "0ms",
        }}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto transition-opacity motion-reduce:transition-none",
          shown && !expanded ? "opacity-0" : "opacity-100",
          EASE
        )}
      >
        <div ref={gridRef} className="p-3 pb-11">
          {groups.map((group) => (
            <section key={group.title} className="mb-4 last:mb-0">
              <h2 className="mb-2 px-0.5 text-xs font-medium text-muted-foreground">
                {group.title}
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
                {group.sections.map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    active={section.id === here}
                    previewed={sections.indexOf(section) < LIVE_PREVIEW_LIMIT}
                    onPrime={() => prime(section.href)}
                    onSelect={() => pick(section)}
                    onClose={closer(section)}
                  />
                ))}
                {group.minting && (
                  <NewSessionCard onSelect={() => cover(openSession())} />
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      {/* It waits out the arrival and leaves on the click. Riding the edge down
          it is a chevron being carried in by something that has not landed yet;
          riding it back up it is the answer to the click arriving a quarter of a
          second late. The panel moving is the whole of both animations, and the
          way out of it belongs to the panel once it is standing still. */}
      {settled && <CollapseHandle />}
      {/* Only while there is a panel to resize: parked, its bottom edge is at
          the top of the window, where a seam has no business being. */}
      {expanded && <LaunchpadResize ceiling={height} />}
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

  // Pushed exactly as far as the panel is tall, off the same drawing, so the two
  // cannot disagree about where the seam between them is even mid-drag.
  const pushRef = useRef<HTMLDivElement>(null);
  useDrawLaunchpad(
    useCallback((drawn: number) => {
      const page = pushRef.current;
      if (page === null) return;
      page.style.transform = isTabOverviewOpen()
        ? `translateY(${launchpadHeightCss(drawn)})`
        : "";
    }, [])
  );
  // Opening and closing move the page the whole of the panel's height, and are
  // the one thing the drawing above cannot hear on its own.
  useLayoutEffect(() => {
    drawLaunchpadHeight(launchpadHeightNow());
  }, [expanded]);

  return (
    <div
      ref={pushRef}
      style={SLIDE}
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
      <LaunchpadHandle />
    </div>
  );
}

/**
 * How far down the window counts as reaching for the launchpad: the bar, and
 * the first strip of the page under it. Read off the pointer's own position
 * rather than a hover region, which would have to lie over the page to be
 * hovered and would take the clicks meant for whatever is under it.
 */
const HANDLE_REACH = 96;

/** Whether the pointer is up in the top of the window, where the handle is. */
function usePointerNearTop(): boolean {
  const [near, setNear] = useState(false);

  // Crossing the line is the event, not moving about on either side of it: this
  // listener sees every pointer move in the window, and telling React about all
  // of them means a render attempt per move — including through the slide.
  const was = useRef(false);
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const now = event.clientY <= HANDLE_REACH;
      if (now === was.current) return;
      was.current = now;
      setNear(now);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return near;
}

/**
 * The way in: a pill hanging off the underside of the bar, in the middle of the
 * window.
 *
 * It rides the page rather than the bar, so it goes down with it when the
 * launchpad pushes — the launchpad is what is above the page, and the handle is
 * the top of the page saying so. Once the panel is up, the way back out is the
 * pill on its bottom edge, in this one's place, so this one gets out of the way.
 *
 * It shows itself only when reached for. A control that is always there is one
 * more thing in front of the page, and this one is over the page rather than in
 * the chrome — so it waits for the pointer to come up to the top of the window,
 * and answers the chord and the keyboard whether it is showing or not.
 */
function LaunchpadHandle() {
  const expanded = useTabOverview();
  const near = usePointerNearTop();
  const shown = near && !expanded;

  return (
    <HandleTooltip label="Launchpad" side="bottom" disabled={!shown}>
      <button
        type="button"
        aria-label="Launchpad"
        aria-expanded={expanded}
        onClick={toggleTabOverview}
        className={cn(
          "absolute left-1/2 z-30 -translate-x-1/2",
          HANDLE,
          HANDLE_UNDER,
          // Tabbed to rather than reached for, it shows itself the same way:
          // the keyboard has no pointer to bring up here.
          shown
            ? "opacity-100"
            : "pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100"
        )}
      >
        <IconChevronDown className="size-4" />
      </button>
    </HandleTooltip>
  );
}

/**
 * Both handles say the same chord, so both say it the same way: the launchpad
 * has no button on the bar to carry ⌘L, and these are where it is learnt.
 */
function HandleTooltip({
  label,
  side,
  disabled,
  children,
}: {
  readonly label: string;
  readonly side: "top" | "bottom";
  readonly disabled?: boolean;
  readonly children: React.ReactElement;
}) {
  return (
    <Tooltip disabled={disabled}>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>
        {label}
        <KbdGroup>
          {Array.from(LAUNCHPAD_KEYS).map((glyph) => (
            <Kbd key={glyph}>{glyph}</Kbd>
          ))}
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The way out, standing on the edge the panel ends at: a chevron pointing back
 * up at the bar, where clicking it takes the window.
 *
 * Above the seam it shares that edge with, so a press in the middle of it
 * closes the panel rather than starting a drag of the fifty pixels the seam
 * gives up to it. Its tooltip goes over the launchpad rather than under it —
 * below is the page the panel is covering, which is not where the panel's own
 * labels belong.
 */
function CollapseHandle() {
  return (
    <HandleTooltip label="Collapse launchpad" side="top">
      <button
        type="button"
        aria-label="Collapse launchpad"
        onClick={closeTabOverview}
        className={cn(
          "absolute left-1/2 z-20 -translate-x-1/2",
          HANDLE,
          HANDLE_OVER
        )}
      >
        <IconChevronUp className="size-4" />
      </button>
    </HandleTooltip>
  );
}

/**
 * The seam between the launchpad and the page it pushed. It takes room away and
 * gives none back: the panel opens at the height its rows come to, so there is
 * nothing above that to drag into but empty panel — and dragged far enough up,
 * it goes altogether. Making it bigger again is the handle's job, which fits it
 * to the rows afresh.
 */
function LaunchpadResize({
  ceiling,
}: {
  /** The height it opened at, which a drag may only take from. */
  readonly ceiling: number;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex">
      <ResizeHandle
        orientation="row"
        label="Resize launchpad"
        className="resize-handle-quiet"
        // Read off the drawing at the moment the pointer goes down: the panel's
        // height has not been React's to know since the drag began.
        value={launchpadHeightNow}
        // The drag is allowed below the panel's own floor so the gesture has
        // somewhere to go: that last stretch is what closes it.
        min={LAUNCHPAD_DISMISS_HEIGHT}
        max={() => ceiling}
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
          drawLaunchpadHeight(dragged);
        }}
        onResizeEnd={(dragged) => {
          setOverviewResizing(false);
          // Remembered once, where it was dropped. Storing it per frame meant
          // serialising every preference in the app sixty times a second, for a
          // number only the last of those was ever going to keep.
          if (isTabOverviewOpen()) {
            setUiPrefs({
              launchpadHeight: Math.max(dragged, LAUNCHPAD_MIN_HEIGHT),
            });
          }
        }}
      />
    </div>
  );
}

/** The page giving way to the launchpad: still there, and plainly not the thing
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
      aria-label="Collapse launchpad"
      data-open={entered || undefined}
      onClick={closeTabOverview}
      style={SLIDE}
      // Dimmed, not blurred: the page under the launchpad is still the page you
      // were reading, and blurring it costs a full-surface filter on every
      // frame of the push-down.
      className="absolute inset-0 z-40 cursor-default rounded-xl bg-background/40 opacity-0 transition-opacity motion-reduce:transition-none data-open:opacity-100"
    />
  );
}

function SectionCard({
  section,
  active,
  previewed,
  onPrime,
  onSelect,
  onClose,
}: {
  readonly section: LaunchpadSection;
  readonly active: boolean;
  /** Whether this card shows a picture, or stays a title in a plain box. */
  readonly previewed: boolean;
  readonly onPrime: () => void;
  readonly onSelect: () => void;
  /** Given only for a card standing for something you can be done with. */
  readonly onClose?: () => void;
}) {
  const Icon = section.icon;

  return (
    <div
      onPointerEnter={onPrime}
      onFocus={onPrime}
      className={cn(
        // The card is the picture's container, and the picture is a page laid
        // over it: the control that picks the section is laid over it in turn
        // rather than wrapped around it.
        //
        // Hover is the border and nothing else. A grid of cards that each lift
        // under the pointer reads as a page of things being nudged, and the
        // border already says which one you are on.
        "group/card relative overflow-hidden rounded-lg border transition-colors duration-200 motion-reduce:transition-none",
        active
          ? "border-brand-500 ring-1 ring-brand-500"
          : "border-border hover:border-muted-foreground/40"
      )}
    >
      {previewed ? (
        <TabPreviewFrame target={section} />
      ) : (
        <div
          style={{ aspectRatio: PREVIEW_ASPECT }}
          className="w-full bg-background"
        />
      )}
      <div className="flex h-9 items-center gap-2 border-t border-border bg-elevate px-2.5 text-xs">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{section.title}</span>
        {/* Above the sheet that picks the section, which covers the whole card
            — so the ✕ is the one part of it that answers for itself. It is the
            strip's ✕ and behaves like it: held back until the card is reached
            for, and there for the keyboard whenever it is on it. */}
        {onClose !== undefined && (
          <button
            type="button"
            aria-label={`Close ${section.title}`}
            onClick={onClose}
            className="relative z-10 flex size-[1.125rem] shrink-0 items-center justify-center rounded opacity-0 group-hover/card:opacity-70 hover:bg-elevate-strong focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <IconX className="size-3.5" />
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label={`Show ${section.title}`}
        aria-current={active}
        onClick={onSelect}
        className="absolute inset-0 cursor-default rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

/**
 * The tile that mints a conversation, at the end of the sessions it would be
 * joining. It is the one card with nothing to photograph — there is no page yet
 * — so it wears the mark it would be adding to the row instead.
 */
function NewSessionCard({ onSelect }: { readonly onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group/card flex flex-col overflow-hidden rounded-lg border border-dashed border-border text-left transition-colors duration-200 outline-none hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      )}
    >
      <div
        style={{ aspectRatio: PREVIEW_ASPECT }}
        className="flex w-full items-center justify-center bg-background text-muted-foreground group-hover/card:text-foreground"
      >
        <IconPlus className="size-5" />
      </div>
      <div className="flex h-9 w-full items-center gap-2 border-t border-border bg-elevate px-2.5 text-xs">
        <IconPlus className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">New session</span>
      </div>
    </button>
  );
}
