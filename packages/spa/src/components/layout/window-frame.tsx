/**
 * WindowFrame — the window's outer shell, shared by both mode shells.
 *
 * In the native shell the frame is a translucent sheet carrying the tab strip
 * and the window controls, with the app inset within it on its own canvas — so
 * the window picks up the desktop behind it and the content still reads as a
 * solid page resting on top. A browser tab already has all of that chrome, so
 * there the canvas simply fills the viewport.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { WindowBar } from "@/components/layout/window-bar";
import { isDesktop } from "@/lib/desktop";

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

  if (!isDesktop) {
    return (
      <div className="app-canvas flex h-svh w-full overflow-hidden text-foreground">
        {children}
      </div>
    );
  }

  return (
    <div className="app-frame flex h-svh w-full flex-col overflow-hidden text-foreground">
      <WindowBar />
      <div className="app-canvas mx-1.5 mb-1.5 flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-frame-border">
        {children}
      </div>
    </div>
  );
}
