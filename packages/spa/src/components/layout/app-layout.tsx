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

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prefs = useUiPrefs();
  const workspace = useWorkspace();
  const [pickerOpen, setPickerOpen] = useState(false);

  const route = shellRoute(pathname, prefs.workMode);
  const gitChrome = showsGitChrome(route);
  const current = workspace.data?.current ?? null;

  // Both rails are the same column carrying different things — code's git
  // surfaces, sessions' new-and-find — so crossing between them leaves the page
  // beside it exactly where it was. Collaboration is the one surface without
  // one: its own sidebar carries the equivalent.
  const railed = route.kind !== "collaboration";

  /** Pages that are meaningless without a repository open behind them. */
  const needsRepo =
    route.kind === "workspace" ||
    route.kind === "session" ||
    route.kind === "collaboration";

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
        {railed &&
          (route.kind === "session" ? <SessionsRail /> : <ModeRail />)}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            route={route}
            pickerOpen={pickerOpen}
            onPickerOpenChange={setPickerOpen}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
            {current !== null && gitChrome && <GitBottomDock />}
          </div>
        </div>
      </WindowFrame>
    </DiffWorkerPoolProvider>
  );
}
