/**
 * WindowFrame — the window's outer shell, shared by both mode shells.
 *
 * The frame is the sheet carrying the tab strip and the window controls, with
 * the app inset within it on its own canvas, so the content reads as a solid
 * page resting on top. Native window and browser tab draw the same frame.
 */
import { WindowBar } from "@/components/layout/window-bar";
import { SearchHost } from "@/interactions/search/components/search-host";

export function WindowFrame({ children }: { children: React.ReactNode }) {
  // The search dialog is mounted here rather than in either shell because both
  // of them mount the frame: one host for every page, whichever shell is
  // showing it.
  return (
    <>
      <SearchHost />
      <div className="app-frame flex h-svh w-full flex-col overflow-hidden text-foreground">
        <WindowBar />
        {/* Sheets on the frame rather than one canvas split by borders: every
            gap between them is the frame's own material, so each seam reads as
            the window showing through instead of a painted divider. The rail is
            the exception — it paves its own seam over and joins the sheet
            beside it, as it did when the window was one canvas. */}
        <div className="flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
