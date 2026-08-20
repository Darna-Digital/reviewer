/**
 * What every collaboration page is drawn inside.
 *
 * The mode has no rail and no sidebar — a project's own page is the index of
 * itself, which is Basecamp's whole argument and the reason the column is
 * centred rather than pushed aside by a tree. Nor is it drawn on a sheet: the
 * ground behind the column is the window's own material, so on the native shell
 * the desktop shows through it (see `.app-canvas.on-frame`). What is left
 * around the page is the hovering bar and the drawer that bar raises.
 *
 * The shell is mounted once by the layout route and stays put while the pages
 * under it change, so the bar does not blink between a project and its board,
 * and the drawer survives a navigation made from inside it.
 *
 * The three boxes below are the launchpad's three, at the other edge: the page
 * that is pushed, the panel that pushes it, and the bar the panel comes out of.
 * `collab-drawer` has the whole of why.
 */
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, type CSSProperties } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  COLLAB_SHORTCUTS,
  collabWidth,
} from "../functions/collab-layout.functions";
import { pressCollabShortcut } from "../adapters/collab-drawer.store";
import { CollabBar } from "./collab-bar";
import {
  CollabDrawer,
  CollabDrawerPush,
  CollabDrawerScrim,
} from "./collab-drawer";
import { CollabColumn } from "./collab-column";

/**
 * How tall the drawer stands, and so exactly how far the page is pushed.
 *
 * A custom property because three things have to agree about it — the drawer's
 * own height, the distance the page travels, and where the bar comes to rest —
 * and a value written out three times is three chances for the seam between
 * them to be somewhere else. The launchpad has the same rule and a harder
 * version of the problem: its height is dragged, so its single source is a
 * store that draws all three per frame rather than a constant.
 */
const DRAWER_HEIGHT = "17rem";

export function CollabShell() {
  // The page on screen, not the one being navigated to — the same reason
  // `AppLayout` reads `resolvedLocation`: the column should not change width
  // ahead of the page that asked for the change.
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  const width = collabWidth(pathname);

  /**
   * ⌥1–⌥3 raise the three panels, in the order the bar carries them.
   *
   * ⌥ rather than ⌘ because ⌘<digit> is the window bar's, counting along the
   * tab strip — a mode is not allowed to take a chord the window is already
   * using, whichever mode happens to be on screen.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return;
      const at = Number(event.key) - 1;
      const shortcut = COLLAB_SHORTCUTS[at];
      if (shortcut === undefined) return;
      event.preventDefault();
      pressCollabShortcut(shortcut.panel);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{ "--collab-drawer": DRAWER_HEIGHT } as CSSProperties}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CollabDrawerPush>
        <ScrollArea className="min-h-0 flex-1">
          <CollabColumn width={width}>
            <Outlet />
          </CollabColumn>
        </ScrollArea>
        {/* Inside the push, so it dims the page rather than the window: it
            travels with what it is covering. */}
        <CollabDrawerScrim />
      </CollabDrawerPush>
      <CollabDrawer />
      <CollabBar />
    </div>
  );
}
