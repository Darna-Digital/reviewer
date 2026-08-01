/**
 * WindowFrame — the window's outer shell, shared by both mode shells.
 *
 * In the native shell the frame is a translucent sheet carrying the tab strip
 * and the window controls, with the app inset within it on its own canvas — so
 * the window picks up the desktop behind it and the content still reads as a
 * solid page resting on top. A browser tab already has all of that chrome, so
 * there the canvas simply fills the viewport.
 */
import { WindowBar } from "@/components/layout/window-bar"
import { isDesktop } from "@/lib/desktop"

export function WindowFrame({ children }: { children: React.ReactNode }) {
  if (!isDesktop) {
    return (
      <div className="app-canvas flex h-svh w-full overflow-hidden text-foreground">
        {children}
      </div>
    )
  }

  return (
    <div className="app-frame flex h-svh w-full flex-col overflow-hidden text-foreground">
      <WindowBar />
      <div className="app-canvas mx-1.5 mb-1.5 flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-frame-border">
        {children}
      </div>
    </div>
  )
}
