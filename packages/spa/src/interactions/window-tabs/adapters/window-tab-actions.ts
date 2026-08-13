/**
 * What acting on a window tab does, bound to the router and the mode.
 *
 * The strip is not the only place tabs are picked from — the overview grid does
 * the same three things — and each of them is a transition plus the navigation
 * that has to follow it, so they live here rather than in whichever surface
 * happened to need them first.
 */
import { useRouter } from "@tanstack/react-router";
import {
  NEW_SESSION,
  setChatMode,
} from "@/interactions/chats/adapters/chat-mode.store";
import { setUiPrefs } from "@/lib/ui-prefs";
import {
  closeTab,
  NEW_SESSION_HREF,
  NEW_SESSION_TITLE,
  openTab,
  selectTab,
  workModeOf,
} from "../functions/window-tabs.functions";
import type { WindowTab } from "../interfaces/window-tabs.interfaces";
import {
  nextTabId,
  updateWindowTabs,
  windowTabsSnapshot,
} from "./window-tabs.store";

export interface WindowTabActions {
  /** Take the window to `tab`, framing the app in the mode it belongs to. */
  readonly select: (tab: WindowTab) => void;
  readonly close: (id: string) => void;
  /** Mint a session tab and go to its composer. */
  readonly openSession: () => void;
}

export function useWindowTabActions(): WindowTabActions {
  const router = useRouter();
  const go = (href: string) => void router.navigate({ href });

  return {
    select: (tab) => {
      // Which mode the app is framed in follows the pinned tab you pick, so the
      // surfaces both modes share — settings, the inbox — still know which one
      // you came from.
      const mode = workModeOf(tab.kind);
      if (mode !== null) setUiPrefs({ workMode: mode });
      const held = windowTabsSnapshot().activeId === tab.id;
      updateWindowTabs((state) => selectTab(state, tab.id));
      if (!held) go(tab.href);
    },
    close: (id) => {
      updateWindowTabs((state) => {
        const next = closeTab(state, id);
        if (next.activeId !== state.activeId) {
          const landing = next.tabs.find((tab) => tab.id === next.activeId);
          if (landing !== undefined) go(landing.href);
        }
        return next;
      });
    },
    openSession: () => {
      // A session minted here is for building, whatever the last one opened
      // from the analysis pane was for.
      setChatMode(NEW_SESSION, "build");
      updateWindowTabs((state) =>
        openTab(state, {
          id: nextTabId(),
          href: NEW_SESSION_HREF,
          title: NEW_SESSION_TITLE,
          kind: "session",
        })
      );
      go(NEW_SESSION_HREF);
    },
  };
}
