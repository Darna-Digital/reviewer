/**
 * WindowBar — the strip along the top of the window: the macOS traffic lights,
 * the tab strip, the window menu and the account.
 *
 * Drawn in both shells, so the app reads the same either way. Two things are
 * the native window's alone: the lead gutter the traffic lights are drawn into,
 * and the drag region — empty space moves the window, and every control opts
 * back out of it.
 */
// The history arrows are parked for now, along with the icons they wore.
// import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import {
  IconCommand,
  IconDotsVertical,
  IconLayoutGrid,
  IconPlus,
  IconSitemap,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
// import { useCanGoBack } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { isFeatureEnabled } from "@byconvo/feature-flags";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Orb } from "@/components/ui/orb";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  updateWindowTabs,
  useWindowTabs,
  windowTabsSnapshot,
} from "@/interactions/window-tabs/adapters/window-tabs.store";
import { useWindowTabActions } from "@/interactions/window-tabs/adapters/window-tab-actions";
import { WindowTabIcon } from "@/interactions/window-tabs/components/window-tab-icon";
import {
  chatIdOf,
  isPinnedTab,
  moveTab,
  nextModeTab,
  NEW_SESSION_HREF,
  renameTab,
  sessionAtSlot,
  stripTabs,
  trackLocation,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import {
  barShortcut,
  sessionDigit,
  type BarPane,
  type BarShortcut,
} from "@/components/layout/window-bar.shortcuts";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import {
  closeTabOverview,
  toggleTabOverview,
  useTabOverview,
} from "@/interactions/tab-preview/adapters/tab-overview.store";
import {
  setProjectPickerOpen,
  useProjectPickerOpen,
} from "@/interactions/workspace/adapters/project-picker.store";
import { ProjectPicker } from "@/interactions/workspace/components/project-picker";
import { ROW_TOOLTIP_PLACEMENT } from "@/components/ui/truncated-text";
import { isChatUnread } from "@byconvo/core/chats";
import { openSearch } from "@/interactions/search/adapters/search.store";
import { useThinkingChatIds } from "@/interactions/chats/adapters/thinking-chats.hook.adapter";
import { isDesktop } from "@/lib/desktop";
import { isCodeSurface } from "@/lib/shell-route";
import type { WindowTab } from "@/interactions/window-tabs/interfaces/window-tabs.interfaces";
import { useRecentChats, useWorkspace } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

const NO_DRAG = "[-webkit-app-region:no-drag]";

/**
 * How much of the bar the window's own controls have.
 *
 * macOS holds the lights 20px off the window's edge, and they run 52px wide, so
 * they end at 72. The gutter gives the group that same 20px on its other side:
 * the lights are a thing on the bar with equal air either way round, rather than
 * a thing the bar starts after.
 *
 * The 20 is measured to the edge of the first control, not to the mark inside
 * it — a chip's fill is what stands next to the lights. That edge is the row's
 * own gap along from the gutter, so the gutter is 92 less those 4.
 */
const LEAD_GUTTER = "w-22";

const sessionsEnabled = isFeatureEnabled("sessions-button");

/** Stay on the page the project was switched from, now scoped to the new one. */
const stayPut = () => {};

const PROJECT_PICKER_KEYS = "⌘⇧P";
const MODE_KEYS = "⌘G";
const NEW_SESSION_KEYS = "⌘T";
const LAUNCHPAD_KEYS = "⌘L";
const COMMANDS_KEYS = "⌘K";
const ANALYSIS_KEYS = "⌘⇧A";
const BROWSER_KEYS = "⌘⇧B";

/** A chord as its keycaps: one per glyph, the way the style guide sets them. */
function Shortcut({ keys }: { keys: string }) {
  return (
    <KbdGroup className="shrink-0">
      {Array.from(keys).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}

/**
 * What the bar says about a control: its name, and the chord that runs it.
 *
 * A long tab title is cut at the tooltip's own width rather than wrapped: the
 * chord sits at the end of the line, and a second line of title pushed it away
 * from the name it belongs to.
 */
function BarLabel({ label, keys }: { label: string; keys?: string | null }) {
  return (
    <TooltipContent side="bottom">
      <span className="min-w-0 truncate">{label}</span>
      {keys != null && <Shortcut keys={keys} />}
    </TooltipContent>
  );
}

function BarTooltip({
  label,
  keys,
  children,
  disabled,
}: {
  label: string;
  keys?: string | null;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip disabled={disabled}>
      {children}
      <BarLabel label={label} keys={keys} />
    </Tooltip>
  );
}

/**
 * A row of the window menu: its name, and its chord on hover rather than set
 * along the row. The keycaps are cut for a tooltip's surface, and a menu that
 * held them would be a second place on the bar where a chord is written — so
 * the row says what it does and the tooltip says how else to do it, exactly as
 * the buttons either side of the strip do.
 */
function MenuRow({
  label,
  keys,
  onClick,
  children,
}: {
  label: string;
  keys: string;
  onClick: () => void;
  /** The row's icon; the label follows it. */
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<DropdownMenuItem onClick={onClick} />}>
        {children}
        {label}
      </TooltipTrigger>
      {/* Flush off the row's edge, where every other row tooltip in the app
          sits, so it never covers the rows under it. */}
      <TooltipContent {...ROW_TOOLTIP_PLACEMENT}>
        {label}
        <Shortcut keys={keys} />
      </TooltipContent>
    </Tooltip>
  );
}

function BarButton({
  label,
  keys,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  /** The chord that does the same thing, set in keycaps beside the label. */
  keys?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Set on toggles, so the button both announces and shows its state. */
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <BarTooltip label={label} keys={keys}>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "text-muted-foreground",
              pressed === true && "bg-elevate-strong text-foreground",
              NO_DRAG
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
    </BarTooltip>
  );
}

/**
 * The chord that takes the window to a tab. The digits count the conversations
 * alone, from ⌘1, until they run out; the places the strip leads with are ways
 * of working rather than tabs among them, and ⌘G steps between them — so it is
 * what they say, and only while there are two of them to cross between.
 */
const tabKeys = (
  tab: WindowTab,
  slot: number,
  modeCount: number
): string | null => {
  if (isPinnedTab(tab)) return modeCount > 1 ? MODE_KEYS : null;
  const digit = sessionDigit(slot);
  return digit === null ? null : `⌘${digit}`;
};

export function WindowBar() {
  // const canGoBack = useCanGoBack();
  const location = useRouterState({ select: (s) => s.location });
  const windowTabs = useWindowTabs();
  const { tabs, activeId } = windowTabs;
  const strip = useMemo(() => stripTabs(windowTabs), [windowTabs]);
  // The pinned tabs lead the strip, so what follows them is slot 1 onwards.
  const pinnedCount = strip.filter(isPinnedTab).length;
  const { select, close, openSession, prime } = useWindowTabActions();
  const overviewOpen = useTabOverview();
  // The launchpad is where the window is while it is up, so none of the tabs
  // behind it is the one being looked at. The strip keeps its roving focus on
  // the tab the window will return to.
  const showingId = overviewOpen ? null : activeId;
  /**
   * Take the window to a tab from the strip. The launchpad is a place the
   * window goes to rather than a page it holds open, so picking a tab from
   * behind it answers it as much as picking one of its own cards does — and
   * unlike a card, the strip is not what the panel is covering, so it goes
   * straight away rather than waiting out the navigation.
   */
  const show = (tab: WindowTab) => {
    closeTabOverview();
    void select(tab);
  };
  /**
   * Mint a session, from the ✛ or from its chord. The launchpad answers to this
   * as it answers to `show`, and for the same reason: the bar is what you
   * reached for, and a panel left standing over the session it has just started
   * is a panel you have to dismiss before you can type into it.
   */
  const mint = () => {
    closeTabOverview();
    void openSession();
  };
  /**
   * The tab being dragged. It lives in a ref as well as state because the first
   * `dragover` can arrive in the same task as the `dragstart` that set it, and
   * would read the pre-render value; the state copy only drives the styling.
   */
  const draggingRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const endDrag = () => {
    draggingRef.current = null;
    setDragging(null);
  };

  // Whichever tab owns the window's location is the active one, however the
  // window got there.
  useEffect(() => {
    updateWindowTabs((state) =>
      trackLocation(state, location.href, location.pathname)
    );
  }, [location.href, location.pathname]);

  // The top of the list answers both questions below: a session that moved is
  // at the top of it by definition, and a tab is minted from a new session.
  const chats = useRecentChats();

  /**
   * Threads touched since the inbox was last looked at. Only a session tab
   * wears the dot, for its own conversation — the strip is where you watch a
   * thread you have open, not a count of everything in the inbox.
   */
  const prefs = useUiPrefs();
  const inCodeMode = isCodeSurface(location.pathname);
  const workspace = useWorkspace();
  const pickerOpen = useProjectPickerOpen();
  // Both panes are there to be read against something else the window is
  // showing, and in the native shell there is always something — the browser
  // pane is a window of its own, and an analysis is opened from either mode. A
  // browser tab has no <webview> to put behind the second, and only reads an
  // analysis beside the code. A pane the window cannot show is off the menu,
  // and its chord does nothing.
  const paneAvailable = (pane: BarPane): boolean =>
    pane === "browser" ? isDesktop : isDesktop || inCodeMode;
  const windowMenu =
    inCodeMode || paneAvailable("analysis") || paneAvailable("browser");
  const togglePane = (pane: BarPane) => {
    if (!paneAvailable(pane)) return;
    setUiPrefs(
      pane === "browser"
        ? { browserPaneOpen: !prefs.browserPaneOpen }
        : { plansPaneOpen: !prefs.plansPaneOpen }
    );
  };
  // A tab waits when its session has moved since it was last opened — the
  // session's own mark, so reading it here puts the tab's dot out too.
  const unread = useMemo(
    () =>
      new Set(
        (chats.data?.items ?? []).filter(isChatUnread).map((chat) => chat.id)
      ),
    [chats.data]
  );
  const thinking = useThinkingChatIds();
  const chatOf = (tab: WindowTab): string | null =>
    tab.kind === "session" ? chatIdOf(tab.href) : null;
  const waiting = (tab: WindowTab): boolean => {
    const chatId = chatOf(tab);
    return chatId !== null && unread.has(chatId);
  };
  const working = (tab: WindowTab): boolean => {
    const chatId = chatOf(tab);
    return chatId !== null && thinking.has(chatId);
  };

  // A session tab is minted before its conversation exists, so it takes the
  // chat's name once the list has one to give.
  useEffect(() => {
    const summaries = chats.data?.items;
    if (summaries === undefined) return;
    updateWindowTabs((state) =>
      state.tabs.reduce((next, tab) => {
        if (tab.kind !== "session") return next;
        const chatId = chatIdOf(tab.href);
        const title = summaries.find((chat) => chat.id === chatId)?.title;
        return title === undefined ? next : renameTab(next, tab.id, title);
      }, state)
    );
  }, [chats.data]);

  // Every tab in the strip, and the session the ✛ would mint, loaded while the
  // window has nothing else to do. A tab is already open as far as you are
  // concerned — clicking it should show the page, not start fetching it — and
  // waiting for the pointer to reach the tab is too late for a click that
  // follows straight after.
  useEffect(() => {
    const warm = () => {
      for (const tab of tabs) prime(tab.href);
      if (sessionsEnabled) prime(NEW_SESSION_HREF);
    };
    const idle = window.requestIdleCallback(warm, { timeout: 2_000 });
    return () => window.cancelIdleCallback(idle);
  }, [tabs, prime]);

  // Every chord does what pressing the control beside it does. The strip is
  // read from the store rather than this render's copy: two presses in a row
  // arrive before React has re-rendered for the first.
  useEffect(() => {
    const run = (shortcut: BarShortcut) => {
      switch (shortcut.kind) {
        case "new-session":
          return mint();
        case "launchpad":
          return toggleTabOverview();
        case "project-picker":
          return setProjectPickerOpen(true);
        case "pane":
          return togglePane(shortcut.pane);
        case "mode": {
          const state = windowTabsSnapshot();
          const tab = nextModeTab(stripTabs(state), state.activeId);
          return tab === null ? undefined : show(tab);
        }
        case "session": {
          const tab = sessionAtSlot(
            stripTabs(windowTabsSnapshot()),
            shortcut.slot
          );
          return tab === null ? undefined : show(tab);
        }
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const shortcut = barShortcut(event);
      if (shortcut === null) return;
      event.preventDefault();
      run(shortcut);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <header
      className={cn(
        // 46px: the 36px band every surface keeps, with 5px of frame above and
        // below it. Its middle is 23, which is where the traffic lights sit —
        // macOS lands a light on an even pixel, so the centre of a 14px one
        // falls on an odd pixel, and only every fourth height puts the bar's own
        // middle there to meet it. The row rides a pixel below that line: the
        // lights are circles among squares and read low against them at a true
        // 23, so the squares give way rather than the bar being rebuilt around
        // a line the lights cannot reach.
        "flex h-11.5 shrink-0 items-center pt-0.5",
        isDesktop && "[-webkit-app-region:drag]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {/* The traffic lights are drawn by macOS over the bar's top-left, so the
            lead gutter is what the window's own controls sit in (see
            `trafficLightPosition` in the desktop main process). A browser tab
            has no controls there, so the bar starts at its edge. */}
        <div
          aria-hidden
          className={cn("shrink-0", isDesktop ? LEAD_GUTTER : "w-2")}
        />
        <SidebarToggle className={NO_DRAG} />
        {/* <BarButton
        label="Back"
        disabled={!canGoBack}
        onClick={() => router.history.back()}
      >
        <IconArrowLeft className="size-5" />
      </BarButton>
      <BarButton label="Forward" onClick={() => router.history.forward()}>
        <IconArrowRight className="size-5" />
      </BarButton> */}

        {/* The project the window is on leads the strip: every tab behind it is
            a place within that project, so the chip names them all rather than
            being one more thing on the page under them. Switching project keeps
            a session or a board where it is; on the code surfaces it lands in
            the arriving project's tree, as it always has. */}
        <div className={cn("flex min-w-0 shrink-0", NO_DRAG)}>
          <ProjectPicker
            workspace={workspace.data}
            open={pickerOpen}
            onOpenChange={setProjectPickerOpen}
            onChosen={inCodeMode ? undefined : stayPut}
            onWindowBar
            tooltip={<BarLabel label="Projects" keys={PROJECT_PICKER_KEYS} />}
          />
        </div>

        <div
          role="tablist"
          aria-label="Open tabs"
          // No inset of its own: the strip stands off the sidebar toggle by the
          // row's gap, the same as the tabs stand off each other. An extra
          // margin here made the one button before the strip the only thing on
          // the bar with more room around it than its neighbours.
          className={cn(
            "flex min-w-0 items-center gap-1 overflow-x-auto",
            NO_DRAG
          )}
        >
          {strip.map((tab, at) => {
            const active = tab.id === showingId;
            const pinned = isPinnedTab(tab);
            return (
              <BarTooltip
                key={tab.id}
                label={tab.title}
                keys={tabKeys(tab, at + 1 - pinnedCount, pinnedCount)}
                disabled={dragging !== null}
              >
                <TooltipTrigger
                  render={
                    <div
                      role="tab"
                      aria-selected={active}
                      aria-label={tab.title}
                      tabIndex={tab.id === activeId ? 0 : -1}
                      draggable={!pinned}
                      onPointerEnter={() => prime(tab.href)}
                      className={cn(
                        "group/tab flex h-7 max-w-52 min-w-0 shrink-0 cursor-default items-center gap-1.5 rounded-md text-[0.8125rem] transition-colors",
                        // A pinned tab is its icon and nothing else, so it wears
                        // the same square — and the same states — as the buttons
                        // at the other end of the bar.
                        pinned ? "w-7 justify-center" : "pr-1 pl-2.5",
                        active
                          ? "bg-elevate-strong text-foreground"
                          : "text-muted-foreground hover:bg-elevate hover:text-foreground",
                        dragging === tab.id && "opacity-50"
                      )}
                      onDragStart={(event) => {
                        draggingRef.current = tab.id;
                        setDragging(tab.id);
                        event.dataTransfer.effectAllowed = "move";
                        // Firefox refuses to start a drag without a payload.
                        event.dataTransfer.setData("text/plain", tab.id);
                      }}
                      onDragOver={(event) => {
                        const held = draggingRef.current;
                        if (held === null) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        // Reorder as the pointer crosses each tab, so the strip
                        // shows where the drop will land instead of only
                        // revealing it after. The slot is the crossed tab's own
                        // in the strip's state, which is not where it is drawn:
                        // a switched-off tab is missing from the bar but still
                        // holds its place behind it.
                        if (held !== tab.id) {
                          updateWindowTabs((current) =>
                            moveTab(
                              current,
                              held,
                              current.tabs.findIndex(
                                (candidate) => candidate.id === tab.id
                              )
                            )
                          );
                        }
                      }}
                      onDragEnd={endDrag}
                      onDrop={(event) => {
                        event.preventDefault();
                        endDrag();
                      }}
                      onClick={(event) => {
                        // Shift-click closes, so a tab can go without aiming for
                        // its ✕.
                        if (event.shiftKey && !pinned) {
                          event.preventDefault();
                          close(tab.id);
                          return;
                        }
                        show(tab);
                      }}
                      onAuxClick={(event) => {
                        if (event.button === 1 && !pinned) {
                          event.preventDefault();
                          close(tab.id);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          show(tab);
                        }
                      }}
                    />
                  }
                >
                  {pinned && <WindowTabIcon kind={tab.kind} />}
                  {!pinned && (
                    <>
                      <span className="truncate">{tab.title}</span>
                      {/* What the thread is doing shares the ✕'s slot, which
                        the tab already reserves — so a thread going quiet
                        neither resizes the tab nor leaves a hole. Reaching for
                        the ✕ trades one for the other.

                        An agent still working outranks a thread waiting to be
                        read: the orb says the tab is going to change again,
                        which is the more useful of the two. */}
                      <span className="relative flex size-[1.125rem] shrink-0 items-center justify-center">
                        {working(tab) ? (
                          <Orb
                            size={18}
                            label="Working"
                            className={cn(
                              "group-hover/tab:opacity-0",
                              active && "opacity-0"
                            )}
                          />
                        ) : (
                          waiting(tab) && (
                            <span
                              aria-label="Waiting"
                              className={cn(
                                "size-1.5 rounded-full bg-brand-500 group-hover/tab:opacity-0",
                                active && "opacity-0"
                              )}
                            />
                          )
                        )}
                        <button
                          type="button"
                          aria-label={`Close ${tab.title}`}
                          className={cn(
                            "absolute inset-0 flex items-center justify-center rounded hover:bg-elevate-strong",
                            active
                              ? "opacity-70"
                              : "opacity-0 group-hover/tab:opacity-70"
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            close(tab.id);
                          }}
                        >
                          <IconX className="size-3.5" />
                        </button>
                      </span>
                    </>
                  )}
                </TooltipTrigger>
              </BarTooltip>
            );
          })}
        </div>
        {sessionsEnabled && (
          <BarButton label="New session" keys={NEW_SESSION_KEYS} onClick={mint}>
            <IconPlus className="size-4" />
          </BarButton>
        )}
      </div>
      {/* The trailing end keeps its content whatever the window's width: it is
          the strip that gives way first. Its inset is a gutter like the lead
          one rather than padding, so both ends of the bar read the same. */}
      <div className="flex shrink-0 items-center justify-end gap-1">
        {/* The launchpad is where the window keeps its tabs, and it is reached
            often enough to be worth a press rather than two — the menu beside
            it holds the surfaces that are opened once and left. */}
        <BarButton
          label="Launchpad"
          keys={LAUNCHPAD_KEYS}
          pressed={overviewOpen}
          onClick={toggleTabOverview}
        >
          <IconLayoutGrid className="size-4" />
        </BarButton>
        {/* Everything the window can put beside the page, under one handle:
            each row names itself, and hovering it says which chord does the
            same. Off the modes that have any, the handle itself goes. */}
        {windowMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Window menu"
                  className={cn("text-muted-foreground", NO_DRAG)}
                />
              }
            >
              <IconDotsVertical className="size-4" />
            </DropdownMenuTrigger>

            {/* Narrower than a menu's default: these rows are short names, and
                the chords that would have set the width are in the tooltips
                rather than along them. */}
            <DropdownMenuContent align="end" className="min-w-48">
              {/* The palette is code mode's, and so is the host that answers
                  ⌘K: off it there is nothing behind the row to open. */}
              {inCodeMode && (
                <MenuRow
                  label="Command menu"
                  keys={COMMANDS_KEYS}
                  onClick={() => openSearch("commands")}
                >
                  <IconCommand className="size-4 shrink-0" />
                </MenuRow>
              )}
              {paneAvailable("analysis") && (
                <MenuRow
                  label="Analysis"
                  keys={ANALYSIS_KEYS}
                  onClick={() => togglePane("analysis")}
                >
                  <IconSitemap className="size-4 shrink-0" />
                </MenuRow>
              )}
              {paneAvailable("browser") && (
                <MenuRow
                  label="Browser"
                  keys={BROWSER_KEYS}
                  onClick={() => togglePane("browser")}
                >
                  <IconWorld className="size-4 shrink-0" />
                </MenuRow>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div aria-hidden className="w-2 shrink-0" />
      </div>
    </header>
  );
}
