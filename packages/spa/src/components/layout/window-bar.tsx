/**
 * WindowBar — the strip along the top of the window: the macOS traffic lights,
 * the tab strip, the pane toggles and the account.
 *
 * Drawn in both shells, so the app reads the same either way. Two things are
 * the native window's alone: the lead gutter the traffic lights are drawn into,
 * and the drag region — empty space moves the window, and every control opts
 * back out of it.
 */
// The history arrows are parked for now, along with the icons they wore.
// import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import {
  IconPlus,
  IconSitemap,
  IconStack2,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
// import { useCanGoBack } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
  NEW_SESSION_HREF,
  renameTab,
  tabAtPosition,
  trackLocation,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import {
  toggleTabOverview,
  useTabOverview,
} from "@/interactions/tab-preview/adapters/tab-overview.store";
import { isChatUnread } from "@/interactions/chats/functions/chat-unread.functions";
import { isDesktop } from "@/lib/desktop";
import type { WindowTab } from "@/interactions/window-tabs/interfaces/window-tabs.interfaces";
import { useChats } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { activeWorkMode } from "@/lib/work-mode";

const NO_DRAG = "[-webkit-app-region:no-drag]";

function BarButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Set on toggles, so the button both announces and shows its state. */
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
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
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function WindowBar() {
  // const canGoBack = useCanGoBack();
  const location = useRouterState({ select: (s) => s.location });
  const { tabs, activeId } = useWindowTabs();
  const { select, close, openSession, prime } = useWindowTabActions();
  const overviewOpen = useTabOverview();
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

  const chats = useChats();

  /**
   * Threads touched since the inbox was last looked at. Only a session tab
   * wears the dot, for its own conversation — the strip is where you watch a
   * thread you have open, not a count of everything in the inbox.
   */
  const prefs = useUiPrefs();
  const inCodeMode =
    activeWorkMode(location.pathname, prefs.workMode) === "code";
  const seenAt = prefs.inboxSeenAt;
  const unread = useMemo(
    () =>
      new Set(
        (chats.data ?? [])
          .filter((chat) => isChatUnread(chat, seenAt))
          .map((chat) => chat.id)
      ),
    [chats.data, seenAt]
  );
  const waiting = (tab: WindowTab): boolean => {
    const chatId = tab.kind === "session" ? chatIdOf(tab.href) : null;
    return chatId !== null && unread.has(chatId);
  };

  // A session tab is minted before its conversation exists, so it takes the
  // chat's name once the list has one to give.
  useEffect(() => {
    const summaries = chats.data;
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
      prime(NEW_SESSION_HREF);
    };
    const idle = window.requestIdleCallback(warm, { timeout: 2_000 });
    return () => window.cancelIdleCallback(idle);
  }, [tabs, prime]);

  // ⌘T mints a session, the same as the ✛ at the end of the strip, and ⌘L
  // expands the launchpad, the same as the button at the head of the bar. ⇧ and
  // ⌥ are left alone so each chord stays exactly the one it is.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key !== "t" && key !== "l") return;
      event.preventDefault();
      if (key === "t") openSession();
      else toggleTabOverview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ⌘1–⌘8 jump to that tab and ⌘9 to the last one, as in every browser. The
  // strip is read from the store rather than this render's copy: two presses in
  // a row arrive before React has re-rendered for the first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const position = Number(event.key);
      if (!Number.isInteger(position) || position < 1 || position > 9) return;
      event.preventDefault();
      const target = tabAtPosition(windowTabsSnapshot().tabs, position);
      if (target === null) return;
      select(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <header
      className={cn(
        "flex h-10 shrink-0 items-center",
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
          className={isDesktop ? "w-24 shrink-0" : "w-2 shrink-0"}
        />
        {/* The launchpad rides the bar rather than the strip: it is a place the
            window goes to, not a page it holds open. */}
        <BarButton
          label="Launchpad"
          pressed={overviewOpen}
          onClick={toggleTabOverview}
        >
          <IconStack2 className="size-4" />
        </BarButton>
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

        <div
          role="tablist"
          aria-label="Open tabs"
          className={cn(
            "ml-1 flex min-w-0 items-center gap-1 overflow-x-auto",
            NO_DRAG
          )}
        >
          {tabs.map((tab, index) => {
            const active = tab.id === activeId;
            const pinned = isPinnedTab(tab);
            return (
              <Tooltip key={tab.id} disabled={dragging !== null}>
                <TooltipTrigger
                  render={
                    <div
                      role="tab"
                      aria-selected={active}
                      aria-label={tab.title}
                      tabIndex={active ? 0 : -1}
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
                        // revealing it after.
                        if (held !== tab.id) {
                          updateWindowTabs((state) =>
                            moveTab(state, held, index)
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
                        select(tab);
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
                          select(tab);
                        }
                      }}
                    />
                  }
                >
                  {pinned && <WindowTabIcon kind={tab.kind} />}
                  {!pinned && (
                    <>
                      <span className="truncate">{tab.title}</span>
                      {/* The dot shares the ✕'s slot, which the tab already
                        reserves — so a thread going quiet neither resizes the
                        tab nor leaves a hole. Reaching for the ✕ trades one
                        for the other. */}
                      <span className="relative flex size-[1.125rem] shrink-0 items-center justify-center">
                        {waiting(tab) && (
                          <span
                            aria-label="Waiting"
                            className={cn(
                              "size-1.5 rounded-full bg-brand-500 group-hover/tab:opacity-0",
                              active && "opacity-0"
                            )}
                          />
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
                <TooltipContent side="bottom">{tab.title}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <BarButton label="New session" onClick={openSession}>
          <IconPlus className="size-4" />
        </BarButton>
      </div>
      {/* The trailing end keeps its content whatever the window's width: it is
          the strip that gives way first. Its inset is a gutter like the lead
          one rather than padding, so both ends of the bar read the same. */}
      <div className="flex shrink-0 items-center justify-end gap-1">
        {/* Both panes are there to be read against something else the window is
            showing, and in the native shell there is always something — the
            browser pane is a window of its own, and an analysis is opened from
            either mode. A browser tab has no <webview> to put behind the
            second, and only reads an analysis beside the code. */}
        {(isDesktop || inCodeMode) && (
          <BarButton
            label="Analysis"
            pressed={prefs.plansPaneOpen}
            onClick={() => setUiPrefs({ plansPaneOpen: !prefs.plansPaneOpen })}
          >
            <IconSitemap className="size-4" />
          </BarButton>
        )}
        {isDesktop && (
          <BarButton
            label="Browser"
            pressed={prefs.browserPaneOpen}
            onClick={() =>
              setUiPrefs({ browserPaneOpen: !prefs.browserPaneOpen })
            }
          >
            <IconWorld className="size-4" />
          </BarButton>
        )}
        <UserMenu className={NO_DRAG} />
        <div aria-hidden className="w-2 shrink-0" />
      </div>
    </header>
  );
}
