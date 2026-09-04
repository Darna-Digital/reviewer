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
import { IconChevronUp, IconPlus, IconX } from "@tabler/icons-react";
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
import { SidebarSearch } from "@/components/layout/sidebar-filters";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Orb } from "@/components/ui/orb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEntered, usePresence, useSettled } from "@/hooks/use-presence";
import { useThinkingChatIds } from "@/interactions/chats/adapters/thinking-chats.hook.adapter";
import { useWindowTabActions } from "@/interactions/window-tabs/adapters/window-tab-actions";
import { chatIdOf } from "@/interactions/window-tabs/functions/window-tabs.functions";
import { PANEL_EASE } from "@/lib/panel-slide";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import {
  beginPick,
  closeTabOverview,
  isOverviewResizing,
  isTabOverviewOpen,
  openTabOverview,
  setOverviewResizing,
  useOverviewResizing,
  useTabOverview,
} from "../adapters/tab-overview.store";
import {
  drawLaunchpadHeight,
  launchpadHeightNow,
  useDrawLaunchpad,
} from "../adapters/launchpad-height.store";
import { useLaunchpadGroups } from "../adapters/launchpad-sections.hook.adapter";
import {
  filterLaunchpadGroups,
  NEW_SESSION_TITLE,
  type LaunchpadSection,
} from "../functions/launchpad-sections.functions";
import {
  LAUNCHPAD_DISMISS_HEIGHT,
  LAUNCHPAD_MIN_HEIGHT,
  launchpadHeightCss,
  launchpadMaxHeight,
  fittedLaunchpadHeight,
  LIVE_PREVIEW_LIMIT,
  OVERVIEW_TRANSITION_MS,
  PICK_COVER_CEILING_MS,
  PREVIEW_ASPECT,
  wait,
} from "../functions/tab-preview.functions";
import { TabPreviewFrame } from "./tab-preview-frame";

