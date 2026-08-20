/**
 * What every collaboration page is drawn inside.
 *
 * The mode has no rail and no sidebar — a project's own page is the index of
 * itself, which is Basecamp's whole argument and the reason the column is
 * centred rather than pushed aside by a tree. What is left around the page is
 * the ground it stands on, the hovering bar, and the drawer that bar raises.
 *
 * The shell is mounted once by the layout route and stays put while the pages
 * under it change, so the bar does not blink between a project and its board,
 * and the drawer survives a navigation made from inside it.
 */
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  collabWidth,
  COLLAB_SHORTCUTS,
} from "../functions/collab-layout.functions";
import { pressCollabShortcut } from "../adapters/collab-drawer.store";
import { CollabBar } from "./collab-bar";
import { CollabDrawer } from "./collab-drawer";
import { CollabColumn } from "./collab-column";

/**
 * How tall the drawer stands. A custom property rather than a class, because
 * the bar has to be lifted by exactly the same amount and the two would
 * otherwise drift apart the first time one of them was adjusted.
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
      style={{ "--collab-drawer": DRAWER_HEIGHT } as React.CSSProperties}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ScrollArea className="min-h-0 flex-1">
        <CollabColumn width={width}>
          <Outlet />
        </CollabColumn>
      </ScrollArea>
      <CollabDrawer />
      <CollabBar />
    </div>
  );
}
