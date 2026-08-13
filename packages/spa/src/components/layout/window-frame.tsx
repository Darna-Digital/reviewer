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
import { useEffect } from "react";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { WindowBar } from "@/components/layout/window-bar";
import { BrowserPane } from "@/interactions/browser-pane/components/browser-pane";
import { PlansPane } from "@/interactions/plans-pane/components/plans-pane";
import { SearchHost } from "@/interactions/search/components/search-host";
import {
  TabOverview,
  TabOverviewPush,
  TabOverviewScrim,
} from "@/interactions/tab-preview/components/tab-overview";
import { isDesktop } from "@/lib/desktop";
import { isPreviewWindow } from "@/lib/preview-window";
import { setUiPrefs, toggleBottomVisible, useUiPrefs } from "@/lib/ui-prefs";
import { activeWorkMode } from "@/lib/work-mode";

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
  const inCodeMode = activeWorkMode(pathname, prefs.workMode) === "code";

  // ⌘B expands or collapses the bottom dock. Every code page carries the dock —
  // the git shell embeds its own, the workspace shell mounts `GitBottomDock` —
  // so the shortcut belongs to the frame under both rather than to either one;
  // living in the git shell alone left it dead on sessions, services and docs.
  // Capture phase, so a field that stops its own keydown (the menu search) can't
  // swallow it either.
  useEffect(() => {
    if (!inCodeMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      toggleBottomVisible();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [inCodeMode]);

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
          {/* Two sheets on the frame rather than one split in half: the gap
              between them is the frame's own material, so the seam reads as the
              window showing through instead of a painted divider. */}
          <TabOverviewPush>
            <div className="app-canvas flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-frame-border">
              {children}
            </div>
            {prefs.plansPaneOpen && (
              // The handle rides inside the pane's own group so the flex gap
              // counts once — one seam, the same width as the frame's inset.
              <div className="flex min-h-0 shrink-0">
                <ResizeHandle
                  orientation="col"
                  label="Resize analysis"
                  value={prefs.plansPaneWidth}
                  min={380}
                  max={() => Math.max(380, window.innerWidth - 480)}
                  direction={-1}
                  onResize={(plansPaneWidth) => setUiPrefs({ plansPaneWidth })}
                />
                <PlansPane />
              </div>
            )}
            {isDesktop && prefs.browserPaneOpen && (
              <div className="flex min-h-0 shrink-0">
                <ResizeHandle
                  orientation="col"
                  label="Resize browser"
                  value={prefs.browserPaneWidth}
                  min={320}
                  max={() => Math.max(320, window.innerWidth - 480)}
                  direction={-1}
                  onResize={(browserPaneWidth) =>
                    setUiPrefs({ browserPaneWidth })
                  }
                />
                <BrowserPane />
              </div>
            )}
            <TabOverviewScrim />
          </TabOverviewPush>
        </div>
      </div>
    </>
  );
}
