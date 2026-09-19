/**
 * WindowFrame — the window's outer shell, shared by both mode shells.
 *
 * The frame is the sheet carrying the tab strip and the window controls, with
 * the app inset within it on its own canvas, so the content reads as a solid
 * page resting on top. Native window and browser tab draw the same frame.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { restoreDock } from "@/components/layout/dock-expansion";
import { WindowBar } from "@/components/layout/window-bar";
import { SearchHost } from "@/interactions/search/components/search-host";
import {
  TabOverview,
  TabOverviewPush,
  TabOverviewScrim,
} from "@/interactions/tab-preview/components/tab-overview";
import { TabSnapshotMill } from "@/interactions/tab-preview/components/tab-snapshot-mill";
import { isPreviewWindow } from "@/lib/preview-window";
import { shellRoute } from "@/lib/shell-route";
import { toggleBottomVisible } from "@/lib/ui-prefs";

export function WindowFrame({ children }: { children: React.ReactNode }) {
  // ⌘, opens Settings, as in every Mac app. It lives here rather than in either
  // shell because both of them mount the frame, so this is the one spot that
  // covers every page.
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key !== ",") return;
      event.preventDefault();
      void navigate({ to: "/settings" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // For the same reason, the search dialog (⌘K, ⇧⇧, ⌘⇧F) is mounted here: one
  // host for every page, whichever shell is showing it.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // ⌘B expands or collapses the bottom dock. Every code page carries the dock —
  // the git shell embeds its own, the workspace shell mounts `GitBottomDock` —
  // so the shortcut belongs to the frame under both rather than to either one;
  // living in the git shell alone left it dead on sessions and services.
  // Capture phase, so a field that stops its own keydown (the menu search) can't
  // swallow it either.
  //
  // On one of the dock's own pages there is no drawer to collapse and the page
  // *is* the dock, so the chord means the smaller of the two: put it back down
  // on the page it was expanded from.
  const route = shellRoute(pathname);
  const dockPageTab = route.kind === "dock" ? route.tab : null;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      if (dockPageTab === null) toggleBottomVisible();
      else restoreDock(navigate, dockPageTab);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dockPageTab, navigate]);

  // A preview is the page and nothing around it: the chrome belongs to the
  // window it is being previewed in.
  if (isPreviewWindow) {
    return (
      <div className="app-canvas flex h-svh w-full overflow-hidden text-foreground">
        {children}
      </div>
    );
  }

  return (
    <>
      <SearchHost />
      <div className="app-frame flex h-svh w-full flex-col overflow-hidden text-foreground">
        <WindowBar />
        {/* Everything under the bar shares one box: the launchpad slides down
            into the top of it and the page is pushed out of the bottom, so the
            window clips both without either being given a size. */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <TabOverview />
          {/* Sheets on the frame rather than one canvas split by borders: every
              gap between them is the frame's own material, so each seam reads as
              the window showing through instead of a painted divider. The rail
              is the exception — it paves its own seam over and joins the sheet
              beside it, as it did when the window was one canvas. */}
          <TabOverviewPush>
            <div className="flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden">
              {children}
            </div>
            <TabOverviewScrim />
          </TabOverviewPush>
        </div>
      </div>
      {/* Outside the frame, and running from the moment the window has settled
          rather than from the moment the launchpad is asked for: the pictures
          are taken in the gaps, so opening the panel is not the wait. */}
      <TabSnapshotMill />
    </>
  );
}
