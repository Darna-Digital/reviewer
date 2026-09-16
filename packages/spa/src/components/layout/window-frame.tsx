/**
 * WindowFrame — the window's outer shell, shared by both mode shells.
 *
 * The frame is the sheet carrying the tab strip and the window controls, with
 * the app inset within it on its own canvas, so the content reads as a solid
 * page resting on top. Native window and browser tab draw the same frame; the
 * browser pane is the one part a tab cannot have, since it is an Electron
 * `<webview>`.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { restoreDock } from "@/components/layout/dock-expansion";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { WindowBar } from "@/components/layout/window-bar";
import {
  updateBrowserPane,
  useBrowserPane,
} from "@/interactions/browser-pane/adapters/browser-pane.store";
import { BrowserPane } from "@/interactions/browser-pane/components/browser-pane";
import { PlansPane } from "@/interactions/plans-pane/components/plans-pane";
import { SearchHost } from "@/interactions/search/components/search-host";
import {
  TabOverview,
  TabOverviewPush,
  TabOverviewScrim,
} from "@/interactions/tab-preview/components/tab-overview";
import { TabSnapshotMill } from "@/interactions/tab-preview/components/tab-snapshot-mill";
import { isDesktop } from "@/lib/desktop";
import { isPreviewWindow } from "@/lib/preview-window";
import { cn } from "@/lib/utils";
import { isCodeSurface, shellRoute } from "@/lib/shell-route";
import {
  setUiPrefs,
  SIDE_PANE_MIN,
  toggleBottomVisible,
  useUiPrefs,
} from "@/lib/ui-prefs";

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

  // For the same reason, code mode's search dialog (⌘K, ⇧⇧, ⌘⇧F) is mounted
  // here: one host for every code page, whichever shell is showing it.
  // Collaboration is left alone — it has a search of its own.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const prefs = useUiPrefs();
  const inCodeMode = isCodeSurface(pathname);

  // An expanded browser is the whole canvas: the page and the analysis pane
  // are hidden rather than unmounted, so the editor, the tree and any terminal
  // come back exactly as they were the moment the browser is put back.
  const browser = useBrowserPane();
  const browserFills = isDesktop && prefs.browserPaneOpen && browser.expanded;

  // Going somewhere in the app — a tab, a mode, a ⌘K jump — while the browser
  // has the whole canvas means wanting to see that page, so the browser steps
  // back to its split as the route changes. Only on a change: the expanded
  // pane must not collapse on the route it was expanded over.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    if (browserFills) updateBrowserPane({ expanded: false });
  }, [pathname, browserFills]);

  // Both side panes hang off the frame, so dragging either used to re-render
  // the entire window — and, because these two wrote straight to the prefs,
  // also serialise and store every preference in the app on each pointer frame.
  // The panes read their width from a CSS variable now, and the prefs are
  // written once, when the drag ends. See `usePanelSize`.
  const plansPane = usePanelSize("plans-w", prefs.plansPaneWidth, "width");
  const browserPane = usePanelSize(
    "browser-w",
    prefs.browserPaneWidth,
    "width"
  );

  // ⌘B expands or collapses the bottom dock. Every code page carries the dock —
  // the git shell embeds its own, the workspace shell mounts `GitBottomDock` —
  // so the shortcut belongs to the frame under both rather than to either one;
  // living in the git shell alone left it dead on sessions, services and docs.
  // Capture phase, so a field that stops its own keydown (the menu search) can't
  // swallow it either.
  //
  // On one of the dock's own pages there is no drawer to collapse and the page
  // *is* the dock, so the chord means the smaller of the two: put it back down
  // on the page it was expanded from.
  const route = shellRoute(pathname);
  const dockPageTab = route.kind === "dock" ? route.tab : null;
  useEffect(() => {
    if (!inCodeMode) return;
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
  }, [inCodeMode, dockPageTab, navigate]);

  // A preview is the page and nothing around it: the chrome belongs to the
  // window it is being previewed in, and the panes beside it are its own.
  if (isPreviewWindow) {
    return (
      <div className="app-canvas flex h-svh w-full overflow-hidden text-foreground">
        {children}
      </div>
    );
  }

  return (
    <>
      {inCodeMode && <SearchHost />}
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
              is the one part that stays on the frame itself. */}
          <TabOverviewPush>
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden",
                browserFills && "hidden"
              )}
            >
              {children}
            </div>
            {prefs.plansPaneOpen && !browserFills && (
              // The handle rides inside the pane's own group so the flex gap
              // counts once — one seam, the same width as the frame's inset.
              <div className="flex min-h-0 shrink-0">
                <ResizeHandle
                  orientation="col"
                  label="Resize analysis"
                  value={plansPane.current}
                  min={SIDE_PANE_MIN.analysis}
                  max={() =>
                    Math.max(SIDE_PANE_MIN.analysis, window.innerWidth - 480)
                  }
                  direction={-1}
                  onResize={plansPane.onResize}
                  onResizeEnd={(plansPaneWidth) =>
                    setUiPrefs({ plansPaneWidth })
                  }
                />
                <PlansPane />
              </div>
            )}
            {isDesktop && prefs.browserPaneOpen && (
              <div
                className={cn(
                  "flex min-h-0 shrink-0",
                  browserFills && "min-w-0 flex-1"
                )}
              >
                {!browserFills && (
                  <ResizeHandle
                    orientation="col"
                    label="Resize browser"
                    value={browserPane.current}
                    min={SIDE_PANE_MIN.browser}
                    max={() =>
                      Math.max(SIDE_PANE_MIN.browser, window.innerWidth - 480)
                    }
                    direction={-1}
                    onResize={browserPane.onResize}
                    onResizeEnd={(browserPaneWidth) =>
                      setUiPrefs({ browserPaneWidth })
                    }
                  />
                )}
                <BrowserPane />
              </div>
            )}
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
