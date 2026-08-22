import { describe, expect, it, vi } from "vitest";
import type {
  WindowTab,
  WindowTabsState,
} from "../interfaces/window-tabs.interfaces";
import {
  chatIdOf,
  closeTab,
  COLLABORATION_TAB_ID,
  initialWindowTabs,
  moveTab,
  nextModeTab,
  onSessionTab,
  openTab,
  PROJECT_TAB_ID,
  renameTab,
  selectTab,
  sessionAtSlot,
  SESSIONS_TAB_ID,
  tabTitle,
  trackLocation,
  withPinnedTabs,
} from "./window-tabs.functions";

// The transitions below are about the strip's shape, not about which features
// are switched on, so they are stated against the full set of pinned tabs.
vi.mock("@byconvo/feature-flags", () => ({ isFeatureEnabled: () => true }));

const session = (
  id: string,
  href = `/modes/agent-session/${id}`
): WindowTab => ({
  id,
  href,
  title: id,
  kind: "session",
});

/** Compact view of a strip: `*` marks the active tab. */
const show = (state: WindowTabsState) =>
  state.tabs
    .map((t) => `${t.id === state.activeId ? "*" : ""}${t.id}`)
    .join(" ")
    .replaceAll(PROJECT_TAB_ID, "code")
    .replaceAll(COLLABORATION_TAB_ID, "team")
    .replaceAll(SESSIONS_TAB_ID, "sessions");

/** The pinned tabs, then a session tab per id, with the last one active. */
const stripOf = (...ids: string[]): WindowTabsState => {
  let state = initialWindowTabs();
  for (const id of ids) state = openTab(state, session(id));
  return state;
};

describe("initialWindowTabs", () => {
  it("opens on the pinned tabs, showing Code", () => {
    expect(show(initialWindowTabs())).toBe("*code team sessions");
  });
});

describe("withPinnedTabs", () => {
  it("restores the pinned tabs ahead of the sessions they were saved with", () => {
    const saved = [
      session("a"),
      { ...initialWindowTabs().tabs[2], href: "/modes/agent-session/z" },
    ];
    const tabs = withPinnedTabs(saved);
    expect(tabs.map((t) => t.id)).toEqual([
      PROJECT_TAB_ID,
      COLLABORATION_TAB_ID,
      SESSIONS_TAB_ID,
      "a",
    ]);
    // Sessions is restored on the list, not on the conversation it was left on.
    expect(tabs[2].href).toBe("/modes/agent-session");
  });

  it("carries a strip saved before sessions moved to their own route", () => {
    const tabs = withPinnedTabs([
      { ...initialWindowTabs().tabs[2], href: "/modes/code/chats" },
      { id: "a", href: "/modes/code/chats/abc", title: "a", kind: "session" },
    ]);
    expect(tabs[2].href).toBe("/modes/agent-session");
    expect(tabs[3].href).toBe("/modes/agent-session/abc");
  });

  it("puts the pinned tabs back when the saved strip has none", () => {
    expect(withPinnedTabs([]).map((t) => t.id)).toEqual([
      PROJECT_TAB_ID,
      COLLABORATION_TAB_ID,
      SESSIONS_TAB_ID,
    ]);
  });
});

describe("onSessionTab", () => {
  it("is true only while a conversation has the window to itself", () => {
    expect(onSessionTab(initialWindowTabs())).toBe(false);
    const state = stripOf("a", "b");
    expect(onSessionTab(state)).toBe(true);
    // Back on the pinned Sessions tab the conversation is a pane beside the
    // list again, which is what the rail's buttons act on.
    expect(onSessionTab(selectTab(state, SESSIONS_TAB_ID))).toBe(false);
  });
});

describe("openTab", () => {
  it("opens next to the active tab and goes to it", () => {
    let state = stripOf("a", "b", "c");
    state = selectTab(state, "a");
    state = openTab(state, session("d"));
    expect(show(state)).toBe("code team sessions a *d b c");
  });

  it("never lands a session ahead of the pinned tabs", () => {
    const state = openTab(initialWindowTabs(), session("a"));
    expect(show(state)).toBe("code team sessions *a");
  });
});

