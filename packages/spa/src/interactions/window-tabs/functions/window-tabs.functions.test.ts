import { describe, expect, it } from "vitest";
import type { WindowTabsState } from "../interfaces/window-tabs.interfaces";
import {
  closeTab,
  initialWindowTabs,
  moveTab,
  openTab,
  selectTab,
  tabAtPosition,
  tabTitle,
  trackLocation,
} from "./window-tabs.functions";

const tab = (id: string, href = `/${id}`) => ({ id, href, title: id });

/** Compact view of a strip: `*` marks the active tab. */
const show = (state: WindowTabsState) =>
  state.tabs
    .map((t) => `${t.id === state.activeId ? "*" : ""}${t.id}`)
    .join(" ");

const stripOf = (...ids: string[]): WindowTabsState => {
  let state = initialWindowTabs(tab(ids[0] ?? ""));
  for (const id of ids.slice(1)) state = openTab(state, tab(id));
  return state;
};

describe("openTab", () => {
  it("opens next to the active tab and goes to it", () => {
    let state = stripOf("a", "b", "c");
    state = selectTab(state, "a");
    state = openTab(state, tab("d"));
    expect(show(state)).toBe("a *d b c");
  });
});

describe("trackLocation", () => {
  it("moves only the active tab", () => {
    const state = trackLocation(stripOf("a", "b"), "/moved", "Moved");
    expect(state.tabs.map((t) => t.href)).toEqual(["/a", "/moved"]);
  });

  it("is a no-op when the active tab is already there", () => {
    const before = stripOf("a");
    expect(trackLocation(before, "/a", "a")).toBe(before);
  });
});

describe("closeTab", () => {
  it("hands the window to the right-hand neighbour", () => {
    let state = stripOf("a", "b", "c");
    state = selectTab(state, "b");
    expect(show(closeTab(state, "b"))).toBe("a *c");
  });

  it("falls back to the left at the end of the strip", () => {
    const state = stripOf("a", "b", "c");
    expect(show(closeTab(state, "c"))).toBe("a *b");
  });

  it("leaves the active tab alone when another closes", () => {
    const state = stripOf("a", "b", "c");
    expect(show(closeTab(state, "a"))).toBe("b *c");
  });

  it("keeps the last tab, since the window still shows something", () => {
    const state = stripOf("a");
    expect(closeTab(state, "a")).toBe(state);
  });
});

describe("moveTab", () => {
  it("drops a tab at the index, sliding the rest out of its way", () => {
    const state = stripOf("a", "b", "c");
    expect(show(moveTab(state, "a", 2))).toBe("b *c a");
    expect(show(moveTab(state, "c", 0))).toBe("*c a b");
  });

  it("leaves which tab is active alone", () => {
    const state = stripOf("a", "b", "c");
    expect(moveTab(state, "a", 2).activeId).toBe(state.activeId);
  });

  it("clamps out-of-range targets and no-ops on a non-move", () => {
    const state = stripOf("a", "b", "c");
    expect(show(moveTab(state, "a", 99))).toBe("b *c a");
    expect(moveTab(state, "b", 1)).toBe(state);
    expect(moveTab(state, "missing", 0)).toBe(state);
  });
});

describe("tabAtPosition", () => {
  it("counts 1-8 from the left and sends 9 to the last tab", () => {
    const { tabs } = stripOf("a", "b", "c", "d");
    expect(tabAtPosition(tabs, 1)?.id).toBe("a");
    expect(tabAtPosition(tabs, 3)?.id).toBe("c");
    expect(tabAtPosition(tabs, 9)?.id).toBe("d");
  });

  it("has nothing at a position past the end", () => {
    const { tabs } = stripOf("a", "b");
    expect(tabAtPosition(tabs, 5)).toBeNull();
  });
});

describe("tabTitle", () => {
  it("names the mode surface a location belongs to", () => {
    expect(tabTitle("/modes/code/browse/commit/abc123")).toBe("Project");
    expect(tabTitle("/modes/collaboration")).toBe("Collaboration");
    expect(tabTitle("/settings")).toBe("Settings");
    expect(tabTitle("/somewhere-else")).toBe("Byconvo");
  });
});
