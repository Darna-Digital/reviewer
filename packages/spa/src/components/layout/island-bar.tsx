/**
 * The top of the macOS shell's code island: the window-tab strip, run here and
 * drawn on the native toolbar, and the open-file band.
 *
 * The strip is the same `useWindowTabStrip` the window bar draws in the browser
 * and in Electron — the store, the priming, the switch — so a tab is changed in
 * the document, primed ahead of the click, exactly as it is there. What the
 * shell has of it is a picture, posted whenever it changes, which the toolbar
 * draws natively where the window bar would draw it; a tab pressed there comes
 * back as a `windowTabs` event, along with the strip's chords — ⌘T, ⌘W, ⌘1–9 —
 * which the shell's menu items claim so they answer while a native view has
 * the keyboard. Nothing of the strip is drawn here, so the island's tabs are
 * never in two places at once; the launchpad that lays them out is the shell's
 * own too, over the window.
 *
 * The band is the header's open-file slot, lent to the code page the way
 * `AppHeader` lends it — the page portals its `TabStrip` in — with the
 * diff-style toggle at its end while a diff is on screen, where the header
 * band keeps it. The band folds away while there is nothing in it: no file
 * open over a page that is not a diff.
 */
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  HeaderDiffStyleToggle,
  useShowsDiffStyleToggle,
} from "@/components/layout/diff-style-toggle";
import {
  setHeaderTabsSlot,
  useHeaderTabsFilled,
} from "@/components/layout/header-tabs";
import { useWindowTabs } from "@/interactions/window-tabs/adapters/window-tabs.store";
import { useWindowTabStrip } from "@/interactions/window-tabs/components/window-tab-strip";
import {
  isPinnedTab,
  sessionAtSlot,
  stepTab,
  tabById,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import type { WindowTab } from "@/interactions/window-tabs/interfaces/window-tabs.interfaces";
import { shell, type ShellWindowTabStrip } from "@/lib/shell";
import { shellRoute } from "@/lib/shell-route";
import { cn } from "@/lib/utils";

const picture = (
  tabs: ReadonlyArray<WindowTab>,
  activeId: string
): ShellWindowTabStrip => ({
  tabs: tabs.map((tab) => ({
    id: tab.id,
    title: tab.title,
    kind: tab.kind,
    pinned: isPinnedTab(tab),
  })),
  activeId,
});

export function IslandBar() {
  // The page that is on screen rather than the one being navigated to, as
  // `CodePage` reads it, so the toggle comes and goes with the diff it is for.
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  const route = shellRoute(pathname);
  const stripShown = useHeaderTabsFilled();
  const toggleShown = useShowsDiffStyleToggle(route);
  const windowTabs = useWindowTabs();
  const { strip, activeId, show, mint, close } = useWindowTabStrip();

  useEffect(() => {
    void shell.post({
      type: "windowTabs",
      strip: picture(strip, activeId),
    });
  }, [strip, activeId]);

  // The strip is read as each event lands rather than from the render that
  // subscribed: two presses can arrive before React has re-rendered for the
  // first.
  useEffect(
    () =>
      shell.subscribe((event) => {
        if (event.type !== "windowTabs") return;
        const showTab = (tab: WindowTab | null) => {
          if (tab !== null) show(tab);
        };
        switch (event.action.kind) {
          case "select":
            showTab(tabById(windowTabs, event.action.id));
            return;
          case "close":
            close(event.action.id);
            return;
          case "newSession":
            mint();
            return;
          case "closeActive":
            close(activeId);
            return;
          case "step":
            showTab(stepTab(strip, activeId, event.action.offset));
            return;
          case "session":
            showTab(sessionAtSlot(strip, event.action.slot));
            return;
        }
      }),
    [windowTabs, strip, activeId, show, mint, close]
  );

  return (
    <div
      // The 36px band every chrome row keeps, around 28px chips — but set
      // from the top rather than centred: the panel's 1pt ring (see
      // `IslandPanel`) is drawn over the band's first row, so centred chips
      // showed a hair less air above than below. Pinned at 4px they stand 3px
      // clear of the ring above and 3px clear of the rule below.
      //
      // Shown while it holds something — the strip the page says it has put
      // in the slot, or the toggle — and folded away otherwise. Said in React
      // rather than read off the DOM with `:has()` and `:empty`: the strip is
      // portalled in by the page, which mounts in either order with this, and
      // WebKit did not always re-evaluate the band's selector when the portal
      // appended into a subtree it was not drawing — the strip was in the
      // document, in a band still folded. See `header-tabs`.
      className={cn(
        "h-9 min-w-0 shrink-0 items-start gap-2 border-b border-hairline px-1 pt-1",
        stripShown || toggleShown ? "flex" : "hidden"
      )}
    >
      <div
        ref={setHeaderTabsSlot}
        className={cn(
          "min-w-0 flex-1 items-center gap-2",
          stripShown ? "flex" : "hidden"
        )}
      />
      {/* Centred on the chip row the strip stands on, so the toggle sits
          level with the tabs rather than on the band's top edge. */}
      {toggleShown && (
        <div className="ml-auto flex h-7 shrink-0 items-center gap-1">
          <HeaderDiffStyleToggle route={route} />
        </div>
      )}
    </div>
  );
}
