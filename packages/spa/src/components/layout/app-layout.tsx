/**
 * The layout — one of them, for every page in the app.
 *
 * There were two: `AppShell` for the code surfaces and `WorkspaceShell` for the
 * sessions and workspace pages, each a pathless layout route
 * with its own `WindowFrame`, mode rail, header and bottom dock. They were
 * siblings in the route tree, so moving between a diff and an agent session
 * unmounted one of them whole and built the other: the frame, the rail, the
 * browser and analysis panes, the tab overview, the search host, and the dock
 * with whatever history you had scrolled and whichever terminals you had open.
 * All of it, on every trip, to swap the page in the middle.
 *
 * So the frame, the rail, the header and the dock live here, above the router's
 * outlet, and stay mounted for the life of the window. What a page is — a diff,
 * a conversation, a board — it decides for itself; the shell only asks the path
 * which shape it should be (see `shellRoute`).
 */
import { Outlet, useRouterState } from "@tanstack/react-router";
import { IconRepeat } from "@tabler/icons-react";
import { useMemo } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { GitBottomDock } from "@/components/layout/git-bottom-dock";
import { ModeRail } from "@/components/layout/mode-rail";
import { setSeamSlot } from "@/components/layout/seam-slot";
import { SessionsRail } from "@/components/layout/sessions-rail";
import { WindowFrame } from "@/components/layout/window-frame";
import { DiffWorkerPoolProvider } from "@/components/diff-worker-pool";
import { useRegisterCommands } from "@/interactions/search/adapters/search.store";
import { useOnSessionTab } from "@/interactions/window-tabs/adapters/window-tabs.store";
import { openProjectPicker } from "@/interactions/workspace/adapters/project-picker.store";
import { useRepoCommands } from "@/interactions/workspace/adapters/workspace.hook.adapter";
import type { Command } from "@/interactions/search/interfaces/search.interfaces";
import { useWorkspace } from "@/lib/queries";
import { shellRoute, showsGitChrome } from "@/lib/shell-route";
import { cn } from "@/lib/utils";

const SESSIONS_PREFIX = "/modes/agent-session";

