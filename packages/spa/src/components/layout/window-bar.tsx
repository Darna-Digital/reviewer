/**
 * WindowBar — the strip along the top of the native window: the macOS traffic
 * lights, history navigation, and the tab strip.
 *
 * Native-shell only. In a browser tab all three already exist one level up —
 * the browser's own tabs, its back button, its chrome — so WindowFrame does not
 * render this there. Empty regions drag the window; every control opts back out.
 */
// The history arrows are parked for now, along with the icons they wore.
// import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import {
  IconCode,
  IconPlus,
  IconSend,
  IconSitemap,
  IconUsersGroup,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
// import { useCanGoBack } from "@tanstack/react-router";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  nextTabId,
  updateWindowTabs,
  useWindowTabs,
  windowTabsSnapshot,
} from "@/interactions/window-tabs/adapters/window-tabs.store";
import {
  chatIdOf,
  closeTab,
  isPinnedTab,
  moveTab,
  NEW_SESSION_HREF,
  NEW_SESSION_TITLE,
  openTab,
  renameTab,
  selectTab,
  tabAtPosition,
  trackLocation,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { isChatUnread } from "@/interactions/chats/functions/chat-unread.functions";
import type {
  WindowTab,
  WindowTabKind,
} from "@/interactions/window-tabs/interfaces/window-tabs.interfaces";
import { useChats } from "@/lib/queries";
import { setUiPrefs, useUiPrefs, type WorkMode } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { activeWorkMode } from "@/lib/work-mode";

const NO_DRAG = "[-webkit-app-region:no-drag]";

/** What each pinned tab is: the icon it wears, and the mode it puts the app in. */
const PINNED: Partial<
  Record<WindowTabKind, { icon: typeof IconCode; mode: WorkMode }>
> = {
  project: { icon: IconCode, mode: "code" },
  collaboration: { icon: IconUsersGroup, mode: "collaboration" },
  sessions: { icon: IconSend, mode: "code" },
};

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
            size="icon"
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
  const router = useRouter();
  // const canGoBack = useCanGoBack();
  const location = useRouterState({ select: (s) => s.location });
  const { tabs, activeId } = useWindowTabs();
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

  const go = (href: string) => void router.navigate({ href });

  // Which mode the app is framed in follows the pinned tab you pick, so the
  // surfaces both modes share — settings, the inbox — still know which one you
  // came from.
  const adoptMode = (tab: WindowTab) => {
    const mode = PINNED[tab.kind]?.mode;
    if (mode !== undefined) setUiPrefs({ workMode: mode });
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

  const openSession = () => {
    updateWindowTabs((state) =>
      openTab(state, {
        id: nextTabId(),
        href: NEW_SESSION_HREF,
        title: NEW_SESSION_TITLE,
        kind: "session",
      })
    );
    go(NEW_SESSION_HREF);
  };

  const close = (id: string) => {
    updateWindowTabs((state) => {
      const next = closeTab(state, id);
      if (next.activeId !== state.activeId) {
        const landing = next.tabs.find((tab) => tab.id === next.activeId);
        if (landing !== undefined) go(landing.href);
      }
      return next;
    });
  };

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
      updateWindowTabs((state) => selectTab(state, target.id));
      adoptMode(target);
      go(target.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <header
      className={cn(
        // The traffic lights are drawn by macOS over the bar's top-left; the
        // lead padding is what the window's own controls sit in, so it has to
        // clear them (see `trafficLightPosition` in the desktop main process).
        "flex h-11 shrink-0 items-center gap-1 pr-2 pl-24",
        "[-webkit-app-region:drag]"
      )}
    >
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
          const Icon = PINNED[tab.kind]?.icon;
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger
                render={
                  <div
                    role="tab"
                    aria-selected={active}
                    aria-label={tab.title}
                    tabIndex={active ? 0 : -1}
                    draggable={!pinned}
                    className={cn(
                      "group/tab flex h-8 max-w-52 min-w-0 shrink-0 cursor-default items-center gap-1.5 rounded-md text-[0.8125rem] transition-colors",
                      // A pinned tab is its icon and nothing else, so it wears
                      // the same square — and the same states — as the buttons
                      // at the other end of the bar.
                      pinned ? "w-8 justify-center" : "pr-1.5 pl-3",
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
                      updateWindowTabs((state) => selectTab(state, tab.id));
                      adoptMode(tab);
                      if (!active) go(tab.href);
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
                        adoptMode(tab);
                        go(tab.href);
                      }
                    }}
                  />
                }
              >
                {Icon !== undefined && <Icon className="size-5 shrink-0" />}
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
        <IconPlus className="size-5" />
      </BarButton>
      <div className="flex-1" />
      {/* Both panes are there to be read against the code — an analysis of it,
          or the page it renders — so neither has anything to sit beside once
          the window is on collaboration. */}
      {inCodeMode && (
        <>
          <BarButton
            label="Analysis"
            pressed={prefs.plansPaneOpen}
            onClick={() => setUiPrefs({ plansPaneOpen: !prefs.plansPaneOpen })}
          >
            <IconSitemap className="size-5" />
          </BarButton>
          <BarButton
            label="Browser"
            pressed={prefs.browserPaneOpen}
            onClick={() =>
              setUiPrefs({ browserPaneOpen: !prefs.browserPaneOpen })
            }
          >
            <IconWorld className="size-5" />
          </BarButton>
        </>
      )}
      <UserMenu className={NO_DRAG} />
    </header>
  );
}
