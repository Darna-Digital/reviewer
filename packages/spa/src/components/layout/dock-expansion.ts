/**
 * Taking one of the dock's surfaces full-page, and putting it back down.
 *
 * The drawer's own button does both, and so does the rail, so the pair
 * lives here rather than in whichever of them needed it first — and with them the
 * one thing a dock page cannot work out for itself: which page it was expanded
 * from. Expanding is asked for while reading something, and that something is
 * where putting the surface down again belongs; a page reached any other way
 * was not expanded from anywhere, and falls back to browsing the project.
 *
 * A module variable rather than state: nothing renders differently for knowing
 * it, and the dock outlives every page it is asked about.
 */
import { BROWSE_HREF, dockPage } from "@/lib/shell-route";
import {
  type BottomTab,
  openBottomTab,
  readUiPrefs,
  setUiPrefs,
} from "@/lib/ui-prefs";

type Navigate = (options: { href: string }) => void;

let cameFrom = BROWSE_HREF;

/** Give `tab` the window, with `from` the page to hand it back to. */
export function expandDock(navigate: Navigate, tab: BottomTab, from: string) {
  cameFrom = from;
  navigate({ href: dockPage(tab).href });
}

/** Move between dock pages, staying full-page. */
export function showDockPage(navigate: Navigate, tab: BottomTab) {
  navigate({ href: dockPage(tab).href });
}

/**
 * Put the surface back in the drawer, on the page it came from. The drawer is
 * opened on that surface whether or not it was showing before: it is the thing
 * being looked at, and it has just been asked for a smaller window rather than
 * for its absence.
 */
export function restoreDock(navigate: Navigate, tab: BottomTab) {
  setUiPrefs({ bottomVisible: true, bottomTab: tab });
  navigate({ href: cameFrom });
}

/** Leaving a dock page for somewhere the surface is worth keeping beside. */
export function keepDockDrawer(tab: BottomTab) {
  setUiPrefs({ bottomVisible: true, bottomTab: tab });
}

/**
 * A rail button pressed: the surface it names, or with that surface already
 * up, the drawer put away — the click that opened it closes it. Once a surface
 * has the window to itself the buttons move between the pages rather than
 * dropping the window back into the drawer for every click; the one you are
 * already on is the click that puts it down. `expandedTab` is that surface,
 * or null while the dock is a drawer.
 */
export function pickDockTab(
  navigate: Navigate,
  tab: BottomTab,
  expandedTab: BottomTab | null
) {
  if (expandedTab === null) {
    const prefs = readUiPrefs();
    if (prefs.bottomVisible && prefs.bottomTab === tab) {
      setUiPrefs({ bottomVisible: false });
    } else {
      openBottomTab(tab);
    }
    return;
  }
  if (expandedTab === tab) restoreDock(navigate, tab);
  else showDockPage(navigate, tab);
}