/** The window's own curve. */
const EASE = PANEL_EASE;

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
 * The way out of the launchpad wears a tab: it is the frame's material rather
 * than a surface of its own — thin, blurred, and dark enough over a page to be
 * read against it.
 *
 * A tab rather than a pill, because it is attached to something: it stands on
 * the bottom of the panel, square along that edge and rounded on the free side,
 * where it takes the frame's own radius.
 *
 * The attached edge keeps its border, laid over the line where the page's own
 * sheet begins. Dropping it and letting that line run through was the tidier
 * idea and the worse tab: the sides then meet nothing at the bottom, and what
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
  "bottom-0 flex h-5 w-9 items-center justify-center rounded-t-md border border-frame-border/70 bg-background/60 text-muted-foreground shadow-xs transition-[background-color,color] duration-200 supports-backdrop-filter:backdrop-blur-md hover:bg-background/80 hover:text-foreground motion-reduce:transition-none";

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
  // A card stands for a tab, so it says what the strip says about it.
  const thinking = useThinkingChatIds();
  const working = (section: LaunchpadSection): boolean => {
    const chatId = chatIdOf(section.href);
    return chatId !== null && thinking.has(chatId);
  };
  const height = useUiPrefs().launchpadHeight;
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // What the search box has narrowed the grid to. The query is the panel's for
  // as long as it is on screen and no longer: it is dropped once the panel is
  // parked, so the launchpad opens on everything it has rather than on the last
  // thing that was looked for — but not a moment before, or the grid would
  // repopulate in full while it is still sliding away.
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!shown) setQuery("");
  }, [shown]);
  const shownGroups = useMemo(
    () => filterLaunchpadGroups(groups, query),
    [groups, query]
  );

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

  // Escape undoes the last thing done, which is the search before it is the
  // panel: a grid narrowed to one card and then dismissed outright is a
  // launchpad you have to reopen to see the rest of.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (query.length > 0) setQuery("");
      else closeTabOverview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, query]);

  // The caret goes in as the panel starts to arrive, so ⌘L and a few letters
  // are one gesture. Without the scroll, which would be the grid jumping to an
  // input that is on its way down the screen.
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (expanded) searchInputRef.current?.focus({ preventScroll: true });
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
  // Read at the moment a fit is asked for rather than as the effect was made:
  // the fit does not run on the query, and a stale one is what it would see.
  const searching = useRef(false);
  searching.current = query.length > 0;
  useLayoutEffect(() => {
    if (!expanded) return;
    let frame = 0;
    const fit = () => {
      const grid = gridRef.current;
      // A panel being pulled open by the pointer has a height already: the
      // pointer's. Sizing it to its rows mid-gesture would take the drag off
      // the pointer and leave it somewhere of our choosing.
      //
      // A narrowed grid is the same case for a different reason: its rows are
      // the answer to a search, and sizing the panel to them would leave it
      // holding the height of a query that is about to be cleared.
      if (grid === null || isOverviewResizing() || searching.current) return;
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
  const pick = (section: LaunchpadSection) => cover(visit(section.href));

  /**
   * What the search box does with a return: the first card left in the grid,
   * read in the order the grid is read. A query narrowed to one card is an
   * answer, and having to reach for it with the pointer is the search asking
   * you to find what you have already named.
   */
  const pickFirstHit = () => {
    const first = shownGroups.flatMap((group) => [...group.sections])[0];
    if (first !== undefined) return pick(first);
    if (shownGroups.some((group) => group.minting)) cover(openSession());
  };

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
          {/* The way to a card by name: the grid's first row, centred over the
              columns and the width of a name rather than of the window. It
              rides the grid rather than standing over it — a box pinned to the
              top of a scroller is chrome, and this is the panel's own first
              line. No fill and no rule: the launchpad is the frame's material
              and nothing else, and a filled box is a sheet laid on it. */}
          <div className="mb-3 flex items-center justify-center">
            <div className="w-full max-w-80 [&_input]:bg-transparent">
              <SidebarSearch
                inputRef={searchInputRef}
                label="Search the launchpad"
                placeholder="Search launchpad…"
                value={query}
                onChange={setQuery}
                onKeyDown={(event) => {
                  if (event.key === "Enter") pickFirstHit();
                }}
              />
            </div>
          </div>
          {shownGroups.map((group) => (
            <section key={group.title} className="mb-4 last:mb-0">
              <h2 className="mb-2 px-0.5 text-xs font-medium text-muted-foreground">
                {group.title}
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(26rem,1fr))] gap-3">
                {group.sections.map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    active={section.id === here}
                    working={working(section)}
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
          {/* Under the box rather than at the head of the grid: it is the
              answer to what was typed, not a row of what was found. */}
          {shownGroups.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Nothing matches.
            </p>
          )}
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
      {/* Only while there is no panel: open, the page's top edge is the panel's
          bottom edge, where the seam that sizes it already stands. */}
      {!expanded && <LaunchpadExpand />}
    </div>
  );
}

/**
 * How long the pointer has to rest on the seam before it is told what it is on.
 * The launchpad's seam lies where the pointer passes on its way to everything
 * else, so it holds off before lighting up — and what it says holds off with it,
 * arriving on the line rather than ahead of it. The wait is `resize-handle-quiet`'s.
 */
const SEAM_HINT_DELAY = 1_000;

/**
 * The way in: the same seam that sizes the launchpad, in the same place, before
 * there is a launchpad to size. It lies along the top of the page — the edge the
 * panel will come out of — and pulling it down brings the panel with it, so the
 * launchpad is opened at the height it is opened to.
 *
 * It rides the page rather than the bar, so it goes down with it when the
 * launchpad pushes; once the panel is up, the seam on its bottom edge stands
 * exactly here, and this one gets out of the way rather than lie under it.
 *
 * A pull shorter than the dismiss height leaves the panel where it was, and the
 * same height in the other direction is what shuts it again — the gesture is
 * reversible at the point it began, without the pointer having to be let go of.
 * Let go of without a pull at all, it opens the launchpad on its own rows: the
 * seam answers a click as the handle it replaced did, since a control you can
 * only drag is one you have to be told about.
 *
 * And told is what the tooltip is for. It hangs off the seam where the handle's
 * hung under the bar, and carries ⌘L: the launchpad has no button on the bar, so
 * the two edges it is dragged by are the only places the chord is written down.
 */
function LaunchpadExpand() {
  return (
    <TooltipProvider delay={SEAM_HINT_DELAY}>
      <Tooltip>
        <TooltipTrigger
          render={<div className="absolute inset-x-0 top-0 z-30 flex" />}
        >
          <ResizeHandle
            orientation="row"
            label="Launchpad"
            hint={null}
            className="resize-handle-quiet"
            // Nothing is open, so the drag starts from no panel at all and the
            // number it reports is how far down the pointer has come.
            value={0}
            min={0}
            max={() => launchpadMaxHeight(window.innerHeight)}
            onResize={(dragged) => {
              if (dragged <= LAUNCHPAD_DISMISS_HEIGHT) {
                // Pulled open and then pulled back: the same edge that dismisses
                // a panel is the one it has not yet cleared.
                if (isTabOverviewOpen()) {
                  setOverviewResizing(false);
                  closeTabOverview();
                }
                return;
              }
              // Before the opening, so the panel arrives under the pointer rather
              // than sliding to meet it — and so the fit to its own rows stands
              // aside for a height the gesture is already deciding.
              setOverviewResizing(true);
              openTabOverview();
              drawLaunchpadHeight(dragged);
            }}
            onResizeEnd={(dragged, moved) => {
              setOverviewResizing(false);
              if (isTabOverviewOpen()) {
                setUiPrefs({
                  launchpadHeight: Math.max(dragged, LAUNCHPAD_MIN_HEIGHT),
                });
              } else if (!moved) {
                openTabOverview();
              }
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Launchpad
          <KbdGroup>
            {Array.from(LAUNCHPAD_KEYS).map((glyph) => (
              <Kbd key={glyph}>{glyph}</Kbd>
            ))}
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
 * labels belong. It carries ⌘L with it: the launchpad has no button on the bar,
 * and this is the one place the chord is written down.
 */
function CollapseHandle() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Collapse launchpad"
            onClick={closeTabOverview}
            className={cn("absolute left-1/2 z-20 -translate-x-1/2", HANDLE)}
          >
            <IconChevronUp className="size-4" />
          </button>
        }
      />
      <TooltipContent side="top">
        Collapse launchpad
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
 * The seam between the launchpad and the page it pushed. It takes room away and
 * gives none back: the panel opens at the height its rows come to, so there is
 * nothing above that to drag into but empty panel — and dragged far enough up,
 * it goes altogether. Making it bigger again is the opening's job: the same seam
 * pulled down from a shut panel opens it wherever it is let go of, and a click
 * on it fits it to the rows afresh. Clicked while the panel is up, it shuts it —
 * one edge, pressed the same way, whichever side of it the panel is on.
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
        onResizeEnd={(dragged, moved) => {
          setOverviewResizing(false);
          if (!isTabOverviewOpen()) return;
          // Pressed and let go of where it stood, which is the way the seam is
          // shut: the same click that pulls the panel out of this edge puts it
          // back, and the chevron in the middle of the edge is spared having to
          // be aimed at.
          if (!moved) {
            closeTabOverview();
            return;
          }
          // Remembered once, where it was dropped. Storing it per frame meant
          // serialising every preference in the app sixty times a second, for a
          // number only the last of those was ever going to keep.
          setUiPrefs({
            launchpadHeight: Math.max(dragged, LAUNCHPAD_MIN_HEIGHT),
          });
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
  working,
  previewed,
  onPrime,
  onSelect,
  onClose,
}: {
  readonly section: LaunchpadSection;
  readonly active: boolean;
  /** Whether an agent is mid-turn in the conversation this card stands for. */
  readonly working: boolean;
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
      {/* The title leads the card the way a tab leads its page: you read what
          the thing is and then look at it, rather than looking first and being
          told after. It is also where the strip puts the same title, so a card
          and the tab it stands for are labelled at the same edge — and at the
          same height, h-7 being what a tab stands at up there. */}
      <div className="flex h-7 items-center gap-2 border-b border-border bg-elevate px-2.5 text-xs">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{section.title}</span>
        {/* Above the sheet that picks the section, which covers the whole card
            — so the ✕ is the one part of it that answers for itself. It is the
            strip's ✕ and behaves like it: held back until the card is reached
            for, and there for the keyboard whenever it is on it. The orb shares
            that slot the same way the strip's does, so reaching for the ✕
            trades one for the other rather than moving the title. */}
        {(onClose !== undefined || working) && (
          <span className="relative z-10 flex size-[1.125rem] shrink-0 items-center justify-center">
            {working && (
              <Orb
                size={18}
                label="Working"
                className="group-hover/card:opacity-0"
              />
            )}
            {onClose !== undefined && (
              <button
                type="button"
                aria-label={`Close ${section.title}`}
                onClick={onClose}
                className="absolute inset-0 flex items-center justify-center rounded opacity-0 group-hover/card:opacity-70 hover:bg-elevate-strong focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </span>
        )}
      </div>
      {previewed ? (
        <TabPreviewFrame target={section} />
      ) : (
        <div
          style={{ aspectRatio: PREVIEW_ASPECT }}
          className="w-full bg-background"
        />
      )}
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
      <div className="flex h-7 w-full items-center gap-2 border-b border-border bg-elevate px-2.5 text-xs">
        <IconPlus className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{NEW_SESSION_TITLE}</span>
      </div>
      <div
        style={{ aspectRatio: PREVIEW_ASPECT }}
        className="flex w-full items-center justify-center bg-background text-muted-foreground group-hover/card:text-foreground"
      >
        <IconPlus className="size-5" />
      </div>
    </button>
  );
}
