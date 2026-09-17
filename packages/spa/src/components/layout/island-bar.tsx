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
 * `AppHeader` lends it: the page portals its `TabStrip` in, and the band folds
 * away while there is nothing in it.
 */
import { useEffect } from "react";
import { setHeaderTabsSlot } from "@/components/layout/header-tabs";
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
      ref={setHeaderTabsSlot}
      // The 36px band every chrome row keeps, around 28px chips.
      className="flex h-9 min-w-0 shrink-0 items-center gap-2 border-b border-hairline px-1 empty:hidden"
    />
  );
}
