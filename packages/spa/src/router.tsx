import "@/lib/idle-callback";
import { focusManager, hashKey, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import {
  readScopedRepoFrom,
  repoFromSearch,
  scopedRepo,
} from "@/lib/repo-scope";
import { routeTree } from "./routeTree.gen";

// TanStack Query's default focus manager only listens to `visibilitychange`,
// which never fires when you OS-switch between apps (the document stays
// "visible" the whole time). In the desktop wrapper that means returning to the
// window after editing files elsewhere never refetched git/diff data — you had
// to reload the whole app. The web view *does* fire `focus` and `blur` on the
// window as its window gains and loses OS focus, so listen for those too.
//
// Leaving is reported as well as coming back. The focus manager only tells its
// listeners when the state it holds changes, so a focus reported while it
// still held the last one was dropped: the first return to the window
// refetched, and none after it did.
if (typeof window !== "undefined") {
  // Only a focus the app actually left counts: `hasFocus()` is true for the
  // whole document tree, so a focus that never left it refetches nothing.
  let away = !document.hasFocus();

  focusManager.setEventListener((handleFocus) => {
    const leave = () => {
      away = true;
      handleFocus(false);
    };
    const comeBack = () => {
      if (!away) return;
      away = false;
      handleFocus(true);
    };
    const onFocus = comeBack;
    const onBlur = () => {
      if (!document.hasFocus()) leave();
    };
    const onVisibility = () => {
      if (document.hidden) leave();
      else comeBack();
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
        // Each repository of the workspace answers on its own: the root the
        // page is about is part of every query's identity (see
        // `lib/repo-scope`), so switching repositories never shows one's
        // answer for another's.
        queryKeyHashFn: (queryKey) =>
          hashKey([scopedRepo() ?? null, ...queryKey]),
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

  // The page on screen is the one whose queries are being built and whose
  // requests are leaving: read the repository off its matches rather than off
  // a location still loading, so a page on its way out never asks the next
  // page's repository for its own files. Before the first match, the location.
  readScopedRepoFrom(() =>
    repoFromSearch(
      router.state.matches.at(-1)?.search ?? router.state.location.search
    )
  );

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
