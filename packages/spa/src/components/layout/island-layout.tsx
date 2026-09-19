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
 * bar's are the app's in a browser tab: switching one is a route change in a
 * document that has already primed the page. They are the toolbar's to draw
 * (see `IslandBar`) — so they are not drawn in here.
 *
 * The code island keeps one of the dock's surfaces too, under the page as
 * `AppLayout` has it: find usages, opened from a symbol in the page's own
 * code. Branches, history, the terminal and the run surfaces are the shell's,
 * drawn natively in its own pane — see `BottomPanel`. The shell is told when
 * the drawer is up, so its pane can leave the foot of the window to it, and
 * puts the drawer away when the pane takes the foot back — see
 * `useShellDock`.
 *
 * The one thing it does that `AppLayout` never has to is talk to the shell:
 * go where the shell says, say where it went, and re-ask for everything when
 * the shell says something changed. See `lib/shell`.
 */
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { DiffWorkerPoolProvider } from "@/components/diff-worker-pool";
import { closeDock } from "@/components/layout/dock-expansion";
import { GitBottomDock } from "@/components/layout/git-bottom-dock";
import { nativeInShell } from "@/components/layout/bottom-panel";
import { IslandBar } from "@/components/layout/island-bar";
import { useWorkspace } from "@/lib/queries";
import { type Island, shell } from "@/lib/shell";
import { shellRoute, showsGitChrome } from "@/lib/shell-route";
import { type BottomTab, useUiPrefs } from "@/lib/ui-prefs";
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
 * The page with the find-usages drawer under it, the shape `AppLayout` gives
 * the git surfaces: a drawer on the code pages, and on one of the dock's own
 * pages the whole canvas, with the outlet put away behind it rather than
 * unmounted. Only the drawer's own surface counts as up: a preference left on
 * one the shell draws itself — its History, its Terminal — opens nothing here.
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
  const prefs = useUiPrefs();
  const drawerTab =
    dockShown && prefs.bottomVisible && !nativeInShell(prefs.bottomTab)
      ? prefs.bottomTab
      : null;
  useShellDock(expandedTab ?? drawerTab, expandedTab ?? null);

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

/**
 * The dock, as the shell sees it: `shown` is the surface that is up — in the
 * drawer, or with the window to it — reported whenever it changes, and the
 * shell's own pane taking the foot of the window comes back as a `dock` event
 * that puts the drawer away.
 */
function useShellDock(
  shown: BottomTab | null,
  expandedTab: BottomTab | null
): void {
  const navigate = useNavigate();

  useEffect(() => {
    void shell.post({ type: "dock", shown });
  }, [shown]);

  useEffect(
    () =>
      shell.subscribe((event) => {
        if (event.type !== "dock") return;
        switch (event.action.kind) {
          case "close":
            closeDock(navigate, expandedTab);
            return;
        }
      }),
    [navigate, expandedTab]
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
