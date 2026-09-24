import "@/lib/idle-callback";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

// TanStack Query's default focus manager only listens to `visibilitychange`,
// which never fires when you OS-switch between apps (the document stays
// "visible" the whole time). In the desktop wrapper that means returning to the
// window after editing files elsewhere never refetched git/diff data — you had
// to reload the whole app. Chromium *does* fire a `focus` event on the window
// when the BrowserWindow regains OS focus, so listen for that too.
if (typeof window !== "undefined") {
  // Only a focus the app actually left counts: `hasFocus()` is true for the
  // whole document tree, so a focus that never left it refetches nothing.
  let away = !document.hasFocus();

  focusManager.setEventListener((handleFocus) => {
    const onFocus = () => {
      if (!away) return;
      away = false;
      handleFocus(true);
    };
    const onBlur = () => {
      away = !document.hasFocus();
    };
    const onVisibility = () => {
      away = document.hidden;
      handleFocus();
    };
    window.addEventListener("focus", onFocus, false);
    window.addEventListener("blur", onBlur, false);
    window.addEventListener("visibilitychange", onVisibility, false);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("visibilitychange", onVisibility);
    };
  });
}

export interface RouterContext {
  queryClient: QueryClient;
}

/**
 * Scroll restoration is off for conversations, which open at their latest
 * message and never anywhere else.
 *
 * Restoration remembers a scrolled element by its position in the DOM — an
 * nth-child path — and carries the last page's entries forward onto whatever
 * still matches on the next one. Every session page has the same shape, so the
 * conversation you left handed its scroll offset to the conversation you
 * opened, dropping you into the middle of it, and the timeline's own scroll to
 * the bottom had already run by then.
 */
const sessionRoutePrefix = "/modes/agent-session/";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Nothing is re-asked for just because a component mounted again —
        // navigating is not new information. What a query is actually worth
        // holding is set where it is declared (`lib/queries.ts`); this is the
        // floor for anything that doesn't say.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: true,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient } satisfies RouterContext,
    scrollRestoration: ({ location }) =>
      !location.pathname.startsWith(sessionRoutePrefix),
    defaultPreload: "intent",
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
