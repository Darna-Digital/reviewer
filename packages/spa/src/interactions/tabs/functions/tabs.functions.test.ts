import { describe, expect, it } from "vitest";
import type { TabsState } from "../interfaces/tabs.interfaces";
import {
  closeAll,
  closeOthers,
  closeTab,
  EMPTY_TABS,
  keepTab,
  moveTab,
  neighbourTab,
  openTab,
  orderTabs,
  pruneTabs,
  syncActive,
  tabToRestore,
  togglePin,
} from "./tabs.functions";

/** Compact view of a strip: `path` for permanent, `~path` preview, `!path` pinned. */
const show = (state: TabsState) =>
  orderTabs(state.tabs)
    .map(
      (tab) => `${tab.pinned ? "!" : ""}${tab.preview ? "~" : ""}${tab.path}`
    )
    .join(" ");

describe("openTab", () => {
  it("previews a single click in a reusable slot", () => {
    let state = openTab(EMPTY_TABS, "a");
    state = openTab(state, "b");
    state = openTab(state, "c");
    expect(show(state)).toBe("~c");
    expect(state.active).toBe("c");
  });

  it("keeps a file opened to stay", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    expect(show(state)).toBe("a b");
  });

  it("previews alongside the permanent tabs", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b");
    state = openTab(state, "c");
    expect(show(state)).toBe("a ~c");
  });

  it("selects a file that is already open instead of duplicating it", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = openTab(state, "a");
    expect(show(state)).toBe("a b");
    expect(state.active).toBe("a");
  });

  it("promotes a previewed file when it is opened to stay", () => {
    let state = openTab(EMPTY_TABS, "a");
    expect(show(state)).toBe("~a");
    state = openTab(state, "a", "permanent");
    expect(show(state)).toBe("a");
  });

  it("never lets the preview slot take a pinned tab", () => {
    let state = openTab(EMPTY_TABS, "a");
    state = togglePin(state, "a");
    state = openTab(state, "b");
    expect(show(state)).toBe("!a ~b");
  });
});

describe("orderTabs", () => {
  it("puts pinned tabs first, keeping insertion order within each group", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = openTab(state, "c", "permanent");
    state = togglePin(state, "c");
    expect(show(state)).toBe("!c a b");
  });

  it("puts an unpinned tab back where it was", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = openTab(state, "c", "permanent");
    state = togglePin(state, "c");
    state = togglePin(state, "c");
    expect(show(state)).toBe("a b c");
  });
});

describe("moveTab", () => {
  const three = () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = openTab(state, "c", "permanent");
    return state;
  };

  it("drops a tab where it was dragged", () => {
    expect(show(moveTab(three(), "c", 0))).toBe("c a b");
    expect(show(moveTab(three(), "a", 2))).toBe("b c a");
    expect(show(moveTab(three(), "a", 1))).toBe("b a c");
  });

  it("leaves the selection alone", () => {
    const state = moveTab({ ...three(), active: "a" }, "a", 2);
    expect(state.active).toBe("a");
  });

  it("clamps a drop past either end", () => {
    expect(show(moveTab(three(), "a", 9))).toBe("b c a");
    expect(show(moveTab(three(), "c", -1))).toBe("c a b");
  });

  it("reorders within the pinned group", () => {
    let state = three();
    state = togglePin(state, "b");
    state = togglePin(state, "c");
    expect(show(state)).toBe("!b !c a");
    expect(show(moveTab(state, "c", 0))).toBe("!c !b a");
  });

  it("keeps an unpinned tab out of the pinned ones", () => {
    let state = three();
    state = togglePin(state, "c");
    expect(show(state)).toBe("!c a b");
    expect(show(moveTab(state, "b", 0))).toBe("!c b a");
  });

  it("ignores a tab that is not open and a move that changes nothing", () => {
    const state = three();
    expect(moveTab(state, "zz", 0)).toBe(state);
    expect(moveTab(state, "b", 1)).toBe(state);
  });
});

describe("togglePin", () => {
  it("settles a preview tab, since it is now worth keeping", () => {
    let state = openTab(EMPTY_TABS, "a");
    state = togglePin(state, "a");
    expect(show(state)).toBe("!a");
    state = openTab(state, "b");
    expect(show(state)).toBe("!a ~b");
  });
});

