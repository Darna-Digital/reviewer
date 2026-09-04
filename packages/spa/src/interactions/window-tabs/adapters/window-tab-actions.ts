/**
 * What acting on a window tab does, bound to the router.
 *
 * The strip is not the only place tabs are picked from — the overview grid does
 * the same three things — and each of them is a transition plus the navigation
 * that has to follow it, so they live here rather than in whichever surface
 * happened to need them first.
 */
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  NEW_SESSION,
  setChatMode,
} from "@/interactions/chats/adapters/chat-mode.store";
import {
  closeTab,
  NEW_SESSION_HREF,
  NEW_SESSION_TITLE,
  openTab,
  selectTab,
} from "../functions/window-tabs.functions";
import type { WindowTab } from "../interfaces/window-tabs.interfaces";
import { nextTabId, updateWindowTabs } from "./window-tabs.store";

type RouterHandle = ReturnType<typeof useRouter>;

export interface WindowTabActions {
  /**
   * Take the window to `tab`. Settles once the page is actually there, so a
   * surface that is covering the window while it navigates knows when it is
   * safe to get out of the way.
   */
  readonly select: (tab: WindowTab) => Promise<void>;
  /**
   * Take the window to a place in the app rather than to a tab. The launchpad
   * picks sections, and which tab ends up holding one is the strip's own
   * business — see `trackLocation`.
   */
  readonly visit: (href: string) => Promise<void>;
  readonly close: (id: string) => void;
  /** Mint a session tab and go to its composer. */
  readonly openSession: () => Promise<void>;
  /**
   * Get a location's route ready without going there — its code loaded, its
   * data asked for.
   *
   * Everything in the strip is a page the window is one click from showing, so
   * none of it should still be being fetched when the click arrives. Until it
   * is, a click leaves the page you are leaving on screen for as long as the
   * route takes to load, which reads as the old tab flashing past the new one.
   */
  readonly prime: (href: string) => void;
}

/**
 * The actions are built once per router rather than per render: they close over
 * nothing a render can change — the strip is read from its store at the moment
 * each one runs — and a caller warming its tabs in an effect should not have to
 * do it again every time something else on the bar re-renders.
 */
export function useWindowTabActions(): WindowTabActions {
  const router = useRouter();
  return useMemo(() => makeWindowTabActions(router), [router]);
}

function makeWindowTabActions(router: RouterHandle): WindowTabActions {
  /**
   * Go to `href`, settling when the window is actually showing it.
   *
   * `navigate` resolves once the router has committed the location, which is
   * before the matched route's code and data are in hand — and so before the
   * page exists. `onResolved` is the router saying the navigation is finished,
   * which is what a caller covering the window is waiting to hear.
   */
  const go = (href: string): Promise<void> => {
    const shown = new Promise<void>((resolve) => {
      const stop = router.subscribe("onResolved", () => {
        stop();
        resolve();
      });
    });
    return router.navigate({ href }).then(() => shown);
  };

  return {
    prime: (href) => {
      const [to, query] = href.split("?");
      if (to === undefined) return;
      void router
        .preloadRoute({
          to,
          search: Object.fromEntries(new URLSearchParams(query ?? "")),
        })
        // A route that declines to preload is one the click will load itself.
        .catch(() => {});
    },
    select: (tab) => {
      // Against the location rather than against which tab is active: Sessions
      // holds the window while you read a conversation without giving up its
      // own href, so picking it there is a click that has somewhere to go.
      const held = router.state.location.href === tab.href;
      updateWindowTabs((state) => selectTab(state, tab.id));
      return held ? Promise.resolve() : go(tab.href);
    },
    visit: (href) => go(href),
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
      return go(NEW_SESSION_HREF);
    },
  };
}
