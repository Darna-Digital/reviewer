/**
 * The window-tab strip: Code and Sessions pinned, then the sessions lifted into
 * tabs of their own, and the ✛ that mints one.
 *
 * The one strip, drawn in two bars: the window bar in the browser tab, and —
 * natively, from the picture the island sends it — the toolbar of the macOS
 * shell. Everything that makes a strip a strip is in
 * `useWindowTabStrip` rather than in either bar — following the location,
 * naming session tabs after their conversations, priming every tab's page while
 * the window is idle, and the chords that pick a tab — so the two bars differ
 * only in what draws the tabs and what stands either side of them.
 */
import { IconPlus, IconX } from "@tabler/icons-react";
import { TooltipTrigger } from "@/components/ui/tooltip";
import { useRouterState } from "@tanstack/react-router";
import { isFeatureEnabled } from "@reviewer/feature-flags";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarButton,
  BarTooltip,
  NO_DRAG,
} from "@/components/layout/bar-controls";
import { TAB_STRIP } from "@/components/layout/tab-chip";
import {
  barShortcut,
  sessionDigit,
  type BarShortcut,
} from "@/components/layout/window-bar.shortcuts";
import { Orb } from "@/components/ui/orb";
import { useThinkingChatIds } from "@/interactions/chats/adapters/thinking-chats.hook.adapter";
import {
  closeTabOverview,
  toggleTabOverview,
  useTabOverview,
} from "@/interactions/tab-preview/adapters/tab-overview.store";
import { isChatUnread } from "@reviewer/core/chats";
import { useRecentChats } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useWindowTabActions } from "../adapters/window-tab-actions";
import {
  updateWindowTabs,
  useWindowTabs,
  windowTabsSnapshot,
} from "../adapters/window-tabs.store";
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
} from "../functions/window-tabs.functions";
import type { WindowTab } from "../interfaces/window-tabs.interfaces";
import { WindowTabIcon } from "./window-tab-icon";

const sessionsEnabled = isFeatureEnabled("sessions-button");

const MODE_KEYS = "⌘G";
const NEW_SESSION_KEYS = "⌘T";

/** The chords that are the strip's to answer; the rest are the bar's. */
const STRIP_SHORTCUTS: ReadonlySet<BarShortcut["kind"]> = new Set<
  BarShortcut["kind"]
>(["new-session", "launchpad", "mode", "session"]);

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

/** The strip as a bar draws it, and what pressing each of its tabs does. */
export interface WindowTabStripHandle {
  readonly strip: ReadonlyArray<WindowTab>;
  readonly activeId: string;
  /** The tab being looked at: none while the launchpad covers the window. */
  readonly showingId: string | null;
  readonly pinnedCount: number;
  readonly show: (tab: WindowTab) => void;
  readonly mint: () => void;
  readonly close: (id: string) => void;
  readonly prime: (href: string) => void;
  /** A session whose thread has moved since the inbox was last looked at. */
  readonly waiting: (tab: WindowTab) => boolean;
  /** A session whose agent is mid-turn. */
  readonly working: (tab: WindowTab) => boolean;
}

export function useWindowTabStrip(): WindowTabStripHandle {
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
   * thread you have open, not a count of everything in the inbox. The mark is
   * the session's own, so reading it here puts the tab's dot out too.
   */
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
        default:
          return undefined;
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const shortcut = barShortcut(event);
      if (shortcut === null || !STRIP_SHORTCUTS.has(shortcut.kind)) return;
      event.preventDefault();
      run(shortcut);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return {
    strip,
    activeId,
    showingId,
    pinnedCount,
    show,
    mint,
    close,
    prime,
    waiting,
    working,
  };
}

export function WindowTabStrip() {
  const {
    strip,
    activeId,
    showingId,
    pinnedCount,
    show,
    mint,
    close,
    prime,
    waiting,
    working,
  } = useWindowTabStrip();
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

  return (
    <>
      <div
        role="tablist"
        aria-label="Open tabs"
        // No inset of its own: the strip stands off the control before it by
        // the row's gap, the same as the tabs stand off each other. An extra
        // margin here made the one button before the strip the only thing on
        // the bar with more room around it than its neighbours.
        className={cn(TAB_STRIP, NO_DRAG)}
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
    </>
  );
}