describe("trackLocation", () => {
  it("hands the window to the tab that owns where it went", () => {
    const state = trackLocation(
      initialWindowTabs(),
      "/modes/code/review/pull/12",
      "/modes/code/review/pull/12"
    );
    expect(show(state)).toBe("*code team sessions");
    expect(state.tabs[0].href).toBe("/modes/code/review/pull/12");
  });

  it("takes the window into Sessions without taking it off the list", () => {
    const state = trackLocation(
      initialWindowTabs(),
      "/modes/agent-session/abc",
      "/modes/agent-session/abc"
    );
    expect(show(state)).toBe("code team *sessions");
    expect(state.tabs[2].href).toBe("/modes/agent-session");
  });

  it("keeps a session tab on its own conversation", () => {
    const state = trackLocation(
      stripOf("a"),
      "/modes/agent-session/abc",
      "/modes/agent-session/abc"
    );
    expect(show(state)).toBe("code team sessions *a");
    expect(state.tabs[3]).toMatchObject({
      href: "/modes/agent-session/abc",
      title: "a",
    });
  });

  it("leaving the chats hands a session tab back to Code", () => {
    const state = trackLocation(
      stripOf("a"),
      "/modes/code/review",
      "/modes/code/review"
    );
    expect(show(state)).toBe("*code team sessions a");
    expect(state.tabs[3].href).toBe("/modes/agent-session/a");
  });

  it("names the code tab after the surface it is on", () => {
    const state = trackLocation(
      initialWindowTabs(),
      "/modes/code/review/pull/12",
      "/modes/code/review/pull/12"
    );
    expect(state.tabs.map((t) => t.title)).toEqual([
      "Review",
      "Collaboration",
      "Sessions",
    ]);
  });

  it("hands collaboration to its own tab, named after where it lands", () => {
    const state = trackLocation(
      initialWindowTabs(),
      "/modes/collaboration/projects/p1",
      "/modes/collaboration/projects/p1"
    );
    expect(show(state)).toBe("code *team sessions");
    expect(state.tabs[1]).toMatchObject({
      href: "/modes/collaboration/projects/p1",
      title: "Collaboration",
    });
  });

  it("leaves the strip where it was while the prototype is on screen", () => {
    // A mode button remembers where it was left, so one trip to the old design
    // would otherwise leave Collaboration labelled after it and pointing there
    // — and ⌘G landing on the prototype rather than on the mode.
    const onCollaboration = trackLocation(
      initialWindowTabs(),
      "/modes/collaboration",
      "/modes/collaboration"
    );
    const after = trackLocation(
      onCollaboration,
      "/modes/experimentation/collaboration",
      "/modes/experimentation/collaboration"
    );
    expect(after).toBe(onCollaboration);
    expect(after.tabs[1]).toMatchObject({
      href: "/modes/collaboration",
      title: "Collaboration",
    });
  });

  it("leaves Sessions and its conversations under their own names", () => {
    const state = trackLocation(
      stripOf("a"),
      "/modes/agent-session/abc",
      "/modes/agent-session/abc"
    );
    expect(state.tabs.map((t) => t.title)).toEqual([
      "Review",
      "Collaboration",
      "Sessions",
      "a",
    ]);
  });

  it("is a no-op when the owning tab is already there", () => {
    const before = initialWindowTabs();
    expect(
      trackLocation(before, "/modes/code/review", "/modes/code/review")
    ).toBe(before);
  });
});

describe("renameTab", () => {
  it("takes the conversation's name", () => {
    const state = renameTab(stripOf("a"), "a", "Fix the parser");
    expect(state.tabs[3].title).toBe("Fix the parser");
  });

  it("is a no-op when the name has not moved", () => {
    const before = stripOf("a");
    expect(renameTab(before, "a", "a")).toBe(before);
    expect(renameTab(before, "missing", "x")).toBe(before);
  });
});

describe("closeTab", () => {
  it("hands the window to the right-hand neighbour", () => {
    let state = stripOf("a", "b", "c");
    state = selectTab(state, "b");
    expect(show(closeTab(state, "b"))).toBe("code team sessions a *c");
  });

  it("falls back to the left at the end of the strip", () => {
    const state = stripOf("a", "b", "c");
    expect(show(closeTab(state, "c"))).toBe("code team sessions a *b");
  });

  it("leaves the active tab alone when another closes", () => {
    const state = stripOf("a", "b", "c");
    expect(show(closeTab(state, "a"))).toBe("code team sessions b *c");
  });

  it("keeps the pinned tabs", () => {
    const state = stripOf("a");
    expect(closeTab(state, PROJECT_TAB_ID)).toBe(state);
    expect(closeTab(state, COLLABORATION_TAB_ID)).toBe(state);
    expect(closeTab(state, SESSIONS_TAB_ID)).toBe(state);
  });
});