describe("closeTab", () => {
  const three = () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = openTab(state, "c", "permanent");
    return state;
  };

  it("selects the tab after the one closed", () => {
    const state = closeTab({ ...three(), active: "b" }, "b");
    expect(state.active).toBe("c");
    expect(show(state)).toBe("a c");
  });

  it("falls back to the tab before when the last one closes", () => {
    const state = closeTab({ ...three(), active: "c" }, "c");
    expect(state.active).toBe("b");
  });

  it("leaves the selection alone when another tab closes", () => {
    const state = closeTab({ ...three(), active: "a" }, "c");
    expect(state.active).toBe("a");
  });

  it("empties out", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = closeTab(state, "a");
    expect(state).toEqual(EMPTY_TABS);
  });

  it("ignores a path that is not open", () => {
    const state = three();
    expect(closeTab(state, "zz")).toBe(state);
  });

  it("follows the strip's order, not insertion order", () => {
    // `c` is pinned, so it sits first; closing it lands on `a`, its neighbour
    // on screen.
    let state = togglePin(three(), "c");
    state = closeTab({ ...state, active: "c" }, "c");
    expect(state.active).toBe("a");
  });
});

describe("closeOthers", () => {
  it("keeps the named tab and every pinned one", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = openTab(state, "c", "permanent");
    state = togglePin(state, "a");
    expect(show(closeOthers(state, "b"))).toBe("!a b");
  });
});

describe("closeAll", () => {
  it("keeps the pinned tabs", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = togglePin(state, "a");
    const closed = closeAll({ ...state, active: "b" });
    expect(show(closed)).toBe("!a");
    expect(closed.active).toBe("a");
  });

  it("clears the selection when nothing is pinned", () => {
    const state = closeAll(openTab(EMPTY_TABS, "a", "permanent"));
    expect(state).toEqual(EMPTY_TABS);
  });
});

describe("keepTab", () => {
  it("promotes a preview tab, as an edit does", () => {
    const state = keepTab(openTab(EMPTY_TABS, "a"), "a");
    expect(show(state)).toBe("a");
  });
  it("does nothing to a tab that is already permanent", () => {
    const state = openTab(EMPTY_TABS, "a", "permanent");
    expect(keepTab(state, "a")).toBe(state);
  });
});

describe("neighbourTab", () => {
  const three = () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = openTab(state, "c", "permanent");
    return state;
  };
  it("steps forward and back", () => {
    expect(neighbourTab({ ...three(), active: "a" }, 1)).toBe("b");
    expect(neighbourTab({ ...three(), active: "b" }, -1)).toBe("a");
  });
  it("wraps at both ends", () => {
    expect(neighbourTab({ ...three(), active: "c" }, 1)).toBe("a");
    expect(neighbourTab({ ...three(), active: "a" }, -1)).toBe("c");
  });
  it("has nothing to step to in an empty strip", () => {
    expect(neighbourTab(EMPTY_TABS, 1)).toBeNull();
  });
});

describe("syncActive", () => {
  it("opens a file the rest of the app navigated to", () => {
    const state = syncActive(EMPTY_TABS, "a");
    expect(show(state)).toBe("~a");
    expect(state.active).toBe("a");
  });
  it("selects one that is already open without disturbing it", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    const synced = syncActive({ ...state, active: "b" }, "a");
    expect(show(synced)).toBe("a b");
    expect(synced.active).toBe("a");
  });
  it("clears the selection when the file view closes", () => {
    const state = syncActive(openTab(EMPTY_TABS, "a", "permanent"), null);
    expect(state.active).toBeNull();
    expect(show(state)).toBe("a");
  });
  it("is a no-op when nothing changed", () => {
    const state = openTab(EMPTY_TABS, "a", "permanent");
    expect(syncActive(state, "a")).toBe(state);
  });
});

describe("tabToRestore", () => {
  it("has nothing to restore from an empty strip", () => {
    expect(tabToRestore(EMPTY_TABS)).toBeNull();
  });
  it("restores the file that was in front", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    expect(tabToRestore(state)).toBe("b");
  });
  it("falls back to the head of the strip", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    expect(tabToRestore({ ...state, active: null })).toBe("a");
  });
  it("follows the strip's order rather than insertion order", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    state = togglePin(state, "b");
    expect(tabToRestore({ ...state, active: null })).toBe("b");
  });
});

describe("pruneTabs", () => {
  it("drops tabs whose file is gone and reselects", () => {
    let state = openTab(EMPTY_TABS, "a", "permanent");
    state = openTab(state, "b", "permanent");
    const pruned = pruneTabs({ ...state, active: "b" }, (path) => path === "a");
    expect(show(pruned)).toBe("a");
    expect(pruned.active).toBe("a");
  });
  it("is a no-op when every file still exists", () => {
    const state = openTab(EMPTY_TABS, "a", "permanent");
    expect(pruneTabs(state, () => true)).toBe(state);
  });
});
