/**
 * The layout — one of them, for every page in the app.
 *
 * There were two: `AppShell` for the code surfaces and `WorkspaceShell` for the
 * sessions, docs, tasks and collaboration pages, each a pathless layout route
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
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { GitBottomDock } from "@/components/layout/git-bottom-dock";
import { ModeRail } from "@/components/layout/mode-rail";
import { SessionsRail } from "@/components/layout/sessions-rail";
import { WindowFrame } from "@/components/layout/window-frame";
import { DiffWorkerPoolProvider } from "@/components/diff-worker-pool";
import { useRegisterCommands } from "@/interactions/search/adapters/search.store";
import { useRepoCommands } from "@/interactions/workspace/adapters/workspace.hook.adapter";
import type { Command } from "@/interactions/search/interfaces/search.interfaces";
import { useWorkspace } from "@/lib/queries";
import { shellRoute, showsGitChrome } from "@/lib/shell-route";
import { useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

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
   */
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  // Selected down to the one flag rather than taken as the whole search: this
  // re-renders the shell on every change of its value, and a search object is a
  // fresh one on every navigation.
  const startingNew = useRouterState({
    select: (s) =>
      ((s.resolvedLocation ?? s.location).search as { new?: boolean }).new ===
      true,
  });
  const prefs = useUiPrefs();
  const workspace = useWorkspace();
  const [pickerOpen, setPickerOpen] = useState(false);

  const route = shellRoute(pathname, prefs.workMode, startingNew);
  const gitChrome = showsGitChrome(route);
  const current = workspace.data?.current ?? null;

  /**
   * The blank composer is the one page the shell gets out of the way of
   * entirely: no rail, no trail, nothing but the question and the box. See
   * `ShellRoute`.
   */
  const bare = route.kind === "session" && route.composing;

  // Both rails are the same column carrying different things — code's git
  // surfaces, sessions' new-and-find — so crossing between them leaves the page
  // beside it exactly where it was. Collaboration is the one surface without
  // one: its own sidebar carries the equivalent.
  const railed = route.kind !== "collaboration" && !bare;

  /** Pages that are meaningless without a repository open behind them. */
  const needsRepo =
    route.kind === "workspace" ||
    route.kind === "session" ||
    route.kind === "collaboration" ||
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

  // The picker is the shell's, so the command that raises it is too.
  const shellCommands = useMemo<ReadonlyArray<Command>>(
    () => [
      {
        id: "project-switch",
        label: "Open Project…",
        group: "Project",
        icon: IconRepeat,
        keywords: "open change repository folder picker switch",
        run: () => setPickerOpen(true),
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
        {railed && (route.kind === "session" ? <SessionsRail /> : <ModeRail />)}
        <div className="flex min-w-0 flex-1 flex-col">
          {!bare && (
            <AppHeader
              route={route}
              pickerOpen={pickerOpen}
              onPickerOpenChange={setPickerOpen}
            />
          )}
          {/* The rule under the header goes with the header: on the composer it
              would be a line drawn across the top of an empty page. */}
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden",
              !bare && "border-t"
            )}
          >
            {/* Put away rather than unmounted: the outlet is where the router
                keeps whatever the location matched, and a dock page matches a
                route that draws nothing. */}
            <div
              className={
                dockExpanded
                  ? "hidden"
                  : "flex min-h-0 flex-1 flex-col overflow-hidden"
              }
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
              ) : (
                <Outlet />
              )}
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