export function AppLayout() {
  /**
   * The page that is *on screen*, not the one being navigated to.
   *
   * `location` changes the moment a navigation starts, while the outlet below
   * goes on rendering the old page until the new one's code and data are in
   * hand. Shaping the shell from `location` therefore stripped the chrome off
   * the page you were still reading — the rail and the trail leaving ahead of
   * the conversation they belonged to, which read as the app coming apart for a
   * moment. `resolvedLocation` is the one the outlet is actually showing, so
   * the frame and the page change together or not at all.
   *
   * Sessions is the exception. Its pinned tab is a surface switch, and leaving a
   * large diff visible after that click reads as the old page flashing under
   * the new tab. While that route resolves, draw the Sessions shell and withhold
   * the old outlet instead.
   */
  const resolvedPathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  const targetPathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const pendingIntoSessions =
    targetPathname.startsWith(SESSIONS_PREFIX) &&
    !resolvedPathname.startsWith(SESSIONS_PREFIX);
  const pathname = pendingIntoSessions ? targetPathname : resolvedPathname;
  // Selected down to the one flag rather than taken as the whole search: this
  // re-renders the shell on every change of its value, and a search object is a
  // fresh one on every navigation.
  const resolvedStartingNew = useRouterState({
    select: (s) =>
      ((s.resolvedLocation ?? s.location).search as { new?: boolean }).new ===
      true,
  });
  const targetStartingNew = useRouterState({
    select: (s) => (s.location.search as { new?: boolean }).new === true,
  });
  const startingNew = pendingIntoSessions
    ? targetStartingNew
    : resolvedStartingNew;
  const workspace = useWorkspace();
  // Which tab is holding the window, where that changes the shape of the page:
  // a conversation lifted into a tab of its own is the whole page rather than
  // the pane beside the list. See `ShellRoute`.
  const soloSession = useOnSessionTab();

  const route = shellRoute(pathname, startingNew, soloSession);
  const gitChrome = showsGitChrome(route);
  const current = workspace.data?.current ?? null;

  /**
   * The blank composer is the one page the shell gets out of the way of
   * entirely: no rail, no trail, nothing but the question and the box. See
   * `ShellRoute`.
   */
  const bare = route.kind === "session" && route.composing;

  /**
   * Pages that wear no header — the composer, because the shell is getting out
   * of its way entirely, and the rest of the sessions surface, which carries
   * the only thing the band held for it, the trail, inside the pane the trail
   * names. That leaves the list running to the top of the window and the seam
   * beside it unbroken. See `ChatsPage`.
   */
  const headerless = route.kind === "session";

  // Both rails are the same column carrying different things — code's git
  // surfaces, sessions' new-and-find — so crossing between them leaves the page
  // beside it exactly where it was. The prototype is the one surface without
  // one: its own sidebar carries the equivalent.
  //
  // So is a conversation with the window to itself. Every button in the
  // sessions rail acts on the list, and on a session tab there is no list — the
  // column would be three controls for a surface that is not on screen, drawn
  // down the side of a page that has nothing else in the margin. The strip
  // above it mints a session and the trail leads back to the list, which is
  // what was worth having here.
  const railed =
    route.kind !== "experimentation" &&
    !bare &&
    !(route.kind === "session" && route.solo);

  /** Pages that are meaningless without a repository open behind them. */
  const needsRepo =
    route.kind === "workspace" ||
    route.kind === "session" ||
    route.kind === "experimentation" ||
    route.kind === "dock";

  /**
   * One of the dock's surfaces, with the window to itself. The dock is already
   * mounted above the outlet for every git page, so this is a shape rather than
   * a page swap: it takes the canvas, and the outlet is put away behind it.
   *
   * Not while there is no repository to read — that case has something to say,
   * and it is said in the middle of the window rather than by a dock with
   * nothing in it.
   */
  const expandedTab =
    route.kind === "dock" && current !== null ? route.tab : undefined;
  const dockExpanded = expandedTab !== undefined;

  // The picker rides the header, but the command that raises it belongs with
  // the rest of the shell's.
  const shellCommands = useMemo<ReadonlyArray<Command>>(
    () => [
      {
        id: "project-switch",
        label: "Open Project…",
        group: "Project",
        icon: IconRepeat,
        keywords: "open change repository folder picker switch",
        run: openProjectPicker,
      },
    ],
    []
  );
  useRegisterCommands("app-shell", shellCommands);
  useRepoCommands(workspace.data);

  return (
    /**
     * One Shiki worker pool for every diff/file surface under here — and, now
     * that the shell outlives the page, one for the life of the window.
     *
     * This is load-bearing rather than tidy. The provider terminates the pool
     * singleton when its last instance unmounts, so while it lived inside the
     * code shell, stepping out to a session tore down the workers and threw
     * away every grammar they had loaded and the whole highlighted-AST cache —
     * to be spawned, reloaded and refilled on the way back. Mounted here it is
     * created once and kept.
     */
    <DiffWorkerPoolProvider>
      <WindowFrame>
        {/* The rail and what stands against it are one box with no gap between
            them: the rail is not a sheet of its own but the left edge of the one
            beside it, carrying the same paper as the header and the page and
            drawing nothing where they meet — see `app-rail`. Every other seam in
            here is the frame showing through; this one is not a seam at all.

            The header stands *on* the page rather than clear of it — the branch
            picker and the trail name what is underneath them, and a run of
            desktop between the two put them on different surfaces. So there is
            no seam there; the seams are the one under the page, and the ones
            the page draws between its own columns. */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          {railed &&
            (route.kind === "session" ? <SessionsRail /> : <ModeRail />)}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
            {/* The header and the page it stands on are one box, because the
              seams the page draws between its columns carry on up through the
              header and have to be dragged there too. A handle for one of them
              hangs in the overlay at the end of this box, which is the one
              thing spanning both — see `seam-slot`. */}
            <div
              className={cn(
                "relative flex min-h-0 flex-col",
                // Every sheet with a corner on the rail is in here — the page,
                // and the columns a split page lays out — so this is the box
                // that carries the rail's paper behind them. See
                // `app-rail-paper`.
                railed && "app-rail-paper",
                // Expanded, the dock is the canvas and the page is put away, so
                // what is left here is the header: as tall as it is, and no more.
                dockExpanded ? "shrink-0" : "flex-1"
              )}
            >
              {!headerless && <AppHeader route={route} />}
              {/* Put away rather than unmounted: the outlet is where the router
                keeps whatever the location matched, and a dock page matches a
                route that draws nothing. */}
              <div
                className={cn(
                  "app-page flex min-h-0 flex-1 flex-col overflow-hidden",
                  !headerless && "app-page-joined",
                  dockExpanded && "hidden"
                )}
              >
                {/* The pages that sit *over* a repository say so when there
                  isn't one. The code surfaces answer for themselves — a
                  project can be open while holding no git root, and they
                  explain that case in the centre rather than here. */}
                {current === null && needsRepo ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
                    <div className="font-medium">No repository selected</div>
                    <div className="text-muted-foreground">
                      Open one from the repo picker above to use this workspace.
                    </div>
                  </div>
                ) : pendingIntoSessions ? (
                  <div className="flex min-h-0 flex-1 flex-col" />
                ) : (
                  <Outlet />
                )}
              </div>
              {/* Lent to the page, which hangs its column seams here. Transparent
                to the pointer but for the handles themselves, so the header and
                the page underneath are reached through it as usual. */}
              <div
                ref={setSeamSlot}
                className="pointer-events-none absolute inset-0 z-20"
              />
            </div>
            {/* The dock is git's, so it follows the git surfaces — but it is
              the same dock throughout, which is what lets a terminal opened
              on the services tab still be running when you come back to it
              from a diff. */}
            {current !== null && gitChrome && (
              <GitBottomDock expandedTab={expandedTab} />
            )}
          </div>
        </div>
      </WindowFrame>
    </DiffWorkerPoolProvider>
  );
}
