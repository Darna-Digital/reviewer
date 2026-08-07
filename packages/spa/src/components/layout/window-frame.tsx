/**
 * WindowFrame — the window's outer shell, shared by both mode shells.
 *
 * In the native shell the frame is a translucent sheet carrying the tab strip
 * and the window controls, with the app inset within it on its own canvas — so
 * the window picks up the desktop behind it and the content still reads as a
 * solid page resting on top. A browser tab already has all of that chrome, so
 * there the canvas simply fills the viewport.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { WindowBar } from "@/components/layout/window-bar";
import { BrowserPane } from "@/interactions/browser-pane/components/browser-pane";
import { PlansPane } from "@/interactions/plans-pane/components/plans-pane";
import { SearchHost } from "@/interactions/search/components/search-host";
import { isDesktop } from "@/lib/desktop";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
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

  return (
    <>
      {inCodeMode && <SearchHost />}
      {isDesktop ? (
        <div className="app-frame flex h-svh w-full flex-col overflow-hidden text-foreground">
          <WindowBar />
          {/* Two sheets on the frame rather than one split in half: the gap
              between them is the frame's own material, so the seam reads as the
              window showing through instead of a painted divider. */}
          <div className="mx-1.5 mb-1.5 flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden">
            <div className="app-canvas flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-frame-border">
              {children}
            </div>
            {prefs.plansPaneOpen && (
              <>
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
              </>
            )}
            {prefs.browserPaneOpen && (
              <>
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
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="app-canvas flex h-svh w-full overflow-hidden text-foreground">
          {children}
        </div>
      )}
    </>
  );
}
