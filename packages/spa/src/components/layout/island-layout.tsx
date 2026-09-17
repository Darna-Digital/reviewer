/**
 * The layout an island wears instead of `AppLayout`.
 *
 * Inside the macOS shell the frame, the rail, the sidebar and the bottom pane
 * are the window's own — native views, or islands of their own — so this
 * document is one part of the app with little around it: the open-file band
 * along its top edge, and under it the routed page, edge to edge, on the
 * canvas. Everything `AppLayout` mounts once for the life of the window that
 * the page underneath still depends on is mounted here for the same reason —
 * the Shiki pool, so leaving and returning to a diff does not spawn the
 * workers and refill their cache.
 *
 * The window tabs are the island's to keep, for the same reason the window
 * bar's are the app's in Electron: switching one is a route change in a
 * document that has already primed the page. They are the toolbar's to draw
 * (see `IslandBar`), and the launchpad that lays them out is the shell's own,
 * over the window, wearing the pictures it takes of the page — so neither is
 * drawn in here.
 *
 * The code island keeps the git dock too, under the page as `AppLayout` has
 * it: branches, history and find-usages are the page's to draw, while the
 * terminal and the run surfaces are the shell's, drawn natively in its own
 * pane — see `BottomPanel`.
 *
 * The one thing it does that `AppLayout` never has to is talk to the shell:
 * go where the shell says, say where it went, and re-ask for everything when
 * the shell says something changed. See `lib/shell`.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { DiffWorkerPoolProvider } from "@/components/diff-worker-pool";
import { GitBottomDock } from "@/components/layout/git-bottom-dock";
import { IslandBar } from "@/components/layout/island-bar";
import { useWorkspace } from "@/lib/queries";
import { type Island, shell } from "@/lib/shell";
import { shellRoute, showsGitChrome } from "@/lib/shell-route";
import { cn } from "@/lib/utils";

export function IslandLayout({ island }: { island: Island }) {
  useShellNavigation(island);

  return (
    <DiffWorkerPoolProvider>
      <div className="island-page flex h-full min-h-0 flex-col overflow-hidden">
        <IslandBody island={island} />
      </div>
    </DiffWorkerPoolProvider>
  );
}

function IslandBody({ island }: { island: Island }) {
  switch (island) {
    case "code":
      return <CodeIsland />;
  }
}

/** The bar, and under it the page, in the box the island has for them. */
function CodeIsland() {
  return (
    <>
      <IslandBar />
      <CodePage />
    </>
  );
}

/**
 * The page with the git dock under it, the shape `AppLayout` gives the git
 * surfaces: a drawer on the code pages, and on one of the dock's own pages
 * the whole canvas, with the outlet put away behind it rather than unmounted.
 */
function CodePage() {
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  const workspace = useWorkspace();
  const current = workspace.data?.current ?? null;
  const route = shellRoute(pathname, false, false);
  const expandedTab =
    route.kind === "dock" && current !== null ? route.tab : undefined;
  const dockShown = current !== null && showsGitChrome(route);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
      <div
        className={cn(
          "app-page flex min-h-0 flex-col overflow-hidden",
          expandedTab !== undefined ? "hidden" : "flex-1"
        )}
      >
        <Outlet />
      </div>
      {dockShown && <GitBottomDock expandedTab={expandedTab} />}
    </div>
  );
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
          default:
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
