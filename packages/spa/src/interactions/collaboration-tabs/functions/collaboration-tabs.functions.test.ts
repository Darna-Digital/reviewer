import { describe, expect, it } from "vitest";
import { PROJECTS } from "@/interactions/collaboration/data/collaboration.mock";
import type {
  CollaborationTab,
  CollaborationTabsState,
} from "../interfaces/collaboration-tabs.interfaces";
import {
  closeTab,
  COLLABORATION_PATH,
  describeLocation,
  initialCollaborationTabs,
  INBOX_PATH,
  moveTab,
  openTab,
  selectTab,
  trackLocation,
  viewHref,
} from "./collaboration-tabs.functions";

const tab = (id: string): CollaborationTab => ({
  id,
  href: viewHref("project", "atlas"),
  title: id,
  kind: "project",
  subject: "atlas",
});

/** Compact view of a strip: `*` marks the active tab. */
const show = (state: CollaborationTabsState) =>
  state.tabs
    .map((t) => `${t.id === state.activeId ? "*" : ""}${t.id}`)
    .join(" ");

const strip = (ids: ReadonlyArray<string>, activeId: string) => ({
  tabs: ids.map(tab),
  activeId,
});

describe("describeLocation", () => {
  it("names a project after the project", () => {
    const project = PROJECTS[0];
    expect(
      describeLocation(COLLABORATION_PATH, { view: "project", id: project.id })
    ).toEqual({ kind: "project", subject: project.id, title: project.name });
  });

  it("reads the inbox off the path, which carries no view", () => {
    expect(describeLocation(INBOX_PATH, {})).toEqual({
      kind: "inbox",
      subject: "",
      title: "Inbox",
    });
  });

  it("falls back to the default surface for a bare collaboration url", () => {
    expect(describeLocation(COLLABORATION_PATH, {}).kind).toBe("project");
  });
});

describe("trackLocation", () => {
  it("re-points the active tab rather than opening another", () => {
    const next = trackLocation(
      strip(["a", "b"], "b"),
      INBOX_PATH,
      describeLocation(INBOX_PATH, {})
    );
    expect(show(next)).toBe("a *b");
    expect(next.tabs[1]).toMatchObject({ href: INBOX_PATH, kind: "inbox" });
  });

  it("is a no-op when the tab already points there", () => {
    const state = strip(["a"], "a");
    const place = { kind: "project", subject: "atlas", title: "a" } as const;
    expect(trackLocation(state, state.tabs[0].href, place)).toBe(state);
  });
});

describe("the strip", () => {
  it("opens with one tab on the default surface", () => {
    const state = initialCollaborationTabs("first");
    expect(show(state)).toBe("*first");
  });

  it("opens a tab next to the active one and goes to it", () => {
    const next = openTab(strip(["a", "b"], "a"), tab("c"));
    expect(show(next)).toBe("a *c b");
  });

  it("hands a closed tab's slot to its right-hand neighbour", () => {
    expect(show(closeTab(strip(["a", "b", "c"], "b"), "b"))).toBe("a *c");
  });

  it("keeps the last tab, so the strip is never empty", () => {
    const state = strip(["a"], "a");
    expect(closeTab(state, "a")).toBe(state);
  });

  it("leaves the active tab alone when another one closes", () => {
    expect(show(closeTab(strip(["a", "b"], "a"), "b"))).toBe("*a");
  });

  it("selects and reorders", () => {
    expect(show(selectTab(strip(["a", "b"], "a"), "b"))).toBe("a *b");
    expect(show(moveTab(strip(["a", "b", "c"], "a"), "c", 0))).toBe("c *a b");
  });
});
