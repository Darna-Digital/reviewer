import { focusManager, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { isPreviewWindow } from "@/lib/preview-window";
import { routeTree } from "./routeTree.gen";

// TanStack Query's default focus manager only listens to `visibilitychange`,
// which never fires when you OS-switch between apps (the document stays
// "visible" the whole time). In the desktop wrapper that means returning to the
// window after editing files elsewhere never refetched git/diff data — you had
// to reload the whole app. Chromium *does* fire a `focus` event on the window
// when the BrowserWindow regains OS focus, so listen for that too.
if (typeof window !== "undefined") {
  // Only a focus the app actually left counts. A `focus` event also fires when
  // the keyboard comes back from a frame *inside* the page — a tab preview
  // rendering itself — and the app was never away, so refetching everything
  // there is a storm for nothing. `hasFocus()` is true for the whole document
  // tree including its frames, which is exactly the distinction wanted.
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

export function getRouter() {
  // A preview fetches each thing once and then holds still: it is a picture of
  // the page, and every refetch in it is work the window it hangs over is
  // already doing for real.
  const queryClient = new QueryClient({
    defaultOptions: isPreviewWindow
      ? {
          queries: {
            staleTime: Infinity,
            gcTime: 5 * 60_000,
            retry: false,
            refetchInterval: false,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: false,
          },
        }
      : {
          queries: {
            // Nothing is re-asked for just because a component mounted again —
            // navigating is not new information. What a query is actually
            // worth holding is set where it is declared (`lib/queries.ts`);
            // this is the floor for anything that doesn't say.
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
    scrollRestoration: true,
    // A preview window is never navigated: it renders the one page it was
    // opened for, so there is nothing for an intent to preload.
    defaultPreload: isPreviewWindow ? false : "intent",
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
