/**
 * The layout an island wears instead of `AppLayout`.
 *
 * Inside the macOS shell the frame, the rail, the header and the dock are the
 * window's own — native views, or islands of their own — so this document is
 * one part of the app with nothing around it: the routed page, edge to edge,
 * on the canvas. Everything `AppLayout` mounts once for the life of the window
 * that the page underneath still depends on is mounted here for the same
 * reason — the Shiki pool, so leaving and returning to a diff does not spawn
 * the workers and refill their cache.
 *
 * The one thing it does that `AppLayout` never has to is talk to the shell:
 * go where the shell says, say where it went, and re-ask for everything when
 * the shell says something changed. See `lib/shell`.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { DiffWorkerPoolProvider } from "@/components/diff-worker-pool";
import { GitBottomDock } from "@/components/layout/git-bottom-dock";
import { type Island, shell } from "@/lib/shell";
import { shellRoute } from "@/lib/shell-route";
import type { BottomTab } from "@/lib/ui-prefs";

export function IslandLayout({ island }: { island: Island }) {
  useShellNavigation(island);

  return (
    <DiffWorkerPoolProvider>
      <div className="island-page app-page flex h-full min-h-0 flex-col overflow-hidden">
        <IslandBody island={island} />
      </div>
    </DiffWorkerPoolProvider>
  );
}

function IslandBody({ island }: { island: Island }) {
  switch (island) {
    // The tree is the code page down to its first column — see
    // `CodeWorkspace` — so it is the same routed page.
    case "code":
    case "tree":
      return <Outlet />;
    case "dock":
      return <DockIsland />;
    default:
      return <UnbuiltIsland island={island} />;
  }
}

/**
 * The dock's surfaces — branches, history, find, threads — with the window's
 * native pane around them. Which surface is the one the dock's own page URLs
 * say (`/modes/code/history` and the rest, see `shell-route`), so the shell
 * chooses one by navigating here, exactly as it steers the code island; the
 * page for that route draws nothing, and the dock draws in its place.
 */
function DockIsland() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const route = shellRoute(pathname, false, false);
  // The dock reaches for the page — a commit picked out of History — and in
  // the browser that is the one window moving. Here the shell hears where it
  // went and sends the page island there, then puts this one back; the surface
  // stays up meanwhile rather than unmounting for the round trip.
  const lastTab = useRef<BottomTab>("history");
  if (route.kind === "dock") lastTab.current = route.tab;
  return <GitBottomDock expandedTab={lastTab.current} chromeless />;
}

function useShellNavigation(island: Island): void {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      shell.subscribe((event) => {
        switch (event.type) {
          case "navigate":
            void router.navigate({ href: event.href });
            return;
          case "refresh":
            void queryClient.invalidateQueries();
            return;
        }
      }),
    [router, queryClient]
  );

  // Announced once the subscription above is in place, so the shell's reply —
  // the page it wants shown — has somewhere to land.
  useEffect(() => {
    void shell.post({ type: "ready", island });
  }, [island]);

  const href = useRouterState({ select: (s) => s.location.href });
  useEffect(() => {
    void shell.post({ type: "navigated", href });
  }, [href]);
}

function UnbuiltIsland({ island }: { island: Island }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      The {island} island is not built yet.
    </div>
  );
}