describe("moveTab", () => {
  it("drops a tab at the index, sliding the rest out of its way", () => {
    const state = stripOf("a", "b", "c");
    expect(show(moveTab(state, "a", 5))).toBe("code team sessions b *c a");
    expect(show(moveTab(state, "c", 3))).toBe("code team sessions *c a b");
  });

  it("holds sessions behind the pinned tabs, which do not move", () => {
    const state = stripOf("a", "b");
    expect(show(moveTab(state, "b", 0))).toBe("code team sessions *b a");
    expect(moveTab(state, PROJECT_TAB_ID, 4)).toBe(state);
    expect(moveTab(state, COLLABORATION_TAB_ID, 4)).toBe(state);
  });

  it("clamps out-of-range targets and no-ops on a non-move", () => {
    const state = stripOf("a", "b", "c");
    expect(show(moveTab(state, "a", 99))).toBe("code team sessions b *c a");
    expect(moveTab(state, "b", 4)).toBe(state);
    expect(moveTab(state, "missing", 3)).toBe(state);
  });
});

describe("nextModeTab", () => {
  it("steps along the ways of working, wrapping round at the last", () => {
    const { tabs } = stripOf("a");
    expect(nextModeTab(tabs, PROJECT_TAB_ID)?.id).toBe(COLLABORATION_TAB_ID);
    expect(nextModeTab(tabs, COLLABORATION_TAB_ID)?.id).toBe(SESSIONS_TAB_ID);
    expect(nextModeTab(tabs, SESSIONS_TAB_ID)?.id).toBe(PROJECT_TAB_ID);
  });

  it("crosses to the first of them from a conversation, which is in neither", () => {
    expect(nextModeTab(stripOf("a").tabs, "a")?.id).toBe(PROJECT_TAB_ID);
    expect(nextModeTab(stripOf("a").tabs, null)?.id).toBe(PROJECT_TAB_ID);
  });

  it("has nowhere to cross to with one way of working", () => {
    const { tabs } = stripOf("a");
    const alone = tabs.filter((tab) => tab.id === PROJECT_TAB_ID);
    expect(nextModeTab(alone, PROJECT_TAB_ID)).toBeNull();
  });
});

describe("sessionAtSlot", () => {
  it("counts the sessions from 1, past the pinned tabs ahead of them", () => {
    const { tabs } = stripOf("a", "b");
    expect(sessionAtSlot(tabs, 1)?.id).toBe("a");
    expect(sessionAtSlot(tabs, 2)?.id).toBe("b");
  });

  it("has nothing at a slot past the last session", () => {
    expect(sessionAtSlot(stripOf("a").tabs, 2)).toBeNull();
    expect(sessionAtSlot(stripOf().tabs, 1)).toBeNull();
  });
});

describe("chatIdOf", () => {
  it("reads the conversation a session tab is showing", () => {
    expect(chatIdOf("/modes/agent-session/abc123")).toBe("abc123");
    expect(chatIdOf("/modes/agent-session?new=true")).toBeNull();
    expect(chatIdOf("/modes/code/review")).toBeNull();
  });
});

describe("tabTitle", () => {
  it("names the mode surface a location belongs to", () => {
    expect(tabTitle("/modes/code/browse/commit/abc123")).toBe("Project");
    expect(tabTitle("/modes/code/review/pull/12")).toBe("Review");
    expect(tabTitle("/modes/collaboration")).toBe("Collaboration");
    expect(tabTitle("/modes/experimentation/collaboration")).toBe(
      "Experimentation"
    );
    expect(tabTitle("/modes/experimentation/collaboration/inbox")).toBe(
      "Inbox"
    );
    expect(tabTitle("/settings")).toBe("Settings");
    expect(tabTitle("/somewhere-else")).toBe("Byconvo");
  });
});
